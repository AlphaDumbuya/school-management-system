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
import { AlertTriangle, TrendingUp, Banknote, Wallet, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { HeroRefreshButton } from '@components/dashboard/HeroRefreshButton';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { financeService } from '@services/financeService';

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
