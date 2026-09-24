import { Knex } from 'knex';
import crypto from 'crypto';
import { logger } from '@utils/logger';
import { AuditService } from './auditService';

export interface PaymentData {
  feeId: string;
  amount: number;
  method: 'cash' | 'check' | 'online' | 'bank_transfer' | 'card';
  transactionReference?: string;
  notes?: string;
  paymentDate?: string;
}

export interface PaymentFilter {
  studentId?: string;
  startDate?: string;
  endDate?: string;
  method?: string;
  status?: string;
}

export class PaymentService {
  private auditService: AuditService;

  constructor(private db: Knex) {
    this.auditService = new AuditService(db);
  }

  /**
   * Record a payment
   */
  async recordPayment(data: PaymentData, userId: string): Promise<any> {
    try {
      logger.info(`Recording payment for fee ${data.feeId}`);

      // Validate fee exists
      const fee = await this.db('fees')
        .where('id', data.feeId)
        .first();

      if (!fee) {
        throw new Error(`Fee ${data.feeId} not found`);
      }

      // Validate payment amount doesn't exceed balance
      if (data.amount > fee.balance) {
        throw new Error(`Payment amount exceeds outstanding balance`);
      }

      // Generate payment ID — payments.id is a UUID column.
      const paymentId = crypto.randomUUID();

      const payment = {
        id: paymentId,
        fee_id: data.feeId,
        student_id: fee.student_id,
        amount: data.amount,
        method: data.method,
        transaction_reference: data.transactionReference || null,
        notes: data.notes || null,
        payment_date: new Date(data.paymentDate || new Date()),
        status: 'completed',
        created_by: userId,
        created_at: new Date(),
      };

      await this.db('payments').insert(payment);

      // Update fee balance and status
      const newBalance = fee.balance - data.amount;
      const newStatus = newBalance === 0 ? 'paid' : 'partial';

      await this.db('fees')
        .where('id', data.feeId)
        .update({
          balance: newBalance,
          status: newStatus,
          updated_at: new Date(),
        });

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'payment',
        entityId: paymentId,
        action: 'create',
        performedBy: userId,
        details: {
          feeId: data.feeId,
          amount: data.amount,
          method: data.method,
          studentId: fee.student_id,
        },
        timestamp: new Date(),
      });

