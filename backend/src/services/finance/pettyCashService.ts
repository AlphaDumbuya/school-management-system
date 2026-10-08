/**
 * Petty cash (bursar Phase B, R2). balance = top-ups − spends − returns (non-
 * voided). A spend also creates a linked expense; voiding the spend voids it.
 * Writes on one fund are serialised (advisory lock) so the balance can't go
 * negative under two clicks at once.
 */
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { tenantToday } from '@utils/schoolDate';
import { round2, audit, cleanMoneyAccount } from './core';
import { expenseService, cleanCategory, yearForDate, assertOpenYear } from './expenseService';

async function balanceOf(q: any, fundId: string): Promise<number> {
  const r = await q('petty_cash_entries').where({ fund_id: fundId }).whereNull('voided_at')
    .select(db.raw("COALESCE(SUM(CASE WHEN kind = 'top_up' THEN amount ELSE -amount END),0) as b")).first();
  return round2(Number(r?.b) || 0);
}

export const pettyCashService = {
  async funds(tenantId: string) {
    const funds = await db('petty_cash_funds as f').leftJoin('users as u', 'u.id', 'f.custodian_user_id')
      .where('f.tenant_id', tenantId).select('f.*', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as custodian_name")).orderBy('f.created_at');
    return Promise.all(funds.map(async (f: any) => {
      const bal = await balanceOf(db, f.id);
      return { ...f, float_amount: round2(f.float_amount), balance: bal, below_float: Number(f.float_amount) > 0 && bal < Number(f.float_amount) * 0.25 };
    }));
  },

  async saveFund(tenantId: string, userId: string, body: any, id?: string) {
    const name = String(body?.name || '').trim().slice(0, 120);
    if (!name) throw new AppError('Name the fund (e.g. Office float).', 400, 'VALIDATION_ERROR');
    const floatAmount = round2(Number(body?.float_amount) || 0);
    if (floatAmount < 0) throw new AppError('The float can\'t be negative.', 400, 'VALIDATION_ERROR');
    let custodian: string | null = body?.custodian_user_id || null;
    if (custodian) {
      const u = await db('users').where({ id: custodian, tenant_id: tenantId }).first();
      if (!u) throw new AppError('Custodian not found in this school.', 400, 'VALIDATION_ERROR');
    }
    const data = { name, float_amount: floatAmount, custodian_user_id: custodian, active: body?.active !== false, updated_at: new Date() };
    if (id) {
      const f = await db('petty_cash_funds').where({ id, tenant_id: tenantId }).first();
      if (!f) throw new AppError('Fund not found', 404, 'NOT_FOUND');
      const [row] = await db('petty_cash_funds').where({ id }).update(data).returning('*');
      await audit('petty_cash_fund', id, 'update', userId, data);
      return row;
    }
    const [row] = await db('petty_cash_funds').insert({ ...data, tenant_id: tenantId, created_by: userId }).returning('*');
    await audit('petty_cash_fund', row.id, 'create', userId, data);
    return row;
  },

  async entries(tenantId: string, fundId: string, year?: string) {
    const f = await db('petty_cash_funds').where({ id: fundId, tenant_id: tenantId }).first();
    if (!f) throw new AppError('Fund not found', 404, 'NOT_FOUND');
    const q = db('petty_cash_entries as e').leftJoin('users as u', 'u.id', 'e.recorded_by').where('e.fund_id', fundId)
      .select('e.*', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as recorded_by_name"))
      .orderBy('e.entry_date', 'desc').orderBy('e.created_at', 'desc');
    if (year) q.where('e.academic_year', year);
    return { fund: f, balance: await balanceOf(db, fundId), entries: (await q.limit(1000)).map((r: any) => ({ ...r, amount: round2(r.amount) })) };
  },

  async addEntry(tenantId: string, userId: string, fundId: string, body: any) {
    const kind = String(body?.kind || '');
    if (!['top_up', 'spend', 'return'].includes(kind)) throw new AppError('Choose top up, spend or return.', 400, 'VALIDATION_ERROR');
    const amount = round2(Number(body?.amount));
    if (!(amount > 0) || amount > 1e9) throw new AppError('Enter an amount above 0.', 400, 'VALIDATION_ERROR');
    const date = String(body?.entry_date || await tenantToday(tenantId)).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('Set a valid date.', 400, 'VALIDATION_ERROR');
    if (date > await tenantToday(tenantId)) throw new AppError('The date cannot be in the future.', 400, 'VALIDATION_ERROR');
    const year = await yearForDate(tenantId, date);
    await assertOpenYear(tenantId, year, 'petty cash');
    const description = String(body?.description || '').trim().slice(0, 500);
    let category: string | null = null;
    // Where a top-up came from / a return went to (books: bank, cash on hand or mobile money).
    const moneyAccount = kind === 'spend' ? null : cleanMoneyAccount(body?.money_account, 'bank');
    if (kind === 'spend') {
      category = cleanCategory(body?.category);
      if (!description) throw new AppError('Describe the spend (e.g. "Chalk and markers").', 400, 'VALIDATION_ERROR');
    }
    let entry: any;
    await db.transaction(async (trx) => {
      const fund = await trx('petty_cash_funds').where({ id: fundId, tenant_id: tenantId }).first();
      if (!fund) throw new AppError('Fund not found', 404, 'NOT_FOUND');
      if (!fund.active) throw new AppError('This fund is closed.', 409, 'CONFLICT');
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`petty:${fundId}`]);
      if (kind !== 'top_up') {
        const bal = await balanceOf(trx, fundId);
        if (amount > bal + 0.005) throw new AppError(`Only Le ${bal.toFixed(2)} is in the fund. Top it up first.`, 409, 'INSUFFICIENT_FUNDS');
      }
      [entry] = await trx('petty_cash_entries').insert({
        tenant_id: tenantId, fund_id: fundId, kind, amount, category, description: description || null,
        entry_date: date, academic_year: year, receipt_url: body?.receipt_url || null, recorded_by: userId, money_account: moneyAccount,
      }).returning('*');
      if (kind === 'spend') {
        const e = await expenseService.createLinked(trx, {
          tenant_id: tenantId, category: category!, amount, expense_date: date, academic_year: year,
          description: `Petty cash (${fund.name}): ${description}`, source: 'petty_cash', source_id: entry.id, recorded_by: userId,
          payment_method: 'cash', receipt_url: body?.receipt_url || null, vendor: body?.vendor ? String(body.vendor).slice(0, 150) : null,
        });
        await trx('petty_cash_entries').where({ id: entry.id }).update({ expense_id: e.id });
        entry.expense_id = e.id;
      }
    });
    await audit('petty_cash_entry', entry.id, kind, userId, { fundId, amount, category, description, money_account: moneyAccount });
    return { ...entry, balance: await balanceOf(db, fundId) };
  },

  async voidEntry(tenantId: string, userId: string, entryId: string, reason: string) {
    if (String(reason || '').trim().length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    await db.transaction(async (trx) => {
      const e = await trx('petty_cash_entries').where({ id: entryId, tenant_id: tenantId }).forUpdate().first();
      if (!e) throw new AppError('Entry not found', 404, 'NOT_FOUND');
      if (e.voided_at) throw new AppError('This entry is already void.', 409, 'CONFLICT');
      await assertOpenYear(tenantId, e.academic_year, 'petty cash');
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`petty:${e.fund_id}`]);
      if (e.kind === 'top_up') {
        const bal = await balanceOf(trx, e.fund_id);
        if (bal - Number(e.amount) < -0.005) throw new AppError('Some of this top-up has already been spent, so it can\'t be voided. Void the spends first.', 409, 'CONFLICT');
      }
      await trx('petty_cash_entries').where({ id: entryId }).update({ voided_at: new Date(), voided_by: userId, void_reason: reason.trim().slice(0, 500) });
      if (e.kind === 'spend') await expenseService.voidLinked(trx, tenantId, 'petty_cash', entryId, userId, `Petty cash entry voided: ${reason}`);
    });
    await audit('petty_cash_entry', entryId, 'void', userId, { reason });
    return { id: entryId, voided: true };
  },
};

export default pettyCashService;
