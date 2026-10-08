/**
 * Shared finance primitives (bursar Phase A).
 *
 * Balance identity, kept by every money path in the same transaction:
 *   fee.balance = fee.amount − Σ payments + Σ refunds − Σ active adjustments
 * Adjustments (discounts, waivers, applied credit, late-fee waivers) reduce a
 * balance WITHOUT cash. They are never counted as "collected".
 */
import type { Knex } from 'knex';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { AuditService } from '@services/auditService';

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const money = (n: number) => `Le ${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const auditService = new AuditService(db);
/** Best-effort audit (never fails the money write that already committed). */
export async function audit(entityType: string, entityId: string | null, action: string, userId: string | null, details: any): Promise<void> {
  await auditService.logAudit({ entityType, entityId: entityId || undefined, action, performedBy: userId || undefined, details, timestamp: new Date() } as any).catch(() => {});
}

/** Next value of a per-school counter (atomic). */
export async function nextSequence(trx: Knex | Knex.Transaction, tenantId: string, key: string): Promise<number> {
  const r = await trx.raw(
    `INSERT INTO finance_sequences (tenant_id, key, value) VALUES (?, ?, 1)
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = finance_sequences.value + 1 RETURNING value`,
    [tenantId, key],
  );
  return Number(r.rows[0].value);
}

/** A new sequential receipt number for the school: RCP-2027-000123. */
export async function nextReceiptNumber(trx: Knex | Knex.Transaction, tenantId: string, date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const n = await nextSequence(trx, tenantId, `receipt:${year}`);
  return `RCP-${year}-${String(n).padStart(6, '0')}`;
}

/** Status a fee should have for its balance (keeps 'overdue' if still owed and past due). */
export function statusFor(fee: { amount: any; status?: string | null }, balance: number): string {
  if (balance <= 0.005) return 'paid';
  if (fee.status === 'overdue') return 'overdue';
  return balance < round2(Number(fee.amount)) - 0.005 ? 'partial' : 'pending';
}

export type AdjustmentKind = 'discount' | 'waiver' | 'credit_applied' | 'late_fee_waiver';

/**
 * Reduce a (locked) fee's balance by up to `amount` with a non-cash
 * adjustment. Caps at the remaining balance; returns what was applied (0 = none).
 */
export async function applyAdjustment(
  trx: Knex.Transaction,
  fee: any,
  amount: number,
  kind: AdjustmentKind,
  opts: { reason?: string | null; userId?: string | null; grantId?: string | null; creditId?: string | null },
): Promise<number> {
  const bal = round2(Math.max(0, Number(fee.balance) || 0));
  const apply = round2(Math.min(bal, Math.max(0, amount)));
  if (apply <= 0) return 0;
  await trx('fee_adjustments').insert({
    tenant_id: fee.tenant_id,
    fee_id: fee.id,
    student_id: fee.student_id,
    kind,
    amount: apply,
    reason: opts.reason || null,
    discount_grant_id: opts.grantId || null,
    credit_id: opts.creditId || null,
    created_by: opts.userId || null,
  });
  const newBal = round2(bal - apply);
  await trx('fees').where({ id: fee.id }).update({ balance: newBal, status: statusFor(fee, newBal), updated_at: new Date() });
  fee.balance = newBal;
  return apply;
}

/** Undo an adjustment: its amount goes back on the fee (never above the billed amount). */
export async function reverseAdjustment(trx: Knex.Transaction, adj: any, userId: string | null): Promise<number> {
  if (adj.reversed_at) return 0;
  const fee = await trx('fees').where({ id: adj.fee_id }).forUpdate().first();
  if (!fee) return 0;
  const newBal = round2(Math.min(Number(fee.amount), Number(fee.balance) + Number(adj.amount)));
  const restored = round2(newBal - Number(fee.balance));
  await trx('fees').where({ id: fee.id }).update({ balance: newBal, status: statusFor({ ...fee, status: fee.status === 'paid' ? 'pending' : fee.status }, newBal), updated_at: new Date() });
  await trx('fee_adjustments').where({ id: adj.id }).update({ reversed_at: new Date(), reversed_by: userId });
  return restored;
}

/** A student's total outstanding across every year. */
export async function studentOutstanding(q: Knex | Knex.Transaction, tenantId: string, studentId: string): Promise<number> {
  const r = await q('fees').where({ tenant_id: tenantId, student_id: studentId }).whereNot('status', 'deleted')
    .sum({ s: db.raw('COALESCE(balance, amount)') }).first();
  return round2(Number((r as any)?.s) || 0);
}

/** School finance settings (school_config_settings), with defaults. */
export async function financeSettings(tenantId: string) {
  const rows = await db('school_config_settings').where({ tenant_id: tenantId })
    .where('setting_key', 'like', 'fin_%').select('setting_key', 'setting_value').catch(() => [] as any[]);
  const s: Record<string, any> = {};
  for (const r of rows) s[r.setting_key] = r.setting_value;
  const num = (v: any, d = 0) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d; };
  const bool = (v: any) => v === true || v === 'true' || v === 1 || v === '1';
  return {
    lateFeeEnabled: bool(s.fin_late_fee_enabled),
    lateFeePercent: num(s.fin_late_fee_percent),
    lateFeeFixed: num(s.fin_late_fee_fixed),
    lateFeeGraceDays: Math.floor(num(s.fin_late_fee_grace_days, 0)),
    lateFeeCap: num(s.fin_late_fee_cap),
    discountApprovalThreshold: num(s.fin_discount_approval_threshold, 0),
    emailManualReceipts: s.fin_email_manual_receipts === undefined ? true : bool(s.fin_email_manual_receipts),
  };
}

const STAFF = ['principal', 'super_admin', 'accountant'];
/**
 * Who may read a student's money records: finance staff, the student
 * themself, or a linked parent/guardian. Throws 403/404 otherwise.
 */
export async function assertCanViewStudent(req: any, studentId: string): Promise<{ tenantId: string; student: any }> {
  const tenantId = req.user?.tenant_id;
  const role = String(req.user?.role || '');
  const userId = req.user?.id;
  const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
  if (STAFF.includes(role)) return { tenantId, student };
  if (role === 'student' && student.user_id === userId) return { tenantId, student };
  if (role === 'parent' || role === 'guardian') {
    const link = await db('guardians').where({ user_id: userId, student_id: studentId }).first().catch(() => null);
    if (link) return { tenantId, student };
  }
  throw new AppError('You can only see your own (or your child\'s) fees.', 403, 'FORBIDDEN');
}

export const isFinanceStaff = (req: any) => STAFF.includes(String(req.user?.role || ''));

/** Student display name + admission number. */
export async function studentLabel(studentId: string): Promise<{ name: string; admissionNo: string; userId: string | null }> {
  const s = await db('students').leftJoin('users', 'users.id', 'students.user_id').where('students.id', studentId)
    .select('students.first_name', 'students.last_name', 'students.student_id', 'students.user_id', 'users.first_name as uf', 'users.last_name as ul').first();
  const name = [s?.uf || s?.first_name, s?.ul || s?.last_name].filter(Boolean).join(' ') || 'Student';
  return { name, admissionNo: s?.student_id || '', userId: s?.user_id || null };
}

/** Best contact for a student's family: a linked parent's email, else the student's. */
export async function familyContact(studentId: string): Promise<{ email: string | null; name: string; userIds: string[] }> {
  const links = await db('guardians').leftJoin('users', 'users.id', 'guardians.user_id').where('guardians.student_id', studentId)
    .select('users.id', 'users.email', 'users.first_name', 'users.last_name').catch(() => [] as any[]);
  const parent = links.find((l: any) => l.email);
  const stu = await db('students').leftJoin('users', 'users.id', 'students.user_id').where('students.id', studentId)
    .select('users.id as uid', 'users.email as uemail', 'students.email').first().catch(() => null);
  const userIds = [...links.map((l: any) => l.id), stu?.uid].filter(Boolean);
  if (parent) return { email: parent.email, name: [parent.first_name, parent.last_name].filter(Boolean).join(' ') || 'Parent', userIds };
  return { email: stu?.uemail || stu?.email || null, name: (await studentLabel(studentId)).name, userIds };
}

/** In-app notification (bell) to specific users. Best-effort. */
export async function notifyUsers(ids: string[], n: { subject: string; message: string; url: string; sourceType?: string; sourceId?: string }): Promise<void> {
  try {
    const { default: notificationService } = await import('@services/notificationService');
    for (const id of Array.from(new Set(ids.filter(Boolean)))) {
      await notificationService.createNotification({
        recipientId: id, notificationType: 'payment', subject: n.subject, message: n.message,
        data: { url: n.url }, channels: ['in_app'], sourceType: n.sourceType, sourceId: n.sourceId,
      }).catch(() => null);
    }
  } catch { /* never fail the money action */ }
}

const leFmt = (n: number) => `Le ${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * In-app notification (bell) to a student's family: every linked parent /
 * guardian login and the student's own login. Opens My Fees. Best-effort.
 */
export async function notifyFamily(
  studentId: string,
  n: { subject: string; message: string; sourceType?: string; sourceId?: string },
  opts: { emailTenantId?: string } = {},
): Promise<void> {
  try {
    const contact = await familyContact(studentId);
    const { name } = await studentLabel(studentId);
    const message = n.message.split('{student}').join(name);
    await notifyUsers(contact.userIds, { ...n, message, url: '/finance/my-fees' });
    // Also by email when asked (families who don't open the app still hear).
    if (opts.emailTenantId && contact.email) await emailFamily(opts.emailTenantId, contact.email, contact.name, n.subject, message);
  } catch { /* never fail the money action */ }
}

const esc = (t: string) => String(t).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' } as any)[c]);

/** A short branded finance email to a family, with a link to My Fees. Best-effort. */
export async function emailFamily(tenantId: string, to: string, toName: string, subject: string, message: string): Promise<boolean> {
  try {
    const { default: emailService } = await import('@services/emailService');
    const { resolveTenantBranding } = await import('@services/email/emailBranding');
    const { renderEmail } = await import('@services/email/emailLayout');
    const branding: any = await resolveTenantBranding(tenantId);
    const appUrl = String(process.env.FRONTEND_URL || process.env.APP_URL || '').replace(/\/$/, '');
    const link = appUrl ? `<p><a href="${appUrl}/finance/my-fees">Open Fees &amp; Payments</a></p>` : '<p>Open <strong>Fees &amp; Payments</strong> in the school portal for the details.</p>';
    const res: any = await (emailService as any).sendEmail({
      ...(emailService as any).senderFromBranding?.(branding),
      to, subject: `${subject} — ${branding?.name || 'School'}`,
      body: renderEmail({ branding, eyebrow: 'School fees', heading: subject, preheader: message.slice(0, 120),
        bodyHtml: `<p>Dear ${esc(toName || 'Parent')},</p><p>${esc(message)}</p>${link}` } as any),
      isHtml: true,
    });
    return res?.success !== false;
  } catch { return false; }
}

/**
 * Claim a one-time notice (e.g. "instalment 2 of plan X is due soon").
 * Returns true only the first time for that key, so a daily job never repeats it.
 */
export async function claimNotice(tenantId: string, key: string): Promise<boolean> {
  const r = await db.raw('INSERT INTO finance_notices (tenant_id, key) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING key', [tenantId, key.slice(0, 200)]).catch(() => null);
  return !!r?.rows?.length;
}

/** Money accounts the bursar can pick (books: 1000 cash, 1010 bank, 1020 mobile). */
export const MONEY_ACCOUNTS = ['bank', 'cash', 'mobile'] as const;
export const cleanMoneyAccount = (v: unknown, dflt: 'bank' | 'cash' | 'mobile' = 'bank') =>
  (MONEY_ACCOUNTS as readonly string[]).includes(String(v)) ? (String(v) as 'bank' | 'cash' | 'mobile') : dflt;
export { leFmt };

/**
 * In-app notification (bell) to a school's finance people. 'accountant' also
 * reaches teachers holding the Bursar duty. Best-effort: never fails the
 * money action that triggered it.
 */
export async function notifyFinanceStaff(
  tenantId: string,
  to: Array<'principal' | 'accountant'>,
  n: { subject: string; message: string; url: string; sourceType?: string; sourceId?: string; exceptUserId?: string | null },
): Promise<number> {
  try {
    const rows = await db('users').where({ tenant_id: tenantId }).where('status', 'active')
      .where((q) => {
        q.whereIn('role', to);
        if (to.includes('accountant')) q.orWhere((q2) => q2.where('role', 'teacher').whereRaw("staff_duties::jsonb @> '[\"accountant\"]'::jsonb"));
      })
      .select('id');
    const ids = rows.map((r: any) => r.id).filter((id: string) => id !== n.exceptUserId);
    if (!ids.length) return 0;
    const { default: notificationService } = await import('@services/notificationService');
    for (const id of ids) {
      await notificationService.createNotification({
        recipientId: id, notificationType: 'payment', subject: n.subject, message: n.message,
        data: { url: n.url }, channels: ['in_app'], sourceType: n.sourceType, sourceId: n.sourceId,
      }).catch(() => null);
    }
    return ids.length;
  } catch {
    return 0;
  }
}
