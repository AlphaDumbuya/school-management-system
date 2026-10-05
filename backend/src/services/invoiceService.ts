import { Knex } from 'knex';
import crypto from 'crypto';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';
import { AuditService } from './auditService';

export interface InvoiceData {
  studentId: string;
  feeIds: string[];
  dueDate?: string;
  notes?: string;
}

export interface InvoiceFilter {
  studentId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  classId?: string;
}

export class InvoiceService {
  private auditService: AuditService;

  constructor(private db: Knex) {
    this.auditService = new AuditService(db);
  }

  /**
   * Generate invoice from fees
   */
  async generateInvoice(data: InvoiceData, userId: string): Promise<any> {
    try {
      logger.info(`Generating invoice for student ${data.studentId}`);

      // Validate student exists
      // studentId is a students.id (the route checks it against the tenant);
      // looking it up in users made every real call fail with "not found".
      const student = await this.db('students').where('id', data.studentId).first();

      if (!student) {
        throw new Error(`Student ${data.studentId} not found`);
      }

      // Get all fees and calculate totals
      // Only open fees not already on a live invoice (no double counting).
      let fees = await this.db('fees')
        .whereIn('id', data.feeIds)
        .where('student_id', data.studentId)
        .whereNotIn('status', ['deleted', 'paid'])
        .whereNotExists(function (this: any) {
          this.select('*').from('invoice_items as ii')
            .join('invoices as iv', 'iv.id', 'ii.invoice_id')
            .whereRaw('ii.fee_id::text = fees.id::text')
            .whereNot('iv.status', 'cancelled');
        });

      if (fees.length === 0) {
        throw new Error('No fees found for invoice');
      }

      const r2 = (n: number) => Math.round(n * 100) / 100;
      const totalAmount = r2(fees.reduce((sum: number, fee: any) => sum + (Number(fee.amount) || 0), 0));
      const totalBalance = r2(fees.reduce((sum: number, fee: any) => sum + (Number(fee.balance) || 0), 0));
      const totalPaid = totalAmount - totalBalance;

      // invoices.id is a UUID column; invoice_number is the human-readable ref.
      const invoiceId = crypto.randomUUID();
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const invoice = {
        id: invoiceId,
        tenant_id: student.tenant_id,
        academic_year: fees[0]?.academic_year || null,
        student_id: data.studentId,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        total_paid: totalPaid,
        balance: totalBalance,
        status: totalBalance === 0 ? 'paid' : 'pending',
        due_date: new Date(data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        notes: data.notes || null,
        generated_by: userId,
        generated_at: new Date(),
        created_at: new Date(),
      };

      await this.db('invoices').insert(invoice);

      // Link invoice to fees (invoice_items.id + invoice_id reference the UUID).
      for (const feeId of fees.map((f: any) => f.id)) {
        await this.db('invoice_items').insert({
          id: crypto.randomUUID(),
          invoice_id: invoiceId,
          fee_id: feeId,
          created_at: new Date(),
        });
      }

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'create',
        performedBy: userId,
        details: {
          studentId: data.studentId,
          feeCount: data.feeIds.length,
          totalAmount,
        },
        timestamp: new Date(),
      });

      logger.info(`Invoice ${invoiceNumber} generated successfully`);
      return invoice;
    } catch (error) {
      logger.error(`Error generating invoice: ${error}`);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string, tenantId?: string): Promise<any> {
    try {
      const invoice = await this.db('invoices')
        .where('id', invoiceId)
        // Tenant scoping (when provided) prevents cross-tenant invoice access.
        .modify((q: any) => { if (tenantId) q.where('tenant_id', tenantId); })
        .first();

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      // Get invoice items
      const items = await this.db('invoice_items')
        .where('invoice_id', invoiceId)
        .leftJoin('fees', 'invoice_items.fee_id', 'fees.id')
        .select('fees.*', 'invoice_items.id as item_id');

      return {
        ...invoice,
        items,
      };
    } catch (error) {
      logger.error(`Error fetching invoice: ${error}`);
      throw error;
    }
  }

