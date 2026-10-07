/**
 * Bank reconciliation (bursar Phase C, R6). The book side is the journal lines
 * on a cash / bank / mobile-money account (debit − credit = money in). The
 * bank side is imported statement lines (+ in, − out). A statement line is
 * matched to one or more book lines of the same total.
 */
import crypto from 'crypto';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { tenantToday } from '@utils/schoolDate';
import { audit, round2 } from './core';
import { glService } from './glService';

const cents = (n: any) => Math.round((Number(n) || 0) * 100);
const d10 = (v: any) => String(v instanceof Date ? v.toISOString() : v || '').slice(0, 10);
const days = (a: string, b: string) => Math.abs((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

async function cashAccount(tenantId: string, accountId: string) {
  const a = await db('gl_accounts').where({ id: accountId, tenant_id: tenantId }).first();
  if (!a) throw new AppError('Account not found', 404, 'NOT_FOUND');
  if (a.subtype !== 'cash') throw new AppError('Only cash, bank and mobile-money accounts can be reconciled.', 400, 'VALIDATION_ERROR');
  return a;
}

/** Book lines on the account not yet matched (signed cents, + = money in). */
async function unmatchedBook(tenantId: string, accountId: string, to?: string) {
  const rows = await db('gl_lines as l').join('gl_entries as e', 'e.id', 'l.entry_id')
    .leftJoin('bank_matches as m', 'm.gl_line_id', 'l.id')
    .where({ 'l.tenant_id': tenantId, 'l.account_id': accountId }).whereNull('m.id')
    .modify((q) => { if (to) q.where('e.entry_date', '<=', to); })
    .orderBy('e.entry_date', 'desc').orderBy('e.entry_no', 'desc')
    .limit(3000)
    .select('l.id', 'e.entry_no', 'e.entry_date', 'e.memo', 'e.source_type', 'l.memo as line_memo', db.raw('(l.debit - l.credit) as amount'));
  return rows.map((r: any) => ({ ...r, entry_date: d10(r.entry_date), amount: round2(r.amount), c: cents(r.amount) }));
}

export const bankRecService = {
  async accounts(tenantId: string) {
    await glService.ensureSynced(tenantId);
    const accs = await db('gl_accounts').where({ tenant_id: tenantId, subtype: 'cash', is_active: true }).orderBy('code');
    const out = [];
    for (const a of accs) {
      const book = await db('gl_lines').where({ tenant_id: tenantId, account_id: a.id }).sum({ s: db.raw('debit - credit') }).first();
      const st = await db('bank_statement_lines').where({ tenant_id: tenantId, account_id: a.id })
        .select(db.raw("COUNT(*) FILTER (WHERE status = 'unmatched') as unmatched"), db.raw('MAX(txn_date) as last_date'), db.raw('COUNT(*) as total')).first();
      out.push({ id: a.id, code: a.code, name: a.name, system_key: a.system_key, book_balance: round2((book as any)?.s), statement_lines: Number((st as any)?.total || 0), unmatched: Number((st as any)?.unmatched || 0), last_statement_date: (st as any)?.last_date ? d10((st as any).last_date) : null });
    }
    return out;
  },

  async view(tenantId: string, accountId: string, q: { to?: string; statement_balance?: string }) {
    await glService.ensureSynced(tenantId);
    const a = await cashAccount(tenantId, accountId);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(q.to || '')) ? String(q.to) : await tenantToday(tenantId);
    const lines = await db('bank_statement_lines').where({ tenant_id: tenantId, account_id: accountId }).where('txn_date', '<=', to)
      .orderBy('txn_date', 'desc').orderBy('created_at', 'desc').limit(3000);
    const matches = lines.length
      ? await db('bank_matches as m').join('gl_lines as l', 'l.id', 'm.gl_line_id').join('gl_entries as e', 'e.id', 'l.entry_id')
        .whereIn('m.statement_line_id', lines.map((l: any) => l.id))
        .select('m.statement_line_id', 'l.id', 'e.entry_no', 'e.entry_date', 'e.memo', db.raw('(l.debit - l.credit) as amount'))
      : [];
    const byLine = new Map<string, any[]>();
    for (const m of matches) {
      if (!byLine.has(m.statement_line_id)) byLine.set(m.statement_line_id, []);
      byLine.get(m.statement_line_id)!.push({ ...m, entry_date: d10(m.entry_date), amount: round2(m.amount) });
    }
    const statement = lines.map((l: any) => ({ ...l, txn_date: d10(l.txn_date), amount: round2(l.amount), balance: l.balance == null ? null : round2(l.balance), matches: byLine.get(l.id) || [] }));
    const book = await unmatchedBook(tenantId, accountId, to);
    const bookBal = await db('gl_lines as l').join('gl_entries as e', 'e.id', 'l.entry_id').where({ 'l.tenant_id': tenantId, 'l.account_id': accountId }).where('e.entry_date', '<=', to).sum({ s: db.raw('l.debit - l.credit') }).first();
    const lastWithBal = statement.find((l: any) => l.balance != null);
    const given = q.statement_balance !== undefined && q.statement_balance !== '' && Number.isFinite(Number(q.statement_balance)) ? cents(q.statement_balance) : null;
    const stmtBal = given ?? (lastWithBal ? cents(lastWithBal.balance) : null);
    const unStmt = statement.filter((l: any) => l.status === 'unmatched').reduce((s: number, l: any) => s + cents(l.amount), 0);
    const unBook = book.reduce((s: number, l: any) => s + l.c, 0);
    const bookC = cents((bookBal as any)?.s);
    // statement − items only on the statement + items only in the books = books
    const difference = stmtBal == null ? null : round2((stmtBal - unStmt + unBook - bookC) / 100);
    return {
      account: { id: a.id, code: a.code, name: a.name }, as_at: to,
      statement, book: book.map(({ c: _c, ...r }: any) => r),
      summary: {
        book_balance: round2(bookC / 100), statement_balance: stmtBal == null ? null : round2(stmtBal / 100),
        unmatched_statement: round2(unStmt / 100), unmatched_statement_count: statement.filter((l: any) => l.status === 'unmatched').length,
        unmatched_book: round2(unBook / 100), unmatched_book_count: book.length,
        difference, reconciled: difference === 0,
      },
    };
  },

  async import(tenantId: string, userId: string, accountId: string, rows: any[]) {
    await cashAccount(tenantId, accountId);
    if (!Array.isArray(rows) || !rows.length) throw new AppError('The file has no rows to import.', 400, 'VALIDATION_ERROR');
    if (rows.length > 3000) throw new AppError('Import up to 3,000 lines at a time.', 400, 'VALIDATION_ERROR');
    const today = await tenantToday(tenantId);
    const batch = crypto.randomUUID();
    const seen = new Map<string, number>();
    const clean: any[] = [];
    rows.forEach((r, i) => {
      const date = String(r?.date || '').slice(0, 10);
      const amount = round2(Number(r?.amount));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) throw new AppError(`Row ${i + 1}: the date is missing, invalid or in the future.`, 400, 'VALIDATION_ERROR');
      if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1e11) throw new AppError(`Row ${i + 1}: the amount is missing or zero.`, 400, 'VALIDATION_ERROR');
      const description = r?.description ? String(r.description).trim().slice(0, 500) : null;
      const reference = r?.reference ? String(r.reference).trim().slice(0, 120) : null;
      const balance = r?.balance !== undefined && r?.balance !== null && r?.balance !== '' && Number.isFinite(Number(r.balance)) ? round2(Number(r.balance)) : null;
      // Identical lines inside one file are real (two equal deposits); re-importing the file is not.
      const base = `${date}|${amount.toFixed(2)}|${(reference || '').toLowerCase()}|${(description || '').toLowerCase().slice(0, 120)}`;
      const k = (seen.get(base) || 0) + 1;
      seen.set(base, k);
      clean.push({ tenant_id: tenantId, account_id: accountId, txn_date: date, amount, balance, description, reference, dedupe_key: `${base}|${k}`, import_batch: batch, imported_by: userId });
    });
    let inserted = 0;
    for (let i = 0; i < clean.length; i += 500) {
      const r = await db('bank_statement_lines').insert(clean.slice(i, i + 500)).onConflict(['account_id', 'dedupe_key']).ignore().returning('id');
      inserted += r.length;
    }
    await audit('bank_statement', accountId, 'import', userId, { batch, rows: clean.length, inserted });
    return { batch, inserted, skipped: clean.length - inserted };
  },

  async undoImport(tenantId: string, userId: string, batch: string) {
    const lines = await db('bank_statement_lines').where({ tenant_id: tenantId, import_batch: batch }).select('id', 'status');
    if (!lines.length) throw new AppError('That import was not found.', 404, 'NOT_FOUND');
    if (lines.some((l: any) => l.status === 'matched')) throw new AppError('Some lines from this import are matched. Unmatch them first.', 409, 'MATCHED');
    await db('bank_statement_lines').where({ tenant_id: tenantId, import_batch: batch }).del();
    await audit('bank_statement', null, 'undo_import', userId, { batch, removed: lines.length });
    return { removed: lines.length };
  },

  async autoMatch(tenantId: string, userId: string, accountId: string) {
    await glService.ensureSynced(tenantId);
    await cashAccount(tenantId, accountId);
    return db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`bank:${accountId}`]);
      const stmt = await trx('bank_statement_lines').where({ tenant_id: tenantId, account_id: accountId, status: 'unmatched' }).orderBy('txn_date');
      const book = await unmatchedBook(tenantId, accountId);
      const used = new Set<string>();
      const pairs: Array<{ s: string; l: string }> = [];
      for (const s of stmt) {
        const sc = cents(s.amount), sd = d10(s.txn_date), ref = String(s.reference || '').toLowerCase();
        let best: any = null, bestScore = Infinity;
        for (const b of book) {
          if (used.has(b.id) || b.c !== sc) continue;
          const gap = days(sd, b.entry_date);
          if (gap > 7) continue;
          const text = `${b.memo || ''} ${b.line_memo || ''} ${b.entry_no}`.toLowerCase();
          const score = (ref && ref.length >= 3 && text.includes(ref) ? 0 : 100) + gap;
          if (score < bestScore) { best = b; bestScore = score; }
        }
        if (best) { used.add(best.id); pairs.push({ s: s.id, l: best.id }); }
      }
      if (pairs.length) {
        await trx('bank_matches').insert(pairs.map((p) => ({ tenant_id: tenantId, statement_line_id: p.s, gl_line_id: p.l, created_by: userId })));
        await trx('bank_statement_lines').whereIn('id', pairs.map((p) => p.s)).update({ status: 'matched' });
      }
      await audit('bank_match', accountId, 'auto_match', userId, { matched: pairs.length });
      return { matched: pairs.length, remaining: stmt.length - pairs.length };
    });
  },

  async match(tenantId: string, userId: string, statementLineId: string, glLineIds: string[]) {
    const ids = Array.from(new Set((Array.isArray(glLineIds) ? glLineIds : []).map(String)));
    if (!ids.length) throw new AppError('Choose the book items to match.', 400, 'VALIDATION_ERROR');
    return db.transaction(async (trx) => {
      const s = await trx('bank_statement_lines').where({ id: statementLineId, tenant_id: tenantId }).forUpdate().first();
      if (!s) throw new AppError('Statement line not found', 404, 'NOT_FOUND');
      if (s.status !== 'unmatched') throw new AppError(`This line is ${s.status}.`, 409, 'CONFLICT');
      const ls = await trx('gl_lines').where({ tenant_id: tenantId, account_id: s.account_id }).whereIn('id', ids);
      if (ls.length !== ids.length) throw new AppError('Every book item must be on the same account.', 400, 'VALIDATION_ERROR');
      if (await trx('bank_matches').whereIn('gl_line_id', ids).first()) throw new AppError('A book item is already matched.', 409, 'CONFLICT');
      const total = ls.reduce((x: number, l: any) => x + cents(l.debit) - cents(l.credit), 0);
      if (total !== cents(s.amount)) throw new AppError(`The book items total Le ${(total / 100).toFixed(2)}; the statement line is Le ${Number(s.amount).toFixed(2)}.`, 400, 'AMOUNT_MISMATCH');
      await trx('bank_matches').insert(ids.map((id) => ({ tenant_id: tenantId, statement_line_id: s.id, gl_line_id: id, created_by: userId })));
      await trx('bank_statement_lines').where({ id: s.id }).update({ status: 'matched' });
      await audit('bank_match', s.id, 'match', userId, { book_lines: ids.length, amount: Number(s.amount) });
      return { matched: true };
    });
  },

  async unmatch(tenantId: string, userId: string, statementLineId: string) {
    const s = await db('bank_statement_lines').where({ id: statementLineId, tenant_id: tenantId }).first();
    if (!s) throw new AppError('Statement line not found', 404, 'NOT_FOUND');
    await db.transaction(async (trx) => {
      await trx('bank_matches').where({ statement_line_id: s.id }).del();
      await trx('bank_statement_lines').where({ id: s.id }).update({ status: 'unmatched' });
    });
    await audit('bank_match', s.id, 'unmatch', userId, {});
    return { unmatched: true };
  },

  async ignore(tenantId: string, userId: string, statementLineId: string, ignored: boolean) {
    const s = await db('bank_statement_lines').where({ id: statementLineId, tenant_id: tenantId }).first();
    if (!s) throw new AppError('Statement line not found', 404, 'NOT_FOUND');
    if (s.status === 'matched') throw new AppError('Unmatch this line first.', 409, 'CONFLICT');
    await db('bank_statement_lines').where({ id: s.id }).update({ status: ignored ? 'ignored' : 'unmatched' });
    await audit('bank_statement', s.id, ignored ? 'ignore' : 'unignore', userId, {});
    return { status: ignored ? 'ignored' : 'unmatched' };
  },

  /** A statement item missing from the books (bank charges, interest): journal it and match it. */
  async addToBooks(tenantId: string, userId: string, statementLineId: string, counterAccountId: string, memo?: string) {
    const s = await db('bank_statement_lines').where({ id: statementLineId, tenant_id: tenantId }).first();
    if (!s) throw new AppError('Statement line not found', 404, 'NOT_FOUND');
    if (s.status !== 'unmatched') throw new AppError(`This line is ${s.status}.`, 409, 'CONFLICT');
    if (counterAccountId === s.account_id) throw new AppError('Choose a different account for the other side.', 400, 'VALIDATION_ERROR');
    const amt = Math.abs(round2(Number(s.amount)));
    const moneyIn = Number(s.amount) > 0;
    return db.transaction(async (trx) => {
      const entry = await glService.postManual(tenantId, userId, {
        entry_date: d10(s.txn_date),
        memo: String(memo || s.description || s.reference || 'Bank statement item').slice(0, 300),
        lines: [
          { account_id: s.account_id, debit: moneyIn ? amt : 0, credit: moneyIn ? 0 : amt },
          { account_id: counterAccountId, debit: moneyIn ? 0 : amt, credit: moneyIn ? amt : 0 },
        ],
      }, { trx });
      const bankLine = entry.lines.find((l: any) => l.account_id === s.account_id);
      await trx('bank_matches').insert({ tenant_id: tenantId, statement_line_id: s.id, gl_line_id: bankLine.id, created_by: userId });
      await trx('bank_statement_lines').where({ id: s.id }).update({ status: 'matched' });
      return { entry_no: entry.entry_no };
    });
  },
};

export default bankRecService;
