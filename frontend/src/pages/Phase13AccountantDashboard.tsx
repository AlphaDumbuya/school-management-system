/**
 * Accountant Dashboard — tenant-scoped financial overview for ONE academic year.
 *
 * KPIs, top outstanding balances and recent payments all follow the selected
 * year (current by default, follows a rollover). Balances still owed from
 * other years are shown separately, since they stay collectable. Figures come
 * from the fees ledger on the server (whole year, not one page). Currency: Le.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { MainLayout } from '@components/layout/MainLayout';
import { AlertTriangle, TrendingUp, Banknote, Wallet, Loader2, RefreshCw, ArrowRight, Receipt, PiggyBank, Users, Scale, BookOpen, Landmark, History, Coins, FileText, Percent, Timer, ListTree } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { HeroRefreshButton } from '@components/dashboard/HeroRefreshButton';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { financeService } from '@services/financeService';
import { bursarService, bursarB } from '@services/bursarService';
import { routeAccess } from '@lib/planFeatures';
import { ChartCard } from '@components/admin/charts/ChartCard';
import { fmtLeShort, prettyLabel, NO_SERIES } from '@lib/chartFormat';

const fmtLe = (v: number | string | null | undefined) =>
  `Le ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** apiClient never throws: turn {success:false} into a query error. */
