/**
 * Audit Log: who did what in the school, and when. Read-only, paged on the
 * server. The school owner also sees IP addresses, browsers and the owner-only
 * entries (payment settings, ownership, what WiSkul support did).
 */
import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, Loader2, LogIn, ShieldAlert, Users, Activity } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { TablePager } from '@components/admin/table/TablePager';
import { unwrap, todayLocal } from '@components/finance/AccountingUi';
import { showToast } from '@utils/toast';
import schoolAuditService, { AuditFilters, AuditRow } from '@services/schoolAuditService';

const field = 'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthLabel = (m: string, short = false) => {
  const [y, mm] = m.split('-');
  const name = MONTHS[Number(mm) - 1] || m;
  return `${short ? name.slice(0, 3) : name} ${y}`;
};
const nice = (s?: string | null) => String(s || '').replace(/_/g, ' ');
const when = (v: string) => new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const label = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const TONE: Record<string, string> = {
  'Sign-ins': 'bg-sky-50 text-sky-700 border-sky-200',
  'Owner & billing': 'bg-amber-50 text-amber-700 border-amber-200',
  'WiSkul support': 'bg-violet-50 text-violet-700 border-violet-200',
  Finance: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Accounts & staff': 'bg-rose-50 text-rose-700 border-rose-200',
};
const toneOf = (c: string) => TONE[c] || 'bg-gray-100 text-gray-700 border-gray-200';

