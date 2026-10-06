/**
 * Discounts, scholarships, bursaries and waivers (bursar Phase A, R1).
 *
 * A grant gives a student a discount for a year (or one term). Once approved
 * it becomes `fee_adjustments` lines (kind discount/waiver) on the matching
 * fees, so the balance drops while the billed amount stays. Re-applying is
 * idempotent: one line per (grant, fee). Fees billed later pick it up via
 * applyApprovedGrantsForStudent (called after billing).
 */
import type { Knex } from 'knex';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { normalizeAcademicYear, resolveActiveYear } from '@utils/academicYear';
import { round2, applyAdjustment, reverseAdjustment, financeSettings, audit } from './core';

const KINDS = ['sibling', 'staff_child', 'scholarship', 'custom'];
const TERMS = ['First Term', 'Second Term', 'Third Term'];

function cleanRule(body: any) {
  const name = String(body?.name || '').trim().slice(0, 120);
  const kind = String(body?.kind || '');
  const basis = String(body?.basis || '');
  const value = round2(Number(body?.value));
  const appliesTo = body?.applies_to === 'all' ? 'all' : 'tuition';
  if (!name) throw new AppError('Give the discount a name.', 400, 'VALIDATION_ERROR');
  if (!KINDS.includes(kind)) throw new AppError(`Type must be one of: ${KINDS.join(', ')}`, 400, 'VALIDATION_ERROR');
  if (!['percent', 'fixed'].includes(basis)) throw new AppError('Choose percent or fixed amount.', 400, 'VALIDATION_ERROR');
  if (!(value > 0) || (basis === 'percent' && value > 100) || value > 1e10) {
    throw new AppError(basis === 'percent' ? 'Percentage must be between 0 and 100.' : 'Amount must be greater than 0.', 400, 'VALIDATION_ERROR');
  }
  const siblingOrder = kind === 'sibling' ? Math.max(2, Math.floor(Number(body?.sibling_order) || 2)) : null;
  return { name, kind, basis, value, applies_to: appliesTo, sibling_order: siblingOrder, description: body?.description ? String(body.description).slice(0, 500) : null, active: body?.active !== false };
}

/** Open fees a grant covers (excludes late fees and deleted rows), oldest first. */
function grantFeesQuery(trx: Knex | Knex.Transaction, grant: any) {
  const q = trx('fees')
    .where({ tenant_id: grant.tenant_id, student_id: grant.student_id, academic_year: grant.academic_year })
    .whereNot('status', 'deleted')
    .where((w) => w.whereNull('source').orWhereNot('source', 'late_fee'));
  if (grant.term) q.where('term', grant.term);
  if (grant.applies_to === 'tuition') q.where('type', 'Tuition');
  return q.orderBy('due_date', 'asc').orderBy('created_at', 'asc');
}

/** What the grant is worth on the student's matching fees (for approval + preview). */
async function estimate(trx: Knex | Knex.Transaction, grant: any): Promise<number> {
  const fees = await grantFeesQuery(trx, grant).select('amount');
  const billed = fees.reduce((s: number, f: any) => s + Number(f.amount || 0), 0);
  return round2(grant.basis === 'percent' ? (billed * Number(grant.value)) / 100 : Math.min(Number(grant.value), billed || Number(grant.value)));
}

