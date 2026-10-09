/**
 * Payroll (bursar Phase B, R4): pay profiles, monthly pay runs, payslips,
 * Sierra Leone PAYE + NASSIT (rates editable per school in Settings).
 *
 * Lifecycle: draft (editable, regenerate) → approved (principal; locked) →
 * paid (creates the Salaries + employer NASSIT expenses) | cancelled (voids
 * them). One live run per month (partial unique index).
 */
// @ts-ignore pdfkit ships without TypeScript types
import PDFDocument from 'pdfkit';
import type { Knex } from 'knex';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { tenantToday } from '@utils/schoolDate';
import { logger } from '@utils/logger';
import { resolveTenantBranding } from '@services/email/emailBranding';
import { renderEmail, emailButton } from '@services/email/emailLayout';
import { round2, audit, notifyFinanceStaff, notifyUsers, cleanMoneyAccount } from './core';
import { expenseService, yearForDate, assertOpenYear } from './expenseService';

export type Band = { upto: number | null; rate: number };
type Line = { name: string; amount: number; taxable?: boolean };

/** Current Sierra Leone monthly PAYE bands (Income Tax Act 2000 as amended). */
export const DEFAULT_PAYE_BANDS: Band[] = [
  { upto: 600, rate: 0 }, { upto: 1200, rate: 15 }, { upto: 1800, rate: 20 }, { upto: 2400, rate: 25 }, { upto: null, rate: 30 },
];

export async function payrollSettings(tenantId: string) {
  const rows = await db('school_config_settings').where({ tenant_id: tenantId })
    .whereIn('setting_key', ['fin_paye_bands', 'fin_nassit_employee_pct', 'fin_nassit_employer_pct', 'fin_paye_after_nassit'])
    .select('setting_key', 'setting_value').catch(() => [] as any[]);
  const s: Record<string, any> = {};
  for (const r of rows) s[r.setting_key] = r.setting_value;
  let bands = DEFAULT_PAYE_BANDS;
  try {
    const parsed = typeof s.fin_paye_bands === 'string' ? JSON.parse(s.fin_paye_bands) : s.fin_paye_bands;
    if (Array.isArray(parsed) && parsed.length) bands = parsed.map((b: any) => ({ upto: b.upto === null || b.upto === '' ? null : Number(b.upto), rate: Number(b.rate) }));
  } catch { /* keep defaults */ }
  const pct = (v: any, d: number) => { const n = Number(v); return v === undefined || v === null || v === '' || !Number.isFinite(n) ? d : n; };
  return {
    bands,
    nassitEmployeePct: pct(s.fin_nassit_employee_pct, 5),
    nassitEmployerPct: pct(s.fin_nassit_employer_pct, 10),
    payeAfterNassit: s.fin_paye_after_nassit === undefined ? true : !(s.fin_paye_after_nassit === false || s.fin_paye_after_nassit === 'false'),
  };
}

export function validateBands(bands: any): Band[] {
  if (!Array.isArray(bands) || !bands.length) throw new AppError('Add at least one PAYE band.', 400, 'VALIDATION_ERROR');
  const out = bands.map((b: any) => ({ upto: b.upto === null || b.upto === '' || b.upto === undefined ? null : Number(b.upto), rate: Number(b.rate) }));
  let prev = 0;
  out.forEach((b, i) => {
    if (!(b.rate >= 0 && b.rate <= 100)) throw new AppError('Each PAYE rate must be between 0 and 100%.', 400, 'VALIDATION_ERROR');
    const last = i === out.length - 1;
    if (last ? b.upto !== null : !(b.upto !== null && b.upto > prev)) throw new AppError('Bands must go up in order, and only the last band has no upper limit.', 400, 'VALIDATION_ERROR');
    if (b.upto !== null) prev = b.upto;
  });
  return out;
}

/** PAYE on a monthly taxable amount (progressive bands). */
export function paye(taxable: number, bands: Band[]): number {
  let tax = 0, lower = 0;
  for (const b of bands) {
    const upper = b.upto === null ? Infinity : b.upto;
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * (b.rate / 100);
    if (taxable <= upper) break;
    lower = upper;
  }
  return round2(tax);
}

const cleanLines = (v: any): Line[] => (Array.isArray(v) ? v : [])
  .map((l: any) => ({ name: String(l?.name || '').trim().slice(0, 80), amount: round2(Number(l?.amount)), taxable: l?.taxable !== false }))
  .filter((l) => l.name && l.amount > 0);

