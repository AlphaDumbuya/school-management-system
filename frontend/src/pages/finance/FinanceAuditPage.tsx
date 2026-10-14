/**
 * Finance Audit Log (bursar Phase C, R7): who did what to the school's money
 * records, and when. Read-only, paged on the server.
 *
 * Audit rows store machine codes (entity type + action, e.g. `payroll_run` /
 * `paid`) and the raw details as JSON. Everything here turns those into plain
 * sentences, labelled fields, Leone amounts, dates and before → after changes;
 * the raw record stays available under "Technical details" for auditors.
 */
import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronDown, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { TablePager } from '@components/admin/table/TablePager';
import { bursarC } from '@services/bursarService';
import { unwrap, todayLocal } from '@components/finance/AccountingUi';

const field = 'min-h-[40px] sm:min-h-0 w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm';
const when = (v: string) => new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const sentence = (s: string) => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.]+/g, ' ').trim().toLowerCase().replace(/^./, (c) => c.toUpperCase());

// ── What happened: one plain sentence per (record type, action) ────────────
const ACTION_TEXT: Record<string, string> = {
  'fee:create': 'Added a fee', 'fee:bulk_create': 'Billed fees in bulk', 'fee:update_status': 'Changed a fee’s status',
  'fee:adjust_amount': 'Changed a fee amount', 'fee:delete': 'Deleted a fee', 'fee:send_balance_reminders': 'Sent fee balance reminders',
  'fee:late_fee_added': 'Added a late fee', 'fee:late_fee_waived': 'Waived a late fee',
  'invoice:create': 'Created an invoice', 'invoice:bulk_create': 'Generated invoices', 'invoice:update_status': 'Changed an invoice’s status',
  'invoice:void': 'Voided an invoice', 'invoice:send_reminder': 'Sent an invoice reminder',
  'payment:create': 'Recorded a payment', 'payment:bulk_record': 'Recorded payments in bulk', 'payment:refund': 'Refunded a payment',
  'receipt:email': 'Emailed a receipt', 'receipt:email_refund': 'Emailed a refund receipt', 'receipt:bulk_email': 'Emailed receipts in bulk',
  'discount_rule:create': 'Added a discount type', 'discount_rule:update': 'Changed a discount type',
  'discount_grant:grant_approved': 'Gave a discount (auto-approved)', 'discount_grant:grant_requested': 'Asked for a discount',
  'discount_grant:approve': 'Approved a discount', 'discount_grant:reject': 'Rejected a discount',
  'discount_grant:withdraw': 'Withdrew a discount request', 'discount_grant:revoke': 'Took back a discount',
  'student_credit:credit_note': 'Issued a credit note', 'student_credit:apply': 'Used student credit to pay fees', 'student_credit:refund': 'Paid student credit back',
  'payment_plan:create': 'Set up a payment plan', 'payment_plan:cancel': 'Cancelled a payment plan',
  'expense:create': 'Recorded an expense', 'expense:update': 'Changed an expense', 'expense:void': 'Voided an expense',
  'petty_cash_fund:create': 'Opened a petty cash fund', 'petty_cash_fund:update': 'Changed a petty cash fund',
  'petty_cash_entry:spend': 'Spent from petty cash', 'petty_cash_entry:top_up': 'Topped up petty cash',
  'petty_cash_entry:return': 'Returned petty cash', 'petty_cash_entry:void': 'Voided a petty cash entry',
  'budget:save': 'Saved the budget', 'budget:edit_approved': 'Edited the approved budget (reopened it)', 'budget:approve': 'Approved the budget',
  'pay_profile:save': 'Saved a staff member’s pay details',
  'payroll_run:generate': 'Started a pay run', 'payroll_run:regenerate': 'Recalculated a pay run', 'payroll_run:approve': 'Approved a pay run',
  'payroll_run:paid': 'Marked a pay run as paid', 'payroll_run:cancel': 'Cancelled a pay run', 'payroll_run:email_payslips': 'Emailed payslips to staff',
  'payslip:edit': 'Changed a payslip', 'payslip:remove': 'Took a payslip out of a pay run',
  'gl_entry:manual': 'Posted a manual journal', 'gl_entry:reverse': 'Reversed a journal',
  'gl_account:create': 'Added an account', 'gl_account:update': 'Changed an account',
  'books_lock:close': 'Closed the books', 'books_lock:reopen': 'Reopened the books',
  'bank_statement:import': 'Imported a bank statement', 'bank_statement:undo_import': 'Undid a statement import',
  'bank_statement:ignore': 'Ignored a statement line', 'bank_statement:unignore': 'Restored a statement line',
  'bank_match:match': 'Matched a statement line to the books', 'bank_match:unmatch': 'Unmatched a statement line', 'bank_match:auto_match': 'Auto-matched statement lines',
};
const VERB: Record<string, string> = {
  create: 'Created', update: 'Changed', save: 'Saved', delete: 'Deleted', void: 'Voided', approve: 'Approved', reject: 'Rejected',
  revoke: 'Took back', pay: 'Paid', paid: 'Paid', cancel: 'Cancelled', email: 'Emailed', regenerate: 'Recalculated', refund: 'Refunded',
  edit: 'Changed', remove: 'Removed', import: 'Imported', generate: 'Generated', record: 'Recorded', apply: 'Applied', issue: 'Issued',
};
const THING: Record<string, string> = {
  fee: 'a fee', fee_structure: 'a fee structure', invoice: 'an invoice', late_fee: 'a late fee', fee_adjustment: 'a fee adjustment',
  payment: 'a payment', refund: 'a refund', receipt: 'a receipt', discount_rule: 'a discount type', discount_grant: 'a discount',
  student_credit: 'student credit', payment_plan: 'a payment plan', expense: 'an expense', petty_cash_fund: 'a petty cash fund',
  petty_cash_entry: 'a petty cash entry', budget: 'the budget', pay_profile: 'staff pay details', pay_settings: 'the PAYE & NASSIT settings',
  payroll_run: 'a pay run', payslip: 'a payslip', gl_entry: 'a journal', gl_account: 'an account', books_lock: 'the books',
  bank_statement: 'a bank statement', bank_match: 'bank lines',
};
const actionText = (r: any) => {
  const key = `${r.entity_type}:${r.action}`;
  if (ACTION_TEXT[key]) return ACTION_TEXT[key];
  const a = String(r.action || '');
  // Dotted or prefixed codes such as "payment.recorded" read as a sentence.
  if (/[.:]/.test(a)) return sentence(a);
  if (VERB[a]) return `${VERB[a]} ${THING[r.entity_type] || sentence(r.entity_type).toLowerCase()}`;
  return `${sentence(a)}${THING[r.entity_type] ? ` · ${THING[r.entity_type].replace(/^(a|an|the) /, '')}` : ''}`;
};

