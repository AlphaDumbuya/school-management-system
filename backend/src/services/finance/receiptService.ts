/**
 * Receipts (bursar Phase A, R4). One receipt per payment submission: every
 * payment row of a submission (a payment spread across several fees) shares a
 * stored, sequential receipt number (RCP-2027-000123) and the student's balance
 * right after it (balance_after), so a reprint shows the balance at the time.
 *
 * Every confirmation email for a payment (staff-recorded, online, refunded)
 * goes through `email()`: the same stored receipt, the same PDF, to every
 * parent/guardian with an email plus the student.
 */
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { round2, familyContact, familyContacts, studentLabel, audit } from './core';

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque', card: 'Card', mobile_money: 'Mobile money', monime: 'Mobile money / card (online)', credit: 'Account credit',
};

/** One line of a receipt: a charge the payment settled (or money kept as credit). */
export interface ReceiptItem {
  payment_id: string;
  /** The fee type, e.g. "Tuition" or "Uniform". */
  label: string;
  /** Term and year ("First Term · 2026/2027"), or a note for credit lines. */
  detail: string | null;
  kind: 'fee' | 'credit';
  fee_type: string | null;
  term: string | null;
  academic_year: string | null;
  amount: number;
  status: string;
}

export interface EmailReceiptOptions {
  /** 'refund' sends the refund confirmation (REFUNDED receipt attached). */
  kind?: 'payment' | 'refund';
  /** Why it was refunded, shown to the family. */
  reason?: string | null;
  /** Amount refunded (a refund email shows this instead of the receipt total). */
  amount?: number;
}

