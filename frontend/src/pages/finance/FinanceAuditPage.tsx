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

const Details: React.FC<{ r: any }> = ({ r }) => {
  const parts = [['Details', r.new_values], ['Before', r.old_values], ['Changes', r.changes]].filter(([, v]) => v && (typeof v !== 'object' || Object.keys(v).length));
  if (!parts.length && !r.reason) return <p className="text-xs text-gray-500">No extra details were recorded.</p>;
  return (
    <div className="space-y-2">
      {r.reason && <p className="text-xs"><span className="font-semibold">Reason:</span> {r.reason}</p>}
      {parts.map(([label, v]) => (
        <div key={label as string}><div className="text-[11px] font-semibold text-gray-500">{label as string}</div>
          <pre className="mt-0.5 max-h-60 overflow-auto rounded-lg bg-gray-100 dark:bg-gray-900 p-2 text-[11px] whitespace-pre-wrap break-all">{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre></div>
      ))}
    </div>
  );
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
                        <td className="px-3 py-2.5 capitalize">{nice(r.action)} <span className="text-gray-500">· {nice(r.entity_type)}</span></td>
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