// ── Field labels and how to show their values ──────────────────────────────
type Kind = 'money' | 'date' | 'month' | 'count' | 'percent' | 'hide' | 'text' | 'attachment';
const F: Record<string, [string, Kind?]> = {
  amount: ['Amount', 'money'], total: ['Total', 'money'], applied: ['Applied', 'money'], credited: ['Put on the family’s credit', 'money'],
  waived: ['Waived', 'money'], owed: ['Amount owed', 'money'], basic_salary: ['Basic salary', 'money'], float_amount: ['Float', 'money'],
  gross: ['Gross pay', 'money'], net: ['Net pay', 'money'], paye: ['PAYE', 'money'], nassit_employee: ['NASSIT (staff)', 'money'],
  nassit_employer: ['NASSIT (employer)', 'money'], other_deductions: ['Other deductions', 'money'], bonus: ['Bonus', 'money'], balance: ['Balance', 'money'],
  debit: ['Debit', 'money'], credit: ['Credit', 'money'], discount: ['Discount', 'money'],
  method: ['Payment method'], payment_method: ['Payment method'], money_account: ['Money account'], paid_from: ['Paid from'],
  bank_name: ['Bank or wallet'], account_number: ['Account number'], staff_kind: ['Staff type'], paye_applies: ['PAYE applies'],
  nassit_applies: ['NASSIT applies'], allowances: ['Allowances'], deductions: ['Deductions'], active: ['Active'], is_active: ['Active'],
  category: ['Category'], vendor: ['Paid to'], description: ['Description'], reference: ['Reference'], department: ['Department'],
  receipt_url: ['Receipt', 'attachment'], expense_date: ['Date', 'date'], entry_date: ['Date', 'date'], date: ['Date', 'date'],
  payment_date: ['Payment date', 'date'], due_date: ['Due', 'date'], academic_year: ['Academic year'], year: ['Academic year'], term: ['Term'],
  period: ['Month', 'month'], name: ['Name'], label: ['Discount'], kind: ['Type'], basis: ['Worked out as'], value: ['Value'],
  applies_to: ['Applies to'], sibling_order: ['From which child'], notes: ['Notes'], note: ['Note'], reason: ['Reason'], memo: ['Description'],
  entry_no: ['Journal no.'], reversal: ['Reversal journal'], code: ['Code'], type: ['Type'], subtype: ['Sub-type'], status: ['Status'],
  matched: ['Lines matched', 'count'], inserted: ['Lines imported', 'count'], rows: ['Rows in the file', 'count'], skipped: ['Skipped', 'count'],
  removed: ['Lines removed', 'count'], remaining: ['Still to match', 'count'], sent: ['Sent', 'count'], notified: ['People notified', 'count'],
  skippedNoEmail: ['Skipped (no email address)', 'count'], skippedNoBalance: ['Skipped (nothing owed)', 'count'], count: ['Count', 'count'],
  scope: ['Sent to'], to: ['Sent to'], receipt: ['Receipt no.'], receipt_number: ['Receipt no.'], instalments: ['Instalments'], lines: ['Lines'],
  locked_until: ['Books closed up to', 'date'], ignored: ['Ignored'], designation: ['Role'], staff_name: ['Staff member'],
  // Internal references: never useful to a reader.
  tenant_id: ['', 'hide'], school_id: ['', 'hide'], id: ['', 'hide'], ref: ['', 'hide'], batch: ['', 'hide'], student: ['', 'hide'],
  studentId: ['', 'hide'], feeIds: ['', 'hide'], fundId: ['', 'hide'], staff_ref_id: ['', 'hide'], custodian_user_id: ['', 'hide'],
  created_at: ['', 'hide'], updated_at: ['', 'hide'], created_by: ['', 'hide'], updated_by: ['', 'hide'],
};
const VALUE: Record<string, string> = {
  mobile_money: 'Mobile money', mobile: 'Mobile money', bank: 'Bank', cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque',
  card: 'Card', monime: 'Online (Monime)', orange_money: 'Orange Money', afrimoney: 'Afrimoney',
  staff_child: 'Staff child', sibling: 'Sibling', scholarship: 'Scholarship / bursary', custom: 'Custom',
  percent: 'A percentage', fixed: 'A fixed amount', tuition: 'Tuition', all: 'Everything', student: 'One student', class: 'A class',
  support: 'Support staff', professional: 'Teaching / professional staff', first_term: 'First term', second_term: 'Second term', third_term: 'Third term',
  asset: 'Asset', liability: 'Liability', equity: 'Equity', income: 'Income', expense: 'Expense', contra: 'Reduces income',
  approved: 'Approved', pending: 'Waiting for approval', rejected: 'Rejected', paid: 'Paid', draft: 'Draft', cancelled: 'Cancelled',
  top_up: 'Top-up', spend: 'Spend', return: 'Returned', petty_cash: 'Petty cash', payroll: 'Payroll', manual: 'Manual',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEYISH = /(amount|total|balance|gross|net|paye|nassit|salary|float|price|fee|cost|spent|budget|deduction|allowance|owed|paid)$/i;
const NOT_MONEY = /(count|rows|skipped|number|order|pct|percent|rate|sent|notified|matched|inserted|removed|days|_no$|from|method|account|date|_at$)/i;
const hidden = (k: string) => F[k]?.[1] === 'hide' || (!F[k] && (/(_id|Id|Ids|_ids)$/.test(k) || /_by$/.test(k)));
const labelOf = (k: string) => F[k]?.[0] || sentence(k);
const kindOf = (k: string): Kind => F[k]?.[1] || (MONEYISH.test(k) && !NOT_MONEY.test(k) ? 'money' : 'text');
const parse = (v: any) => {
  if (typeof v !== 'string' || !/^\s*[[{]/.test(v)) return v;
  try { return JSON.parse(v); } catch { return v; }
};
const money = (v: any) => `Le ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isNum = (v: any) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v));
const empty = (v: any) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);

/** One value, readable. `parent` gives context (e.g. a discount's `value` is a % or Le). */
function fmt(k: string, raw: any, parent?: any): string {
  const v = parse(raw);
  if (empty(v)) return '—';
  const kind = kindOf(k);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (kind === 'attachment') return 'Attached';
  if (k === 'value' && parent && isNum(v)) return parent.basis === 'percent' ? `${Number(v)}%` : money(v);
  if (kind === 'money' && isNum(v)) return money(v);
  if (kind === 'count' && isNum(v)) return Number(v).toLocaleString();
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return when(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' });
    if (/^\d{4}-\d{2}$/.test(v) && (kind === 'month' || k === 'period')) return new Date(`${v}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (UUID.test(v)) return '—';
    if (VALUE[v]) return VALUE[v];
    if (/^[a-z]+(_[a-z]+)+$/.test(v)) return sentence(v); // other snake_case codes
    return v;
  }
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== 'object' || x === null)) return v.map((x) => fmt(k, x)).join(', ');
    return `${v.length} item${v.length === 1 ? '' : 's'}`;
  }
  if (typeof v === 'object') return pairs(v).map(([kk, vv]) => `${labelOf(kk)}: ${fmt(kk, vv, v)}`).join(' · ') || '—';
  return String(v);
}
const pairs = (o: any): Array<[string, any]> => Object.entries(o || {}).filter(([k, v]) => !hidden(k) && !empty(parse(v)) && !(typeof v === 'string' && UUID.test(v)));

