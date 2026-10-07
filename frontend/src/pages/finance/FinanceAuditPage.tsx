/**
 * Finance Audit Log (bursar Phase C, R7): who did what to the school's money
 * records, and when. Read-only, paged on the server.
 */
import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { TablePager } from '@components/admin/table/TablePager';
import { bursarC } from '@services/bursarService';
import { unwrap, todayLocal } from '@components/finance/AccountingUi';

const field = 'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm';
const nice = (s: string) => String(s || '').replace(/_/g, ' ');
const when = (v: string) => new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// ── Readable details ────────────────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HIDDEN = /^(id|tenant_id|school_id|.*_id|.*Id|created_by|updated_by|recorded_by|requested_by|decided_by|voided_by|created_at|updated_at|ref)$/;
const MONEY = /(amount|total|value|balance|gross|net|paye|nassit|salary|float|price|fee|cost|spent|budget|deduction|allowance|credit|debit|paid)/i;
const label = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const parse = (v: any) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };
const fmt = (k: string, v: any): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if ((typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))) && MONEY.test(k) && !/(pct|percent|rate|order|count|rows|number)/i.test(k)) {
    return `Le ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return when(v);
  if (typeof v === 'string' && UUID.test(v)) return '';
  if (Array.isArray(v)) return v.every((x) => typeof x !== 'object') ? v.join(', ') : `${v.length} item${v.length === 1 ? '' : 's'}`;
  if (typeof v === 'object') return Object.entries(v).filter(([kk, vv]) => !HIDDEN.test(kk) && vv !== null && vv !== '').map(([kk, vv]) => `${label(kk)}: ${fmt(kk, vv)}`).join(' · ');
  return nice(String(v));
};
const visible = (o: any) => Object.entries(o || {}).filter(([k, v]) => !HIDDEN.test(k) && v !== null && v !== undefined && v !== '' && !(typeof v === 'string' && UUID.test(v)));

/** A list of objects (budget lines, journal lines…) as a small table. */
const ItemTable: React.FC<{ k: string; items: any[] }> = ({ k, items }) => {
  const cols = Array.from(new Set(items.flatMap((x) => visible(x).map(([c]) => c))));
  return (
    <div className="sm:col-span-2"><dt className="text-[11px] font-semibold text-gray-500">{label(k)}</dt>
      <dd className="mt-1 overflow-x-auto"><table className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg">
        <thead className="bg-gray-100 dark:bg-gray-900 text-gray-500"><tr>{cols.map((c) => <th key={c} className="px-2 py-1 text-left font-semibold">{label(c)}</th>)}</tr></thead>
        <tbody>{items.map((x, i) => <tr key={i} className="border-t border-gray-100 dark:border-gray-800">{cols.map((c) => <td key={c} className="px-2 py-1">{fmt(c, x?.[c])}</td>)}</tr>)}</tbody>
      </table></dd></div>
  );
};

const Fields: React.FC<{ o: any }> = ({ o }) => (
  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
    {visible(o).map(([k, v]) => Array.isArray(v) && v.some((x) => x && typeof x === 'object')
      ? <ItemTable key={k} k={k} items={v as any[]} />
      : <div key={k} className="flex gap-2"><dt className="text-gray-500 min-w-[7rem]">{label(k)}</dt><dd className="font-medium break-words">{fmt(k, v)}</dd></div>)}
  </dl>
);

/** Before → after, only what changed. */
const Changes: React.FC<{ before: any; after: any }> = ({ before, after }) => {
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})])).filter((k) => !HIDDEN.test(k));
  const changed = keys.filter((k) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null) && after?.[k] !== undefined);
  if (!changed.length) return <p className="text-xs text-gray-500">Saved with no changes.</p>;
  return (
    <table className="text-xs"><thead className="text-gray-500"><tr><th className="pr-4 text-left font-semibold">Field</th><th className="pr-4 text-left font-semibold">Before</th><th className="text-left font-semibold">After</th></tr></thead>
      <tbody>{changed.map((k) => <tr key={k}><td className="pr-4 py-0.5 text-gray-500">{label(k)}</td><td className="pr-4 py-0.5 line-through text-gray-400">{fmt(k, before?.[k])}</td><td className="py-0.5 font-medium">{fmt(k, after?.[k])}</td></tr>)}</tbody>
    </table>
  );
};

const Details: React.FC<{ r: any }> = ({ r }) => {
  const nv = parse(r.new_values), ov = parse(r.old_values), ch = parse(r.changes);
  const hasBA = nv && typeof nv === 'object' && ('before' in nv || 'after' in nv);
  const rest = hasBA ? Object.fromEntries(Object.entries(nv).filter(([k]) => k !== 'before' && k !== 'after')) : nv;
  const blocks: React.ReactNode[] = [];
  if (r.reason) blocks.push(<p key="r" className="text-xs"><span className="text-gray-500">Reason:</span> <span className="font-medium">{r.reason}</span></p>);
  if (hasBA) blocks.push(<div key="ba"><div className="text-[11px] font-semibold text-gray-500 mb-1">What changed</div><Changes before={nv.before} after={nv.after} /></div>);
  else if (ov && typeof ov === 'object' && nv && typeof nv === 'object') blocks.push(<div key="ba"><div className="text-[11px] font-semibold text-gray-500 mb-1">What changed</div><Changes before={ov} after={nv} /></div>);
  if (rest && typeof rest === 'object' && visible(rest).length && !(ov && !hasBA)) blocks.push(<Fields key="f" o={rest} />);
  if (ch && typeof ch === 'object' && visible(ch).length) blocks.push(<Fields key="c" o={ch} />);
  if (typeof nv === 'string' && nv) blocks.push(<p key="s" className="text-xs">{nv}</p>);
  return (
    <div className="space-y-3">
      {blocks.length ? blocks : <p className="text-xs text-gray-500">No extra details were recorded.</p>}
      {(nv || ov || ch) && (
        <details className="text-[11px] text-gray-500"><summary className="cursor-pointer select-none">Technical record (for auditors)</summary>
          <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-gray-100 dark:bg-gray-900 p-2 whitespace-pre-wrap break-all">{JSON.stringify({ details: nv, before: ov, changes: ch }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
};

// ── One-line summary: "Saved budget · 2027/2028 · 1 line" ───────────────────
const VERB: Record<string, string> = {
  create: 'Created', update: 'Updated', save: 'Saved', delete: 'Deleted', void: 'Voided', approve: 'Approved', reject: 'Rejected',
  revoke: 'Revoked', pay: 'Paid', cancel: 'Cancelled', email: 'Emailed', regenerate: 'Recalculated', refund: 'Refunded',
  manual: 'Posted', reverse: 'Reversed', close: 'Closed', reopen: 'Reopened', import: 'Imported', undo_import: 'Undid import of',
  auto_match: 'Auto-matched', match: 'Matched', unmatch: 'Unmatched', ignore: 'Ignored', unignore: 'Restored', credit_note: 'Issued a credit note for',
  send_balance_reminders: 'Sent balance reminders for', grant_approved: 'Gave (auto-approved)', grant_pending: 'Requested', record: 'Recorded',
  apply: 'Applied', edit_approved: 'Edited (reopened)', grant: 'Gave', waive: 'Waived', issue: 'Issued', generate: 'Generated',
};
const THING: Record<string, string> = {
  fee: 'fees', gl_entry: 'journal entry', gl_account: 'account', books_lock: 'the books', bank_statement: 'bank statement', bank_match: 'bank lines',
  petty_cash_fund: 'petty cash fund', petty_cash_entry: 'petty cash entry', pay_profile: 'staff pay details', payroll_run: 'pay run',
  discount_rule: 'discount type', discount_grant: 'discount', student_credit: 'student credit', payment_plan: 'payment plan',
};
const summary = (r: any) => {
  const v = parse(r.new_values) || {};
  const after = v.after || v;
  const bits: string[] = [];
  const amt = after.amount ?? after.total ?? v.amount ?? v.total;
  if (amt !== undefined && amt !== null && amt !== '') bits.push(fmt('amount', amt));
  for (const k of ['category', 'entry_no', 'period', 'year', 'academic_year', 'label', 'name']) if (after[k] && typeof after[k] !== 'object') { bits.push(String(after[k])); break; }
  if (Array.isArray(v.lines)) bits.push(`${v.lines.length} line${v.lines.length === 1 ? '' : 's'}`);
  if (typeof v.matched === 'number') bits.push(`${v.matched} matched`);
  if (typeof v.inserted === 'number') bits.push(`${v.inserted} lines`);
  return { text: `${VERB[r.action] || label(nice(r.action))} ${THING[r.entity_type] || nice(r.entity_type)}`, extra: bits.filter(Boolean).join(' · ') };
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
  const d = q.data;
  return (
    <MainLayout>
      <PageShell title="Finance Audit Log" subtitle="Every change to fees, payments, discounts, expenses, payroll and the books, with who made it" onRefresh={() => q.refetch()} isRefreshing={q.isFetching}>
        <div className="flex flex-col lg:flex-row gap-2 mb-3 lg:items-center flex-wrap">
          <SearchBar placeholder="Search action, person or details…" onSearch={reset(setSearch)} className="w-full lg:max-w-xs" />
          <select aria-label="Area" value={area} onChange={(e) => reset(setArea)(e.target.value)} className={field}><option value="">All areas</option>{(d?.areas || []).map((a: string) => <option key={a} value={a}>{a}</option>)}</select>
          <select aria-label="Person" value={person} onChange={(e) => reset(setPerson)(e.target.value)} className={field}><option value="">Everyone</option>{(d?.people || []).map((p: any) => <option key={p.id} value={p.id}>{p.name || 'Unnamed'} ({nice(p.role)})</option>)}</select>
          <label htmlFor="au-from" className="sr-only">From</label><input id="au-from" type="date" max={to || todayLocal()} value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={field} />
          <label htmlFor="au-to" className="sr-only">To</label><input id="au-to" type="date" min={from || undefined} max={todayLocal()} value={to} onChange={(e) => reset(setTo)(e.target.value)} className={field} />
        </div>
        {q.error ? <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
          : q.isLoading || !d ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : !d.rows.length ? <EmptyState message="Nothing found" description="Finance actions appear here as staff record and change money records." />
          : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500"><tr><th className="px-3 py-3 w-8" /><th className="px-3 py-3 text-left">When</th><th className="px-3 py-3 text-left">Who</th><th className="px-3 py-3 text-left">Area</th><th className="px-3 py-3 text-left">What</th></tr></thead>
                <tbody>
                  {d.rows.map((r: any) => (
                    <React.Fragment key={r.id}>
                      <tr className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2.5"><button type="button" aria-expanded={open.has(r.id)} aria-label="Show details" onClick={() => setOpen((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} className="text-gray-400 hover:text-gray-700">{open.has(r.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{when(r.created_at)}</td>
                        <td className="px-3 py-2.5"><div className="font-medium">{r.user_name || '—'}</div><div className="text-[11px] text-gray-400 capitalize">{nice(r.role)}</div></td>
                        <td className="px-3 py-2.5 text-xs">{r.area}</td>
                        <td className="px-3 py-2.5">{(() => { const x = summary(r); return <><span className="font-medium">{x.text}</span>{x.extra && <span className="text-gray-500"> · {x.extra}</span>}</>; })()}</td>
                      </tr>
                      {open.has(r.id) && <tr className="bg-gray-50/60 dark:bg-gray-900/30"><td /><td colSpan={4} className="px-3 py-2"><Details r={r} /></td></tr>}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <TablePager page={page} pageCount={Math.max(1, Math.ceil(d.total / size))} size={size} total={d.total} onPage={setPage} onSize={(n) => { setSize(n); setPage(0); }} label="actions" />
            </div>
          )}
      </PageShell>
    </MainLayout>
  );
};

export default FinanceAuditPage;
