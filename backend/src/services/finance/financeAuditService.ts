/**
 * Finance audit log (bursar Phase C, R7): read-only, school-scoped (audit_logs
 * has no tenant column, so rows are scoped through the person who acted).
 */
import { db } from '@utils/database';

export const FINANCE_AUDIT_AREAS: Record<string, string[]> = {
  'Fees & billing': ['fee', 'fee_structure', 'invoice', 'late_fee', 'fee_adjustment'],
  Payments: ['payment', 'refund', 'receipt'],
  'Discounts & credit': ['discount_rule', 'discount_grant', 'student_credit', 'payment_plan'],
  Expenses: ['expense', 'petty_cash_fund', 'petty_cash_entry', 'budget'],
  Payroll: ['pay_profile', 'pay_settings', 'payroll_run', 'payslip'],
  Accounting: ['gl_entry', 'gl_account', 'books_lock', 'bank_statement', 'bank_match'],
};
const ALL = Object.values(FINANCE_AUDIT_AREAS).flat();

export const financeAuditService = {
  async list(tenantId: string, q: any) {
    const page = Math.max(0, Math.floor(Number(q?.page) || 0));
    const size = Math.min(100, Math.max(10, Math.floor(Number(q?.size) || 25)));
    const types = q?.area && FINANCE_AUDIT_AREAS[q.area] ? FINANCE_AUDIT_AREAS[q.area] : ALL;
    const base = db('audit_logs as a').join('users as u', 'u.id', 'a.performed_by')
      .where('u.tenant_id', tenantId).whereIn('a.entity_type', types)
      .modify((x) => {
        if (q?.user_id) x.where('a.performed_by', String(q.user_id));
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(q?.from || ''))) x.where('a.created_at', '>=', `${q.from}T00:00:00`);
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(q?.to || ''))) x.where('a.created_at', '<', db.raw("?::date + interval '1 day'", [q.to]));
        const t = String(q?.search || '').trim();
        if (t) {
          const like = `%${t.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
          x.where((w) => w.whereILike('a.action', like).orWhereILike('a.entity_type', like)
            .orWhereRaw('a.new_values::text ILIKE ?', [like]).orWhereRaw('a.old_values::text ILIKE ?', [like])
            .orWhereRaw("CONCAT_WS(' ', u.first_name, u.last_name) ILIKE ?", [like]));
        }
      });
    const total = Number((await base.clone().count('* as n').first() as any)?.n || 0);
    const rows = await base.clone().orderBy('a.created_at', 'desc').limit(size).offset(page * size)
      .select('a.id', 'a.created_at', 'a.action', 'a.entity_type', 'a.entity_id', 'a.new_values', 'a.old_values', 'a.changes', 'a.reason',
        'a.performed_by', 'u.role', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as user_name"));
    const people = await db('audit_logs as a').join('users as u', 'u.id', 'a.performed_by')
      .where('u.tenant_id', tenantId).whereIn('a.entity_type', ALL)
      .distinct('u.id', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as name"), 'u.role');
    const area = (t: string) => Object.entries(FINANCE_AUDIT_AREAS).find(([, v]) => v.includes(t))?.[0] || 'Other';
    return { total, page, size, rows: rows.map((r: any) => ({ ...r, area: area(r.entity_type) })), areas: Object.keys(FINANCE_AUDIT_AREAS), people };
  },
};

export default financeAuditService;
