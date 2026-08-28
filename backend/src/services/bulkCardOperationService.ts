import { Knex } from 'knex';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { IdCardService } from './idCardService.js';

/**
 * Bulk Card Operation Service
 * Phase 2.1: Identity Management Module
 * 
 * Handles batch card generation with asynchronous processing, progress tracking,
 * error resilience, and multi-card PDF generation. Enforces concurrency limits
 * and provides comprehensive reporting.
 */

export interface BulkCardRequest {
  tenantId: string;
  userIds?: string[];  // Explicit list
  filters?: BulkFilterCriteria;  // Or filter criteria
  templateId?: string;
  format: 'pvc' | 'badge';
  expirationDate?: string;  // Optional ISO date; defaults to 1 year per card
  requestedBy: string;
}

export interface BulkFilterCriteria {
  classId?: string;
  departmentId?: string;
  role?: string;
  customQuery?: Record<string, any>;
}

export interface BulkJobResult {
  jobId: string;
  estimatedCardCount: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export interface BulkJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalCards: number;
  processedCards: number;
  successfulCards: number;
  failedCards: number;
  progress: number;  // 0-100
  pdfUrl?: string;  // Available when completed
  startedAt?: Date;
  completedAt?: Date;
}

export interface BulkJobReport {
  jobId: string;
  totalRequested: number;
  successful: SuccessEntry[];
  failed: FailureEntry[];
  pdfUrl: string;
  generatedAt: Date;
}

export interface SuccessEntry {
  userId: string;
  userName: string;
  cardId: string;
  cardNumber: string;
}

export interface FailureEntry {
  userId: string;
  userName?: string;
  errorCode: string;
  errorMessage: string;
}

export class BulkCardOperationService {
  private readonly MAX_CONCURRENT_JOBS_PER_TENANT = 3;
  private idCardService: IdCardService;

  constructor(private db: Knex) {
    this.idCardService = new IdCardService(db);
  }

  /**
   * Create a bulk card generation job
   * Requirements: 5.1, 5.2, 5.6, 5.8
   */
  async createBulkJob(request: BulkCardRequest): Promise<BulkJobResult> {
    try {
      // Check concurrency limit
      const activeJobs = await this.db('bulk_card_jobs')
        .where({ tenant_id: request.tenantId })
        .whereIn('status', ['queued', 'processing'])
        .count('* as count')
        .first();

      if (Number(activeJobs?.count || 0) >= this.MAX_CONCURRENT_JOBS_PER_TENANT) {
        throw new Error(
          `Maximum ${this.MAX_CONCURRENT_JOBS_PER_TENANT} concurrent bulk jobs per tenant exceeded`
        );
      }

      // Resolve user IDs from filters or use provided list
      let userIds: string[];
      if (request.userIds) {
        userIds = request.userIds;
      } else if (request.filters) {
        userIds = await this.resolveUserIdsFromFilters(
          request.tenantId,
          request.filters
        );
      } else {
        throw new Error('Either userIds or filters must be provided');
      }

      // Validate members exist and are active. A member id may reference the
      // users table (staff/teachers) OR the students table (student-only
      // records without a linked user). Both are valid targets for card
      // generation, so accept an id present in either table for this tenant.
      const validUsers = await this.db('users')
        .where({ tenant_id: request.tenantId })
        .whereIn('id', userIds)
        .where({ status: 'active' })
        .select('id');

      const validStudents = await this.db('students')
        .where({ tenant_id: request.tenantId })
        .whereIn('id', userIds)
        .where({ status: 'active' })
        .select('id');

      const validIdSet = new Set<string>([
        ...validUsers.map((u: any) => u.id),
        ...validStudents.map((s: any) => s.id),
      ]);

      const validUserIds = userIds.filter((id) => validIdSet.has(id));
      const invalidCount = userIds.length - validUserIds.length;

      if (validUserIds.length === 0) {
        throw new Error('No active members found for the selected targets.');
      }

      if (invalidCount > 0) {
        logger.warn(
          `Bulk job skipping ${invalidCount} member(s) not found or inactive`,
          { tenantId: request.tenantId }
        );
      }

      // Create job record
      const [job] = await this.db('bulk_card_jobs')
        .insert({
          tenant_id: request.tenantId,
          status: 'queued',
          total_cards: validUserIds.length,
          processed_cards: 0,
          successful_cards: 0,
          failed_cards: 0,
          // request_params is a jsonb column — pass a plain object. Knex/pg
          // serializes it correctly; stringifying here caused double-encoding.
          request_params: JSON.stringify({
            userIds: validUserIds,
            templateId: request.templateId ?? null,
            format: request.format,
            expirationDate: request.expirationDate ?? null,
          }),
          requested_by: request.requestedBy,
          created_at: new Date(),
        })
        .returning('*');

      logger.info(`Created bulk job ${job.id} for ${validUserIds.length} cards`, {
        tenantId: request.tenantId,
        requestedBy: request.requestedBy,
      });

      // Always process in the background (non-blocking) so the API responds
      // immediately with a queued job and the client can poll for progress.
      // Errors inside processBulkJob are captured and reflected in job status.
      setImmediate(() => {
        this.processBulkJob(job.id).catch((err) =>
          logger.error(`Unhandled error processing bulk job ${job.id}`, { err })
        );
      });

      return {
        jobId: job.id,
        estimatedCardCount: validUserIds.length,
        status: job.status,
        createdAt: new Date(job.created_at),
      };
    } catch (error) {
      logger.error('Failed to create bulk job', { request, error });
      throw error;
    }
  }