  /**
   * Get student invoices
   */
  async getStudentInvoices(studentId: string, filters?: InvoiceFilter, tenantId?: string): Promise<any[]> {
    try {
      logger.info(`Fetching invoices for student ${studentId}`);

      let query = this.db('invoices').where('student_id', studentId);
      if (tenantId) query = query.where('tenant_id', tenantId);

      if (filters?.status) {
        query = query.where('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.where('generated_at', '>=', new Date(filters.startDate));
      }

      if (filters?.endDate) {
        query = query.where('generated_at', '<=', new Date(filters.endDate));
      }

      const invoices = await query.orderBy('generated_at', 'desc');

      return invoices;
    } catch (error) {
      logger.error(`Error fetching student invoices: ${error}`);
      throw error;
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(invoiceId: string, status: string, userId: string, tenantId?: string): Promise<any> {
    try {
      logger.info(`Updating invoice ${invoiceId} status to ${status}`);

      // getInvoiceById enforces the tenant — a cross-tenant id throws "not found".
      const invoice = await this.getInvoiceById(invoiceId, tenantId);

      await this.db('invoices')
        .where('id', invoiceId)
        .modify((q: any) => { if (tenantId) q.where('tenant_id', tenantId); })
        .update({
          status,
          updated_at: new Date(),
        });

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'update_status',
        performedBy: userId,
        details: {
          from: invoice.status,
          to: status,
        },
        timestamp: new Date(),
      });

      return { id: invoiceId, status };
    } catch (error) {
      logger.error(`Error updating invoice status: ${error}`);
      throw error;
    }
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStatistics(filters?: InvoiceFilter, tenantId?: string): Promise<any> {
    try {
      logger.info('Calculating invoice statistics');

      let query = this.db('invoices');

      // Tenant scoping so invoice aggregates never span schools.
      if (tenantId) query = query.where('tenant_id', tenantId);

      if (filters?.startDate) {
        query = query.where('generated_at', '>=', new Date(filters.startDate));
      }

      if (filters?.endDate) {
        query = query.where('generated_at', '<=', new Date(filters.endDate));
      }

      const stats = await query
        .select(
          this.db.raw('COUNT(*) as total_invoices'),
          this.db.raw('SUM(total_amount) as total_amount_invoiced'),
          this.db.raw('SUM(total_paid) as total_amount_paid'),
          this.db.raw('SUM(balance) as total_outstanding'),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as paid_invoices', ['paid']),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as pending_invoices', ['pending']),
          this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as overdue_invoices', ['overdue']),
          this.db.raw('AVG(total_amount) as average_invoice_amount')
        )
        .first();

      return stats;
    } catch (error) {
      logger.error(`Error calculating invoice statistics: ${error}`);
      throw error;
    }
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(tenantId?: string): Promise<any[]> {
    try {
      const today = new Date();

      const invoices = await this.db('invoices')
        .where('invoices.due_date', '<', today)
        .whereNot('invoices.status', 'paid')
        .modify((q: any) => { if (tenantId) q.where('invoices.tenant_id', tenantId); })
        // student_id references the students table (not users). Pull the name
        // from there so student_name/email are actually populated.
        .leftJoin('students', 'invoices.student_id', 'students.id')
        .select(
          'invoices.*',
          this.db.raw("CONCAT_WS(' ', students.first_name, students.last_name) as student_name"),
          'students.email as student_email'
        )
        .orderBy('invoices.due_date', 'asc');

      return invoices;
    } catch (error) {
      logger.error(`Error fetching overdue invoices: ${error}`);
      throw error;
    }
  }

  /**
   * Send invoice reminder
   */
  async sendInvoiceReminder(invoiceId: string, userId: string, tenantId?: string): Promise<any> {
    try {
      logger.info(`Sending reminder for invoice ${invoiceId}`);

      const invoice = await this.getInvoiceById(invoiceId, tenantId);

      // Tenant isolation: reject sending a reminder for an invoice that doesn't
      // belong to the caller's school (prevents cross-tenant data/email leakage).
      if (tenantId) {
        const owner = await this.db('students').where('id', invoice.student_id).first().catch(() => null);
        const invoiceTenant = invoice.tenant_id || owner?.tenant_id;
        if (invoiceTenant && invoiceTenant !== tenantId) {
          throw new AppError('Invoice not in your school', 403, 'FORBIDDEN');
        }
      }

      // Resolve the student and the best contact email (guardian first).
      const studentRow = await this.db('students')
        .where('id', invoice.student_id)
        .first()
        .catch(() => null);
      const studentUser = await this.db('users')
        .where('id', invoice.student_id)
        .first()
        .catch(() => null);

      const studentName = studentRow
        ? [studentRow.first_name, studentRow.last_name].filter(Boolean).join(' ')
        : studentUser
        ? [studentUser.first_name, studentUser.last_name].filter(Boolean).join(' ')
        : 'Student';

      let recipientEmail: string | null =
        studentRow?.email || studentUser?.email || null;
      let recipientName = studentName;

      // Prefer a linked active guardian's email.
      const guardianLink = await this.db('student_guardians')
        .where({ student_id: invoice.student_id, status: 'active' })
        .first()
        .catch(() => null);
      if (guardianLink?.guardian_id) {
        const guardian = await this.db('users')
          .where({ id: guardianLink.guardian_id })
          .first()
          .catch(() => null);
        if (guardian?.email) {
          recipientEmail = guardian.email;
          recipientName = [guardian.first_name, guardian.last_name].filter(Boolean).join(' ') || recipientName;
        }
      }

      const balance = Number(invoice.balance ?? invoice.total_amount ?? 0);
      const overdue = invoice.due_date ? new Date(invoice.due_date) < new Date() : false;

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'invoice',
        entityId: invoiceId,
        action: 'send_reminder',
        performedBy: userId,
        details: {
          studentEmail: recipientEmail,
          invoiceAmount: invoice.total_amount,
        },
        timestamp: new Date(),
      });

      // Send the branded fee reminder email (best-effort).
      let emailSent = false;
      if (recipientEmail) {
        try {
          const { default: emailService } = await import('./emailService');
          await emailService.sendFeeReminderEmail(invoice.tenant_id, recipientEmail, {
            guardianName: recipientName,
            studentName,
            amountDue: balance,
            currency: 'Le',
            dueDate: invoice.due_date,
            overdue,
            feeName: invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : undefined,
          });
          emailSent = true;
        } catch (mailErr) {
          logger.warn(`Fee reminder email failed for invoice ${invoiceId}: ${mailErr}`);
        }
      }

      return {
        success: true,
        message: emailSent
          ? `Reminder email sent for invoice ${invoiceId}`
          : `Reminder logged for invoice ${invoiceId} (no email on file)`,
        studentEmail: recipientEmail,
        emailSent,
      };
    } catch (error) {
      logger.error(`Error sending invoice reminder: ${error}`);
      throw error;
    }
  }