/** A list of objects (budget lines, instalments, allowances…) as a small table. */
const ItemTable: React.FC<{ k: string; items: any[] }> = ({ k, items }) => {
  const cols = Array.from(new Set(items.flatMap((x) => pairs(x).map(([c]) => c))));
  return (
    <div className="sm:col-span-2 min-w-0"><dt className="text-[11px] font-semibold text-gray-500">{labelOf(k)}</dt>
      <dd className="mt-1 overflow-x-auto"><table className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg">
        <thead className="bg-gray-100 dark:bg-gray-900 text-gray-500"><tr>{cols.map((c) => <th key={c} className="px-2 py-1 text-left font-semibold whitespace-nowrap">{labelOf(c)}</th>)}</tr></thead>
        <tbody>{items.map((x, i) => <tr key={i} className="border-t border-gray-100 dark:border-gray-800">{cols.map((c) => <td key={c} className={`px-2 py-1 ${kindOf(c) === 'money' || kindOf(c) === 'date' ? 'whitespace-nowrap text-right' : ''}`}>{fmt(c, x?.[c], x)}</td>)}</tr>)}</tbody>
      </table></dd></div>
  );
};

const Fields: React.FC<{ o: any }> = ({ o }) => (
  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
    {pairs(o).map(([k, raw]) => {
      const v = parse(raw);
      return Array.isArray(v) && v.some((x) => x && typeof x === 'object')
        ? <ItemTable key={k} k={k} items={v} />
        : <div key={k} className="flex gap-2 min-w-0"><dt className="text-gray-500 w-32 shrink-0">{labelOf(k)}</dt><dd className="font-medium break-words min-w-0">{fmt(k, v, o)}</dd></div>;
    })}
  </dl>
);