  /**
   * Process a bulk job
   * Requirements: 5.3, 5.4, 5.5
   */
  private async processBulkJob(jobId: string): Promise<void> {
    try {
      // Update status to processing
      await this.db('bulk_card_jobs')
        .where({ id: jobId })
        .update({
          status: 'processing',
          started_at: new Date(),
        });

      // Get job details
      const job = await this.db('bulk_card_jobs')
        .where({ id: jobId })
        .first();

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // request_params is jsonb. Depending on how it was stored (object vs
      // stringified), pg may return an object OR a JSON string (or even a
      // double-encoded string). Normalise defensively.
      let params: any = job.request_params;
      if (typeof params === 'string') {
        params = JSON.parse(params);
        if (typeof params === 'string') params = JSON.parse(params);
      }
      const userIds: string[] = params.userIds || [];

      if (userIds.length === 0) {
        throw new Error('Bulk job has no target members to process');
      }

      // Process each user
      let successCount = 0;
      let failCount = 0;

      for (const userId of userIds) {
        try {
          // Generate card
          const result = await this.idCardService.generateCard(
            userId,
            job.tenant_id,
            {
              templateId: params.templateId,
              format: params.format,
              issuedBy: job.requested_by,
              expirationDate: params.expirationDate ? new Date(params.expirationDate) : undefined,
            }
          );

          // Record success (best-effort — a logging failure must not abort the job)
          await this.db('bulk_card_results').insert({
            job_id: jobId,
            user_id: userId,
            card_id: result.cardId,
            status: 'success',
            processed_at: new Date(),
          }).catch((e) => logger.warn(`Could not record success for ${userId}`, { e }));

          successCount++;
        } catch (error: any) {
          // Record failure (best-effort)
          await this.db('bulk_card_results').insert({
            job_id: jobId,
            user_id: userId,
            status: 'failed',
            error_code: String(error.code || 'GENERATION_ERROR').slice(0, 100),
            error_message: String(error.message || 'Unknown error').slice(0, 500),
            processed_at: new Date(),
          }).catch((e) => logger.warn(`Could not record failure for ${userId}`, { e }));

          failCount++;
          logger.error(`Failed to generate card for user ${userId} in job ${jobId}`, {
            message: error?.message,
          });
        }

        // Update progress (best-effort)
        await this.db('bulk_card_jobs')
          .where({ id: jobId })
          .update({
            processed_cards: successCount + failCount,
            successful_cards: successCount,
            failed_cards: failCount,
          }).catch(() => {});
      }

      // Generate combined PDF if there are successful cards
      let pdfUrl: string | undefined;
      if (successCount > 0) {
        pdfUrl = await this.generateCombinedPDF(jobId);
      }

      // Mark job as completed
      await this.db('bulk_card_jobs')
        .where({ id: jobId })
        .update({
          status: 'completed',
          pdf_url: pdfUrl,
          completed_at: new Date(),
        });

      logger.info(`Completed bulk job ${jobId}`, {
        total: userIds.length,
        successful: successCount,
        failed: failCount,
      });
    } catch (error) {
      // Mark job as failed
      await this.db('bulk_card_jobs')
        .where({ id: jobId })
        .update({
          status: 'failed',
          completed_at: new Date(),
        });

      logger.error(`Bulk job ${jobId} failed`, { error });
    }
  }

