import { Knex } from 'knex';
import crypto from 'crypto';
import { logger } from '@utils/logger';
import { AuditService } from './auditService';

export interface FeeData {
  type: string;
  amount: number;
  dueDate: string;
  description?: string;
  studentId: string;
  classId?: string;
  academicSession?: string;
  status?: 'pending' | 'partial' | 'paid' | 'overdue';
}

export interface FeeUpdate {
  type?: string;
  amount?: number;
  dueDate?: string;
  description?: string;
  status?: string;
}

export class FeeService {
  private auditService: AuditService;

  constructor(private db: Knex) {
    this.auditService = new AuditService(db);
  }

  /**
   * Create a new fee record
   */
  async createFee(data: FeeData, userId: string): Promise<any> {
    try {
      logger.info(`Creating fee for student ${data.studentId}`);

      // Canonical charge subject is students.id (financial-management spec §1).
      const student = await this.db('students').where('id', data.studentId).first();

      if (!student) {
        // Detect the legacy inconsistency where a users.id (role student) was
        // passed instead of a students.id. Reject rather than auto-reconcile.
        const asUser = await this.db('users')
          .where({ id: data.studentId, role: 'student' })
          .first()
          .catch(() => null);
        if (asUser) {
          throw new Error(
            `Student identifier mismatch: a user id was supplied where a student id is required (student ${data.studentId}).`,
          );
        }
        throw new Error(`Student ${data.studentId} not found`);
      }

      // Generate fee ID — fees.id is a UUID column.
      const feeId = crypto.randomUUID();

      const fee = {
        id: feeId,
        tenant_id: student.tenant_id || null,
        type: data.type,
        amount: data.amount,
        due_date: new Date(data.dueDate),
        description: data.description || null,
        student_id: data.studentId,
        class_id: data.classId || null,
        academic_session: data.academicSession || null,
        status: 'pending',
        balance: data.amount,
        created_at: new Date(),
        updated_at: new Date(),
      };

      await this.db('fees').insert(fee);

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'fee',
        entityId: feeId,
        action: 'create',
        performedBy: userId,
        details: {
          type: data.type,
          amount: data.amount,
          studentId: data.studentId,
        },
        timestamp: new Date(),
      });