const fmt = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.every((x) => typeof x !== 'object') ? v.join(', ') : `${v.length} items`;
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${label(k)}: ${fmt(x)}`).join(' · ');
  return String(v);
};

/** Before → after for fields that changed, else the recorded details. */
const Details: React.FC<{ r: AuditRow; showAddress: boolean }> = ({ r, showAddress }) => {
  const before = (r.before && typeof r.before === 'object' ? r.before : null) as Record<string, unknown> | null;
  const after = (r.after && typeof r.after === 'object' ? r.after : null) as Record<string, unknown> | null;
  const keys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
  const changed = before && after ? keys.filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) : [];
  return (
    <div className="space-y-2 text-xs">
      {r.reason && <p><span className="text-gray-500">Reason:</span> <span className="font-medium">{r.reason}</span></p>}
      {changed.length > 0 ? (
        <table>
          <thead className="text-gray-500"><tr><th className="pr-4 text-left font-semibold">Field</th><th className="pr-4 text-left font-semibold">Before</th><th className="text-left font-semibold">After</th></tr></thead>
          <tbody>{changed.map((k) => (
            <tr key={k}><td className="pr-4 py-0.5 text-gray-500">{label(k)}</td><td className="pr-4 py-0.5 line-through text-gray-400">{fmt(before![k])}</td><td className="py-0.5 font-medium">{fmt(after![k])}</td></tr>
          ))}</tbody>
        </table>
      ) : after ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {Object.entries(after).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
            <div key={k} className="flex gap-2"><dt className="text-gray-500 min-w-[6rem]">{label(k)}</dt><dd className="font-medium break-words">{fmt(v)}</dd></div>
          ))}
        </dl>
      ) : !r.reason ? <p className="text-gray-500">No extra details were recorded.</p> : null}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-gray-500">
        <div className="flex gap-2"><dt className="min-w-[6rem]">Record type</dt><dd className="font-medium text-gray-700 dark:text-gray-300">{nice(r.entityType)}</dd></div>
        {showAddress && r.ip && <div className="flex gap-2"><dt className="min-w-[6rem]">IP address</dt><dd className="font-medium text-gray-700 dark:text-gray-300">{r.ip}</dd></div>}
        {showAddress && r.userAgent && <div className="flex gap-2 sm:col-span-2"><dt className="min-w-[6rem]">Browser</dt><dd className="font-medium text-gray-700 dark:text-gray-300 break-all">{r.userAgent}</dd></div>}
      </dl>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; value: React.ReactNode; label: string; warn?: boolean }> = ({ icon, value, label: l, warn }) => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3.5 flex items-center gap-3">
    <span className={`rounded-xl p-2 ${warn ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-[#1d4ed8]'}`} aria-hidden="true">{icon}</span>
    <div><div className="text-lg font-bold leading-tight">{value}</div><div className="text-xs text-gray-500">{l}</div></div>
  </div>
);

export const AuditLogPage: React.FC = () => {
  const [academicYear, setAcademicYear] = useState(''); // '' = the school's current year
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  const [person, setPerson] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const filters: AuditFilters = { academicYear: academicYear || undefined, month: month || undefined, category: category || undefined, person: person || undefined, from: from || undefined, to: to || undefined, search: search || undefined };
  const q = useQuery({
    queryKey: ['school-audit', filters, page, size],
    queryFn: () => unwrap<any>(schoolAuditService.list({ ...filters, page, size }), 'Could not load the audit log.'),
    placeholderData: keepPreviousData,
  });
  const s = useQuery({ queryKey: ['school-audit-summary'], queryFn: () => unwrap<any>(schoolAuditService.summary(), 'Could not load the summary.') });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };
  const d = q.data;
  const sum = s.data;

  const exportCsv = async () => {
    setExporting(true);
    try { await schoolAuditService.exportCsv(filters); }
    catch (e: any) { showToast.error(e?.message || 'Could not download the audit log'); }
    finally { setExporting(false); }
  };

  return (
    <MainLayout>
      <PageShell
        title="Audit Log"
        subtitle="Who did what in your school, and when"
        onRefresh={() => { q.refetch(); s.refetch(); }}
        isRefreshing={q.isFetching}
        actions={(
          <button type="button" onClick={exportCsv} disabled={exporting} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download CSV
          </button>
        )}
      >
        {sum && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Stat icon={<Activity size={18} />} value={sum.changesLast30Days} label="Recorded actions, last 30 days" />
            <Stat icon={<Users size={18} />} value={sum.activePeopleLast7Days} label="People active, last 7 days" />
            <Stat icon={sum.failedSignInsLast7Days ? <ShieldAlert size={18} /> : <LogIn size={18} />} value={sum.failedSignInsLast7Days} label="Failed sign-ins, last 7 days" warn={sum.failedSignInsLast7Days >= 5} />
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2 mb-3 lg:items-center flex-wrap">
          <select aria-label="Academic year" value={academicYear} onChange={(e) => { setMonth(''); reset(setAcademicYear)(e.target.value); }} className={field}>
            <option value="">{d?.academicYear && academicYear === '' ? `Current year (${d.academicYear.name})` : 'Current academic year'}</option>
            {(d?.sessions || []).filter((x: any) => !(x.isActive && academicYear === '')).map((x: any) => <option key={x.id} value={x.id}>{x.name}{x.isActive ? ' (current)' : ''}</option>)}
            <option value="all">All years</option>
          </select>
          <select aria-label="Month" value={month} onChange={(e) => reset(setMonth)(e.target.value)} className={field}>
            <option value="">All months</option>
            {(d?.months || []).map((m: any) => <option key={m.month} value={m.month}>{monthLabel(m.month)} ({m.count})</option>)}
          </select>
          <SearchBar placeholder="Search action, record or person…" onSearch={reset(setSearch)} className="w-full lg:max-w-xs" />
          <select aria-label="Category" value={category} onChange={(e) => reset(setCategory)(e.target.value)} className={field}>
            <option value="">All categories</option>
            {(d?.categories || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label="Person" value={person} onChange={(e) => reset(setPerson)(e.target.value)} className={field}>
            <option value="">Everyone</option>
            {(d?.people || []).map((p: any) => <option key={p.id} value={p.id}>{p.name || 'Unnamed'} ({nice(p.role)})</option>)}
          </select>
          <label htmlFor="al-from" className="sr-only">From</label>
          <input id="al-from" type="date" max={to || todayLocal()} value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={field} />
          <label htmlFor="al-to" className="sr-only">To</label>
          <input id="al-to" type="date" min={from || undefined} max={todayLocal()} value={to} onChange={(e) => reset(setTo)(e.target.value)} className={field} />
        </div>

        {d && d.months.length > 1 && (
          <div className="mb-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3" aria-label="Activity by month">
            <div className="text-xs font-semibold text-gray-500 mb-2">Activity by month{d.academicYear ? ` · ${d.academicYear.name}` : ' · all years'}</div>
            <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ minHeight: 64 }}>
              {(() => {
                const asc = [...d.months].reverse();
                const top = Math.max(...asc.map((m: any) => m.count), 1);
                return asc.map((m: any) => (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => reset(setMonth)(month === m.month ? '' : m.month)}
                    aria-pressed={month === m.month}
                    aria-label={`${monthLabel(m.month)}: ${m.count} actions`}
                    title={`${monthLabel(m.month)}: ${m.count}`}
                    className={`flex flex-col items-center gap-1 shrink-0 w-10 rounded-lg px-1 pt-1 text-[10px] ${month === m.month ? 'bg-blue-50 text-[#1d4ed8] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <span className={`w-5 rounded-t ${month === m.month ? 'bg-[#1d4ed8]' : 'bg-blue-300'}`} style={{ height: Math.max(4, Math.round((m.count / top) * 40)) }} />
                    <span>{monthLabel(m.month, true).split(' ')[0]}</span>
                  </button>
                ));
              })()}
            </div>
          </div>
        )}

        {d?.academicYearUnknown && (
          <p role="alert" className="mb-3 text-sm text-amber-700">That academic year is not part of your school. Showing nothing.</p>
        )}

        {q.error ? (
          <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
        ) : q.isLoading || !d ? (
          <div className="py-12 flex justify-center" role="status" aria-label="Loading"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : !d.rows.length ? (
          <EmptyState message="Nothing found" description="Actions appear here as people sign in and change records in your school." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500">
                <tr><th className="px-3 py-3 w-8" /><th className="px-3 py-3 text-left">When</th><th className="px-3 py-3 text-left">Who</th><th className="px-3 py-3 text-left">Category</th><th className="px-3 py-3 text-left">What</th></tr>
              </thead>
              <tbody>
                {d.rows.map((r: AuditRow) => (
                  <React.Fragment key={r.id}>
                    <tr className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2.5">
                        <button type="button" aria-expanded={open.has(r.id)} aria-label="Show details" onClick={() => setOpen((x) => { const n = new Set(x); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} className="text-gray-400 hover:text-gray-700">
                          {open.has(r.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{when(r.at)}</td>
                      <td className="px-3 py-2.5"><div className="font-medium">{r.actor.name || '—'}</div><div className="text-[11px] text-gray-400 capitalize">{nice(r.actor.role)}</div></td>
                      <td className="px-3 py-2.5"><span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneOf(r.category)}`}>{r.category}</span></td>
                      <td className="px-3 py-2.5 font-medium">{r.summary}</td>
                    </tr>
                    {open.has(r.id) && (
                      <tr className="bg-gray-50/60 dark:bg-gray-900/30"><td /><td colSpan={4} className="px-3 py-2"><Details r={r} showAddress={d.canSeeAddresses} /></td></tr>
                    )}
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

export default AuditLogPage;
