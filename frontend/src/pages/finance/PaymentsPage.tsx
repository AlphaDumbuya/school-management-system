/**
 * PaymentsPage — /finance/payments
 * The school's payments command center to monitor and manage all fee payments
 * across every class, level and term:
 *  - Total fees billed, collected, outstanding + collection-rate gauge
 *  - This-month collections, payment-method mix, 6-month trend
 *  - Breakdowns by TERM, LEVEL and CLASS (billed / collected / outstanding / %)
 *  - Top defaulters, recent activity
 *  - Record manual payments, view receipts, filter & export the full ledger
 * Online (Monime) payments auto-record here and settle fees/invoices.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Smartphone, CreditCard, Banknote, Landmark, Wallet, Plus, Download,
  TrendingUp, Receipt, ChevronDown, X, Users, AlertTriangle, Bell, Loader2,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { ChartCard } from '@components/admin/charts/ChartCard';
import { showToast } from '@utils/toast';
import { ExportButton } from '@components/admin/common/ExportButton';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { financeService } from '@services/financeService';
import { studentsService } from '@services/studentsService';
import { classesService } from '@services/classesService';
import { schoolConfigService } from '@services/schoolConfigService';
import { financeLedgerService, LedgerTerm } from '@services/financeLedgerService';
import { fmtMoney, statusPill, SwipeHint } from './FinanceOverviewCards';

// Academic sections — the true 3-tier hierarchy used by the school:
//   Nursery (Nursery 1–3), Primary (Class 1–6), Secondary → JSS 1–3 / SSS 1–3.
// The Level filter works by SECTION group; each group matches any of its level
// codes so filtering by "Junior Secondary" catches JSS1/JSS2/JSS3, etc.
const SECTION_GROUPS: { key: string; label: string; levels: string[] }[] = [
  { key: 'nursery', label: 'Nursery', levels: ['NURSERY1', 'NURSERY2', 'NURSERY3'] },
  { key: 'primary', label: 'Primary', levels: ['CLASS1', 'CLASS2', 'CLASS3', 'CLASS4', 'CLASS5', 'CLASS6'] },
  { key: 'jss', label: 'Junior Secondary (JSS)', levels: ['JSS1', 'JSS2', 'JSS3'] },
  { key: 'sss', label: 'Senior Secondary (SSS)', levels: ['SSS1', 'SSS2', 'SSS3'] },
];
const sectionForLevel = (lvl?: string) => SECTION_GROUPS.find((g) => g.levels.includes((lvl || '').toUpperCase()))?.key;

const methodMeta = (m?: string) => {
  const s = (m || '').toLowerCase();
  if (s === 'monime') return { icon: <Smartphone size={14} className="text-emerald-600" />, label: 'Monime (Online)' };
  if (s.includes('mobile') || s.includes('momo')) return { icon: <Smartphone size={14} className="text-emerald-600" />, label: 'Mobile Money' };
  if (s.includes('card')) return { icon: <CreditCard size={14} className="text-blue-600" />, label: 'Card' };
  if (s.includes('bank')) return { icon: <Landmark size={14} className="text-violet-600" />, label: 'Bank' };
  if (s.includes('wallet')) return { icon: <Wallet size={14} className="text-amber-600" />, label: 'Wallet' };
  if (s.includes('cash')) return { icon: <Banknote size={14} className="text-gray-500" />, label: 'Cash' };
  if (s.includes('cheque')) return { icon: <Banknote size={14} className="text-gray-500" />, label: 'Cheque' };
  return { icon: <Banknote size={14} className="text-gray-400" />, label: m || '—' };
};

type BreakdownTab = 'term' | 'level' | 'class';

export const PaymentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [balanceFilter, setBalanceFilter] = useState(''); // '', 'settled', 'due'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exportStatus, setExportStatus] = useState(''); // '', 'unpaid', 'partial', 'paid' — scopes the exported report
  const [recordOpen, setRecordOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>('term');
  // Academic-year scope for the KPIs, charts AND the payments ledger. Opens on
  // the school's ACTIVE year; '' = "All years"; a past year is history.
  const [pickedYear, setYear] = useState<string | null>(null);
  const { activeYear } = useAcademicYears();
  const year = pickedYear ?? activeYear;
  const yearReady = pickedYear !== null || !!activeYear;
  const viewingPast = !!year && !!activeYear && year < activeYear;

  const { data: analyticsResp, isLoading: anLoading, refetch: refetchAn } = useQuery({
    queryKey: ['finance-analytics', year], queryFn: () => financeService.getAnalytics(year || undefined), enabled: yearReady, staleTime: 30_000,
  });
  const { data: payResp, isLoading, refetch } = useQuery({
    queryKey: ['finance-payments', year], queryFn: () => financeService.listPayments(year || undefined), enabled: yearReady, staleTime: 15_000,
  });
  const { data: schoolResp } = useQuery({
    queryKey: ['school-info'], queryFn: () => schoolConfigService.getSchoolInfo(), staleTime: 60_000,
  });
  const school = ((schoolResp as any)?.data ?? (schoolResp as any)) ?? {};
  // Full class list (not just classes that appear in payments) so filters show
  // every option, each with a live count of matching payments.
  const { data: classesResp } = useQuery({
    queryKey: ['finance-filter-classes', year],
    queryFn: () => classesService.listAllClasses({ limit: 100, academic_year: year || 'all' }),
    enabled: yearReady,
    staleTime: 60_000,
  });
  const allClasses = ((classesResp as any)?.data?.data ?? (classesResp as any)?.data ?? []) as any[];

  const a = ((analyticsResp as any)?.data?.data ?? (analyticsResp as any)?.data) as any;
  const payments = ((payResp as any)?.data?.data ?? (payResp as any)?.data ?? []) as any[];

  // Count how many payments (within a given subset) match each value.
  const countBy = (rows: any[], fn: (p: any) => string | undefined) => {
    const m = new Map<string, number>();
    rows.forEach((p) => { const k = fn(p); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return m;
  };

  // Section is the PRIMARY filter. Everything downstream (classes, methods,
  // statuses, counts) is scoped to the chosen section so the options cascade.
  const sectionScoped = useMemo(
    () => (sectionFilter ? payments.filter((p) => sectionForLevel(p.class_level) === sectionFilter) : payments),
    [payments, sectionFilter]
  );

  // When the section changes, drop a class selection that no longer belongs to
  // the new section (keeps the cascade consistent).
  useEffect(() => {
    if (!classFilter) return;
    const stillValid = payments.some((p) => p.class_name === classFilter && (!sectionFilter || sectionForLevel(p.class_level) === sectionFilter));
    if (!stillValid) setClassFilter('');
  }, [sectionFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const sectionCounts = useMemo(() => countBy(payments, (p) => sectionForLevel(p.class_level)), [payments]);
  const classCounts = useMemo(() => countBy(sectionScoped, (p) => p.class_name), [sectionScoped]);
  const methodCounts = useMemo(() => countBy(sectionScoped, (p) => (p.method || p.payment_method || '').toLowerCase() || undefined), [sectionScoped]);
  const statusCounts = useMemo(() => countBy(sectionScoped, (p) => (p.status || '').toLowerCase() || undefined), [sectionScoped]);

  // Sections present in this school's classes/payments (Nursery / Primary /
  // JSS / SSS), shown in natural order.
  const sections = useMemo(() => {
    const present = new Set<string>();
    allClasses.forEach((c) => { const k = sectionForLevel(c.level); if (k) present.add(k); });
    payments.forEach((p) => { const k = sectionForLevel(p.class_level); if (k) present.add(k); });
    return SECTION_GROUPS.filter((g) => present.has(g.key));
  }, [allClasses, payments]);
  // Classes are scoped to the selected section (both from the full class list
  // and from payments) so picking a section narrows the Class dropdown.
  const classesList = useMemo(() => {
    const scopedClasses = sectionFilter ? allClasses.filter((c) => sectionForLevel(c.level) === sectionFilter) : allClasses;
    const s = new Set<string>([...scopedClasses.map((c) => c.name).filter(Boolean), ...sectionScoped.map((p) => p.class_name).filter(Boolean)]);
    return Array.from(s).sort();
  }, [allClasses, sectionScoped, sectionFilter]);
  const methods = useMemo(() => Array.from(new Set(sectionScoped.map((p) => (p.method || p.payment_method || '').toLowerCase()).filter(Boolean))).sort(), [sectionScoped]);
  const statuses = useMemo(() => Array.from(new Set(sectionScoped.map((p) => (p.status || '').toLowerCase()).filter(Boolean))).sort(), [sectionScoped]);

  const filtered = payments.filter((p) => {
    const t = search.trim().toLowerCase();
    const matchSearch = !t
      || p.student_name?.toLowerCase().includes(t)
      || (p.admission_no || '').toLowerCase().includes(t)
      || (p.reference_number || '').toLowerCase().includes(t)
      || (p.provider_reference || '').toLowerCase().includes(t)
      || (p.transaction_reference || '').toLowerCase().includes(t)
      || (p.class_name || '').toLowerCase().includes(t);
    const matchSection = !sectionFilter || sectionForLevel(p.class_level) === sectionFilter;
    const matchClass = !classFilter || p.class_name === classFilter;
    const matchMethod = !methodFilter || (p.method || p.payment_method || '').toLowerCase() === methodFilter;
    const matchStatus = !statusFilter || (p.status || '').toLowerCase() === statusFilter;
    const matchBalance = !balanceFilter
      || (balanceFilter === 'settled' && Number(p.student_balance) <= 0)
      || (balanceFilter === 'due' && Number(p.student_balance) > 0);
    const pd = p.payment_date ? new Date(p.payment_date) : null;
    const matchFrom = !fromDate || (pd && pd >= new Date(fromDate + 'T00:00:00'));
    const matchTo = !toDate || (pd && pd <= new Date(toDate + 'T23:59:59'));
    return matchSearch && matchSection && matchClass && matchMethod && matchStatus && matchBalance && matchFrom && matchTo;
  });

  const queryClient = useQueryClient();
  const refetchAll = () => {
    refetch(); refetchAn();
    // Also refresh the portal ledgers so students/parents see updated balances.
    ['student-ledger', 'my-ledger', 'child-ledger', 'student-dashboard',
     'parent-dashboard', 'parent-child-detail', 'finance-overview']
      .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  const totals = a?.totals ?? { billed: 0, paid: 0, outstanding: 0, collectionRate: 0, invoiceCount: 0, overdueCount: 0 };
  // Compact currency for chart axes/tooltips (e.g. Le 12.5k, Le 3.2M).
  const fmtLeShort = (v: number) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1_000_000) return `Le ${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `Le ${(n / 1_000).toFixed(1)}k`;
    return `Le ${n.toLocaleString()}`;
  };
  const trendSeries = a?.trend?.length ? { series: [{ name: 'Collected', data: a.trend.map((t: any) => t.total) }], labels: a.trend.map((t: any) => t.label) } : { series: [], labels: [] };
  const methodSeries = a?.byMethod?.length ? { series: [{ name: 'Amount', data: a.byMethod.map((m: any) => m.total) }], labels: a.byMethod.map((m: any) => methodMeta(m.method).label) } : { series: [], labels: [] };

  // Grouped bar: Billed vs Collected vs Outstanding by class level.
  const byLevelChart = a?.byLevel?.length ? {
    labels: a.byLevel.map((l: any) => l.level),
    series: [
      { name: 'Billed', data: a.byLevel.map((l: any) => l.billed) },
      { name: 'Collected', data: a.byLevel.map((l: any) => l.collected) },
      { name: 'Outstanding', data: a.byLevel.map((l: any) => l.outstanding) },
    ],
  } : { series: [], labels: [] };

  // Bar: collection rate (%) per class — lowest first so laggards stand out.
  const rateByClassChart = a?.byClass?.length ? (() => {
    const sorted = [...a.byClass].filter((c: any) => c.billed > 0).sort((x: any, y: any) => x.rate - y.rate).slice(0, 12);
    return { labels: sorted.map((c: any) => c.className), series: [{ name: 'Collection %', data: sorted.map((c: any) => c.rate) }] };
  })() : { series: [], labels: [] };

  // Donut: billed split into collected vs outstanding (overall health at a glance).
  const collectedVsOutstanding = (totals.paid > 0 || totals.outstanding > 0) ? {
    labels: ['Collected', 'Outstanding'],
    series: [{ name: 'Le', data: [totals.paid, totals.outstanding] }],
  } : { series: [], labels: [] };

  const breakdownRows: any[] = breakdownTab === 'term' ? (a?.byTerm ?? []) : breakdownTab === 'level' ? (a?.byLevel ?? []) : (a?.byClass ?? []);
  const breakdownKey = breakdownTab === 'term' ? 'term' : breakdownTab === 'level' ? 'level' : 'className';

  return (
    <MainLayout>
      <PageShell
        title="Payments & Collections"
        subtitle="Monitor and manage all fee collections across classes, levels and terms"
        onRefresh={refetchAll}
        isRefreshing={isLoading || anLoading}
        actions={
          <div className="flex items-center gap-2">
            <YearFilter value={year} onChange={setYear} includeAllOption />
            <div className="relative hidden sm:block">
              <select
                value={exportStatus}
                onChange={(e) => setExportStatus(e.target.value)}
                title="Scope the exported fees report"
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Report: All students</option>
                <option value="unpaid">Report: Unpaid only</option>
                <option value="partial">Report: Partial only</option>
                <option value="paid">Report: Fully paid</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
            <ExportButton
              endpoint="/api/v1/finance/export"
              filename={exportStatus === 'unpaid' ? 'unpaid-students-report' : 'student-fees-report'}
              label="Export Report"
              params={{ section: sectionFilter || undefined, className: classFilter || undefined, status: exportStatus || undefined, academic_year: year || undefined }}
            />
            <Button variant="outline" size="sm" onClick={() => setRemindOpen(true)}><Bell size={15} className="sm:mr-1.5" /><span className="hidden sm:inline">Send Reminders</span></Button>
            <Button variant="default" size="sm" onClick={() => setRecordOpen(true)}><Plus size={15} className="sm:mr-1.5" /><span className="hidden sm:inline">Record Payment</span></Button>
          </div>
        }
      >
        {(viewingPast || (pickedYear === '' && !!activeYear)) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <span>
              {viewingPast
                ? <>Showing <strong>{year}</strong> fees and payments as history. Outstanding arrears can still be collected with Record Payment.</>
                : <>Showing fees and payments from <strong>all years</strong>.</>}
            </span>
            <button type="button" onClick={() => setYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          </div>
        )}

        {/* ── Hero KPIs + collection-rate gauge ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="lg:col-span-1 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Collection Rate</span>
              <TrendingUp size={16} className="text-white/70" />
            </div>
            <div className="mt-2">
              <div className="text-4xl font-black">{anLoading ? '—' : `${totals.collectionRate}%`}</div>
              <div className="mt-3 h-2 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(100, totals.collectionRate)}%` }} />
              </div>
              <div className="text-xs text-white/70 mt-2">{fmtMoney(totals.paid)} of {fmtMoney(totals.billed)} collected</div>
            </div>
          </div>
          <HubStat label="Total Billed" value={fmtMoney(totals.billed)} sub={`${totals.invoiceCount} invoices`} color="text-blue-600 bg-blue-500/10" icon={<Receipt size={18} />} loading={anLoading} />
          <HubStat label="Collected" value={fmtMoney(totals.paid)} sub={`this month: ${fmtMoney(a?.thisMonth?.total)}`} color="text-emerald-600 bg-emerald-500/10" icon={<Banknote size={18} />} loading={anLoading} />
          <HubStat label="Outstanding" value={fmtMoney(totals.outstanding)} sub={`${totals.overdueCount} overdue`} color="text-rose-600 bg-rose-500/10" icon={<AlertTriangle size={18} />} loading={anLoading} />
        </div>

        {/* ── Trend + method mix ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <ChartCard title="Collection Trend" subtitle="Fees collected over the last 6 months" type="line" height={280}
              colors={['#10b981']} valueFormatter={fmtLeShort}
              emptyState={{ message: 'No collections yet', description: 'Recorded payments will chart here.' }} {...trendSeries} />
          </div>
          <div>
            <ChartCard title="By Payment Method" type="donut" height={280}
              valueFormatter={fmtLeShort}
              emptyState={{ message: 'No method data yet', description: 'Payment methods will break down here.' }} {...methodSeries} />
          </div>
        </div>

        {/* ── Billed vs Collected vs Outstanding by level + collection health donut ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <ChartCard title="Billed vs Collected vs Outstanding" subtitle="By class level" type="bar" height={300}
              colors={['#3b82f6', '#10b981', '#ef4444']} valueFormatter={fmtLeShort}
              emptyState={{ message: 'No billing data yet', description: 'Bill a term on the Fees page to populate this.' }} {...byLevelChart} />
          </div>
          <div>
            <ChartCard title="Collection Health" subtitle="Collected vs outstanding" type="donut" height={300}
              colors={['#10b981', '#ef4444']} valueFormatter={fmtLeShort}
              donutCenterLabel={`${totals.collectionRate}%`}
              emptyState={{ message: 'No fees billed yet', description: 'Overall collection split will show here.' }} {...collectedVsOutstanding} />
          </div>
        </div>

        {/* ── Collection rate by class ── */}
        <div className="mb-6">
          <ChartCard title="Collection Rate by Class" subtitle="Lowest-collecting classes first — spot where to follow up" type="bar" height={300}
            colors={['#8b5cf6']} valueFormatter={(v) => `${Math.round(Number(v) || 0)}%`}
            emptyState={{ message: 'No class billing yet', description: 'Per-class collection rates will chart here.' }} {...rateByClassChart} />
        </div>

        {/* ── Breakdown by term / level / class ── */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Collections Breakdown</h3>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-900/50 rounded-xl p-1">
              {(['term', 'level', 'class'] as BreakdownTab[]).map((t) => (
                <button key={t} onClick={() => setBreakdownTab(t)} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${breakdownTab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>By {t}</button>
              ))}
            </div>
          </div>
          {breakdownRows.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No billing data for this breakdown yet.</p>
          ) : (
            <>
            <SwipeHint />
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="py-2 pr-4 whitespace-nowrap capitalize">{breakdownTab}</th>
                    <th className="py-2 px-4 text-right whitespace-nowrap">Billed</th>
                    <th className="py-2 px-4 text-right whitespace-nowrap">Collected</th>
                    <th className="py-2 px-4 text-right whitespace-nowrap">Outstanding</th>
                    <th className="py-2 px-4 whitespace-nowrap w-40">Collection %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {breakdownRows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap capitalize">{r[breakdownKey] || '—'}</td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">{fmtMoney(r.billed)}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-600 whitespace-nowrap">{fmtMoney(r.collected)}</td>
                      <td className={`py-2.5 px-4 text-right whitespace-nowrap ${Number(r.outstanding) > 0 ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>{fmtMoney(r.outstanding)}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden min-w-[60px]">
                            <div className={`h-full rounded-full ${r.rate >= 80 ? 'bg-emerald-500' : r.rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, r.rate)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-10 text-right">{r.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        {/* ── Top defaulters + recent activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle size={16} className="text-rose-500" /><h3 className="text-sm font-bold text-gray-900 dark:text-white">Top Outstanding Balances</h3></div>
            {(a?.topDefaulters?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No outstanding balances. 🎉</p>
            ) : (
              <div className="space-y-2">
                {a.topDefaulters.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{d.studentName}</div>
                      <div className="text-xs text-gray-400">{d.className || '—'} · {d.admissionNo}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-rose-600 whitespace-nowrap">{fmtMoney(d.outstanding)}</span>
                      {d.studentId && <DefaulterReminderButton studentId={d.studentId} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <div className="flex items-center gap-2 mb-3"><Users size={16} className="text-blue-500" /><h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Activity</h3></div>
            {(a?.recent?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No recent payments.</p>
            ) : (
              <div className="space-y-2">
                {a.recent.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {methodMeta(r.method).icon}
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{r.studentName}</div>
                        <div className="text-xs text-gray-400">{r.date ? new Date(r.date).toLocaleDateString() : ''}</div>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">{fmtMoney(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Ledger with filters ── */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <SearchBar placeholder="Search by student, admission #, reference or class…" onSearch={setSearch} isLoading={isLoading} resultCount={search ? filtered.length : undefined} defaultValue={search} className="w-full sm:max-w-md" />
            {(search || sectionFilter || classFilter || methodFilter || statusFilter || balanceFilter || fromDate || toDate) && (
              <button
                onClick={() => { setSearch(''); setSectionFilter(''); setClassFilter(''); setMethodFilter(''); setStatusFilter(''); setBalanceFilter(''); setFromDate(''); setToDate(''); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-rose-600 whitespace-nowrap"
              >
                <X size={13} /> Clear filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <FilterSelect value={sectionFilter} onChange={setSectionFilter} allLabel={`All sections (${payments.length})`} options={sections.map((g) => ({ value: g.key, label: `${g.label}${sectionCounts.get(g.key) ? ` (${sectionCounts.get(g.key)})` : ''}` }))} />
            <FilterSelect value={classFilter} onChange={setClassFilter} allLabel="All classes" options={classesList.map((c) => ({ value: c, label: `${c}${classCounts.get(c) ? ` (${classCounts.get(c)})` : ''}` }))} />
            <FilterSelect value={methodFilter} onChange={setMethodFilter} allLabel="All methods" options={methods.map((m) => ({ value: m, label: `${methodMeta(m).label}${methodCounts.get(m) ? ` (${methodCounts.get(m)})` : ''}` }))} />
            <FilterSelect value={statusFilter} onChange={setStatusFilter} allLabel="All statuses" options={statuses.map((s) => ({ value: s, label: `${cap(s)}${statusCounts.get(s) ? ` (${statusCounts.get(s)})` : ''}` }))} />
            <FilterSelect value={balanceFilter} onChange={setBalanceFilter} allLabel="Any balance" options={[{ value: 'settled', label: 'Settled — no balance' }, { value: 'due', label: 'Has outstanding balance' }]} />
            <div className="grid grid-cols-2 gap-2 col-span-2 sm:col-span-1 lg:col-span-1">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="From date" className="w-full px-2 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} title="To date" className="w-full px-2 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState message="No payments found" description="Manual and online (Monime) payments will appear here." />
        ) : (
          <>
          <SwipeHint />
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] text-xs text-white uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Student</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Class</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Total Billed</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Balance</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Method</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filtered.map((p, rowIndex) => {
                  const meta = methodMeta(p.method || p.payment_method);
                  return (
                    <tr key={p.id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-gray-700/30 ${rowIndex % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/30' : 'bg-white dark:bg-transparent'}`}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-white">{p.student_name}</div>
                        <div className="text-xs text-gray-400">{p.admission_no}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{p.class_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{fmtMoney(p.amount)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-gray-600 dark:text-gray-400">{fmtMoney(p.student_total_billed)}</td>
                      <td className={`px-4 py-3 text-right whitespace-nowrap font-semibold ${Number(p.student_balance) > 0 ? 'text-rose-600' : 'text-gray-400'}`}>{fmtMoney(p.student_balance)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1.5 text-xs font-medium">{meta.icon}{meta.label}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">{statusPill(p.status)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setReceipt(p)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"><Receipt size={13} /> View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {recordOpen && <RecordPaymentModal onClose={() => setRecordOpen(false)} onSaved={() => { setRecordOpen(false); refetchAll(); }} />}
        {remindOpen && <SendRemindersModal onClose={() => setRemindOpen(false)} defaulterCount={a?.topDefaulters?.length ?? 0} />}
        {receipt && <ReceiptModal payment={receipt} school={school} onClose={() => setReceipt(null)} />}
      </PageShell>
    </MainLayout>
  );
};

const HubStat: React.FC<{ label: string; value: string; sub?: string; color: string; icon: React.ReactNode; loading?: boolean }> = ({ label, value, sub, color, icon, loading }) => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color} mb-3`}>{icon}</div>
    <div className="text-xl font-black text-gray-900 dark:text-white">{loading ? <span className="inline-block h-6 w-24 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" /> : value}</div>
    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    {sub && <div className="text-[11px] text-gray-400 mt-1">{sub}</div>}
  </div>
);

// ── Record manual payment ─────────────────────────────────────────────────────
const RecordPaymentModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [studentQuery, setStudentQuery] = useState('');
  const [studentId, setStudentId] = useState('');
  const [scopeId, setScopeId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: studentsResp } = useQuery({
    queryKey: ['pay-students', studentQuery],
    queryFn: () => studentsService.listStudents({ search: studentQuery, limit: 10 } as any),
    enabled: studentQuery.trim().length > 1, staleTime: 30_000,
  });
  const students = ((studentsResp as any)?.data?.data ?? (studentsResp as any)?.data ?? []) as any[];

  // Load the student's ledger and build the SAME "what to pay for" scopes the
  // parent/student portal offers (full outstanding / full year / term / charges).
  const { data: ledgerResp } = useQuery({
    queryKey: ['pay-student-ledger', studentId], queryFn: () => financeLedgerService.getStudentLedger(studentId),
    enabled: !!studentId, staleTime: 15_000,
  });
  const ledger = (((ledgerResp as any)?.data?.data ?? (ledgerResp as any)?.data) ?? null) as any;

  const TERM_LABEL: Record<LedgerTerm, string> = { first_term: 'First Term', second_term: 'Second Term', third_term: 'Third Term' };
  const isTuition = (type?: string | null) => (type || '').toLowerCase().includes('tuition');

  // Each scope carries the ordered list of underlying fee ids so a manual
  // payment can be applied across them oldest-first (mirrors the online flow).
  // Staff can record against ANY term / year / charges — even ones with nothing
  // outstanding (e.g. paying a future term in advance). We therefore list every
  // bucket that has been billed, defaulting the payable amount to whatever is
  // still outstanding (falling back to the billed amount when fully paid).
  type PayScopeOpt = { id: string; label: string; sublabel?: string; amount: number; outstanding: number; feeIds: string[] };
  const scopes: PayScopeOpt[] = React.useMemo(() => {
    if (!ledger) return [];
    const out: PayScopeOpt[] = [];
    // Fee ids across everything, ordered so we settle oldest charges first.
    const allFeeIds: string[] = [];
    ledger.years?.forEach((y: any) => y.terms?.forEach((t: any) => t.charges?.forEach((c: any) => { allFeeIds.push(c.id); })));
    if (Number(ledger.totals?.billed || 0) > 0) {
      out.push({
        id: 'all',
        label: 'Full outstanding balance',
        amount: Number(ledger.totals?.outstanding || 0) > 0 ? ledger.totals.outstanding : ledger.totals.billed,
        outstanding: Number(ledger.totals?.outstanding || 0),
        feeIds: allFeeIds,
      });
    }
    ledger.years?.forEach((y: any) => {
      const yearFeeIds: string[] = [];
      y.terms?.forEach((t: any) => t.charges?.forEach((c: any) => { yearFeeIds.push(c.id); }));
      if (Number(y.billed || 0) > 0) {
        out.push({
          id: `year:${y.academic_year}`,
          label: 'Full Year',
          sublabel: y.academic_year,
          amount: Number(y.outstanding || 0) > 0 ? y.outstanding : y.billed,
          outstanding: Number(y.outstanding || 0),
          feeIds: yearFeeIds,
        });
      }
      y.terms?.forEach((t: any) => {
        const termCharges = (t.charges || []);
        if (Number(t.billed || 0) > 0) {
          out.push({
            id: `term:${y.academic_year}:${t.term}`,
            label: `${TERM_LABEL[t.term as LedgerTerm]} — Full`,
            sublabel: y.academic_year,
            amount: Number(t.outstanding || 0) > 0 ? t.outstanding : t.billed,
            outstanding: Number(t.outstanding || 0),
            feeIds: termCharges.map((c: any) => c.id),
          });
        }
        const chargeOnly = termCharges.filter((c: any) => !isTuition(c.type));
        const chargeBilled = chargeOnly.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
        const chargeOut = chargeOnly.reduce((s: number, c: any) => s + Number(c.outstanding || 0), 0);
        if (chargeBilled > 0) {
          out.push({
            id: `charges:${y.academic_year}:${t.term}`,
            label: `${TERM_LABEL[t.term as LedgerTerm]} — Charges only`,
            sublabel: y.academic_year,
            amount: Math.round((chargeOut > 0 ? chargeOut : chargeBilled) * 100) / 100,
            outstanding: Math.round(chargeOut * 100) / 100,
            feeIds: chargeOnly.map((c: any) => c.id),
          });
        }
      });
    });
    const seen = new Set<string>();
    // A fee can't be paid beyond its balance (the server rejects it), so only
    // offer buckets that still have something outstanding, priced at that.
    return out
      .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
      .filter((s) => s.outstanding > 0.005)
      .map((s) => ({ ...s, amount: Math.round(s.outstanding * 100) / 100 }));
  }, [ledger]);

  const selectedScope = scopes.find((s) => s.id === scopeId) || null;

  // Lock background scroll so the centered modal is the focal point.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const submit = async () => {
    if (!selectedScope) { showToast.error('Select what to pay for'); return; }
    const amt = Number(amount);
    if (!(amt > 0)) { showToast.error('Enter a valid amount'); return; }
    if (amt > selectedScope.amount) { showToast.error(`Amount exceeds the total for this selection (${fmtMoney(selectedScope.amount)})`); return; }
    setSaving(true);
    try {
      // Apply the amount across the scope's fees oldest-first (the ledger orders
      // charges chronologically) — one recordPayment call per fee until the
      // amount is exhausted. Mirrors the online settle-across-fees logic.
      const feeOutstanding = new Map<string, number>();
      ledger.years?.forEach((y: any) => y.terms?.forEach((t: any) => t.charges?.forEach((c: any) => {
        feeOutstanding.set(c.id, Number(c.outstanding || 0));
      })));
      let remaining = Math.round(amt * 100) / 100;
      let recorded = 0;
      let failure: string | null = null;
      for (const fid of selectedScope.feeIds) {
        if (remaining <= 0.005) break;
        const bal = Math.round((feeOutstanding.get(fid) || 0) * 100) / 100;
        if (bal <= 0) continue;
        const pay = Math.round(Math.min(bal, remaining) * 100) / 100;
        try {
          const res: any = await financeService.recordPayment({ feeId: fid, amount: pay, method, transactionReference: reference || undefined });
          const body = res?.data ?? res;
          if (res?.success === false || body?.success === false) {
            failure = body?.error || body?.message || res?.error || 'Failed to record payment';
            break;
          }
        } catch (e: any) {
          failure = e?.response?.data?.error || e?.response?.data?.message || 'Failed to record payment';
          break;
        }
        remaining = Math.round((remaining - pay) * 100) / 100;
        recorded = Math.round((recorded + pay) * 100) / 100;
      }
      if (failure) {
        // Some fees may already be settled; say exactly what went through and
        // refresh so the ledger shows the true state before any retry.
        if (recorded > 0) {
          showToast.error(`Only ${fmtMoney(recorded)} of ${fmtMoney(amt)} was recorded. ${failure}`);
          onSaved();
        } else {
          showToast.error(failure);
        }
        return;
      }
      showToast.success(`Recorded ${fmtMoney(recorded)} for ${selectedScope.label}`);
      onSaved();
    } catch (err: any) {
      showToast.error(err?.response?.data?.message || 'Failed to record payment');
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md lg:max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 my-6 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
          <div className="flex items-center gap-2">
            <Plus size={18} />
            <div>
              <h3 className="font-bold">Record Payment</h3>
              <p className="text-[11px] text-white/70">Log a manual (cash / bank / cheque / card) fee payment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/80 hover:bg-white/20"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Student</label>
            <input value={studentQuery} onChange={(e) => { setStudentQuery(e.target.value); setStudentId(''); setScopeId(''); setAmount(''); }} placeholder="Search by name or admission #…" className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            {/* Names can repeat — always pick by admission #, which is unique. */}
            {studentQuery && !studentId && students.length > 0 && (
              <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                {students.map((s: any) => {
                  const cls = s.class_name || s.className || (s.enrollment && s.enrollment.class_name) || '';
                  return (
                    <button
                      key={s.id}
                      onClick={() => { setStudentId(s.id); setStudentQuery(`${s.first_name} ${s.last_name} · ${s.student_id}`); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between gap-3 border-b border-gray-50 dark:border-gray-700/40 last:border-0"
                    >
                      <span className="text-sm text-gray-900 dark:text-white truncate">{s.first_name} {s.last_name}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        {cls && <span className="text-[10px] text-gray-400">{cls}</span>}
                        <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">{s.student_id}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {studentId && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Selected: {studentQuery}</p>
            )}
          </div>
          {studentId && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">What to pay for</label>
              <select value={scopeId} onChange={(e) => { setScopeId(e.target.value); const s = scopes.find((x) => x.id === e.target.value); setAmount(s ? String(s.amount) : ''); }} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                <option value="">Select what to pay for…</option>
                {scopes.map((s) => <option key={s.id} value={s.id}>{s.label} — {fmtMoney(s.amount)}</option>)}
              </select>
              {/* Selected-scope summary — year + amount due (full breakdown stays concise for mobile). */}
              {selectedScope && (
                <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{selectedScope.label}</div>
                      {selectedScope.sublabel && <div className="text-gray-500">{selectedScope.sublabel}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase">{selectedScope.outstanding > 0.001 ? 'Outstanding' : 'Amount'}</div>
                      <div className={`font-bold ${selectedScope.outstanding > 0.001 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmtMoney(selectedScope.amount)}</div>
                    </div>
                  </div>
                </div>
              )}
              {ledger && scopes.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {Number(ledger.totals?.billed || 0) > 0
                    ? 'This student has no outstanding balance. Everything billed is paid.'
                    : 'No billed fees for this student yet.'}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Amount (Le)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                {['cash', 'bank_transfer', 'cheque', 'card'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Reference (optional)</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Teller / cheque no." className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="default" size="sm" onClick={submit} disabled={saving}>{saving ? 'Recording…' : 'Record Payment'}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Print stylesheet for the A4 receipt. Hidden on screen; on print we hide the
// entire app (#root) and render only the receipt sheet at full A4 size.
const RECEIPT_PRINT_CSS = `
.receipt-print-sheet { display: none; }
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body * { visibility: hidden !important; }
  .receipt-print-sheet, .receipt-print-sheet * { visibility: visible !important; }
  .receipt-print-sheet {
    display: block !important;
    position: absolute; left: 0; top: 0; width: 210mm; min-height: 297mm;
    background: #fff; color: #111827;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    /* Force browsers to print exact colors (not wash them out) */
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .receipt-print-sheet * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .rcpt-page { padding: 18mm 16mm; position: relative; overflow: hidden; min-height: 297mm; box-sizing: border-box; }

  /* Repeating diagonal watermark */
  .rcpt-watermark {
    position: absolute; inset: 0; z-index: 0; overflow: hidden;
    transform: rotate(-30deg); transform-origin: center;
    display: flex; flex-wrap: wrap; align-content: center; gap: 4px;
    opacity: 0.05; pointer-events: none;
    font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #1a1a2e;
    line-height: 2.6;
  }
  .rcpt-watermark span { white-space: nowrap; }

  /* Large faint centre seal */
  .rcpt-seal {
    position: absolute; top: 46%; left: 50%; transform: translate(-50%, -50%) rotate(-14deg);
    z-index: 0; font-size: 120px; font-weight: 900; letter-spacing: 6px;
    color: #059669; opacity: 0.07; pointer-events: none;
  }

  /* Keep content above the watermark/seal */
  .rcpt-header, .rcpt-title, .rcpt-topgrid, .rcpt-table, .rcpt-summary-title,
  .rcpt-signrow, .rcpt-verify, .rcpt-footer { position: relative; z-index: 1; }
  .rcpt-header { display: flex; align-items: center; gap: 14px; padding-bottom: 14px; border-bottom: 3px solid #1a1a2e; }
  .rcpt-logo { width: 62px; height: 62px; object-fit: contain; border-radius: 8px; }
  .rcpt-logo-fallback { display:flex; align-items:center; justify-content:center; background:#1a1a2e; color:#fff; font-size:28px; font-weight:800; }
  .rcpt-school { flex: 1; }
  .rcpt-school-name { font-size: 22px; font-weight: 800; letter-spacing: -0.3px; }
  .rcpt-school-line { font-size: 11px; color: #475569; margin-top: 2px; }
  .rcpt-badge { text-align: right; }
  .rcpt-badge-title { font-size: 13px; font-weight: 800; color: #047857; letter-spacing: 2px; }
  .rcpt-badge-no { font-size: 11px; color: #1f2937; margin-top: 3px; font-weight: 600; }
  .rcpt-badge-date { font-size: 11px; color: #475569; }
  .rcpt-title { text-align: center; font-size: 12px; letter-spacing: 3px; color: #475569; font-weight: 700; margin: 20px 0 16px; }
  .rcpt-topgrid { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 22px; }
  .rcpt-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #475569; font-weight: 700; }
  .rcpt-payer { font-size: 17px; font-weight: 800; margin-top: 4px; color: #111827; }
  .rcpt-sub { font-size: 12px; color: #475569; margin-top: 2px; }
  .rcpt-amountbox { background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 10px; padding: 12px 18px; text-align: right; min-width: 190px; }
  .rcpt-amount { font-size: 24px; font-weight: 800; color: #047857; margin-top: 4px; }
  .rcpt-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  .rcpt-table td { padding: 9px 4px; font-size: 12.5px; border-bottom: 1px solid #cbd5e1; }
  .rcpt-table td:first-child { color: #334155; font-weight: 500; }
  .rcpt-table td:last-child { text-align: right; font-weight: 700; color: #111827; }
  .rcpt-summary-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #475569; font-weight: 700; margin: 6px 0 6px; }
  .rcpt-balrow td { border-top: 2px solid #111827; border-bottom: none; padding-top: 12px; font-size: 15px; font-weight: 800; }
  .rcpt-due td:last-child { color: #dc2626 !important; }
  .rcpt-settled td:last-child { color: #047857 !important; }
  .rcpt-signrow { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 22px; gap: 24px; }
  .rcpt-stamp { display: inline-block; padding: 8px 18px; border: 2px solid #047857; color: #047857; font-weight: 800; border-radius: 8px; font-size: 13px; letter-spacing: 1px; transform: rotate(-4deg); }
  .rcpt-stamp-recv { border-color: #b45309; color: #b45309; }
  .rcpt-sign { text-align: center; min-width: 200px; }
  .rcpt-sign-line { border-bottom: 1px solid #64748b; height: 28px; }
  .rcpt-sign-label { font-size: 10px; color: #475569; margin-top: 4px; }
  .rcpt-verify { margin-top: 26px; padding: 8px 12px; background: #f1f5f9; border: 1px dashed #94a3b8; border-radius: 8px; font-size: 10.5px; color: #334155; }
  .rcpt-verify-label { font-weight: 700; }
  .rcpt-verify-code { font-family: 'Courier New', monospace; font-weight: 800; letter-spacing: 2px; color: #111827; margin: 0 6px; }
  .rcpt-verify-hint { color: #64748b; }
  .rcpt-footer { position: absolute; bottom: 16mm; left: 16mm; right: 16mm; padding-top: 12px; border-top: 1px solid #cbd5e1; }
  .rcpt-foot-name { font-size: 12px; font-weight: 800; color: #111827; }
  .rcpt-foot-line { font-size: 10.5px; color: #475569; margin-top: 2px; }
  .rcpt-foot-note { font-size: 9.5px; color: #64748b; margin-top: 8px; }
}
`;

const ReceiptModal: React.FC<{ payment: any; school?: any; onClose: () => void }> = ({ payment, school = {}, onClose }) => {
  const meta = methodMeta(payment.method || payment.payment_method);
  const receiptNo = payment.reference_number || payment.provider_reference || payment.transaction_reference || `RCPT-${String(payment.id || '').slice(0, 8).toUpperCase()}`;
  const billed = Number(payment.student_total_billed) || 0;
  const paid = Number(payment.student_total_paid) || 0;
  const balance = Number(payment.student_balance) || 0;
  const settled = balance <= 0;

  const schoolName = school?.name || 'School';
  const schoolAddress = [school?.address, school?.city, school?.state, school?.country].filter(Boolean).join(', ');
  const schoolContacts = [school?.phone, school?.email, school?.website].filter(Boolean).join('  •  ');
  const schoolLogo = school?.logo_url;
  const paidDate = payment.payment_date ? new Date(payment.payment_date) : new Date();

  // Deterministic verification code derived from the receipt's key fields — the
  // same receipt always yields the same code, so it can be quoted to confirm
  // authenticity (and any tampering changes it).
  const verifyCode = (() => {
    const raw = `${receiptNo}|${payment.student_id || payment.admission_no || ''}|${payment.amount}|${paidDate.toISOString().slice(0, 10)}`;
    let h = 0;
    for (let i = 0; i < raw.length; i++) { h = (h * 31 + raw.charCodeAt(i)) >>> 0; }
    const hex = h.toString(16).toUpperCase().padStart(8, '0');
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
  })();

  // Lock background scroll while open so the centered modal is the focal point
  // (prevents the page staying scrolled behind the overlay).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md lg:max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden my-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Receipt size={18} /><span className="font-bold">Payment Receipt</span></div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20"><X size={16} /></button>
          </div>
          <div className="mt-1 text-xs text-white/80 font-mono">No. {receiptNo}</div>
        </div>

        {/* Amount hero — this specific transaction */}
        <div className="px-5 py-5 text-center border-b border-gray-100 dark:border-gray-700">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">This Payment</div>
          <div className="text-3xl font-black text-emerald-600 mt-1">{fmtMoney(payment.amount)}</div>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {cap(payment.status || 'completed')}
          </div>
        </div>

        {/* Payer + payment details */}
        <div className="px-5 py-4 space-y-3 text-sm border-b border-gray-100 dark:border-gray-700">
          <Row label="Student" value={payment.student_name} />
          <Row label="Admission #" value={payment.admission_no || '—'} />
          <Row label="Class" value={payment.class_name || '—'} />
          <Row label="Date" value={payment.payment_date ? new Date(payment.payment_date).toLocaleString() : '—'} />
          <Row label="Method" value={meta.label} />
          <Row label="Reference" value={payment.provider_reference || payment.transaction_reference || '—'} />
        </div>

        {/* Fee account summary */}
        <div className="px-5 py-4 space-y-2.5 text-sm bg-gray-50 dark:bg-gray-900/40">
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-bold mb-1">Fee Account Summary</div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Total Billed</span>
            <span className="font-semibold text-gray-900 dark:text-white">{fmtMoney(billed)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Total Paid (to date)</span>
            <span className="font-semibold text-emerald-600">{fmtMoney(paid)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-2.5">
            <span className="font-bold text-gray-700 dark:text-gray-300">Balance {settled ? '' : 'Due'}</span>
            <span className={`text-lg font-black ${settled ? 'text-emerald-600' : 'text-rose-600'}`}>{settled ? 'Le 0.00 · Settled' : fmtMoney(balance)}</span>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {/* ── Print-only A4 receipt (hidden on screen, shown only when printing) ── */}
      <style>{RECEIPT_PRINT_CSS}</style>
      <div className="receipt-print-sheet" aria-hidden>
        <div className="rcpt-page">
          {/* Diagonal repeating watermark for authenticity */}
          <div className="rcpt-watermark">
            {Array.from({ length: 40 }).map((_, i) => (
              <span key={i}>{(schoolName || 'RECEIPT').toUpperCase()} · PAID&nbsp;&nbsp;</span>
            ))}
          </div>
          {/* Large faint centre seal */}
          <div className="rcpt-seal">{settled ? 'PAID' : 'RECEIVED'}</div>
          {/* Header band */}
          <div className="rcpt-header">
            {schoolLogo ? <img src={schoolLogo} alt="" className="rcpt-logo" /> : <div className="rcpt-logo rcpt-logo-fallback">{schoolName.charAt(0)}</div>}
            <div className="rcpt-school">
              <div className="rcpt-school-name">{schoolName}</div>
              {schoolAddress && <div className="rcpt-school-line">{schoolAddress}</div>}
              {schoolContacts && <div className="rcpt-school-line">{schoolContacts}</div>}
            </div>
            <div className="rcpt-badge">
              <div className="rcpt-badge-title">RECEIPT</div>
              <div className="rcpt-badge-no">No. {receiptNo}</div>
              <div className="rcpt-badge-date">{paidDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>

          <div className="rcpt-title">OFFICIAL PAYMENT RECEIPT</div>

          {/* Received from + amount */}
          <div className="rcpt-topgrid">
            <div>
              <div className="rcpt-label">Received From</div>
              <div className="rcpt-payer">{payment.student_name}</div>
              <div className="rcpt-sub">{payment.admission_no || ''}{payment.class_name ? ` · ${payment.class_name}` : ''}</div>
            </div>
            <div className="rcpt-amountbox">
              <div className="rcpt-label">Amount Paid</div>
              <div className="rcpt-amount">{fmtMoney(payment.amount)}</div>
            </div>
          </div>

          {/* Payment details */}
          <table className="rcpt-table">
            <tbody>
              <tr><td>Payment Method</td><td>{meta.label}</td></tr>
              <tr><td>Reference</td><td>{payment.provider_reference || payment.transaction_reference || '—'}</td></tr>
              <tr><td>Date &amp; Time</td><td>{paidDate.toLocaleString()}</td></tr>
              <tr><td>Status</td><td>{cap(payment.status || 'completed')}</td></tr>
            </tbody>
          </table>

          {/* Fee account summary */}
          <div className="rcpt-summary-title">Fee Account Summary</div>
          <table className="rcpt-table">
            <tbody>
              <tr><td>Total Billed</td><td>{fmtMoney(billed)}</td></tr>
              <tr><td>Total Paid (to date)</td><td>{fmtMoney(paid)}</td></tr>
              <tr className={`rcpt-balrow ${settled ? 'rcpt-settled' : 'rcpt-due'}`}><td>Balance {settled ? '' : 'Due'}</td><td>{settled ? 'Le 0.00 — Settled' : fmtMoney(balance)}</td></tr>
            </tbody>
          </table>

          {/* Stamp + signature row */}
          <div className="rcpt-signrow">
            <div className={`rcpt-stamp ${settled ? 'rcpt-stamp-paid' : 'rcpt-stamp-recv'}`}>{settled ? '✓ FULLY PAID' : '✓ PAYMENT RECEIVED'}</div>
            <div className="rcpt-sign">
              <div className="rcpt-sign-line" />
              <div className="rcpt-sign-label">Authorised Signature / Bursar</div>
            </div>
          </div>

          {/* Verification strip */}
          <div className="rcpt-verify">
            <span className="rcpt-verify-label">Verification Code:</span>
            <span className="rcpt-verify-code">{verifyCode}</span>
            <span className="rcpt-verify-hint">Quote this code to confirm authenticity with {schoolName}.</span>
          </div>

          {/* Footer */}
          <div className="rcpt-footer">
            <div className="rcpt-foot-name">{schoolName}</div>
            {schoolContacts && <div className="rcpt-foot-line">{schoolContacts}</div>}
            <div className="rcpt-foot-note">This is an official computer-generated receipt. Any alteration renders it void. Issued electronically — valid without a physical signature.</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

function cap(s?: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Reusable filter dropdown for the payments ledger ──────────────────────────
const FilterSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}> = ({ value, onChange, allLabel, options }) => (
  <div className="relative w-full">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white dark:bg-gray-800 ${value ? 'border-blue-400 text-gray-900 dark:text-white font-medium' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
  </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900 dark:text-white text-right">{value}</span>
  </div>
);

// ── Quick per-defaulter reminder (one click, emails that student's guardian) ──
const DefaulterReminderButton: React.FC<{ studentId: string }> = ({ studentId }) => {
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try {
      const res: any = await financeService.sendBalanceReminders({ scope: 'student', studentId });
      const d = res?.data?.data ?? res?.data;
      if (d?.sent > 0) showToast.success('Reminder sent (email + portal notification)');
      else if (d?.notified > 0) showToast.success('Portal notification sent (no email on file)');
      else if (d?.skippedNoBalance > 0) showToast.info('No outstanding balance to remind about');
      else showToast.info('Nothing to send');
    } catch {
      showToast.error('Failed to send reminder');
    } finally { setSending(false); }
  };
  return (
    <button onClick={send} disabled={sending} title="Email balance reminder" className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50">
      {sending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
    </button>
  );
};

// ── Bulk balance-reminder modal ──────────────────────────────────────────────
type RemindScope = 'all' | 'section' | 'class';
const TERMS = ['First Term', 'Second Term', 'Third Term'];

const SendRemindersModal: React.FC<{ onClose: () => void; defaulterCount?: number }> = ({ onClose, defaulterCount }) => {
  const [scope, setScope] = useState<RemindScope>('all');
  const [classId, setClassId] = useState('');
  const [section, setSection] = useState('');
  const [term, setTerm] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const { data: classesResp } = useQuery({ queryKey: ['remind-classes'], queryFn: () => classesService.listAllClasses({ limit: 100 }), staleTime: 60_000 });
  const classes = ((classesResp as any)?.data?.data ?? (classesResp as any)?.data ?? []) as any[];
  // Sections present among the school's classes (Nursery / Primary / JSS / SSS).
  const availableSections = useMemo(() => {
    const present = new Set<string>();
    classes.forEach((c: any) => { const k = SECTION_GROUPS.find((g) => g.levels.includes((c.level || '').toUpperCase()))?.key; if (k) present.add(k); });
    return SECTION_GROUPS.filter((g) => present.has(g.key));
  }, [classes]);
  // Classes scoped to the chosen section (so the class dropdown cascades).
  const scopedClasses = useMemo(() => {
    if (scope !== 'class') return classes;
    return section ? classes.filter((c: any) => SECTION_GROUPS.find((g) => g.levels.includes((c.level || '').toUpperCase()))?.key === section) : classes;
  }, [classes, scope, section]);

  const submit = async () => {
    if (scope === 'section' && !section) { showToast.error('Select a section'); return; }
    if (scope === 'class' && !classId) { showToast.error('Select a class'); return; }
    setSending(true);
    try {
      const res: any = await financeService.sendBalanceReminders({
        scope, classId: scope === 'class' ? classId : undefined, section: scope === 'section' ? section : undefined,
        term: term || undefined, message: message || undefined,
      });
      const d = res?.data?.data ?? res?.data;
      const sent = d?.sent ?? 0;
      const notified = d?.notified ?? 0;
      if (sent > 0 || notified > 0) {
        const parts: string[] = [];
        if (sent > 0) parts.push(`${sent} email${sent === 1 ? '' : 's'}`);
        if (notified > 0) parts.push(`${notified} portal alert${notified === 1 ? '' : 's'}`);
        const extra = d?.skippedNoEmail ? ` · ${d.skippedNoEmail} had no email` : '';
        showToast.success(`Sent ${parts.join(' + ')}${extra}`);
        onClose();
      } else if (d?.skippedNoBalance > 0) {
        showToast.info('No outstanding balances in this scope');
      } else {
        showToast.info('No students matched this scope');
      }
    } catch (err: any) {
      showToast.error(err?.response?.data?.error || 'Failed to send reminders');
    } finally { setSending(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2"><Bell size={16} className="text-amber-500" /><h3 className="font-bold text-gray-900 dark:text-white">Send Balance Reminders</h3></div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">Sends each guardian (and the student's own account) a descriptive reminder of their child's outstanding fee balance — both as a <strong>portal notification</strong> and, where an email is on file, a branded email with a secure "Log in &amp; Pay" button. Students with no balance are skipped.</p>

          {typeof defaulterCount === 'number' && defaulterCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle size={14} className="flex-shrink-0" />
              <span><strong>{defaulterCount}</strong> student{defaulterCount === 1 ? '' : 's'} currently have an outstanding balance. Only those in your chosen scope will be reminded.</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Who to remind</label>
            <div className="grid grid-cols-3 gap-1 mt-1 bg-gray-100 dark:bg-gray-900/50 rounded-xl p-1">
              {(['all', 'section', 'class'] as RemindScope[]).map((s) => (
                <button key={s} onClick={() => { setScope(s); setClassId(''); }} className={`px-2 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${scope === s ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>{s === 'all' ? 'All defaulters' : s}</button>
              ))}
            </div>
          </div>

          {scope === 'section' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Section</label>
              <select value={section} onChange={(e) => setSection(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                <option value="">Select a section…</option>
                {availableSections.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
          )}
          {scope === 'class' && (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Section (optional filter)</label>
                <select value={section} onChange={(e) => { setSection(e.target.value); setClassId(''); }} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option value="">All sections</option>
                  {availableSections.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Class</label>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                  <option value="">Select a class…</option>
                  {scopedClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Term (optional)</label>
            <select value={term} onChange={(e) => setTerm(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="">All outstanding fees</option>
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Custom note (optional)</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Add a personal note that appears in the email, e.g. deadlines or payment plans…" className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="default" size="sm" onClick={submit} disabled={sending}>{sending ? 'Sending…' : 'Send Reminders'}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaymentsPage;