/** Compute one payslip. */
export function computeSlip(
  p: { basic_salary: any; allowances: any; deductions: any; paye_applies: boolean; nassit_applies: boolean },
  st: Awaited<ReturnType<typeof payrollSettings>>,
  extras: Line[] = [],
  extraDeductions: Line[] = [],
) {
  const basic = round2(Number(p.basic_salary) || 0);
  const allowances = cleanLines(p.allowances);
  const earnings = [...allowances, ...extras];
  const gross = round2(basic + earnings.reduce((s, l) => s + l.amount, 0));
  const taxableGross = round2(basic + earnings.filter((l) => l.taxable !== false).reduce((s, l) => s + l.amount, 0));
  const nassitEmployee = p.nassit_applies ? round2((basic * st.nassitEmployeePct) / 100) : 0;
  const nassitEmployer = p.nassit_applies ? round2((basic * st.nassitEmployerPct) / 100) : 0;
  const taxable = round2(Math.max(0, taxableGross - (st.payeAfterNassit ? nassitEmployee : 0)));
  const tax = p.paye_applies ? paye(taxable, st.bands) : 0;
  const deductions = [...cleanLines(p.deductions), ...extraDeductions];
  const other = round2(deductions.reduce((s, l) => s + l.amount, 0));
  const totalDeductions = round2(tax + nassitEmployee + other);
  return { basic, allowances, gross, taxable, paye: tax, nassit_employee: nassitEmployee, nassit_employer: nassitEmployer, deductions, total_deductions: totalDeductions, net: round2(gross - totalDeductions) };
}