async function ok<T>(p: Promise<any>): Promise<T> {
  const r = await p;
  if (r?.success === false) throw new Error(r.error || 'Could not load finance figures.');
  return r?.data as T;
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  refunded: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

export const Phase13AccountantDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { activeYear } = useAcademicYears();
  const [pickedYear, setPickedYear] = useState(''); // '' = current year
  const year = pickedYear || activeYear;
  const viewingPast = !!year && !!activeYear && year < activeYear;
  // Pay runs waiting on someone: drafts for the principal, approved ones to pay.
  const runsQ = useQuery({ queryKey: ['fin-runs'], queryFn: async () => { const r: any = await bursarB.runs(); return r?.success === false ? [] : (r?.data || []); }, staleTime: 60_000 });
  const runsDraft = (runsQ.data || []).filter((x: any) => x.status === 'draft').length;
  const runsToPay = (runsQ.data || []).filter((x: any) => x.status === 'approved').length;
  const changeYear = (y: string) => setPickedYear(!y || y === activeYear ? '' : y);

  const overviewQ = useQuery({
    queryKey: ['acct-overview', year],
    queryFn: () => ok<any>(financeService.getOverview(year)),
    enabled: !!year,
    staleTime: 60_000,
  });
  const analyticsQ = useQuery({
    queryKey: ['acct-analytics', year],
    queryFn: () => ok<any>(financeService.getAnalytics(year)),
    enabled: !!year,
    staleTime: 60_000,
  });

  const cashQ = useQuery({
    queryKey: ['acct-cash', year],
    queryFn: () => ok<any>(bursarService.cashPosition(year)),
    enabled: !!year && !viewingPast,
    staleTime: 60_000,
  });
  const pendingQ = useQuery({
    queryKey: ['acct-pending-discounts', year],
    queryFn: () => ok<any[]>(bursarService.listGrants({ academic_year: year, status: 'pending' })),
    enabled: !!year,
    staleTime: 60_000,
  });
  const cash = cashQ.data;
  const pendingDiscounts = (pendingQ.data || []).length;
  const overview = overviewQ.data;
  const analytics = analyticsQ.data;
  const totals = analytics?.totals;
  const recent: any[] = analytics?.recent ?? [];
  const defaulters: any[] = analytics?.topDefaulters ?? [];
  const otherYears: { year: string; outstanding: number; students: number }[] = analytics?.otherYears ?? [];
  const arrears = otherYears.reduce((s, r) => s + r.outstanding, 0);

  const loading = !year || overviewQ.isLoading || analyticsQ.isLoading;
  const loadError = (overviewQ.error || analyticsQ.error) as Error | null;
  const retry = () => { void overviewQ.refetch(); void analyticsQ.refetch(); };

  // Chart series from the analytics already loaded for this year.
  const trendChart = analytics?.trend?.length
    ? { labels: analytics.trend.map((t: any) => t.label), series: [{ name: 'Collected', data: analytics.trend.map((t: any) => t.total) }] }
    : NO_SERIES;
  const healthChart = totals && (totals.paid > 0 || totals.outstanding > 0)
    ? { labels: ['Collected', 'Outstanding'], series: [{ name: 'Le', data: [totals.paid, totals.outstanding] }] }
    : NO_SERIES;
  const levelChart = analytics?.byLevel?.length
    ? {
      labels: analytics.byLevel.map((l: any) => l.level),
      series: [
        { name: 'Billed', data: analytics.byLevel.map((l: any) => l.billed) },
        { name: 'Collected', data: analytics.byLevel.map((l: any) => l.collected) },
        { name: 'Outstanding', data: analytics.byLevel.map((l: any) => l.outstanding) },
      ],
    }
    : NO_SERIES;
  const methodChart = analytics?.byMethod?.length
    ? { labels: analytics.byMethod.map((m: any) => prettyLabel(m.method)), series: [{ name: 'Amount', data: analytics.byMethod.map((m: any) => m.total) }] }
    : NO_SERIES;

  const kpis = [
    { label: `Collected · ${year || '…'}`, value: fmtLe(overview?.totalPaid), icon: <Banknote size={20} />, tint: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Total Billed', value: fmtLe(overview?.totalBilled), icon: <Wallet size={20} />, tint: 'text-blue-600 bg-blue-500/10' },
    { label: 'Outstanding', value: fmtLe(overview?.totalOutstanding), icon: <AlertTriangle size={20} />, tint: 'text-amber-600 bg-amber-500/10' },
    { label: 'Collection Rate', value: totals ? `${Math.round(totals.collectionRate)}%` : '—', icon: <TrendingUp size={20} />, tint: 'text-purple-600 bg-purple-500/10' },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <WelcomeHero
          firstName={user?.firstName ?? (user as any)?.first_name}
          role="accountant"
          roleLabel="Accountant"
          subtitle={`School fees for ${year || 'the current year'}: billed, collected and still owed.`}
          actions={
            <div className="flex items-center gap-2">
              <YearFilter value={year} onChange={changeYear} noAutoSelect />
              <HeroRefreshButton
                onRefresh={() => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('acct-') })}
              />
            </div>
          }
        />

        {viewingPast && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <span>Showing <strong>{year}</strong> as history. Unpaid balances from that year can still be collected.</span>
            <button type="button" onClick={() => changeYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          </div>
        )}

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <span>{loadError.message}</span>
            <button type="button" onClick={retry} className="inline-flex items-center gap-1 text-xs font-bold hover:underline">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${k.tint} mb-3`}>{k.icon}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">
                {loading ? <span className="inline-block h-6 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" /> : loadError ? '—' : k.value}
              </div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Charts: trend, collection health, by level, by method */}
        {!loadError && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2">
                <ChartCard title="Collections" subtitle="Fees received over the last 6 months" type="line" height={260}
                  isLoading={loading} colors={['#10b981']} valueFormatter={fmtLeShort}
                  emptyState={{ message: 'No collections yet', description: 'Recorded payments will chart here.' }} {...trendChart} />
              </div>
              <ChartCard title="Collection health" subtitle={`Collected vs still owed · ${year || ''}`} type="donut" height={260}
                isLoading={loading} colors={['#10b981', '#ef4444']} valueFormatter={fmtLeShort}
                donutCenterLabel={totals ? `${Math.round(totals.collectionRate)}%` : undefined}
                emptyState={{ message: 'Nothing billed yet', description: 'Bill a term on the Fees page.' }} {...healthChart} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2">
                <ChartCard title="Billed, collected and owed" subtitle="By class level" type="bar" height={280}
                  isLoading={loading} colors={['#3b82f6', '#10b981', '#ef4444']} valueFormatter={fmtLeShort}
                  emptyState={{ message: 'No billing data yet', description: 'Bill a term on the Fees page to populate this.' }} {...levelChart} />
              </div>
              <ChartCard title="How families pay" subtitle="Amount by payment method" type="donut" height={280}
                isLoading={loading} valueFormatter={fmtLeShort}
                emptyState={{ message: 'No payments yet', description: 'Payment methods will break down here.' }} {...methodChart} />
            </div>
          </>
        )}

        {/* Cash position, overdue, discounts */}
        {!loadError && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {!viewingPast && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <div className="text-xs font-semibold text-gray-500">Cash received</div>
                <div className="mt-1 text-sm"><span className="text-gray-500">Today </span><strong>{fmtLe(cash?.today)}</strong></div>
                <div className="text-sm"><span className="text-gray-500">This month </span><strong>{fmtLe(cash?.month)}</strong></div>
              </div>
            )}
            <Link to="/finance/aging" className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 hover:ring-2 hover:ring-red-300">
              <div className="text-xs font-semibold text-red-700">Overdue now</div>
              <div className="text-xl font-black text-red-700">{fmtLe(overview?.overdueAmount)}</div>
              <div className="text-[11px] text-red-700/80">{overview?.overdueInvoices ?? 0} overdue charge{overview?.overdueInvoices === 1 ? '' : 's'} · see aging</div>
            </Link>
            <Link to={routeAccess(user, '/finance/discounts') === 'locked' ? '/finance/payments' : '/finance/discounts'} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:ring-2 hover:ring-blue-200">
              <div className="text-xs font-semibold text-gray-500">Discounts & waivers</div>
              <div className="text-xl font-black">{fmtLe(overview?.totalDiscounts)}</div>
              <div className="text-[11px] text-gray-500">Taken off fees · not counted as collected</div>
            </Link>
            <Link to="/finance/discounts" className={`rounded-2xl border p-4 ${pendingDiscounts ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
              <div className="text-xs font-semibold text-gray-500">Discounts awaiting approval</div>
              <div className={`text-xl font-black ${pendingDiscounts ? 'text-amber-700' : ''}`}>{pendingDiscounts}</div>
              <div className="text-[11px] text-gray-500">The principal approves them</div>
            </Link>
          </div>
        )}

        {/* Arrears from other years */}
        {!loading && !loadError && arrears > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>{fmtLe(arrears)}</strong> is still owed from other years and is not included above:{' '}
                {otherYears.map((r) => `${r.year} ${fmtLe(r.outstanding)} (${r.students} student${r.students === 1 ? '' : 's'})`).join(' · ')}.
              </span>
              <Link to="/finance/invoices" className="inline-flex items-center gap-1 text-xs font-bold hover:underline">
                Collect <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        )}

        {/* Every finance area, one tap away */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Finance work areas</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { to: '/finance/fees', label: 'Fee Structures', icon: <Coins size={16} /> },
              { to: '/finance/invoices', label: 'Invoices', icon: <FileText size={16} /> },
              { to: '/finance/payments', label: 'Payments', icon: <Receipt size={16} /> },
              { to: '/finance/aging', label: 'Arrears & Aging', icon: <Timer size={16} /> },
              { to: '/finance/discounts', label: 'Discounts', icon: <Percent size={16} /> },
              { to: '/finance/expenses', label: 'Expenses', icon: <Wallet size={16} /> },
              { to: '/finance/petty-cash', label: 'Petty Cash', icon: <PiggyBank size={16} /> },
              { to: '/finance/budgets', label: 'Budget', icon: <TrendingUp size={16} /> },
              { to: '/finance/payroll', label: 'Payroll', icon: <Users size={16} />, note: runsDraft ? `${runsDraft} awaiting approval` : runsToPay ? `${runsToPay} to pay` : '' },
              { to: '/finance/reports', label: 'Statements', icon: <Scale size={16} /> },
              { to: '/finance/journal', label: 'Journal', icon: <BookOpen size={16} /> },
              { to: '/finance/bank-reconciliation', label: 'Bank Reconciliation', icon: <Landmark size={16} /> },
              { to: '/finance/accounts', label: 'Chart of Accounts', icon: <ListTree size={16} /> },
              { to: '/finance/audit-log', label: 'Audit Log', icon: <History size={16} /> },
            ].filter((l) => routeAccess(user, l.to) !== 'locked').map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-blue-300 hover:text-blue-700">
                <span className="text-blue-600 dark:text-blue-400">{l.icon}</span>
                <span className="min-w-0"><span className="block truncate">{l.label}</span>{l.note && <span className="block text-[11px] font-medium text-amber-700">{l.note}</span>}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent payments */}
          <Card className={viewingPast ? 'lg:col-span-3' : 'lg:col-span-2'}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{viewingPast ? `Payments for ${year}` : 'Recent Payments'}</CardTitle>
              <Link to="/finance/payments" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">View all</Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
              ) : loadError ? (
                <EmptyState message="Payments couldn't be loaded" description="Use Retry above." />
              ) : recent.length === 0 ? (
                <EmptyState message={`No payments for ${year} yet`} description="Recorded and online payments will appear here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                        <th className="py-2 pr-4">Student</th>
                        <th className="py-2 pr-4">Method</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4 text-right">Amount</th>
                        <th className="py-2 pr-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.slice(0, 10).map((p) => (
                        <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200">{p.studentName || '—'}</td>
                          <td className="py-2 pr-4 capitalize text-gray-500">{String(p.method || '—').replace(/_/g, ' ')}</td>
                          <td className="py-2 pr-4">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[p.status] || STATUS_STYLE.refunded}`}>
                              {p.status || '—'}
                            </span>
                          </td>
                          <td className={`py-2 pr-4 text-right font-bold ${p.status === 'completed' ? 'text-gray-900 dark:text-white' : 'text-gray-400 line-through decoration-1'}`}>
                            {fmtLe(p.amount)}
                          </td>
                          <td className="py-2 pr-4 text-gray-500">{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {recent.some((p) => p.status !== 'completed') && (
                    <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Only completed payments count towards Collected.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live widget: current year only */}
          {!viewingPast && <AnnouncementsWidget academicYear={year} />}
        </div>

        {/* Top outstanding balances (selected year) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Outstanding Balances · {year}</CardTitle>
            <Link to="/finance/invoices" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">Invoices</Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
            ) : loadError ? (
              <EmptyState message="Balances couldn't be loaded" description="Use Retry above." />
            ) : defaulters.length === 0 ? (
              <EmptyState message={`No unpaid balances for ${year}`} description="Students who still owe this year's fees will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                      <th className="py-2 pr-4">Student</th>
                      <th className="py-2 pr-4">Admission No.</th>
                      <th className="py-2 pr-4">Class ({year})</th>
                      <th className="py-2 pr-4 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defaulters.map((d, i) => (
                      <tr key={`${d.studentId || d.admissionNo}-${i}`} className="border-b border-gray-50 dark:border-gray-800">
                        <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200">{d.studentName || '—'}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-gray-500">{d.admissionNo || '—'}</td>
                        <td className="py-2 pr-4 text-gray-500">{d.className || '—'}</td>
                        <td className="py-2 pr-4 text-right font-bold text-amber-600">{fmtLe(d.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Phase13AccountantDashboard;
