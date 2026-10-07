/**
 * Bursar finance Phase C routes (.kiro/specs/bursar-finance-phase-c):
 * chart of accounts, journal, financial statements, bank reconciliation and
 * the finance audit log. Mounted at /api/v1/finance. Finance staff only;
 * closing the books is principal only.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { db } from '@utils/database';
import { sendExport } from '@utils/exportResponse';
import { isFinanceStaff } from '@services/finance/core';
import { glService } from '@services/finance/glService';
import { glReportService } from '@services/finance/glReportService';
import { bankRecService } from '@services/finance/bankRecService';
import { financeAuditService } from '@services/finance/financeAuditService';

const router = Router();
router.use(authenticate, attachUserContext);

const staff = (req: Request, _res: Response, next: NextFunction) =>
  isFinanceStaff(req) ? next() : next(new AppError('Finance management is restricted to the bursar and principal.', 403, 'FORBIDDEN'));
const principal = (req: Request, _res: Response, next: NextFunction) =>
  ['principal', 'super_admin'].includes(String(req.user?.role || '')) ? next() : next(new AppError('Only the principal can close or reopen the books.', 403, 'FORBIDDEN'));
const T = (req: Request) => String(req.user!.tenant_id);
const U = (req: Request) => String(req.user!.id);
const wrap = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch((e: any) => {
  // 42P01 = table missing: migration 167 has not run on this database yet.
  if (e?.code === '42P01') return next(new AppError('Accounting is not set up on this server yet. Run the database migrations (167_bursar_finance_c).', 503, 'ACCOUNTING_NOT_READY'));
  next(e);
});
const le = (n: number) => `Le ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const blank = (n: number) => (n ? le(n) : '');

// ── Accounts ────────────────────────────────────────────────────────────────
router.get('/gl/accounts', staff, wrap(async (req, res) => res.json({ success: true, data: await glReportService.accounts(T(req)) })));
router.post('/gl/accounts', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await glService.saveAccount(T(req), U(req), req.body) })));
router.put('/gl/accounts/:id', staff, wrap(async (req, res) => res.json({ success: true, data: await glService.saveAccount(T(req), U(req), req.body, req.params.id) })));

// ── Journal ─────────────────────────────────────────────────────────────────
router.post('/gl/sync', staff, wrap(async (req, res) => res.json({ success: true, data: await glService.sync(T(req)) })));
router.get('/gl/journal', staff, wrap(async (req, res) => {
  await glService.ensureSynced(T(req));
  const q = req.query as Record<string, string>;
  const page = Math.max(0, Math.floor(Number(q.page) || 0));
  const size = Math.min(100, Math.max(10, Math.floor(Number(q.size) || 25)));
  const base = db('gl_entries as e').where('e.tenant_id', T(req)).modify((x) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.from || '')) x.where('e.entry_date', '>=', q.from);
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.to || '')) x.where('e.entry_date', '<=', q.to);
    if (q.academic_year) x.where('e.academic_year', q.academic_year);
    if (q.source) x.where('e.source_type', q.source);
    if (q.kind) x.where('e.kind', q.kind);
    if (q.account_id) x.whereIn('e.id', db('gl_lines').where('account_id', q.account_id).select('entry_id'));
    const t = String(q.search || '').trim();
    if (t) {
      const like = `%${t.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      x.where((w) => w.whereILike('e.memo', like).orWhereILike('e.entry_no', like));
    }
  });
  const total = Number((await base.clone().count('* as n').first() as any)?.n || 0);
  const entries = await base.clone().leftJoin('users as u', 'u.id', 'e.created_by')
    .orderBy('e.entry_date', 'desc').orderBy('e.entry_no', 'desc').limit(size).offset(page * size)
    .select('e.*', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as created_by_name"));
  const lines = entries.length
    ? await db('gl_lines as l').join('gl_accounts as a', 'a.id', 'l.account_id').whereIn('l.entry_id', entries.map((e: any) => e.id))
      .select('l.id', 'l.entry_id', 'l.account_id', 'a.code', 'a.name', 'l.debit', 'l.credit', 'l.memo').orderBy('l.debit', 'desc')
    : [];
  const by = new Map<string, any[]>();
  for (const l of lines) { if (!by.has(l.entry_id)) by.set(l.entry_id, []); by.get(l.entry_id)!.push({ ...l, debit: Number(l.debit), credit: Number(l.credit) }); }
  res.json({
    success: true,
    data: {
      total, page, size,
      rows: entries.map((e: any) => {
        const ls = by.get(e.id) || [];
        return { ...e, entry_date: String(e.entry_date instanceof Date ? e.entry_date.toISOString() : e.entry_date).slice(0, 10), lines: ls, total: Math.round(ls.reduce((s, l) => s + l.debit, 0) * 100) / 100 };
      }),
    },
  });
}));
router.post('/gl/journal', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await glService.postManual(T(req), U(req), req.body) })));
router.post('/gl/journal/:id/reverse', staff, wrap(async (req, res) => res.json({ success: true, data: await glService.reverse(T(req), U(req), req.params.id, String(req.body?.reason || '')) })));

// ── Closing the books ───────────────────────────────────────────────────────
router.get('/gl/lock', staff, wrap(async (req, res) => res.json({ success: true, data: { locked_until: await glService.lockDate(T(req)) } })));
router.put('/gl/lock', principal, wrap(async (req, res) => res.json({ success: true, data: await glService.setLockDate(T(req), U(req), req.body?.locked_until || null) })));

// ── Statements (JSON, or a file with ?format=csv|excel|pdf) ─────────────────
const fileOr = (build: (req: Request) => Promise<any>, toFile: (d: any) => { rows: any[]; columns: Record<string, string>; title: string; filename: string }) =>
  wrap(async (req, res) => {
    const d = await build(req);
    if (!req.query.format) return res.json({ success: true, data: d });
    const f = toFile(d);
    await sendExport(res, { format: req.query.format as string, tenantId: T(req), rows: f.rows, columns: f.columns, filename: f.filename, title: f.title, sheetName: f.title.slice(0, 30), highlightLastRow: true } as any);
  });

router.get('/gl/reports/trial-balance', staff, fileOr((req) => glReportService.trialBalance(T(req), req.query), (d) => ({
  title: `Trial Balance — ${d.range.label}`, filename: 'trial_balance',
  columns: { Code: 'code', Account: 'name', Debit: 'debit', Credit: 'credit' },
  rows: [...d.lines.map((l: any) => ({ code: l.code, name: l.name, debit: blank(l.debit), credit: blank(l.credit) })), { code: '', name: 'TOTAL', debit: le(d.total_debit), credit: le(d.total_credit) }],
})));
router.get('/gl/reports/income-statement', staff, fileOr((req) => glReportService.incomeStatement(T(req), req.query), (d) => ({
  title: `Income Statement — ${d.range.label}`, filename: 'income_statement',
  columns: { Section: 'section', Account: 'name', Amount: 'amount' },
  rows: [
    ...d.income.map((l: any) => ({ section: 'Income', name: `${l.code} ${l.name}`, amount: le(l.amount) })),
    { section: 'Income', name: 'Total income', amount: le(d.total_income) },
    ...d.expenses.map((l: any) => ({ section: 'Expenses', name: `${l.code} ${l.name}`, amount: le(l.amount) })),
    { section: 'Expenses', name: 'Total expenses', amount: le(d.total_expenses) },
    { section: '', name: d.surplus >= 0 ? 'SURPLUS' : 'DEFICIT', amount: le(d.surplus) },
  ],
})));
router.get('/gl/reports/balance-sheet', staff, fileOr((req) => glReportService.balanceSheet(T(req), req.query), (d) => ({
  title: `Balance Sheet — as at ${d.as_at}`, filename: 'balance_sheet',
  columns: { Section: 'section', Account: 'name', Amount: 'amount' },
  rows: [
    ...d.assets.map((l: any) => ({ section: 'Assets', name: `${l.code} ${l.name}`, amount: le(l.amount) })),
    { section: 'Assets', name: 'Total assets', amount: le(d.total_assets) },
    ...d.liabilities.map((l: any) => ({ section: 'Liabilities', name: `${l.code} ${l.name}`, amount: le(l.amount) })),
    { section: 'Liabilities', name: 'Total liabilities', amount: le(d.total_liabilities) },
    ...d.equity.map((l: any) => ({ section: 'Equity', name: `${l.code} ${l.name}`, amount: le(l.amount) })),
    { section: 'Equity', name: 'Total equity', amount: le(d.total_equity) },
    { section: '', name: 'LIABILITIES + EQUITY', amount: le(d.total_liabilities + d.total_equity) },
  ],
})));
router.get('/gl/reports/cash-flow', staff, fileOr((req) => glReportService.cashFlow(T(req), req.query), (d) => ({
  title: `Cash Flow — ${d.range.label}`, filename: 'cash_flow',
  columns: { Section: 'section', Item: 'label', Amount: 'amount' },
  rows: [
    { section: '', label: 'Opening cash', amount: le(d.opening_cash) },
    ...d.operating.map((l: any) => ({ section: 'Operating', label: l.label, amount: le(l.amount) })),
    { section: 'Operating', label: 'Net cash from operating activities', amount: le(d.net_operating) },
    ...d.investing.map((l: any) => ({ section: 'Investing', label: l.label, amount: le(l.amount) })),
    ...d.financing.map((l: any) => ({ section: 'Financing', label: l.label, amount: le(l.amount) })),
    { section: '', label: 'Net change in cash', amount: le(d.net_change) },
    { section: '', label: 'CLOSING CASH', amount: le(d.closing_cash) },
  ],
})));
router.get('/gl/reports/ledger/:accountId', staff, fileOr((req) => glReportService.ledger(T(req), req.params.accountId, req.query), (d) => ({
  title: `Ledger ${d.account.code} ${d.account.name} — ${d.range.label}`, filename: `ledger_${d.account.code}`,
  columns: { Date: 'date', Entry: 'no', Details: 'memo', Debit: 'debit', Credit: 'credit', Balance: 'balance' },
  rows: [
    { date: '', no: '', memo: 'Opening balance', debit: '', credit: '', balance: le(d.opening) },
    ...d.lines.map((l: any) => ({ date: l.entry_date, no: l.entry_no, memo: l.line_memo || l.memo || '', debit: blank(l.debit), credit: blank(l.credit), balance: le(l.balance) })),
    { date: '', no: '', memo: 'CLOSING BALANCE', debit: '', credit: '', balance: le(d.closing) },
  ],
})));
router.get('/gl/integrity', staff, wrap(async (req, res) => res.json({ success: true, data: await glReportService.integrity(T(req)) })));

// ── Bank reconciliation ─────────────────────────────────────────────────────
router.get('/bank/accounts', staff, wrap(async (req, res) => res.json({ success: true, data: await bankRecService.accounts(T(req)) })));
router.post('/bank/match', staff, wrap(async (req, res) => res.json({ success: true, data: await bankRecService.match(T(req), U(req), String(req.body?.statement_line_id || ''), req.body?.gl_line_ids) })));
router.post('/bank/unmatch', staff, wrap(async (req, res) => res.json({ success: true, data: await bankRecService.unmatch(T(req), U(req), String(req.body?.statement_line_id || '')) })));
router.post('/bank/lines/:id/ignore', staff, wrap(async (req, res) => res.json({ success: true, data: await bankRecService.ignore(T(req), U(req), req.params.id, req.body?.ignored !== false) })));
router.post('/bank/lines/:id/book', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await bankRecService.addToBooks(T(req), U(req), req.params.id, String(req.body?.account_id || ''), req.body?.memo) })));
router.delete('/bank/imports/:batch', staff, wrap(async (req, res) => res.json({ success: true, data: await bankRecService.undoImport(T(req), U(req), req.params.batch) })));
router.get('/bank/:accountId', staff, wrap(async (req, res) => res.json({ success: true, data: await bankRecService.view(T(req), req.params.accountId, req.query as any) })));
router.post('/bank/:accountId/import', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await bankRecService.import(T(req), U(req), req.params.accountId, req.body?.rows) })));
router.post('/bank/:accountId/auto-match', staff, wrap(async (req, res) => res.json({ success: true, data: await bankRecService.autoMatch(T(req), U(req), req.params.accountId) })));

// ── Finance audit log ───────────────────────────────────────────────────────
router.get('/audit', staff, wrap(async (req, res) => res.json({ success: true, data: await financeAuditService.list(T(req), req.query) })));

export default router;