      logger.info(`Fee ${feeId} created successfully`);
      return fee;
    } catch (error) {
      logger.error(`Error creating fee: ${error}`);
      throw error;
    }
  }

  /**
   * Get fee by ID
   */
  async getFeeById(feeId: string): Promise<any> {
    try {
      const fee = await this.db('fees')
        .where('id', feeId)
        .first();

      if (!fee) {
        throw new Error(`Fee ${feeId} not found`);
      }

      return fee;
    } catch (error) {
      logger.error(`Error fetching fee: ${error}`);
      throw error;
    }
  }

  /**
   * Get fees for a student
   */
  async getStudentFees(studentId: string, filters?: any): Promise<any[]> {
    try {
      logger.info(`Fetching fees for student ${studentId}`);

      let query = this.db('fees').where('student_id', studentId);

      if (filters?.status) {
        query = query.where('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.where('due_date', '>=', new Date(filters.startDate));
      }

      if (filters?.endDate) {
        query = query.where('due_date', '<=', new Date(filters.endDate));
      }

      const fees = await query.orderBy('due_date', 'asc');
      return fees;
    } catch (error) {
      logger.error(`Error fetching student fees: ${error}`);
      throw error;
    }
  }

  /**
   * Get fees for a class
   */
  async getClassFees(classId: string): Promise<any[]> {
    try {
      const fees = await this.db('fees')
        .where('class_id', classId)
        .orderBy('due_date', 'asc');

      return fees;
    } catch (error) {
      logger.error(`Error fetching class fees: ${error}`);
      throw error;
    }
  }

  /**
   * Update fee status
   */
  async updateFeeStatus(feeId: string, status: string, userId: string): Promise<any> {
    try {
      logger.info(`Updating fee ${feeId} status to ${status}`);

      const fee = await this.getFeeById(feeId);

      // Update status
      await this.db('fees')
        .where('id', feeId)
        .update({
          status,
          updated_at: new Date(),
        });

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'fee',
        entityId: feeId,
        action: 'update_status',
        performedBy: userId,
        details: {
          from: fee.status,
          to: status,
        },
        timestamp: new Date(),
      });

      return { id: feeId, status };
    } catch (error) {
      logger.error(`Error updating fee status: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate outstanding balance for student
   */
  async getStudentOutstanding(studentId: string): Promise<number> {
    try {
      logger.info(`Calculating outstanding balance for student ${studentId}`);

      const result = await this.db('fees')
        .where('student_id', studentId)
        .whereIn('status', ['pending', 'partial', 'overdue'])
        .sum('balance as total_balance')
        .first();

      return result?.total_balance || 0;
    } catch (error) {
      logger.error(`Error calculating outstanding balance: ${error}`);
      throw error;
    }
  }

  /**
   * Get fee statistics
   */
  async getFeeStatistics(classId?: string): Promise<any> {
    try {
      logger.info(`Calculating fee statistics for class ${classId}`);

      let query = this.db('fees');

      if (classId) {
        query = query.where('class_id', classId);
      }

      const stats = await query
        .select(
          this.db.raw('COUNT(*) as total_fees'),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_count', ['pending']),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as partial_count', ['partial']),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as paid_count', ['paid']),
          this.db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as overdue_count', ['overdue']),
          this.db.raw('SUM(amount) as total_amount'),
          this.db.raw('SUM(balance) as outstanding_balance'),
          this.db.raw('SUM(CASE WHEN status = ? THEN amount ELSE 0 END) as paid_amount', ['paid']),
        )
        .first();

      return stats;
    } catch (error) {
      logger.error(`Error calculating fee statistics: ${error}`);
      throw error;
    }
  }

  /**
   * Bulk create fees for students in a class
   */
  async bulkCreateFees(classId: string, feeData: FeeData[], userId: string): Promise<any> {
    try {
      logger.info(`Bulk creating fees for class ${classId}`);

      const results = {
        created: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const fee of feeData) {
        try {
          await this.createFee({ ...fee, classId }, userId);
          results.created++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to create fee for student ${fee.studentId}: ${error}`);
        }
      }

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'fee',
        entityId: `bulk-create-${Date.now()}`,
        action: 'bulk_create',
        performedBy: userId,
        details: {
          classId,
          created: results.created,
          failed: results.failed,
        },
        timestamp: new Date(),
      });

      return results;
    } catch (error) {
      logger.error(`Error bulk creating fees: ${error}`);
      throw error;
    }
  }

  /**
   * Get overdue fees
   */
  async getOverdueFees(daysOverdue: number = 0): Promise<any[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

      const fees = await this.db('fees')
        .where('fees.due_date', '<', cutoffDate)
        .whereIn('fees.status', ['pending', 'partial', 'overdue'])
        // Canonical subject is students.id, so join students (not users).
        .leftJoin('students', 'fees.student_id', 'students.id')
        .select(
          'fees.id',
          'fees.type',
          'fees.amount',
          'fees.balance',
          'fees.due_date',
          'fees.status',
          this.db.raw("TRIM(CONCAT(COALESCE(students.first_name,''),' ',COALESCE(students.last_name,''))) as student_name"),
          'students.email as student_email',
          'fees.student_id'
        )
        .orderBy('fees.due_date', 'asc');

      return fees;
    } catch (error) {
      logger.error(`Error fetching overdue fees: ${error}`);
      throw error;
    }
  }

  /**
   * Get fees by type
   */
  async getFeesByType(type: string, classId?: string): Promise<any[]> {
    try {
      let query = this.db('fees').where('type', type);

      if (classId) {
        query = query.where('class_id', classId);
      }

      return await query.orderBy('due_date', 'asc');
    } catch (error) {
      logger.error(`Error fetching fees by type: ${error}`);
      throw error;
    }
  }

  /**
   * Waive or adjust fee amount
   */
  async adjustFeeAmount(
    feeId: string,
    newAmount: number,
    reason: string,
    userId: string
  ): Promise<any> {
    try {
      logger.info(`Adjusting fee ${feeId} amount to ${newAmount}`);

      const fee = await this.getFeeById(feeId);
      const difference = fee.amount - newAmount;

      await this.db('fees')
        .where('id', feeId)
        .update({
          amount: newAmount,
          balance: Math.max(0, fee.balance - difference),
          updated_at: new Date(),
        });

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'fee',
        entityId: feeId,
        action: 'adjust_amount',
        performedBy: userId,
        details: {
          originalAmount: fee.amount,
          newAmount,
          adjustment: difference,
          reason,
        },
        timestamp: new Date(),
      });

      return { id: feeId, newAmount, adjustment: difference };
    } catch (error) {
      logger.error(`Error adjusting fee amount: ${error}`);
      throw error;
    }
  }

  /**
   * Delete fee (soft delete with reason)
   */
  async deleteFee(feeId: string, reason: string, userId: string): Promise<void> {
    try {
      logger.info(`Deleting fee ${feeId}`);

      const fee = await this.getFeeById(feeId);

      // Mark as deleted instead of hard delete
      await this.db('fees')
        .where('id', feeId)
        .update({
          status: 'deleted',
          updated_at: new Date(),
        });

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'fee',
        entityId: feeId,
        action: 'delete',
        performedBy: userId,
        details: {
          amount: fee.amount,
          reason,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error(`Error deleting fee: ${error}`);
      throw error;
    }
  }
}