export const receiptService = {
  /** All rows of one receipt plus what they paid for. */
  async get(tenantId: string, receiptNumber: string) {
    const rows = await db('payments as p')
      .leftJoin('fees as f', db.raw('f.id::text') as any, 'p.fee_id')
      .leftJoin('invoices as inv', db.raw('inv.id::text') as any, 'p.invoice_id')
      .where('p.tenant_id', tenantId).where('p.receipt_number', receiptNumber)
      .select('p.*', 'f.type as fee_type', 'f.term as fee_term', 'f.academic_year as fee_year', 'inv.invoice_number')
      .orderBy('p.created_at');
    if (!rows.length) throw new AppError('Receipt not found', 404, 'NOT_FOUND');
    const first = rows[0];
    const amount = round2(rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
    const refunded = rows.filter((r: any) => r.status === 'refunded');
    const status: 'paid' | 'refunded' | 'part_refunded' = refunded.length === 0 ? 'paid' : refunded.length === rows.length ? 'refunded' : 'part_refunded';
    const student = await studentLabel(first.student_id);

    // The class the pupil is in, the academic year, and who took the payment:
    // the details a school expects to see on an official receipt.
    const cls = await db('enrollments as e').join('classes as c', 'c.id', 'e.class_id')
      .where('e.student_id', first.student_id).whereIn('e.status', ['active', 'enrolled'])
      .orderBy('e.created_at', 'desc').first('c.name').catch(() => null);
    let academicYear: string | null = rows.find((r: any) => r.fee_year)?.fee_year || null;
    if (!academicYear) {
      try { academicYear = (await (await import('@utils/academicYear')).resolveActiveYear(tenantId)).yearString || null; } catch { academicYear = null; }
    }
    const byId = first.recorded_by || first.created_by || null;
    const by = byId ? await db('users').where({ id: byId }).first('first_name', 'last_name', 'role').catch(() => null) : null;
    const receivedBy = by ? [by.first_name, by.last_name].filter(Boolean).join(' ') || null : null;

    // What each payment paid for: the split recorded when the money came in
    // (payment_allocations: fee type, term, year, amount). Payments from before
    // that was kept fall back to the fee the payment row points at, and an
    // online payment from that time to a generic line (its split was never stored).
    const allocRows: any[] = await db('payment_allocations')
      .where({ tenant_id: tenantId, receipt_number: receiptNumber }).orderBy('created_at').orderBy('id')
      .catch(() => [] as any[]);
    const allocByPayment = new Map<string, any[]>();
    for (const a of allocRows) {
      const k = String(a.payment_id);
      if (!allocByPayment.has(k)) allocByPayment.set(k, []);
      allocByPayment.get(k)!.push(a);
    }
    const termYear = (term?: string | null, year?: string | null) => [term, year].filter(Boolean).join(' · ') || null;
    const items: ReceiptItem[] = [];
    for (const r of rows) {
      const allocs = allocByPayment.get(String(r.id));
      if (allocs?.length) {
        for (const a of allocs) {
          const credit = a.kind === 'credit';
          items.push({
            payment_id: r.id,
            label: a.fee_type || (credit ? 'Account credit' : 'Fee'),
            detail: credit ? (a.description || null) : termYear(a.term, a.academic_year),
            kind: credit ? 'credit' : 'fee',
            fee_type: a.fee_type || null, term: a.term || null, academic_year: a.academic_year || null,
            amount: round2(a.amount), status: r.status,
          });
        }
      } else if (r.fee_id) {
        items.push({
          payment_id: r.id, label: r.fee_type || 'Fee', detail: termYear(r.fee_term, r.fee_year), kind: 'fee',
          fee_type: r.fee_type || null, term: r.fee_term || null, academic_year: r.fee_year || null,
          amount: round2(r.amount), status: r.status,
        });
      } else if (/overpayment|credit/i.test(String(r.notes || ''))) {
        items.push({ payment_id: r.id, label: 'Account credit', detail: 'Extra amount held as account credit', kind: 'credit', fee_type: 'Account credit', term: null, academic_year: null, amount: round2(r.amount), status: r.status });
      } else if (String(r.method || r.payment_method) === 'monime') {
        items.push({ payment_id: r.id, label: 'School fees (paid online)', detail: r.invoice_number ? `Invoice ${r.invoice_number}` : null, kind: 'fee', fee_type: null, term: null, academic_year: null, amount: round2(r.amount), status: r.status });
      } else {
        items.push({ payment_id: r.id, label: 'School fees', detail: null, kind: 'fee', fee_type: null, term: null, academic_year: null, amount: round2(r.amount), status: r.status });
      }
    }

    return {
      receipt_number: receiptNumber,
      student_id: first.student_id,
      student_name: student.name,
      admission_no: student.admissionNo,
      class_name: cls?.name || null,
      academic_year: academicYear,
      received_by: receivedBy,
      amount,
      method: first.method || first.payment_method,
      method_label: METHOD_LABEL[String(first.method || first.payment_method)] || String(first.method || first.payment_method || ''),
      reference: first.transaction_reference || first.provider_reference || null,
      date: first.payment_date,
      balance_after: first.balance_after != null ? round2(first.balance_after) : null,
      status,
      items,
    };
  },

  /** The data both the PDF and the email are built from (so they always agree). */
  async forDocument(tenantId: string, receiptNumber: string) {
    const r = await this.get(tenantId, receiptNumber);
    const contact = await familyContact(r.student_id);
    // The pupil's photo (the school's record photo, else the account photo), and
    // the receipt's verification code (made the first time the receipt is drawn).
    const photo = await db('students as s').leftJoin('users as u', 'u.id', 's.user_id')
      .where('s.id', r.student_id)
      .first(db.raw("COALESCE(NULLIF(s.photo_url, ''), NULLIF(u.photo_url, ''), NULLIF(u.profile_photo_url, '')) as ref"))
      .catch(() => null);
    const { getOrCreateCode, verifyUrl, formatCode } = await import('./receiptVerifyService');
    const code = await getOrCreateCode(tenantId, receiptNumber);
    return {
      r,
      doc: {
        studentPhotoRef: photo?.ref || undefined,
        verifyCode: code ? formatCode(code) : undefined,
        verifyUrl: code ? verifyUrl(code) : undefined,
        receiptNumber: r.receipt_number,
        payerName: contact.name || r.student_name,
        studentName: r.student_name,
        admissionNo: r.admission_no || undefined,
        className: r.class_name || undefined,
        academicYear: r.academic_year || undefined,
        receivedBy: r.received_by || undefined,
        amount: r.amount,
        method: r.method_label,
        reference: r.reference || undefined,
        date: new Date(r.date),
        balanceRemaining: r.balance_after ?? undefined,
        status: r.status,
        items: r.items.map((i) => ({ label: i.label, detail: i.detail || undefined, amount: i.amount })),
      },
    };
  },

  async pdf(tenantId: string, receiptNumber: string): Promise<Buffer> {
    const { doc } = await this.forDocument(tenantId, receiptNumber);
    const { generateReceiptPdfBase64 } = await import('../email/receiptPdf.js');
    const { base64 } = await generateReceiptPdfBase64(tenantId, doc);
    return Buffer.from(base64, 'base64');
  },

  /**
   * Email a receipt (with the PDF attached) to the whole family: every linked
   * parent/guardian with an email, and the student. Says truthfully whether
   * anything was actually sent.
   */
  async email(tenantId: string, receiptNumber: string, userId: string | null, opts: EmailReceiptOptions = {}): Promise<{ sent: boolean; to?: string; reason?: string }> {
    const { r, doc } = await this.forDocument(tenantId, receiptNumber);
    const recipients = await familyContacts(r.student_id);
    if (!recipients.length) return { sent: false, reason: 'No email on file for this student or their parents.' };
    const { default: emailService } = await import('@services/emailService');

    const sentTo: string[] = [];
    let lastError = '';
    let disabled = false;
    for (const to of recipients) {
      try {
        const res: any = await emailService.sendPaymentReceiptEmail(tenantId, to.email, {
          ...doc,
          payerName: to.name || doc.payerName,
          currency: 'Le',
          // A refund email states the amount refunded, not the receipt total.
          ...(opts.kind === 'refund' && opts.amount != null ? { amount: opts.amount } : {}),
          kind: opts.kind || 'payment',
          refundReason: opts.reason || undefined,
        });
        // sendEmail answers { status: 'sent' | 'disabled' } — 'disabled' means
        // nothing left the building (no email key, or a demo address).
        if (res?.status === 'sent') sentTo.push(to.email);
        else if (res?.status === 'disabled') disabled = true;
        else lastError = 'The email provider did not confirm the send.';
      } catch (e: any) {
        lastError = e?.message || 'Email could not be sent.';
      }
    }
    if (sentTo.length) {
      await db('payments').where({ tenant_id: tenantId, receipt_number: receiptNumber }).update({ receipt_emailed_at: new Date() }).catch(() => {});
      await audit('receipt', null, opts.kind === 'refund' ? 'email_refund' : 'email', userId, { receipt: receiptNumber, to: sentTo });
      return { sent: true, to: sentTo.join(', ') };
    }
    if (disabled && !lastError) return { sent: false, reason: 'Email sending is switched off for this school (or it is a demo school).' };
    return { sent: false, reason: lastError || 'Email could not be sent.' };
  },

  /** Best-effort email after a payment commits (never fails the payment). */
  async emailQuietly(tenantId: string, receiptNumber: string, opts: EmailReceiptOptions = {}) {
    try {
      const out = await this.email(tenantId, receiptNumber, null, opts);
      if (!out.sent) logger.warn(`Receipt ${receiptNumber} not emailed: ${out.reason}`);
      return out;
    } catch (e: any) {
      logger.warn(`Receipt email ${receiptNumber} failed: ${e?.message || e}`);
      return { sent: false, reason: e?.message || 'failed' };
    }
  },

  /**
   * Safety net, run by the daily job: online payments whose receipt email
   * didn't go out (provider hiccup, cold start) are sent again for up to
   * 3 days. Payments with nobody to email are marked handled so they stop
   * being retried.
   */
  async resendMissingOnline(): Promise<{ checked: number; sent: number; skipped: number }> {
    const due = await db('payments')
      .where({ status: 'completed' }).whereNotNull('receipt_number').whereNull('receipt_emailed_at')
      .whereRaw("COALESCE(method, payment_method) = 'monime'")
      .whereRaw("created_at < NOW() - INTERVAL '10 minutes'").whereRaw("created_at > NOW() - INTERVAL '3 days'")
      .select('tenant_id', 'receipt_number').groupBy('tenant_id', 'receipt_number').limit(200).catch(() => [] as any[]);
    let sent = 0, skipped = 0;
    for (const p of due) {
      const out = await this.emailQuietly(p.tenant_id, p.receipt_number);
      if (out.sent) sent++;
      else {
        skipped++;
        if (/No email on file|switched off/i.test(String((out as any).reason || ''))) {
          await db('payments').where({ tenant_id: p.tenant_id, receipt_number: p.receipt_number }).update({ receipt_emailed_at: new Date() }).catch(() => {});
        }
      }
    }
    return { checked: due.length, sent, skipped };
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

    // "Paid for" per receipt, e.g. "Tuition, Uniform" (a separate query so a school
    // whose database has not been updated yet still gets its list).
    const purposes = new Map<string, string[]>();
    if (rows.length) {
      const allocs: any[] = await db('payment_allocations')
        .where('tenant_id', tenantId).whereIn('receipt_number', rows.map((r: any) => r.receipt_number))
        .select('receipt_number', 'fee_type', 'kind').catch(() => [] as any[]);
      for (const a of allocs) {
        const name = a.kind === 'credit' ? 'Account credit' : a.fee_type;
        if (!name) continue;
        const list = purposes.get(a.receipt_number) || [];
        if (!list.includes(name)) list.push(name);
        purposes.set(a.receipt_number, list);
      }
    }
    return rows.map((r: any) => ({
      ...r,
      purpose: purposes.get(r.receipt_number)?.join(', ') || null,
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
