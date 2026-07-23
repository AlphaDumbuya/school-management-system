/**
 * Behavioral Note Service
 * Phase 2.3 - Discipline & Conduct Module
 * Teacher behavioral observations and notes
 */

import { db } from '@utils/database.js';
import { logger } from '@utils/logger.js';
import { AppError } from '@middleware/errorHandler.js';
import notificationService from '@services/notificationService.js';
import {
  BehavioralNote,
  BehavioralNoteCreateInput,
  DisciplineQueryOptions,
} from '@types/discipline.js';

class BehavioralNoteService {
  /**
   * Create behavioral note
   */
  async createNote(
    tenantId: string,
    noteData: BehavioralNoteCreateInput
  ): Promise<BehavioralNote> {
    try {
      // Verify student exists by id or student_id
      const student = await db('users')
        .where({ tenant_id: tenantId })
        .where(function () {
          this.where('id', noteData.student_id).orWhere('student_id', noteData.student_id);
        })
        .first();

      if (!student) {
        throw new AppError('Student not found', 404);
      }

      const note: BehavioralNote = {
        note_id: '',
        tenant_id: tenantId,
        student_id: noteData.student_id,
        recorded_by: noteData.recorded_by,
        note_type: noteData.note_type as any,
        content: noteData.content,
        category: noteData.category,
        rating: noteData.rating,
        class_id: noteData.class_id,
        note_date: noteData.note_date || new Date(),
        parent_notified: false,
        is_shared_with_student: noteData.is_shared_with_student || false,
        is_confidential: noteData.is_confidential || false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const [id] = await db('behavioral_notes').insert(note);
      note.note_id = id;

      // Notify if required
      if (note.note_type === 'concern' && !note.is_confidential) {
        await this.notifyParent(tenantId, note);
      }

      // Log audit entry
      await this.logNoteAudit(tenantId, id, 'created', noteData.recorded_by, note);

      logger.info(`Behavioral note ${id} created for student ${noteData.student_id}`);
      return note;
    } catch (error) {
      logger.error('Error creating behavioral note:', error);
      throw error;
    }
  }

  /**
   * Get student behavioral notes
   */
  async getStudentNotes(
    studentId: string,
    tenantId: string,
    options?: DisciplineQueryOptions
  ) {
    try {
      let query = db('behavioral_notes')
        .where({ student_id: studentId, tenant_id: tenantId })
        .orderBy('note_date', 'desc');

      // Filter by type
      if (options?.filters?.status) {
        // Status maps to note_type for behavioral notes
        query = query.where({ note_type: options.filters.status });
      }

      // Filter by date range
      if (options?.filters?.date_from) {
        query = query.where('note_date', '>=', options.filters.date_from);
      }

      if (options?.filters?.date_to) {
        query = query.where('note_date', '<=', options.filters.date_to);
      }

      // Pagination
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const notes = await query
        .clone()
        .limit(limit)
        .offset(offset);

      const total = await query.clone().count('* as count').first();

      return {
        data: notes,
        pagination: {
          page,
          limit,
          total: total?.count || 0,
          total_pages: Math.ceil((total?.count || 0) / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting student notes:', error);
      throw error;
    }
  }

  /**
   * Get single note
   */
  async getNote(noteId: string, tenantId: string): Promise<BehavioralNote> {
    try {
      const note = await db('behavioral_notes')
        .where({ note_id: noteId, tenant_id: tenantId })
        .first();

      if (!note) {
        throw new AppError('Behavioral note not found', 404);
      }

      return note;
    } catch (error) {
      logger.error('Error getting note:', error);
      throw error;
    }
  }

  /**
   * Update behavioral note
   */
  async updateNote(
    noteId: string,
    tenantId: string,
    updateData: Partial<BehavioralNote>,
    userId: string
  ): Promise<BehavioralNote> {
    try {
      const note = await this.getNote(noteId, tenantId);

      const updates = {
        ...updateData,
        updated_at: new Date(),
      };

      await db('behavioral_notes')
        .where({ note_id: noteId })
        .update(updates);

      await this.logNoteAudit(tenantId, noteId, 'updated', userId, updates);

      logger.info(`Behavioral note ${noteId} updated`);
      return this.getNote(noteId, tenantId);
    } catch (error) {
      logger.error('Error updating note:', error);
      throw error;
    }
  }

  /**
   * Delete behavioral note (soft delete)
   */
  async deleteNote(
    noteId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    try {
      const note = await this.getNote(noteId, tenantId);

      // Soft delete
      await db('behavioral_notes')
        .where({ note_id: noteId })
        .update({
          updated_at: new Date(),
          content: '[Deleted]',
        });

      await this.logNoteAudit(tenantId, noteId, 'deleted', userId, { content: '[Deleted]' });

      logger.info(`Behavioral note ${noteId} deleted`);
    } catch (error) {
      logger.error('Error deleting note:', error);
      throw error;
    }
  }

  /**
   * Share note with student
   */
  async shareWithStudent(
    noteId: string,
    tenantId: string,
    userId: string
  ): Promise<BehavioralNote> {
    try {
      const note = await this.getNote(noteId, tenantId);

      if (note.is_confidential) {
        throw new AppError('Cannot share confidential notes with students', 400);
      }

      await db('behavioral_notes')
        .where({ note_id: noteId })
        .update({ is_shared_with_student: true });

      await this.logNoteAudit(tenantId, noteId, 'updated', userId, {
        is_shared_with_student: true,
      });

      // Notify student
      await notificationService.createNotification({
        user_id: note.student_id,
        tenant_id: tenantId,
        type: 'note_shared',
        title: 'Teacher Note',
        message: `A note from your teacher has been shared with you`,
        related_entity: 'behavioral_note',
        related_id: noteId,
      });

      logger.info(`Behavioral note ${noteId} shared with student`);
      return this.getNote(noteId, tenantId);
    } catch (error) {
      logger.error('Error sharing note with student:', error);
      throw error;
    }
  }

  /**
   * Get notes by class
   */
  async getClassNotes(classId: string, tenantId: string, options?: DisciplineQueryOptions) {
    try {
      let query = db('behavioral_notes')
        .where({ class_id: classId, tenant_id: tenantId })
        .orderBy('note_date', 'desc');

      if (options?.filters?.status) {
        query = query.where({ note_type: options.filters.status });
      }

      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const notes = await query
        .clone()
        .limit(limit)
        .offset(offset);

      const total = await query.clone().count('* as count').first();

      return {
        data: notes,
        pagination: {
          page,
          limit,
          total: total?.count || 0,
          total_pages: Math.ceil((total?.count || 0) / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting class notes:', error);
      throw error;
    }
  }

  /**
   * Get notes summary for student
   */
  async getStudentNoteSummary(studentId: string, tenantId: string) {
    try {
      const allNotes = await db('behavioral_notes')
        .where({ student_id: studentId, tenant_id: tenantId });

      const positiveNotes = allNotes.filter(n => n.note_type === 'positive');
      const concernNotes = allNotes.filter(n => n.note_type === 'concern');
      const commendations = allNotes.filter(n => n.note_type === 'commendation');

      const ratingSum = allNotes.reduce((sum, note) => sum + (note.rating || 0), 0);
      const averageRating = allNotes.length > 0 ? ratingSum / allNotes.length : 0;

      // Get by category
      const byCategory: Record<string, number> = {};
      for (const note of allNotes) {
        if (note.category) {
          byCategory[note.category] = (byCategory[note.category] || 0) + 1;
        }
      }

      return {
        total_notes: allNotes.length,
        positive_notes: positiveNotes.length,
        concern_notes: concernNotes.length,
        commendations: commendations.length,
        average_rating: parseFloat(averageRating.toFixed(2)),
        by_category: byCategory,
      };
    } catch (error) {
      logger.error('Error getting student note summary:', error);
      throw error;
    }
  }

  /**
   * Get teacher's notes
   */
  async getTeacherNotes(teacherId: string, tenantId: string, options?: DisciplineQueryOptions) {
    try {
      let query = db('behavioral_notes')
        .where({ recorded_by: teacherId, tenant_id: tenantId })
        .orderBy('note_date', 'desc');

      if (options?.filters?.status) {
        query = query.where({ note_type: options.filters.status });
      }

      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const notes = await query
        .clone()
        .limit(limit)
        .offset(offset);

      const total = await query.clone().count('* as count').first();

      return {
        data: notes,
        pagination: {
          page,
          limit,
          total: total?.count || 0,
          total_pages: Math.ceil((total?.count || 0) / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting teacher notes:', error);
      throw error;
    }
  }

  /**
   * Get commendations for student
   */
  async getCommendations(studentId: string, tenantId: string) {
    try {
      const commendations = await db('behavioral_notes')
        .where({
          student_id: studentId,
          tenant_id: tenantId,
          note_type: 'commendation',
        })
        .orderBy('note_date', 'desc');

      return commendations;
    } catch (error) {
      logger.error('Error getting commendations:', error);
      throw error;
    }
  }

  /**
   * Get concern notes for student
   */
  async getConcernNotes(studentId: string, tenantId: string) {
    try {
      const concerns = await db('behavioral_notes')
        .where({
          student_id: studentId,
          tenant_id: tenantId,
          note_type: 'concern',
        })
        .orderBy('note_date', 'desc');

      return concerns;
    } catch (error) {
      logger.error('Error getting concern notes:', error);
      throw error;
    }
  }

  /**
   * Notify parent of concern
   */
  private async notifyParent(tenantId: string, note: BehavioralNote) {
    try {
      const guardians = await db('student_guardians')
        .where({ student_id: note.student_id, status: 'active' })
        .select('guardian_id');

      for (const guardian of guardians) {
        try {
          await notificationService.createNotification({
            user_id: guardian.guardian_id,
            tenant_id: tenantId,
            type: 'concern_note',
            title: 'Teacher Concern Note',
            message: `A concern note has been recorded for your child: ${note.content?.substring(0, 100)}...`,
            related_entity: 'behavioral_note',
            related_id: note.note_id,
            priority: 'high',
          });

          logger.debug(
            `Parent ${guardian.guardian_id} notified of concern note ${note.note_id}`
          );
        } catch (err) {
          logger.error(`Error notifying guardian:`, err);
        }
      }

      await db('behavioral_notes')
        .where({ note_id: note.note_id })
        .update({ parent_notified: true });
    } catch (error) {
      logger.error('Error notifying parent:', error);
    }
  }

  /**
   * Log behavioral note audit entry
   */
  private async logNoteAudit(
    tenantId: string,
    noteId: string,
    action: string,
    userId: string,
    changes: any
  ) {
    try {
      await db('discipline_audit_logs').insert({
        tenant_id: tenantId,
        entity_type: 'behavioral_notes',
        entity_id: noteId,
        user_id: userId,
        action,
        changes: JSON.stringify(changes),
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error logging note audit:', error);
    }
  /**
   * List all behavioral notes school-wide (tenant-isolated)
   */
  async listAllNotes(
    tenantId: string,
    options?: {
      search?: string;
      note_type?: string;
      page?: number;
      limit?: number;
    }
  ) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      let query = db('behavioral_notes as bn')
        .leftJoin('users as u', function() {
          this.on('bn.student_id', '=', 'u.id').andOn('u.tenant_id', '=', db.raw('?', [tenantId]));
        })
        .leftJoin('users as rb', function() {
          this.on('bn.recorded_by', '=', 'rb.id').andOn('rb.tenant_id', '=', db.raw('?', [tenantId]));
        })
        .where('bn.tenant_id', tenantId)
        .select(
          'bn.*',
          db.raw("CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as student_name"),
          db.raw("CONCAT(COALESCE(rb.first_name, ''), ' ', COALESCE(rb.last_name, '')) as recorded_by_name")
        )
        .orderBy('bn.note_date', 'desc');

      if (options?.note_type) {
        query = query.where('bn.note_type', options.note_type);
      }

      if (options?.search) {
        const term = `%${options.search.toLowerCase()}%`;
        query = query.where(builder => {
          builder.whereRaw("LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) LIKE ?", [term])
            .orWhereRaw("LOWER(u.student_id) LIKE ?", [term])
            .orWhereRaw("LOWER(bn.content) LIKE ?", [term]);
        });
      }

      const items = await query.clone().limit(limit).offset(offset);
      const countRes = await query.clone().count('* as count').first();
      const total = Number(countRes?.count || 0);

      return {
        data: items,
        pagination: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      logger.error('Error listing all behavioral notes:', error);
      throw error;
    }
  }
}

export default new BehavioralNoteService();
