import { Knex } from 'knex';
import crypto from 'crypto';
import { logger } from '@utils/logger';
import { AuditService } from './auditService';
import { nextReceiptNumber, studentOutstanding } from './finance/core';

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

/** A business-rule failure the route maps to a 4xx (not a 500). */
export class PaymentRuleError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** A valid payment date that isn't in the future (default: now). */
export function parsePaymentDate(raw?: string | Date | null): Date {
  if (!raw) return new Date();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new PaymentRuleError('Payment date is not a valid date.');
  // Allow a day of slack for time zones (the school's "today" may be ahead of UTC).
  if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new PaymentRuleError('Payment date cannot be in the future.');
  return d;
}

export class PaymentService {
  private auditService: AuditService;

  /**
   * Record ONE manual payment across several fees, oldest first, in a single
   * transaction (all of it lands or none of it does). `idempotencyKey` makes a
   * retried submit return the original payments instead of paying twice.
   */
  async recordAcrossFees(input: {
    tenantId: string;
    feeIds: string[];
    amount: number;
    method: string;
    transactionReference?: string | null;
    notes?: string | null;
    paymentDate?: string | null;
    idempotencyKey?: string | null;
    /** Accept more than is owed: the excess becomes account credit. */
    allowCredit?: boolean;
  }, userId: string): Promise<{ payments: any[]; recorded: number; duplicate: boolean; receipt_number?: string | null; credit?: number; balance_after?: number }> {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const amount = round2(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new PaymentRuleError('Payment amount must be greater than zero');
    if (!Array.isArray(input.feeIds) || input.feeIds.length === 0) throw new PaymentRuleError('Choose what the payment is for');
    const paymentDate = parsePaymentDate(input.paymentDate);
    const key = input.idempotencyKey ? String(input.idempotencyKey).slice(0, 80) : null;

    if (key) {
      const prior = await this.db('payments').where({ tenant_id: input.tenantId, idempotency_key: key });
      if (prior.length) {
        return { payments: prior, recorded: round2(prior.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)), duplicate: true, receipt_number: prior[0].receipt_number };
      }
    }

    const created: any[] = [];
    let receiptNumber: string | null = null;
    let credit = 0;
    let balanceAfter = 0;
    try {
    await this.db.transaction(async (trx) => {
      const fees = await trx('fees')
        .whereIn('id', input.feeIds)
        .where('tenant_id', input.tenantId)
        .whereNot('status', 'deleted')
        .forUpdate();
      if (fees.length !== new Set(input.feeIds).size) throw new PaymentRuleError('One or more fees were not found in this school.', 404);
      if (new Set(fees.map((f: any) => f.student_id)).size > 1) throw new PaymentRuleError('A payment can only cover one student’s fees.');
      // Settle in the order the caller listed (the ledger's oldest-first order).
      const order = new Map(input.feeIds.map((id, i) => [String(id), i]));
      fees.sort((a: any, b: any) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0));

      const outstanding = round2(fees.reduce((s: number, f: any) => s + Math.max(0, Number(f.balance) || 0), 0));
      if (amount > outstanding + 0.005 && !input.allowCredit) {
        throw new PaymentRuleError(`Payment amount exceeds outstanding balance (Le ${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}). Tick "Keep the extra as account credit" to accept it.`);
      }
      // One stored, sequential receipt number for the whole submission.
      receiptNumber = await nextReceiptNumber(trx, input.tenantId, paymentDate);

      let remaining = amount;
      for (const fee of fees) {
        if (remaining <= 0.005) break;
        const bal = round2(Math.max(0, Number(fee.balance) || 0));
        if (bal <= 0) continue;
        const pay = round2(Math.min(bal, remaining));
        const row = {
          id: crypto.randomUUID(),
          tenant_id: input.tenantId,
          fee_id: fee.id,
          student_id: fee.student_id,
          amount: pay,
          method: input.method,
          payment_method: input.method,
          transaction_reference: input.transactionReference || null,
          notes: input.notes || null,
          payment_date: paymentDate,
          status: 'completed',
          created_by: userId,
          recorded_by: userId,
          idempotency_key: key,
          receipt_number: receiptNumber,
          created_at: new Date(),
          updated_at: new Date(),
        };
        await trx('payments').insert(row);
        let newBalance = round2(bal - pay);
        if (newBalance <= 0.005) newBalance = 0;
        await trx('fees').where('id', fee.id).update({ balance: newBalance, status: newBalance === 0 ? 'paid' : 'partial', updated_at: new Date() });
        created.push(row);
        remaining = round2(remaining - pay);
      }
      // Cash above what was owed: keep it as account credit (its own payment row).
      if (remaining > 0.005) {
        const studentId = fees[0].student_id;
        const extra = {
          id: crypto.randomUUID(), tenant_id: input.tenantId, fee_id: null, student_id: studentId, amount: remaining,
          method: input.method, payment_method: input.method, transaction_reference: input.transactionReference || null,
          notes: 'Overpayment held as account credit', payment_date: paymentDate, status: 'completed',
          created_by: userId, recorded_by: userId, idempotency_key: key, receipt_number: receiptNumber,
          created_at: new Date(), updated_at: new Date(),
        };
        await trx('payments').insert(extra);
        await trx('student_credits').insert({ tenant_id: input.tenantId, student_id: studentId, kind: 'overpayment', amount: remaining, payment_id: extra.id, reason: `Overpayment on receipt ${receiptNumber}`, created_by: userId });
        created.push(extra);
        credit = remaining;
      }
      // The student's total balance right after this payment (for the receipt).
      balanceAfter = await studentOutstanding(trx, input.tenantId, fees[0].student_id);
      await trx('payments').whereIn('id', created.map((p) => p.id)).update({ balance_after: balanceAfter });
    });
    } catch (e: any) {
      // Two submits with the same key at the same moment: the unique index
      // stops the second one. Return the first one's payments.
      if (e?.code === '23505' && key) {
        const prior = await this.db('payments').where({ tenant_id: input.tenantId, idempotency_key: key });
        return { payments: prior, recorded: round2(prior.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)), duplicate: true, receipt_number: prior[0]?.receipt_number };
      }
      throw e;
    }

    await this.auditService.logAudit({
      entityType: 'payment',
      entityId: created[0]?.id || 'none',
      action: 'create',
      performedBy: userId,
      details: { amount, method: input.method, feeIds: created.map((p) => p.fee_id), studentId: created[0]?.student_id },
      timestamp: new Date(),
    } as any).catch((e: any) => logger.warn(`Payment audit failed: ${e?.message || e}`));

    return { payments: created, recorded: amount, duplicate: false, receipt_number: receiptNumber, credit, balance_after: balanceAfter };
  }

  constructor(private db: Knex) {
    this.auditService = new AuditService(db);
  }

  /**
   * Record a payment
   */
  async recordPayment(data: PaymentData, userId: string): Promise<any> {
    try {
      logger.info(`Recording payment for fee ${data.feeId}`);

      // Money is handled in cents-precision to avoid float drift (0.1 + 0.2).
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const amount = round2(Number(data.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Payment amount must be greater than zero');
      }

      // Generate payment ID — payments.id is a UUID column.
      const paymentId = crypto.randomUUID();
      let payment: any;
      let fee: any;

      // Lock the fee row so two simultaneous payments can't both read the same
      // balance and over-pay it; insert + balance update commit together.
      const paymentDate = parsePaymentDate(data.paymentDate);

      await this.db.transaction(async (trx) => {
        fee = await trx('fees').where('id', data.feeId).whereNot('status', 'deleted').forUpdate().first();

        if (!fee) {
          throw new Error(`Fee ${data.feeId} not found`);
        }

        const balance = round2(Number(fee.balance) || 0);
        // Validate payment amount doesn't exceed balance (1 cent tolerance).
        if (amount > balance + 0.005) {
          throw new Error(`Payment amount exceeds outstanding balance`);
        }

        // Every payment gets a stored, sequential receipt number so the
        // receipt PDF and email can be produced for it.
        const receiptNumber = fee.tenant_id
          ? await nextReceiptNumber(trx, fee.tenant_id, paymentDate)
          : null;

        payment = {
          id: paymentId,
          // tenant_id was missing, so tenant-scoped stats skipped manual payments.
          tenant_id: fee.tenant_id || null,
          fee_id: data.feeId,
          student_id: fee.student_id,
          amount,
          method: data.method,
          payment_method: data.method,
          transaction_reference: data.transactionReference || null,
          notes: data.notes || null,
          payment_date: paymentDate,
          status: 'completed',
          created_by: userId,
          recorded_by: userId,
          receipt_number: receiptNumber,
          created_at: new Date(),
        };

        await trx('payments').insert(payment);

        // Update fee balance and status. Anything under half a cent is paid.
        let newBalance = round2(balance - amount);
        if (newBalance <= 0.005) newBalance = 0;
        const newStatus = newBalance === 0 ? 'paid' : 'partial';

        await trx('fees')
          .where('id', data.feeId)
          .update({
            balance: newBalance,
            status: newStatus,
            updated_at: new Date(),
          });

        if (fee.tenant_id) {
          const balanceAfter = await studentOutstanding(trx, fee.tenant_id, fee.student_id);
          await trx('payments').where('id', paymentId).update({ balance_after: balanceAfter });
          payment.balance_after = balanceAfter;
        }
      });

      // Audit is best-effort: the payment is already committed, so a failed
      // audit write must not return a 500 (the client would retry and pay twice).
      await this.auditService.logAudit({
        entityType: 'payment',
        entityId: paymentId,
        action: 'create',
        performedBy: userId,
        details: {
          feeId: data.feeId,
          amount,
          method: data.method,
          studentId: fee.student_id,
        },
        timestamp: new Date(),
      } as any).catch((e: any) => logger.warn(`Payment audit failed: ${e?.message || e}`));

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
  async getPaymentStatistics(filters?: PaymentFilter, tenantId?: string): Promise<any> {
    try {
      logger.info('Calculating payment statistics');

      let query = this.db('payments');

      // Tenant scoping: these aggregates must never sum across schools.
      if (tenantId) query = query.where('payments.tenant_id', tenantId);

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

      // Get payment breakdown by method (same tenant scope).
      let byMethodQuery = this.db('payments')
        .select('method')
        .sum('amount as total_amount')
        .count('* as count')
        .groupBy('method');
      if (tenantId) byMethodQuery = byMethodQuery.where('tenant_id', tenantId);
      const byMethod = await byMethodQuery;

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
  async getRecentPayments(limit: number = 50, tenantId?: string): Promise<any[]> {
    try {
      // student_id references students.id (NOT users.id); join students then
      // their optional user account for name/email. Tenant-scoped.
      let query = this.db('payments')
        .leftJoin('students', 'payments.student_id', 'students.id')
        .leftJoin('users', 'students.user_id', 'users.id')
        .select(
          'payments.*',
          this.db.raw("COALESCE(NULLIF(TRIM(CONCAT_WS(' ', students.first_name, students.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', users.first_name, users.last_name)), '')) as student_name"),
          'users.email as student_email'
        )
        .orderBy('payments.payment_date', 'desc')
        .limit(limit);

      if (tenantId) query = query.where('payments.tenant_id', tenantId);

      const payments = await query;
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
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const refundId = crypto.randomUUID();
      let refund: any;
      let payment: any;

      // One transaction with the payment and fee locked: a double click can't
      // refund twice, and the balance can't be restored twice.
      await this.db.transaction(async (trx) => {
        payment = await trx('payments').where('id', paymentId).forUpdate().first();
        if (!payment) throw new PaymentRuleError('Payment not found', 404);
        if (payment.status !== 'completed') {
          throw new PaymentRuleError(`This payment is ${payment.status || 'not completed'} and can't be refunded.`, 409);
        }
        if (!payment.fee_id) {
          // Online (Monime) payments are spread across several fees at reconcile
          // time; reversing them needs the provider's refund, not a ledger edit.
          throw new PaymentRuleError('Online payments are refunded through the payment provider, not here.', 409);
        }
        const fee = await trx('fees').where('id', payment.fee_id).forUpdate().first();
        if (!fee) throw new PaymentRuleError('The fee this payment settled no longer exists.', 409);

        refund = {
          id: refundId,
          original_payment_id: paymentId,
          amount: payment.amount,
          reason,
          refund_date: new Date(),
          status: 'completed',
          processed_by: userId,
          created_at: new Date(),
        };
        await trx('refunds').insert(refund);

        // pg returns numerics as strings: "500" + "200" was "500200".
        const amount = round2(Number(fee.amount) || 0);
        const newBalance = Math.min(amount, round2((Number(fee.balance) || 0) + (Number(payment.amount) || 0)));
        const newStatus = newBalance <= 0.005 ? 'paid' : newBalance < amount - 0.005 ? 'partial' : 'pending';
        await trx('fees').where('id', fee.id).update({ balance: newBalance, status: newStatus, updated_at: new Date() });
        await trx('payments').where('id', paymentId).update({ status: 'refunded', updated_at: new Date() });
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
      } as any).catch((e: any) => logger.warn(`Refund audit failed: ${e?.message || e}`));

      logger.info(`Payment refund ${refundId} processed`);
      try {
        const { notifyFamily, leFmt } = await import('./finance/core.js');
        // In-app notice only; the email is the refund receipt below (with the
        // REFUNDED PDF attached) so the family gets one message, not two.
        await notifyFamily(payment.student_id, {
          subject: 'Payment refunded',
          message: `${leFmt(Number(payment.amount))}${payment.receipt_number ? ` (receipt ${payment.receipt_number})` : ''} for {student} was refunded. The fees show it as owed again.`,
          sourceType: 'payment', sourceId: paymentId,
        });
        if (payment.receipt_number && payment.tenant_id) {
          const { receiptService } = await import('./finance/receiptService.js');
          await receiptService.emailQuietly(payment.tenant_id, payment.receipt_number, {
            kind: 'refund', reason, amount: Number(payment.amount),
          });
        }
      } catch { /* best-effort */ }
      return refund;
    } catch (error) {
      logger.error(`Error refunding payment: ${error}`);
      throw error;
    }
  }

  /**
   * Get payment summary by date range
   */
  async getPaymentSummary(startDate: string, endDate: string, tenantId?: string): Promise<any> {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      let base = this.db('payments').whereBetween('payment_date', [start, end]);
      if (tenantId) base = base.where('tenant_id', tenantId);

      const summary = await base
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
   * After a single-fee payment commits: tell the family in the app and email
   * them the receipt (when the school has e-receipts on). Best-effort, never
   * throws, so it can't fail a payment that is already recorded.
   */
  async announcePayment(payment: any): Promise<void> {
    try {
      if (!payment?.tenant_id || !payment?.student_id) return;
      const { notifyFamily, leFmt, financeSettings } = await import('./finance/core');
      void notifyFamily(payment.student_id, {
        subject: 'Payment received',
        message: `${leFmt(Number(payment.amount))} was received for {student}${payment.receipt_number ? ` (receipt ${payment.receipt_number})` : ''}. Thank you.`,
        sourceType: 'payment',
      });
      if (payment.receipt_number && (await financeSettings(payment.tenant_id)).emailManualReceipts) {
        const { receiptService } = await import('./finance/receiptService');
        await receiptService.emailQuietly(payment.tenant_id, payment.receipt_number);
      }
    } catch (e: any) {
      logger.warn(`Payment announcement failed: ${e?.message || e}`);
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
          await this.announcePayment(result);
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
  async getPaymentMethodsSummary(tenantId?: string): Promise<any[]> {
    try {
      let query = this.db('payments')
        .select('method')
        .count('* as count')
        .sum('amount as total_amount')
        .groupBy('method')
        .orderBy('total_amount', 'desc');
      if (tenantId) query = query.where('tenant_id', tenantId);

      const summary = await query;
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