  /**
   * Get bulk job status
   */
  async getBulkJobStatus(jobId: string): Promise<BulkJobStatus> {
    try {
      const job = await this.db('bulk_card_jobs')
        .where({ id: jobId })
        .first();

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const progress = job.total_cards > 0
        ? Math.round((job.processed_cards / job.total_cards) * 100)
        : 0;

      return {
        jobId: job.id,
        status: job.status,
        totalCards: job.total_cards,
        processedCards: job.processed_cards,
        successfulCards: job.successful_cards,
        failedCards: job.failed_cards,
        progress,
        pdfUrl: job.pdf_url,
        startedAt: job.started_at ? new Date(job.started_at) : undefined,
        completedAt: job.completed_at ? new Date(job.completed_at) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get job status', { jobId, error });
      throw error;
    }
  }

  /**
   * Cancel a bulk job
   */
  async cancelBulkJob(jobId: string): Promise<void> {
    try {
      const job = await this.db('bulk_card_jobs')
        .where({ id: jobId })
        .first();

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (!['queued', 'processing'].includes(job.status)) {
        throw new Error(`Cannot cancel job with status ${job.status}`);
      }

      await this.db('bulk_card_jobs')
        .where({ id: jobId })
        .update({
          status: 'cancelled',
          completed_at: new Date(),
        });

      logger.info(`Cancelled bulk job ${jobId}`);
    } catch (error) {
      logger.error('Failed to cancel job', { jobId, error });
      throw error;
    }
  }

  /**
   * Get bulk job report
   * Requirements: 5.7
   */
  async getBulkJobReport(jobId: string): Promise<BulkJobReport> {
    try {
      const job = await this.db('bulk_card_jobs')
        .where({ id: jobId })
        .first();

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      // Get all results. A member id can reference users OR students, so use
      // LEFT joins to both and coalesce the name (never drop a result row).
      const results = await this.db('bulk_card_results')
        .where({ job_id: jobId })
        .leftJoin('users', 'bulk_card_results.user_id', 'users.id')
        .leftJoin('students', 'bulk_card_results.user_id', 'students.id')
        .select(
          'bulk_card_results.*',
          this.db.raw("COALESCE(users.first_name, students.first_name, '') as first_name"),
          this.db.raw("COALESCE(users.last_name, students.last_name, '') as last_name")
        );

      const successful: SuccessEntry[] = [];
      const failed: FailureEntry[] = [];

      for (const result of results) {
        const userName = `${result.first_name} ${result.last_name}`.trim() || 'Unknown';

        if (result.status === 'success') {
          // Get card details
          const card = await this.db('id_cards')
            .where({ id: result.card_id })
            .first();

          successful.push({
            userId: result.user_id,
            userName,
            cardId: result.card_id,
            cardNumber: card?.card_number || 'N/A',
          });
        } else {
          failed.push({
            userId: result.user_id,
            userName,
            errorCode: result.error_code,
            errorMessage: result.error_message,
          });
        }
      }

      return {
        jobId,
        totalRequested: job.total_cards,
        successful,
        failed,
        pdfUrl: job.pdf_url || '',
        generatedAt: new Date(job.completed_at || job.created_at),
      };
    } catch (error) {
      logger.error('Failed to get job report', { jobId, error });
      throw error;
    }
  }

  /**
   * Resolve user IDs from filter criteria
   * Requirements: 5.6
   */
  private async resolveUserIdsFromFilters(
    tenantId: string,
    filters: BulkFilterCriteria
  ): Promise<string[]> {
    try {
      let query = this.db('users')
        .where({ tenant_id: tenantId, status: 'active' });

      if (filters.role) {
        query = query.where({ role: filters.role });
      }

      if (filters.classId) {
        // Join with enrollments to get students in a specific class
        query = query
          .join('students', 'users.id', 'students.user_id')
          .join('enrollments', 'students.id', 'enrollments.student_id')
          .where('enrollments.class_id', filters.classId)
          .where('enrollments.status', 'active');
      }

      if (filters.departmentId) {
        // Join with teachers to get teachers in a specific department.
        // The teachers table stores department as a string column.
        query = query
          .join('teachers', 'users.id', 'teachers.user_id')
          .where('teachers.department', filters.departmentId);
      }

      const users = await query.select('users.id');
      return users.map((u: any) => u.id);
    } catch (error) {
      logger.error('Failed to resolve user IDs from filters', { tenantId, filters, error });
      throw error;
    }
  }

  /**
   * Generate combined PDF with multiple cards
   * Requirements: 5.4, 11.3
   */
  private async generateCombinedPDF(jobId: string): Promise<string | undefined> {
    try {
      const job = await this.db('bulk_card_jobs').where({ id: jobId }).first();
      if (!job) throw new Error(`Job ${jobId} not found`);
      const tenantId = job.tenant_id;

      // Collect the stored PDF paths for every successfully generated card.
      const successResults = await this.db('bulk_card_results')
        .where({ job_id: jobId, status: 'success' })
        .whereNotNull('card_id')
        .select('card_id');

      const cardIds = successResults.map((r: any) => r.card_id);
      if (cardIds.length === 0) return undefined;

      const cards = await this.db('id_cards')
        .whereIn('id', cardIds)
        .select('id', 'pdf_url');

      const storageRoot = process.env.LOCAL_STORAGE_PATH || './storage';

      // Merge every card PDF into a single document (all pages preserved).
      const merged = await PDFDocument.create();
      let mergedCount = 0;

      for (const card of cards) {
        try {
          if (!card.pdf_url) continue;
          // pdf_url looks like /storage/uploads/cards/<tenant>/<cardId>.pdf
          const relative = String(card.pdf_url).replace(/^\/storage\//, '');
          const filePath = path.join(storageRoot, relative);

          const bytes = await fs.readFile(filePath).catch(() => null);
          if (!bytes) {
            logger.warn(`Combined PDF: missing card file for ${card.id}`, { filePath });
            continue;
          }

          const src = await PDFDocument.load(bytes);
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
          mergedCount++;
        } catch (cardErr) {
          logger.warn(`Combined PDF: failed to append card ${card.id}`, { cardErr });
        }
      }

      if (mergedCount === 0) return undefined;

      const mergedBytes = await merged.save();

      // Persist alongside other tenant card assets and expose via /storage.
      const targetDir = path.join(storageRoot, 'uploads', 'bulk', tenantId);
      await fs.mkdir(targetDir, { recursive: true });
      const filePath = path.join(targetDir, `${jobId}.pdf`);
      await fs.writeFile(filePath, Buffer.from(mergedBytes));

      const pdfUrl = `/storage/uploads/bulk/${tenantId}/${jobId}.pdf`;
      logger.info(`Generated combined PDF for job ${jobId} (${mergedCount} cards)`, { pdfUrl });
      return pdfUrl;
    } catch (error) {
      logger.error('Failed to generate combined PDF', { jobId, error });
      // Non-fatal: the job still completes; the combined download just won't exist.
      return undefined;
    }
  }
}
