/**
 * Receipts (bursar Phase A, R4). One receipt per payment submission: every
 * payment row of a submission (a payment spread across several fees) shares a
 * stored, sequential receipt number (RCP-2027-000123) and the student's balance
 * right after it (balance_after), so a reprint shows the balance at the time.
 */
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { round2, familyContact, studentLabel, audit } from './core';

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque', card: 'Card', mobile_money: 'Mobile money', monime: 'Mobile / Card (Monime)', credit: 'Account credit',
};

export const receiptService = {
  /** All rows of one receipt plus what they paid for. */
  async get(tenantId: string, receiptNumber: string) {
    const rows = await db('payments as p')
      .leftJoin('fees as f', db.raw('f.id::text') as any, 'p.fee_id')
      .where('p.tenant_id', tenantId).where('p.receipt_number', receiptNumber)
      .select('p.*', 'f.type as fee_type', 'f.term as fee_term', 'f.academic_year as fee_year')
      .orderBy('p.created_at');
    if (!rows.length) throw new AppError('Receipt not found', 404, 'NOT_FOUND');
    const first = rows[0];
    const amount = round2(rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
    const refunded = rows.filter((r: any) => r.status === 'refunded');
    const status: 'paid' | 'refunded' | 'part_refunded' = refunded.length === 0 ? 'paid' : refunded.length === rows.length ? 'refunded' : 'part_refunded';
    const student = await studentLabel(first.student_id);
    return {
      receipt_number: receiptNumber,
      student_id: first.student_id,
      student_name: student.name,
      admission_no: student.admissionNo,
      amount,
      method: first.method || first.payment_method,
      method_label: METHOD_LABEL[String(first.method || first.payment_method)] || String(first.method || first.payment_method || ''),
      reference: first.transaction_reference || first.provider_reference || null,
      date: first.payment_date,
      balance_after: first.balance_after != null ? round2(first.balance_after) : null,
      status,
      items: rows.map((r: any) => ({
        payment_id: r.id,
        label: r.fee_id ? `${r.fee_type || 'Fee'}${r.fee_term ? ` · ${r.fee_term}` : ''}${r.fee_year ? ` · ${r.fee_year}` : ''}` : 'Added to account credit',
        amount: round2(r.amount),
        status: r.status,
      })),
    };
  },

  async pdf(tenantId: string, receiptNumber: string): Promise<Buffer> {
    const r = await this.get(tenantId, receiptNumber);
    const contact = await familyContact(r.student_id);
    const { generateReceiptPdfBase64 } = await import('../email/receiptPdf.js');
    const { base64 } = await generateReceiptPdfBase64(tenantId, {
      receiptNumber: r.receipt_number,
      payerName: contact.name || r.student_name,
      studentName: `${r.student_name}${r.admission_no ? ` (${r.admission_no})` : ''}`,
      amount: r.amount,
      method: r.method_label,
      reference: r.reference || undefined,
      date: new Date(r.date),
      balanceRemaining: r.balance_after ?? undefined,
      status: r.status,
      items: r.items.map((i) => ({ label: i.label, amount: i.amount })),
    });
    return Buffer.from(base64, 'base64');
  },

  /** Email a receipt to the family. Returns whether it was sent (and why not). */
  async email(tenantId: string, receiptNumber: string, userId: string | null): Promise<{ sent: boolean; to?: string; reason?: string }> {
    const r = await this.get(tenantId, receiptNumber);
    const contact = await familyContact(r.student_id);
    if (!contact.email) return { sent: false, reason: 'No email on file for this student or their parent.' };
    const { default: emailService } = await import('@services/emailService');
    const res: any = await emailService.sendPaymentReceiptEmail(tenantId, contact.email, {
      payerName: contact.name,
      studentName: r.student_name,
      amount: r.amount,
      currency: 'Le',
      method: r.method_label,
      reference: r.reference || undefined,
      receiptNumber: r.receipt_number,
      date: r.date,
      balanceRemaining: r.balance_after ?? undefined,
      items: r.items.map((i) => ({ label: i.label, amount: i.amount })),
    });
    const sent = res?.success !== false;
    if (sent) await audit('receipt', null, 'email', userId, { receipt: receiptNumber, to: contact.email });
    return sent ? { sent: true, to: contact.email } : { sent: false, reason: res?.error || 'Email could not be sent.' };
  },

  /** Best-effort email after a payment commits (never fails the payment). */
  async emailQuietly(tenantId: string, receiptNumber: string) {
    try { await this.email(tenantId, receiptNumber, null); } catch (e: any) { logger.warn(`Receipt email ${receiptNumber} failed: ${e?.message || e}`); }
  },

  /** Receipts in a period (staff list / bulk email). */
  async list(tenantId: string, f: { from?: string; to?: string; classId?: string; studentId?: string; limit?: number }) {
    const q = db('payments as p')
      .join('students as s', 's.id', 'p.student_id')
      .leftJoin('users as u', 'u.id', 's.user_id')
      .where('p.tenant_id', tenantId).whereNotNull('p.receipt_number')
      .groupBy('p.receipt_number', 'p.student_id', 's.student_id', 'u.first_name', 'u.last_name', 's.first_name', 's.last_name')
      .select(
        'p.receipt_number', 'p.student_id', 's.student_id as admission_no',
        db.raw("COALESCE(u.first_name || ' ' || u.last_name, s.first_name || ' ' || s.last_name) as student_name"),
        db.raw('SUM(p.amount) as amount'),
        db.raw('MIN(p.payment_date) as date'),
        db.raw('MIN(COALESCE(p.method, p.payment_method)) as method'),
        db.raw("BOOL_AND(p.status = 'refunded') as refunded"),
        db.raw("BOOL_OR(p.status = 'refunded') as any_refunded"),
        db.raw('MAX(p.balance_after) as balance_after'),
      )
      .orderByRaw('MIN(p.payment_date) DESC, p.receipt_number DESC');
    if (f.from) q.where('p.payment_date', '>=', f.from);
    if (f.to) q.where('p.payment_date', '<=', f.to);
    if (f.studentId) q.where('p.student_id', f.studentId);
    if (f.classId) q.whereExists(db('enrollments as e').whereRaw('e.student_id = p.student_id').where('e.class_id', f.classId));
    const rows = await q.limit(Math.min(f.limit || 500, 2000));
    return rows.map((r: any) => ({
      ...r,
      amount: round2(r.amount),
      balance_after: r.balance_after != null ? round2(r.balance_after) : null,
      status: r.refunded ? 'refunded' : r.any_refunded ? 'part_refunded' : 'paid',
      method_label: METHOD_LABEL[String(r.method)] || r.method,
    }));
  },

  async bulkEmail(tenantId: string, userId: string, f: { from?: string; to?: string; classId?: string }) {
    if (!f.from || !f.to) throw new AppError('Choose a date range.', 400, 'VALIDATION_ERROR');
    const list = await this.list(tenantId, { ...f, limit: 500 });
    let sent = 0, skipped = 0, failed = 0;
    for (const r of list) {
      if (r.status === 'refunded') { skipped++; continue; }
      try {
        const out = await this.email(tenantId, r.receipt_number, userId);
        if (out.sent) sent++; else skipped++;
      } catch { failed++; }
    }
    await audit('receipt', null, 'bulk_email', userId, { ...f, sent, skipped, failed });
    return { considered: list.length, sent, skipped, failed };
  },
};

export default receiptService;