      logger.info(`Payment ${paymentId} recorded successfully`);
      return payment;
    } catch (error) {
      logger.error(`Error recording payment: ${error}`);
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<any> {
    try {
      const payment = await this.db('payments')
        .where('id', paymentId)
        .first();

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      return payment;
    } catch (error) {
      logger.error(`Error fetching payment: ${error}`);
      throw error;
    }
  }

  /**
   * Get payments for a student
   */
  async getStudentPayments(studentId: string, filters?: PaymentFilter): Promise<any[]> {
    try {
      logger.info(`Fetching payments for student ${studentId}`);

      let query = this.db('payments').where('student_id', studentId);

      if (filters?.startDate) {
        query = query.where('payment_date', '>=', new Date(filters.startDate));
      }

      if (filters?.endDate) {
        query = query.where('payment_date', '<=', new Date(filters.endDate));
      }

      if (filters?.method) {
        query = query.where('method', filters.method);
      }

      const payments = await query
        .leftJoin('fees', 'payments.fee_id', 'fees.id')
        .select(
          'payments.*',
          'fees.type as fee_type',
          'fees.amount as fee_amount'
        )
        .orderBy('payments.payment_date', 'desc');

      return payments;
    } catch (error) {
      logger.error(`Error fetching student payments: ${error}`);
      throw error;
    }
  }

  /**
   * Get payments for a fee
   */
  async getFeePayments(feeId: string): Promise<any[]> {
    try {
      const payments = await this.db('payments')
        .where('fee_id', feeId)
        .orderBy('payment_date', 'desc');

      return payments;
    } catch (error) {
      logger.error(`Error fetching fee payments: ${error}`);
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(filters?: PaymentFilter): Promise<any> {
    try {
      logger.info('Calculating payment statistics');

      let query = this.db('payments');

      if (filters?.studentId) {
        query = query.where('student_id', filters.studentId);
      }

      if (filters?.startDate) {
        query = query.where('payment_date', '>=', new Date(filters.startDate));
      }

      if (filters?.endDate) {
        query = query.where('payment_date', '<=', new Date(filters.endDate));
      }

      const stats = await query
        .select(
          this.db.raw('COUNT(*) as total_payments'),
          this.db.raw('SUM(amount) as total_amount'),
          this.db.raw('AVG(amount) as average_amount'),
          this.db.raw('MAX(amount) as max_amount'),
          this.db.raw('MIN(amount) as min_amount'),
          this.db.raw('COUNT(DISTINCT student_id) as unique_students'),
          this.db.raw('COUNT(DISTINCT method) as payment_methods_used')
        )
        .first();

      // Get payment breakdown by method
      const byMethod = await this.db('payments')
        .select('method')
        .sum('amount as total_amount')
        .count('* as count')
        .groupBy('method');

      return {
        ...stats,
        byMethod,
      };
    } catch (error) {
      logger.error(`Error calculating payment statistics: ${error}`);
      throw error;
    }
  }

  /**
   * Get recent payments
   */
  async getRecentPayments(limit: number = 50): Promise<any[]> {
    try {
      const payments = await this.db('payments')
        .leftJoin('users', 'payments.student_id', 'users.id')
        .select(
          'payments.*',
          'users.name as student_name',
          'users.email as student_email'
        )
        .orderBy('payments.payment_date', 'desc')
        .limit(limit);

      return payments;
    } catch (error) {
      logger.error(`Error fetching recent payments: ${error}`);
      throw error;
    }
  }

  /**
   * Get payment receipt
   */
  async getPaymentReceipt(paymentId: string): Promise<any> {
    try {
      const payment = await this.db('payments')
        .leftJoin('users', 'payments.student_id', 'users.id')
        .leftJoin('fees', 'payments.fee_id', 'fees.id')
        .select(
          'payments.*',
          'users.name as student_name',
          'users.email as student_email',
          'users.phone as student_phone',
          'fees.type as fee_type',
          'fees.description as fee_description'
        )
        .where('payments.id', paymentId)
        .first();

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      return payment;
    } catch (error) {
      logger.error(`Error fetching payment receipt: ${error}`);
      throw error;
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(paymentId: string, reason: string, userId: string): Promise<any> {
    try {
      logger.info(`Refunding payment ${paymentId}`);

      const payment = await this.getPaymentById(paymentId);

      // Get the original fee
      const fee = await this.db('fees')
        .where('id', payment.fee_id)
        .first();

      // Create refund transaction — refunds.id is a UUID column.
      const refundId = crypto.randomUUID();

      const refund = {
        id: refundId,
        original_payment_id: paymentId,
        amount: payment.amount,
        reason,
        refund_date: new Date(),
        status: 'completed',
        processed_by: userId,
        created_at: new Date(),
      };

      await this.db('refunds').insert(refund);

      // Update fee balance
      const newBalance = fee.balance + payment.amount;
      const newStatus = newBalance > 0 ? 'pending' : 'paid';

      await this.db('fees')
        .where('id', payment.fee_id)
        .update({
          balance: newBalance,
          status: newStatus,
          updated_at: new Date(),
        });

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'payment',
        entityId: paymentId,
        action: 'refund',
        performedBy: userId,
        details: {
          refundId,
          amount: payment.amount,
          reason,
        },
        timestamp: new Date(),
      });

      logger.info(`Payment refund ${refundId} processed`);
      return refund;
    } catch (error) {
      logger.error(`Error refunding payment: ${error}`);
      throw error;
    }
  }

  /**
   * Get payment summary by date range
   */
  async getPaymentSummary(startDate: string, endDate: string): Promise<any> {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const summary = await this.db('payments')
        .whereBetween('payment_date', [start, end])
        .select(
          this.db.raw('DATE(payment_date) as payment_date'),
          'method',
          this.db.raw('COUNT(*) as count'),
          this.db.raw('SUM(amount) as total_amount')
        )
        .groupBy('payment_date', 'method')
        .orderBy('payment_date', 'desc');

      return summary;
    } catch (error) {
      logger.error(`Error getting payment summary: ${error}`);
      throw error;
    }
  }

  /**
   * Bulk record payments
   */
  async bulkRecordPayments(payments: PaymentData[], userId: string): Promise<any> {
    try {
      logger.info(`Bulk recording ${payments.length} payments`);

      const results = {
        created: 0,
        failed: 0,
        totalAmount: 0,
        errors: [] as string[],
      };

      for (const payment of payments) {
        try {
          const result = await this.recordPayment(payment, userId);
          results.created++;
          results.totalAmount += result.amount;
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to record payment for fee ${payment.feeId}: ${error}`);
        }
      }

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'payment',
        entityId: `bulk-record-${Date.now()}`,
        action: 'bulk_record',
        performedBy: userId,
        details: {
          created: results.created,
          failed: results.failed,
          totalAmount: results.totalAmount,
        },
        timestamp: new Date(),
      });

      return results;
    } catch (error) {
      logger.error(`Error bulk recording payments: ${error}`);
      throw error;
    }
  }

  /**
   * Get payment methods summary
   */
  async getPaymentMethodsSummary(): Promise<any[]> {
    try {
      const summary = await this.db('payments')
        .select('method')
        .count('* as count')
        .sum('amount as total_amount')
        .groupBy('method')
        .orderBy('total_amount', 'desc');

      return summary;
    } catch (error) {
      logger.error(`Error getting payment methods summary: ${error}`);
      throw error;
    }
  }

  /**
   * Verify payment exists (for duplicate prevention)
   */
  async verifyPaymentExists(
    feeId: string,
    amount: number,
    transactionRef: string
  ): Promise<boolean> {
    try {
      const payment = await this.db('payments')
        .where('fee_id', feeId)
        .where('amount', amount)
        .where('transaction_reference', transactionRef)
        .where('status', 'completed')
        .first();

      return !!payment;
    } catch (error) {
      logger.error(`Error verifying payment: ${error}`);
      throw error;
    }
  }
}