/** Everyone on the staff list with their pay profile (if any). */
async function staffWithProfiles(tenantId: string) {
  const prof = await db('staff_pay_profiles').where({ tenant_id: tenantId });
  const key = (k: string, id: string) => `${k}:${id}`;
  const byKey = new Map(prof.map((p: any) => [key(p.staff_kind, p.staff_ref_id), p]));
  const staff = await db('teachers as t').join('users as u', 'u.id', 't.user_id')
    .where('u.tenant_id', tenantId).whereNot('u.role', 'super_admin')
    .select('t.id', 't.teacher_id as staff_number', 't.designation', 't.status as tstatus', 'u.status', 'u.id as user_id', 'u.email', 'u.role',
      db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as name"));
  const support = await db('support_staff').where({ tenant_id: tenantId })
    .select('id', 'staff_id as staff_number', 'job_type as designation', 'status', db.raw("TRIM(CONCAT_WS(' ', first_name, last_name)) as name"));
  return [
    ...staff.map((s: any) => ({ kind: 'staff', ref: s.id, name: s.name, staff_number: s.staff_number, designation: s.designation || s.role, user_id: s.user_id, email: s.email, active: s.status === 'active' && (s.tstatus || 'active') === 'active', profile: byKey.get(key('staff', s.id)) || null })),
    ...support.map((s: any) => ({ kind: 'support', ref: s.id, name: s.name, staff_number: s.staff_number, designation: s.designation, user_id: null, email: null, active: s.status === 'active', profile: byKey.get(key('support', s.id)) || null })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

async function recalcRun(trx: Knex | Knex.Transaction, runId: string) {
  const t = await trx('payslips').where({ run_id: runId }).select(
    db.raw('COUNT(*) as n'), db.raw('COALESCE(SUM(gross),0) as gross'), db.raw('COALESCE(SUM(paye),0) as paye'),
    db.raw('COALESCE(SUM(nassit_employee),0) as ne'), db.raw('COALESCE(SUM(nassit_employer),0) as nr'),
    db.raw('COALESCE(SUM(total_deductions - paye - nassit_employee),0) as other'), db.raw('COALESCE(SUM(net),0) as net')).first() as any;
  await trx('payroll_runs').where({ id: runId }).update({
    staff_count: Number(t.n), gross: round2(t.gross), paye: round2(t.paye), nassit_employee: round2(t.ne), nassit_employer: round2(t.nr),
    other_deductions: round2(t.other), net: round2(t.net), updated_at: new Date(),
  });
}

async function lockedRun(trx: Knex.Transaction, tenantId: string, runId: string) {
  const r = await trx('payroll_runs').where({ id: runId, tenant_id: tenantId }).forUpdate().first();
  if (!r) throw new AppError('Pay run not found', 404, 'NOT_FOUND');
  return r;
}

/**
 * Separation of duties: only the principal changes the pay of the person
 * running payroll. The bursar can't edit their own pay details or payslip.
 */
const isPrincipalRole = (role?: string) => role === 'principal' || role === 'super_admin';
async function assertNotOwnPay(tenantId: string, userId: string, role: string | undefined, staffKind: string, staffRefId: string) {
  if (isPrincipalRole(role) || staffKind !== 'staff') return;
  const t = await db('teachers').where({ id: staffRefId }).first('user_id');
  if (t?.user_id && String(t.user_id) === String(userId)) {
    throw new AppError('You can\'t change your own pay. Ask the principal to do it.', 403, 'OWN_PAY');
  }
}

export const payrollService = {
  settings: payrollSettings,

  async staff(tenantId: string) {
    const st = await payrollSettings(tenantId);
    return (await staffWithProfiles(tenantId)).map((s) => ({
      ...s,
      preview: s.profile ? computeSlip(s.profile, st) : null,
    }));
  },

  async saveProfile(tenantId: string, userId: string, body: any, role?: string) {
    const kind = body?.staff_kind === 'support' ? 'support' : body?.staff_kind === 'staff' ? 'staff' : null;
    if (!kind || !body?.staff_ref_id) throw new AppError('Choose a staff member.', 400, 'VALIDATION_ERROR');
    await assertNotOwnPay(tenantId, userId, role, kind, body.staff_ref_id);
    const exists = kind === 'staff'
      ? await db('teachers as t').join('users as u', 'u.id', 't.user_id').where({ 't.id': body.staff_ref_id, 'u.tenant_id': tenantId }).first()
      : await db('support_staff').where({ id: body.staff_ref_id, tenant_id: tenantId }).first();
    if (!exists) throw new AppError('Staff member not found in this school.', 404, 'NOT_FOUND');
    const basic = round2(Number(body?.basic_salary));
    if (!(basic >= 0) || basic > 1e9) throw new AppError('Enter a valid basic salary.', 400, 'VALIDATION_ERROR');
    const method = ['bank', 'cash', 'mobile_money', 'cheque'].includes(body?.payment_method) ? body.payment_method : 'bank';
    const row = {
      tenant_id: tenantId, staff_kind: kind, staff_ref_id: body.staff_ref_id, basic_salary: basic,
      allowances: JSON.stringify(cleanLines(body?.allowances)), deductions: JSON.stringify(cleanLines(body?.deductions)),
      paye_applies: body?.paye_applies !== false, nassit_applies: body?.nassit_applies !== false,
      payment_method: method, bank_name: body?.bank_name ? String(body.bank_name).slice(0, 100) : null,
      account_number: body?.account_number ? String(body.account_number).slice(0, 60) : null,
      active: body?.active !== false, updated_by: userId, updated_at: new Date(),
    };
    const [saved] = await db('staff_pay_profiles').insert(row).onConflict(['tenant_id', 'staff_kind', 'staff_ref_id']).merge().returning('*');
    await audit('pay_profile', saved.id, 'save', userId, { ...row, account_number: row.account_number ? '••••' : null });
    return saved;
  },

  async runs(tenantId: string) {
    return db('payroll_runs as r').leftJoin('users as a', 'a.id', 'r.approved_by').leftJoin('users as p', 'p.id', 'r.paid_by')
      .where('r.tenant_id', tenantId)
      .select('r.*', db.raw("TRIM(CONCAT_WS(' ', a.first_name, a.last_name)) as approved_by_name"), db.raw("TRIM(CONCAT_WS(' ', p.first_name, p.last_name)) as paid_by_name"))
      .orderBy('r.period', 'desc').orderBy('r.created_at', 'desc').limit(60);
  },

  async run(tenantId: string, runId: string) {
    const r = await db('payroll_runs').where({ id: runId, tenant_id: tenantId }).first();
    if (!r) throw new AppError('Pay run not found', 404, 'NOT_FOUND');
    const slips = await db('payslips').where({ run_id: runId }).orderBy('staff_name');
    return { ...r, payslips: slips };
  },

  async fillSlips(trx: Knex.Transaction, tenantId: string, runId: string) {
    const st = await payrollSettings(tenantId);
    const staff = (await staffWithProfiles(tenantId)).filter((s) => s.active && s.profile && s.profile.active && Number(s.profile.basic_salary) > 0);
    await trx('payslips').where({ run_id: runId }).del();
    for (const s of staff) {
      const c = computeSlip(s.profile, st);
      await trx('payslips').insert({
        run_id: runId, tenant_id: tenantId, staff_kind: s.kind, staff_ref_id: s.ref, user_id: s.user_id,
        staff_name: s.name, staff_number: s.staff_number, designation: s.designation,
        basic: c.basic, allowances: JSON.stringify(c.allowances), extras: '[]', deductions: JSON.stringify(c.deductions),
        gross: c.gross, taxable: c.taxable, paye: c.paye, nassit_employee: c.nassit_employee, nassit_employer: c.nassit_employer,
        total_deductions: c.total_deductions, net: c.net,
        payment_method: s.profile.payment_method, bank_name: s.profile.bank_name, account_number: s.profile.account_number, email: s.email,
      });
    }
    await recalcRun(trx, runId);
    return staff.length;
  },

  async generate(tenantId: string, userId: string, period: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) throw new AppError('Choose the month (YYYY-MM).', 400, 'VALIDATION_ERROR');
    const year = await yearForDate(tenantId, `${period}-01`);
    await assertOpenYear(tenantId, year, 'payroll');
    let run: any;
    try {
      await db.transaction(async (trx) => {
        [run] = await trx('payroll_runs').insert({ tenant_id: tenantId, period, academic_year: year, status: 'draft', created_by: userId }).returning('*');
        const n = await this.fillSlips(trx, tenantId, run.id);
        if (!n) throw new AppError('No staff have a salary set. Add pay details under Staff pay first.', 400, 'NO_PROFILES');
      });
    } catch (e: any) {
      if (e?.code === '23505') throw new AppError(`There is already a pay run for ${period}. Open it, or cancel it first.`, 409, 'DUPLICATE');
      throw e;
    }
    await audit('payroll_run', run.id, 'generate', userId, { period });
    await notifyFinanceStaff(tenantId, ['principal'], {
      subject: `Pay run ${period} ready for approval`,
      message: `The ${period} payroll draft is ready. Check it and approve it so it can be paid.`,
      url: '/finance/payroll', sourceType: 'payroll_run', sourceId: run.id, exceptUserId: userId,
    });
    return this.run(tenantId, run.id);
  },

  async regenerate(tenantId: string, userId: string, runId: string) {
    await db.transaction(async (trx) => {
      const r = await lockedRun(trx, tenantId, runId);
      if (r.status !== 'draft') throw new AppError('Only a draft pay run can be recalculated.', 409, 'LOCKED');
      await this.fillSlips(trx, tenantId, runId);
    });
    await audit('payroll_run', runId, 'regenerate', userId, {});
    return this.run(tenantId, runId);
  },

  /** One-off additions (bonus, overtime) and deductions on a draft payslip. */
  async editSlip(tenantId: string, userId: string, slipId: string, body: any, role?: string) {
    await db.transaction(async (trx) => {
      const slip = await trx('payslips').where({ id: slipId, tenant_id: tenantId }).forUpdate().first();
      if (!slip) throw new AppError('Payslip not found', 404, 'NOT_FOUND');
      if (!isPrincipalRole(role) && slip.user_id && String(slip.user_id) === String(userId)) {
        throw new AppError('You can\'t change your own payslip. Ask the principal to do it.', 403, 'OWN_PAY');
      }
      const r = await lockedRun(trx, tenantId, slip.run_id);
      if (r.status !== 'draft') throw new AppError('This pay run is locked. Only drafts can be changed.', 409, 'LOCKED');
      const profile = await trx('staff_pay_profiles').where({ tenant_id: tenantId, staff_kind: slip.staff_kind, staff_ref_id: slip.staff_ref_id }).first();
      const st = await payrollSettings(tenantId);
      const extras = cleanLines(body?.extras);
      const oneOffDeductions = cleanLines(body?.one_off_deductions);
      const c = computeSlip(profile || { basic_salary: slip.basic, allowances: slip.allowances, deductions: [], paye_applies: true, nassit_applies: true }, st, extras, oneOffDeductions);
      if (c.net < 0) throw new AppError('Deductions are larger than the pay. Lower them.', 400, 'VALIDATION_ERROR');
      await trx('payslips').where({ id: slipId }).update({
        extras: JSON.stringify(extras), deductions: JSON.stringify(c.deductions), gross: c.gross, taxable: c.taxable, paye: c.paye,
        nassit_employee: c.nassit_employee, nassit_employer: c.nassit_employer, total_deductions: c.total_deductions, net: c.net, updated_at: new Date(),
      });
      await recalcRun(trx, slip.run_id);
    });
    await audit('payslip', slipId, 'edit', userId, body);
    return db('payslips').where({ id: slipId }).first();
  },

  async removeSlip(tenantId: string, userId: string, slipId: string, role?: string) {
    await db.transaction(async (trx) => {
      const slip = await trx('payslips').where({ id: slipId, tenant_id: tenantId }).first();
      if (!slip) throw new AppError('Payslip not found', 404, 'NOT_FOUND');
      if (!isPrincipalRole(role) && slip.user_id && String(slip.user_id) === String(userId)) {
        throw new AppError('You can\'t remove your own payslip. Ask the principal to do it.', 403, 'OWN_PAY');
      }
      const r = await lockedRun(trx, tenantId, slip.run_id);
      if (r.status !== 'draft') throw new AppError('This pay run is locked.', 409, 'LOCKED');
      await trx('payslips').where({ id: slipId }).del();
      await recalcRun(trx, slip.run_id);
    });
    await audit('payslip', slipId, 'remove', userId, {});
    return { id: slipId, removed: true };
  },

  async approve(tenantId: string, userId: string, runId: string) {
    await db.transaction(async (trx) => {
      const r = await lockedRun(trx, tenantId, runId);
      if (r.status !== 'draft') throw new AppError(`This pay run is already ${r.status}.`, 409, 'CONFLICT');
      if (!r.staff_count) throw new AppError('This pay run has no payslips.', 400, 'VALIDATION_ERROR');
      await trx('payroll_runs').where({ id: runId }).update({ status: 'approved', approved_by: userId, approved_at: new Date(), updated_at: new Date() });
    });
    await audit('payroll_run', runId, 'approve', userId, {});
    const ar = await db('payroll_runs').where({ id: runId }).first('period');
    await notifyFinanceStaff(tenantId, ['accountant'], {
      subject: `Pay run ${ar?.period || ''} approved`.trim(),
      message: 'The principal approved the payroll. Pay the staff, then mark the run as paid.',
      url: '/finance/payroll', sourceType: 'payroll_run', sourceId: runId, exceptUserId: userId,
    });
    return this.run(tenantId, runId);
  },

  /** Mark paid: records the salary cost and employer NASSIT as expenses (once). */
  async markPaid(tenantId: string, userId: string, runId: string, paymentDate?: string, paidFrom?: string) {
    const from = cleanMoneyAccount(paidFrom, 'bank');
    const date = String(paymentDate || await tenantToday(tenantId)).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('Set the payment date.', 400, 'VALIDATION_ERROR');
    if (date > await tenantToday(tenantId)) throw new AppError('The payment date cannot be in the future.', 400, 'VALIDATION_ERROR');
    await db.transaction(async (trx) => {
      const r = await lockedRun(trx, tenantId, runId);
      if (r.status === 'paid') throw new AppError('This pay run is already marked paid.', 409, 'ALREADY_PAID');
      if (r.status !== 'approved') throw new AppError('The principal must approve the pay run before it is paid.', 409, 'NOT_APPROVED');
      const year = await yearForDate(tenantId, date);
      const base = { tenant_id: tenantId, expense_date: date, academic_year: year, source: 'payroll' as const, source_id: runId, recorded_by: userId, payment_method: from === 'bank' ? 'bank_transfer' : from === 'mobile' ? 'mobile_money' : 'cash' };
      await expenseService.createLinked(trx, { ...base, category: 'Salaries', amount: Number(r.gross), description: `Salaries for ${r.period} (${r.staff_count} staff; PAYE Le ${Number(r.paye).toFixed(2)} and NASSIT Le ${Number(r.nassit_employee).toFixed(2)} withheld)` });
      if (Number(r.nassit_employer) > 0) {
        await expenseService.createLinked(trx, { ...base, category: 'Statutory (PAYE/NASSIT)', amount: Number(r.nassit_employer), description: `Employer NASSIT for ${r.period}` });
      }
      await trx('payroll_runs').where({ id: runId }).update({ status: 'paid', paid_by: userId, paid_at: new Date(), payment_date: date, paid_from: from, updated_at: new Date() });
    });
    await audit('payroll_run', runId, 'paid', userId, { date, paid_from: from });
    // Tell each staff member with a login that their salary was paid.
    const run = await db('payroll_runs').where({ id: runId }).first('period');
    const slips = await db('payslips').where({ run_id: runId }).whereNotNull('user_id').select('user_id', 'net');
    for (const sl of slips) {
      await notifyUsers([sl.user_id], {
        subject: `Salary for ${run?.period} paid`,
        message: `Your net pay of Le ${Number(sl.net).toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${run?.period} was paid. Your payslip is under My Payslips.`,
        url: '/finance/my-payslips', sourceType: 'payroll_run', sourceId: runId,
      });
    }
    return this.run(tenantId, runId);
  },

  async cancel(tenantId: string, userId: string, runId: string, reason: string) {
    if (String(reason || '').trim().length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    await db.transaction(async (trx) => {
      const r = await lockedRun(trx, tenantId, runId);
      if (r.status === 'cancelled') throw new AppError('This pay run is already cancelled.', 409, 'CONFLICT');
      if (r.status === 'paid') await expenseService.voidLinked(trx, tenantId, 'payroll', runId, userId, `Pay run ${r.period} cancelled: ${reason}`);
      await trx('payroll_runs').where({ id: runId }).update({ status: 'cancelled', cancelled_reason: reason.trim().slice(0, 500), updated_at: new Date() });
    });
    await audit('payroll_run', runId, 'cancel', userId, { reason });
    return this.run(tenantId, runId);
  },

  /** Payslip as a PDF. */
  async slipPdf(tenantId: string, slipId: string): Promise<{ pdf: Buffer; slip: any; run: any }> {
    const slip = await db('payslips').where({ id: slipId, tenant_id: tenantId }).first();
    if (!slip) throw new AppError('Payslip not found', 404, 'NOT_FOUND');
    const run = await db('payroll_runs').where({ id: slip.run_id }).first();
    const branding = await resolveTenantBranding(tenantId);
    const le = (n: any) => `Le ${round2(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const parse = (v: any) => (typeof v === 'string' ? JSON.parse(v || '[]') : v || []);
    const monthLabel = new Date(`${run.period}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const pdf: Buffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 48 });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        const left = 48, right = doc.page.width - 48, W = right - left;
        doc.rect(0, 0, doc.page.width, 96).fill('#1a1a2e');
        doc.font('Helvetica-Bold').fontSize(17).fillColor('#ffffff').text(branding.name, left, 30, { width: W - 160 });
        doc.font('Helvetica').fontSize(9).fillColor('#a0aec0').text([branding.address, branding.contactPhone].filter(Boolean).join('  ·  '), left, 54, { width: W - 160 });
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#00d4aa').text('PAYSLIP', right - 150, 30, { width: 150, align: 'right' });
        doc.font('Helvetica').fontSize(9).fillColor('#a0aec0').text(monthLabel, right - 150, 48, { width: 150, align: 'right' });
        let y = 120;
        const kv = (k: string, v: string, x: number) => { doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(k, x, y); doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(v || '—', x, y + 12); };
        kv('Employee', slip.staff_name, left); kv('Staff No.', slip.staff_number || '—', left + 220); kv('Position', String(slip.designation || '').replace(/_/g, ' '), left + 360);
        y += 40;
        kv('Payment', `${String(slip.payment_method || '').replace(/_/g, ' ')}${slip.bank_name ? ` · ${slip.bank_name}` : ''}${slip.account_number ? ` · ••••${String(slip.account_number).slice(-4)}` : ''}`, left);
        kv('Status', run.status === 'paid' ? `Paid ${String(run.payment_date || '').slice(0, 10)}` : run.status, left + 360);
        y += 46;
        const col = (title: string, x: number, rows: Array<[string, any]>, total: [string, any]) => {
          let yy = y;
          doc.rect(x, yy, W / 2 - 8, 20).fill('#f1f5f9');
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111827').text(title, x + 8, yy + 6);
          yy += 26;
          for (const [k, v] of rows) { doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(k, x + 8, yy, { width: W / 2 - 110 }); doc.text(le(v), x + W / 2 - 110, yy, { width: 94, align: 'right' }); yy += 16; }
          doc.moveTo(x, yy + 2).lineTo(x + W / 2 - 8, yy + 2).strokeColor('#cbd5e1').stroke();
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(total[0], x + 8, yy + 8); doc.text(le(total[1]), x + W / 2 - 110, yy + 8, { width: 94, align: 'right' });
          return yy + 26;
        };
        const earnings: Array<[string, any]> = [['Basic salary', slip.basic], ...parse(slip.allowances).map((a: any) => [a.name, a.amount] as [string, any]), ...parse(slip.extras).map((a: any) => [a.name, a.amount] as [string, any])];
        const deds: Array<[string, any]> = [['PAYE (income tax)', slip.paye], ['NASSIT (employee)', slip.nassit_employee], ...parse(slip.deductions).map((d: any) => [d.name, d.amount] as [string, any])];
        const y1 = col('EARNINGS', left, earnings, ['Gross pay', slip.gross]);
        const y2 = col('DEDUCTIONS', left + W / 2 + 8, deds, ['Total deductions', slip.total_deductions]);
        y = Math.max(y1, y2) + 10;
        doc.roundedRect(left, y, W, 46, 8).fill('#ecfdf5');
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#047857').text('NET PAY', left + 14, y + 16);
        doc.fontSize(18).text(le(slip.net), left, y + 12, { width: W - 14, align: 'right' });
        y += 62;
        doc.font('Helvetica').fontSize(8.5).fillColor('#64748b')
          .text(`Taxable pay ${le(slip.taxable)}  ·  Employer NASSIT (paid by the school, not deducted) ${le(slip.nassit_employer)}`, left, y, { width: W });
        doc.fontSize(8).fillColor('#94a3b8').text('Computer-generated payslip. Keep it for your records.', left, doc.page.height - 60, { width: W, align: 'center' });
        doc.end();
      } catch (e) { reject(e); }
    });
    return { pdf, slip, run };
  },

  async emailSlips(tenantId: string, userId: string, runId: string) {
    const run = await db('payroll_runs').where({ id: runId, tenant_id: tenantId }).first();
    if (!run) throw new AppError('Pay run not found', 404, 'NOT_FOUND');
    if (!['approved', 'paid'].includes(run.status)) throw new AppError('Payslips are emailed once the pay run is approved.', 409, 'NOT_APPROVED');
    const slips = await db('payslips').where({ run_id: runId });
    const { default: emailService } = await import('@services/emailService');
    const branding = await resolveTenantBranding(tenantId);
    let sent = 0, skipped = 0, failed = 0;
    for (const s of slips) {
      if (!s.email) { skipped++; continue; }
      try {
        const { pdf } = await this.slipPdf(tenantId, s.id);
        const res: any = await (emailService as any).sendEmail({
          ...(emailService as any).senderFromBranding?.(branding),
          to: s.email,
          subject: `Your payslip for ${run.period} — ${branding.name}`,
          body: renderEmail({
            branding, eyebrow: 'Payslip', heading: `Your payslip for ${run.period}`, preheader: `Net pay Le ${Number(s.net).toFixed(2)}`,
            bodyHtml: `<p>Dear ${String(s.staff_name).replace(/[<>&]/g, '')},</p><p>Your payslip for <strong>${run.period}</strong> is attached as a PDF. Net pay: <strong>Le ${Number(s.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>.</p><p>You can also download it any time under <strong>My Payslips</strong> in the portal.</p>${emailButton('Open My Payslips', `${branding.appUrl}/finance/my-payslips`)}`,
          }),
          isHtml: true,
          attachments: [{ name: `Payslip-${run.period}-${s.staff_number || 'staff'}.pdf`, content: pdf.toString('base64') }],
        });
        if (res?.success === false) failed++; else sent++;
      } catch (e: any) { failed++; logger.warn(`Payslip email failed for ${s.id}: ${e?.message || e}`); }
    }
    await audit('payroll_run', runId, 'email_payslips', userId, { sent, skipped, failed });
    return { sent, skipped, failed };
  },

  /** A staff member's own payslips (approved and paid runs only). */
  async mySlips(tenantId: string, userId: string) {
    return db('payslips as s').join('payroll_runs as r', 'r.id', 's.run_id')
      .where({ 's.tenant_id': tenantId, 's.user_id': userId }).whereIn('r.status', ['approved', 'paid'])
      .select('s.id', 'r.period', 'r.status', 'r.payment_date', 's.gross', 's.paye', 's.nassit_employee', 's.total_deductions', 's.net')
      .orderBy('r.period', 'desc');
  },
};

export default payrollService;