/** Before → after, only what changed. */
const Changes: React.FC<{ before: any; after: any }> = ({ before, after }) => {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})])).filter((k) => !hidden(k));
  const changed = keys.filter((k) => JSON.stringify(parse(before?.[k]) ?? null) !== JSON.stringify(parse(after?.[k]) ?? null) && after?.[k] !== undefined);
  if (!changed.length) return <p className="text-xs text-gray-500">Saved with no changes.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {changed.map((k) => (
        <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-gray-500 w-32 shrink-0">{labelOf(k)}</span>
          <span className="line-through text-gray-400 break-words">{fmt(k, before?.[k], before)}</span>
          <span aria-hidden="true" className="text-gray-400">→</span><span className="sr-only">changed to</span>
          <span className="font-medium break-words">{fmt(k, after?.[k], after)}</span>
        </li>
      ))}
    </ul>
  );
};

const Details: React.FC<{ r: any }> = ({ r }) => {
  const nv = parse(r.new_values), ov = parse(r.old_values), ch = parse(r.changes);
  const hasBA = nv && typeof nv === 'object' && !Array.isArray(nv) && ('before' in nv || 'after' in nv);
  const rest = hasBA ? Object.fromEntries(Object.entries(nv).filter(([k]) => k !== 'before' && k !== 'after')) : nv;
  const blocks: React.ReactNode[] = [];
  if (r.reason) blocks.push(<p key="r" className="text-xs"><span className="text-gray-500">Reason:</span> <span className="font-medium">{r.reason}</span></p>);
  const ba = hasBA ? [nv.before, nv.after] : ov && typeof ov === 'object' && nv && typeof nv === 'object' ? [ov, nv] : null;
  if (ba) {
    const [b, a] = ba;
    const isObj = (x: any) => x && typeof x === 'object' && !Array.isArray(x);
    blocks.push(
      <div key="ba"><div className="text-[11px] font-semibold text-gray-500 mb-1">What changed</div>
        {isObj(b) || isObj(a) ? <Changes before={isObj(b) ? b : {}} after={isObj(a) ? a : {}} />
          : <p className="text-xs"><span className="line-through text-gray-400">{fmt(r.entity_type === 'books_lock' ? 'locked_until' : 'value', b)}</span> <span aria-hidden="true">→</span><span className="sr-only">changed to</span> <span className="font-medium">{fmt(r.entity_type === 'books_lock' ? 'locked_until' : 'value', a)}</span></p>}
      </div>,
    );
  }
  if (rest && typeof rest === 'object' && pairs(rest).length && !(ov && !hasBA)) blocks.push(<Fields key="f" o={rest} />);
  if (ch && typeof ch === 'object' && pairs(ch).length) blocks.push(<Fields key="c" o={ch} />);
  if (typeof nv === 'string' && nv) blocks.push(<p key="s" className="text-xs">{nv}</p>);
  return (
    <div className="space-y-3">
      {blocks.length ? blocks : <p className="text-xs text-gray-500">No extra details were recorded.</p>}
      <details className="text-[11px] text-gray-500">
        <summary className="cursor-pointer select-none py-2 sm:py-0.5">Technical details (for auditors)</summary>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt>Action code</dt><dd className="font-mono break-all">{r.entity_type}/{r.action}</dd>
          {r.entity_id && <><dt>Record ID</dt><dd className="font-mono break-all">{r.entity_id}</dd></>}
          <dt>Log ID</dt><dd className="font-mono break-all">{r.id}</dd>
        </dl>
        {(nv || ov || ch) && <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-gray-100 dark:bg-gray-900 p-2 whitespace-pre-wrap break-all">{JSON.stringify({ details: nv, before: ov, changes: ch }, null, 2)}</pre>}
      </details>
    </div>
  );
};

// ── One-line summary: "Recorded an expense · Le 925.00 · Administration" ───
const summary = (r: any) => {
  const v = parse(r.new_values) || {};
  const after = v && typeof v === 'object' ? (v.after && typeof v.after === 'object' ? v.after : v) : {};
  const bits: string[] = [];
  const amt = after.amount ?? after.total ?? v.amount ?? v.total ?? v.applied ?? v.waived ?? v.owed;
  if (!empty(amt) && isNum(amt)) bits.push(money(amt));
  for (const k of ['label', 'name', 'category', 'entry_no', 'receipt', 'period', 'year', 'academic_year']) {
    if (!empty(after[k]) && typeof after[k] !== 'object') { bits.push(fmt(k, after[k], after)); break; }
  }
  if (!empty(after.vendor) && typeof after.vendor === 'string') bits.push(after.vendor);
  if (Array.isArray(v.lines)) bits.push(`${v.lines.length} line${v.lines.length === 1 ? '' : 's'}`);
  if (Array.isArray(v.instalments)) bits.push(`${v.instalments.length} instalment${v.instalments.length === 1 ? '' : 's'}`);
  if (isNum(v.matched)) bits.push(`${v.matched} matched`);
  if (isNum(v.inserted)) bits.push(`${v.inserted} line${Number(v.inserted) === 1 ? '' : 's'} imported`);
  if (isNum(v.sent)) bits.push(`${v.sent} sent`);
  if (r.entity_type === 'books_lock' && after && typeof v.after === 'string') bits.push(`up to ${fmt('locked_until', v.after)}`);
  return { text: actionText(r), extra: bits.filter((b) => b && b !== '—').join(' · ') };
};

export const FinanceAuditPage: React.FC = () => {
  const [area, setArea] = useState('');
  const [person, setPerson] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const params = { area: area || undefined, user_id: person || undefined, from: from || undefined, to: to || undefined, search: search || undefined, page, size };
  const q = useQuery({ queryKey: ['fin-gl-audit', params], queryFn: () => unwrap<any>(bursarC.audit(params), 'Could not load the audit log.'), placeholderData: keepPreviousData });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const d = q.data;
  return (
    <MainLayout>
      <PageShell title="Finance Audit Log" subtitle="Every change to fees, payments, discounts, expenses, payroll and the books, with who made it"
        onRefresh={() => q.refetch()} isRefreshing={q.isFetching} mobileLabels>
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:flex lg:flex-wrap lg:items-center gap-2 mb-3">
          <SearchBar placeholder="Search action, person or details…" onSearch={reset(setSearch)} className="xs:col-span-2 lg:max-w-xs lg:w-full" />
          <select aria-label="Area" value={area} onChange={(e) => reset(setArea)(e.target.value)} className={field}><option value="">All areas</option>{(d?.areas || []).map((a: string) => <option key={a} value={a}>{a}</option>)}</select>
          <select aria-label="Person" value={person} onChange={(e) => reset(setPerson)(e.target.value)} className={field}><option value="">Everyone</option>{(d?.people || []).map((p: any) => <option key={p.id} value={p.id}>{p.name || 'Unnamed'} ({sentence(p.role)})</option>)}</select>
          <label className="flex flex-col text-[11px] font-semibold text-gray-500 lg:flex-row lg:items-center lg:gap-2">From
            <input type="date" max={to || todayLocal()} value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={`${field} mt-0.5 lg:mt-0 font-normal text-gray-900 dark:text-gray-100`} /></label>
          <label className="flex flex-col text-[11px] font-semibold text-gray-500 lg:flex-row lg:items-center lg:gap-2">To
            <input type="date" min={from || undefined} max={todayLocal()} value={to} onChange={(e) => reset(setTo)(e.target.value)} className={`${field} mt-0.5 lg:mt-0 font-normal text-gray-900 dark:text-gray-100`} /></label>
        </div>
        {q.error ? <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
          : q.isLoading || !d ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : !d.rows.length ? <EmptyState message="Nothing found" description={search || area || person || from || to ? 'No finance actions match these filters.' : 'Finance actions appear here as staff record and change money records.'} />
          : (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {d.rows.map((r: any) => {
                  const x = summary(r);
                  const isOpen = open.has(r.id);
                  return (
                    <li key={r.id}>
                      <button type="button" aria-expanded={isOpen} aria-controls={`au-${r.id}`} onClick={() => toggle(r.id)}
                        className="w-full flex items-start gap-3 px-4 py-3 text-left min-h-[44px] hover:bg-gray-50 dark:hover:bg-gray-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm"><span className="font-semibold text-gray-900 dark:text-white">{x.text}</span>{x.extra && <span className="text-gray-600 dark:text-gray-300"> · {x.extra}</span>}</p>
                          <p className="mt-0.5 text-xs text-gray-500 flex flex-wrap gap-x-2">
                            <span className="whitespace-nowrap">{when(r.created_at)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{r.user_name || 'Unknown person'}{r.role ? ` (${sentence(r.role)})` : ''}</span>
                            <span aria-hidden="true">·</span>
                            <span>{r.area}</span>
                          </p>
                        </div>
                        <ChevronDown size={16} className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      {isOpen && <div id={`au-${r.id}`} className="px-4 pb-4 pt-1 bg-gray-50/60 dark:bg-gray-900/30"><Details r={r} /></div>}
                    </li>
                  );
                })}
              </ul>
              <TablePager page={page} pageCount={Math.max(1, Math.ceil(d.total / size))} size={size} total={d.total} onPage={setPage} onSize={(n) => { setSize(n); setPage(0); }} label="actions" />
            </div>
          )}
      </PageShell>
    </MainLayout>
  );
};

export default FinanceAuditPage;