  /**
   * Export invoice as data
   */
  async exportInvoiceData(invoiceId: string): Promise<any> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);

      const student = await this.db('users')
        .where('id', invoice.student_id)
        .first();

      return {
        invoice: invoice,
        student: student,
        exportDate: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Error exporting invoice: ${error}`);
      throw error;
    }
  }

  /**
   * Bulk generate invoices
   */
  async bulkGenerateInvoices(classId: string, feeType: string, userId: string): Promise<any> {
    try {
      logger.info(`Bulk generating invoices for class ${classId}`);

      // Get all students in class
      const enrollments = await this.db('enrollments')
        .where('class_id', classId)
        .where('status', 'active')
        .distinct('student_id');

      const results = {
        created: 0,
        failed: 0,
        invoiceIds: [] as string[],
        errors: [] as string[],
      };

      for (const enrollment of enrollments) {
        try {
          // Get fees for this student
          const fees = await this.db('fees')
            .where('student_id', enrollment.student_id)
            .where('type', feeType)
            .whereNotIn('status', ['paid', 'deleted'])
            .whereNotExists(function (this: any) {
              this.select('*').from('invoice_items as ii')
                .join('invoices as iv', 'iv.id', 'ii.invoice_id')
                .whereRaw('ii.fee_id::text = fees.id::text')
                .whereNot('iv.status', 'cancelled');
            })
            .select('id');

          if (fees.length > 0) {
            const feeIds = fees.map((f: any) => f.id);
            const invoice = await this.generateInvoice(
              {
                studentId: enrollment.student_id,
                feeIds,
              },
              userId
            );
            results.created++;
            results.invoiceIds.push(invoice.id);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed for student ${enrollment.student_id}: ${error}`);
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error bulk generating invoices: ${error}`);
      throw error;
    }
  }

  /**
   * Get invoice summary
   */
  async getInvoiceSummary(invoiceId: string, tenantId?: string): Promise<any> {
    try {
      const invoice = await this.getInvoiceById(invoiceId, tenantId);

      const summary = {
        invoiceNumber: invoice.invoice_number,
        student: await this.db('students').where('id', invoice.student_id).first(),
        items: invoice.items,
        totalAmount: invoice.total_amount,
        totalPaid: invoice.total_paid,
        balance: invoice.balance,
        status: invoice.status,
        dueDate: invoice.due_date,
        generatedDate: invoice.generated_at,
      };

      return summary;
    } catch (error) {
      logger.error(`Error generating invoice summary: ${error}`);
      throw error;
    }
  }
}