export const discountService = {
  async listRules(tenantId: string) {
    return db('discount_rules').where({ tenant_id: tenantId }).orderBy('active', 'desc').orderBy('name');
  },

  async createRule(tenantId: string, userId: string, body: any) {
    const r = cleanRule(body);
    const [row] = await db('discount_rules').insert({ ...r, tenant_id: tenantId, created_by: userId }).returning('*');
    await audit('discount_rule', row.id, 'create', userId, r);
    return row;
  },

  async updateRule(tenantId: string, userId: string, id: string, body: any) {
    const existing = await db('discount_rules').where({ id, tenant_id: tenantId }).first();
    if (!existing) throw new AppError('Discount not found', 404, 'NOT_FOUND');
    const r = cleanRule({ ...existing, ...body });
    const [row] = await db('discount_rules').where({ id }).update({ ...r, updated_at: new Date() }).returning('*');
    await audit('discount_rule', id, 'update', userId, { before: existing, after: r });
    return row;
  },

  async listGrants(tenantId: string, filters: { year?: string; status?: string; studentId?: string }) {
    const q = db('discount_grants as g')
      .join('students as s', 's.id', 'g.student_id')
      .leftJoin('users as u', 'u.id', 's.user_id')
      .leftJoin('users as rq', 'rq.id', 'g.requested_by')
      .leftJoin('users as dc', 'dc.id', 'g.decided_by')
      .where('g.tenant_id', tenantId)
      .select(
        'g.*',
        db.raw("COALESCE(u.first_name || ' ' || u.last_name, s.first_name || ' ' || s.last_name) as student_name"),
        's.student_id as admission_no',
        db.raw("TRIM(CONCAT_WS(' ', rq.first_name, rq.last_name)) as requested_by_name"),
        db.raw("TRIM(CONCAT_WS(' ', dc.first_name, dc.last_name)) as decided_by_name"),
        db.raw("(SELECT COALESCE(SUM(a.amount),0) FROM fee_adjustments a WHERE a.discount_grant_id = g.id AND a.reversed_at IS NULL) as applied_amount"),
      )
      .orderBy('g.created_at', 'desc');
    const y = normalizeAcademicYear(filters.year || null);
    if (y && y !== 'all') q.where('g.academic_year', y);
    if (filters.status) q.where('g.status', filters.status);
    if (filters.studentId) q.where('g.student_id', filters.studentId);
    return (await q.limit(1000)).map((r: any) => ({ ...r, applied_amount: round2(r.applied_amount) }));
  },

  /** Give a student a discount (from a rule) or a one-off waiver. */
  async grant(tenantId: string, user: { id: string; role: string }, body: any) {
    const student = await db('students').where({ id: body?.student_id, tenant_id: tenantId }).first();
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
    const year = normalizeAcademicYear(body?.academic_year || null) || (await resolveActiveYear(tenantId)).yearString;
    if (!year || !/^\d{4}\/\d{4}$/.test(year)) throw new AppError('Choose an academic year.', 400, 'VALIDATION_ERROR');
    const active = (await resolveActiveYear(tenantId)).yearString;
    if (active && year < active) throw new AppError(`${year} is a past academic year. Discounts are given in ${active}.`, 409, 'PAST_YEAR_READ_ONLY');
    const term = body?.term ? String(body.term) : null;
    if (term && !TERMS.includes(term)) throw new AppError(`Term must be one of: ${TERMS.join(', ')}`, 400, 'VALIDATION_ERROR');

    let rule: any = null;
    let shape: { basis: string; value: number; applies_to: string; label: string };
    const reason = String(body?.reason || '').trim().slice(0, 500);
    if (body?.rule_id) {
      rule = await db('discount_rules').where({ id: body.rule_id, tenant_id: tenantId, active: true }).first();
      if (!rule) throw new AppError('That discount is not available.', 404, 'NOT_FOUND');
      shape = { basis: rule.basis, value: Number(rule.value), applies_to: rule.applies_to, label: rule.name };
      if (rule.kind === 'custom' && reason.length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    } else {
      // One-off waiver: needs a reason.
      if (reason.length < 5) throw new AppError('Give a reason for the waiver (at least 5 characters).', 400, 'VALIDATION_ERROR');
      const c = cleanRule({ name: body?.label || 'Waiver', kind: 'custom', basis: body?.basis, value: body?.value, applies_to: body?.applies_to });
      shape = { basis: c.basis, value: c.value, applies_to: c.applies_to, label: c.name };
    }

    const dup = await db('discount_grants')
      .where({ tenant_id: tenantId, student_id: student.id, academic_year: year })
      .whereIn('status', ['pending', 'approved'])
      .modify((q) => { if (rule) q.where('rule_id', rule.id); else q.whereNull('rule_id').where('label', shape.label); })
      .modify((q) => { if (term) q.where('term', term); else q.whereNull('term'); })
      .first();
    if (dup) throw new AppError(`${shape.label} is already ${dup.status} for this student in ${year}.`, 409, 'DUPLICATE');

    const draft = { tenant_id: tenantId, student_id: student.id, academic_year: year, term, ...shape, value: shape.value };
    const worth = await estimate(db, draft);
    const { discountApprovalThreshold } = await financeSettings(tenantId);
    const autoApprove = user.role === 'principal' || user.role === 'super_admin' || (discountApprovalThreshold > 0 && worth <= discountApprovalThreshold);

    let grant: any;
    let applied = 0;
    await db.transaction(async (trx) => {
      [grant] = await trx('discount_grants').insert({
        tenant_id: tenantId, student_id: student.id, rule_id: rule?.id || null, label: shape.label,
        academic_year: year, term, basis: shape.basis, value: shape.value, applies_to: shape.applies_to,
        reason: reason || null, status: autoApprove ? 'approved' : 'pending', requested_by: user.id,
        ...(autoApprove ? { decided_by: user.id, decided_at: new Date(), decision_reason: 'Auto-approved' } : {}),
      }).returning('*');
      if (autoApprove) applied = await this.applyGrant(trx, grant, user.id);
    });
    await audit('discount_grant', grant.id, autoApprove ? 'grant_approved' : 'grant_requested', user.id, { ...shape, year, term, worth, applied });
    return { grant, worth, applied, needsApproval: !autoApprove };
  },

  /** Apply an approved grant to the student's matching fees. Returns Le applied now. */
  async applyGrant(trx: Knex.Transaction, grant: any, userId: string | null): Promise<number> {
    if (grant.status !== 'approved') return 0;
    const fees = await grantFeesQuery(trx, grant).forUpdate();
    const already = await trx('fee_adjustments').where({ discount_grant_id: grant.id }).whereNull('reversed_at').select('fee_id', 'amount');
    const done = new Set(already.map((a: any) => String(a.fee_id)));
    const kind = grant.rule_id ? 'discount' : 'waiver';
    const label = `${grant.label}${grant.reason ? `: ${grant.reason}` : ''}`;
    let applied = 0;
    if (grant.basis === 'percent') {
      for (const f of fees) {
        if (done.has(String(f.id))) continue;
        applied += await applyAdjustment(trx, f, round2((Number(f.amount) * Number(grant.value)) / 100), kind, { reason: label, userId, grantId: grant.id });
      }
    } else {
      let remaining = round2(Number(grant.value) - already.reduce((s: number, a: any) => s + Number(a.amount), 0));
      for (const f of fees) {
        if (remaining <= 0) break;
        if (done.has(String(f.id))) continue;
        const a = await applyAdjustment(trx, f, remaining, kind, { reason: label, userId, grantId: grant.id });
        remaining = round2(remaining - a);
        applied += a;
      }
    }
    return round2(applied);
  },

  /** After billing: apply every approved grant of the student to newly billed fees. */
  async applyApprovedGrantsForStudent(trx: Knex.Transaction, tenantId: string, studentId: string, year: string): Promise<number> {
    const grants = await trx('discount_grants').where({ tenant_id: tenantId, student_id: studentId, academic_year: year, status: 'approved' });
    let total = 0;
    for (const g of grants) total += await this.applyGrant(trx, g, null);
    return round2(total);
  },

  async decide(tenantId: string, userId: string, id: string, decision: 'approve' | 'reject', reason: string) {
    let grant: any;
    let applied = 0;
    await db.transaction(async (trx) => {
      grant = await trx('discount_grants').where({ id, tenant_id: tenantId }).forUpdate().first();
      if (!grant) throw new AppError('Discount request not found', 404, 'NOT_FOUND');
      if (grant.status !== 'pending') throw new AppError(`This request is already ${grant.status}.`, 409, 'CONFLICT');
      if (decision === 'reject' && reason.trim().length < 5) throw new AppError('Give a reason for rejecting (at least 5 characters).', 400, 'VALIDATION_ERROR');
      const status = decision === 'approve' ? 'approved' : 'rejected';
      await trx('discount_grants').where({ id }).update({ status, decided_by: userId, decided_at: new Date(), decision_reason: reason || null, updated_at: new Date() });
      grant.status = status;
      if (status === 'approved') applied = await this.applyGrant(trx, grant, userId);
    });
    await audit('discount_grant', id, decision, userId, { reason, applied });
    return { id, status: grant.status, applied };
  },

  /** Withdraw an approved discount: its lines come off and the amounts are owed again. */
  async revoke(tenantId: string, userId: string, id: string, reason: string) {
    if (reason.trim().length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    let restored = 0;
    await db.transaction(async (trx) => {
      const grant = await trx('discount_grants').where({ id, tenant_id: tenantId }).forUpdate().first();
      if (!grant) throw new AppError('Discount not found', 404, 'NOT_FOUND');
      if (grant.status !== 'approved' && grant.status !== 'pending') throw new AppError(`This discount is already ${grant.status}.`, 409, 'CONFLICT');
      const adjs = await trx('fee_adjustments').where({ discount_grant_id: id }).whereNull('reversed_at');
      for (const a of adjs) restored += await reverseAdjustment(trx, a, userId);
      await trx('discount_grants').where({ id }).update({ status: 'revoked', decided_by: userId, decided_at: new Date(), decision_reason: reason, updated_at: new Date() });
    });
    await audit('discount_grant', id, 'revoke', userId, { reason, restored });
    return { id, status: 'revoked', restored: round2(restored) };
  },

  /**
   * Students who qualify for a sibling rule: the Nth+ child (by date of birth,
   * oldest first) among a parent's children enrolled this year, without the
   * rule yet. Families are linked by the parent account (guardians.user_id).
   */
  async siblingCandidates(tenantId: string, ruleId: string, year: string) {
    const rule = await db('discount_rules').where({ id: ruleId, tenant_id: tenantId, kind: 'sibling' }).first();
    if (!rule) throw new AppError('Sibling discount not found', 404, 'NOT_FOUND');
    const rows = await db('guardians as g')
      .join('students as s', 's.id', 'g.student_id')
      .leftJoin('users as u', 'u.id', 's.user_id')
      .where('s.tenant_id', tenantId).where('s.status', 'active').whereNotNull('g.user_id')
      .select('g.user_id as family', 's.id', 's.student_id', 's.date_of_birth', 's.created_at',
        db.raw("COALESCE(u.first_name || ' ' || u.last_name, s.first_name || ' ' || s.last_name) as name"));
    const families = new Map<string, any[]>();
    for (const r of rows) (families.get(r.family) ?? families.set(r.family, []).get(r.family)!).push(r);
    const granted = new Set((await db('discount_grants').where({ tenant_id: tenantId, rule_id: ruleId, academic_year: year })
      .whereIn('status', ['pending', 'approved']).select('student_id')).map((r: any) => String(r.student_id)));
    const out: any[] = [];
    const seen = new Set<string>();
    for (const kids of families.values()) {
      const uniq = kids.filter((k, i) => kids.findIndex((x) => x.id === k.id) === i)
        .sort((a, b) => String(a.date_of_birth || a.created_at).localeCompare(String(b.date_of_birth || b.created_at)));
      uniq.forEach((k, i) => {
        const order = i + 1;
        if (order >= (rule.sibling_order || 2) && !granted.has(String(k.id)) && !seen.has(String(k.id))) {
          seen.add(String(k.id));
          out.push({ student_id: k.id, admission_no: k.student_id, name: k.name, child_number: order, siblings: uniq.length });
        }
      });
    }
    return out;
  },
};

export default discountService;
