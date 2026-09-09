/**
 * Accountant Dashboard — real, tenant-scoped financial overview.
 *
 * Pulls live data from the finance endpoints (overview KPIs, analytics with
 * recent payments + top defaulters). No mock data. Currency is Leone (Le).
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { MainLayout } from '@components/layout/MainLayout';
import { AlertTriangle, TrendingUp, Banknote, Wallet, Loader2 } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { financeService } from '@services/financeService';

const fmtLe = (v: number | string | null | undefined) =>
  `Le ${(Number(v) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const Phase13AccountantDashboard: React.FC = () => {
  const { user } = useAuthStore();

  const { data: overviewResp, isLoading: overviewLoading } = useQuery({
    queryKey: ['acct-overview'],
    queryFn: () => financeService.getOverview(),
    staleTime: 60_000,
  });
  const { data: analyticsResp, isLoading: analyticsLoading } = useQuery({
    queryKey: ['acct-analytics'],
    queryFn: () => financeService.getAnalytics(),
    staleTime: 60_000,
  });

  const overview = (overviewResp as any)?.data;
  const analytics = (analyticsResp as any)?.data;
  const totals = analytics?.totals;
  const recent: any[] = analytics?.recent ?? [];
  const defaulters: any[] = analytics?.topDefaulters ?? [];

  const kpis = [
    { label: 'Collected', value: fmtLe(overview?.totalPaid), icon: <Banknote size={20} />, tint: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Total Billed', value: fmtLe(overview?.totalBilled), icon: <Wallet size={20} />, tint: 'text-blue-600 bg-blue-500/10' },
    { label: 'Outstanding', value: fmtLe(overview?.totalOutstanding), icon: <AlertTriangle size={20} />, tint: 'text-amber-600 bg-amber-500/10' },
    { label: 'Collection Rate', value: totals ? `${Math.round(totals.collectionRate)}%` : '—', icon: <TrendingUp size={20} />, tint: 'text-purple-600 bg-purple-500/10' },
  ];

  const loading = overviewLoading || analyticsLoading;

  return (
    <MainLayout>
      <div className="space-y-6">
        <WelcomeHero
          firstName={user?.firstName ?? (user as any)?.first_name}
          role="accountant"
          roleLabel="Accountant"
          subtitle="Financial management and revenue tracking."
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${k.tint} mb-3`}>{k.icon}</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">
                {loading ? <span className="inline-block h-6 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" /> : k.value}
              </div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent payments */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Recent Payments</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
              ) : recent.length === 0 ? (
                <EmptyState message="No payments yet" description="Recorded payments will appear here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                        <th className="py-2 pr-4">Student</th>
                        <th className="py-2 pr-4">Method</th>
                        <th className="py-2 pr-4 text-right">Amount</th>
                        <th className="py-2 pr-4">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.slice(0, 10).map((p) => (
                        <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200">{p.studentName || '—'}</td>
                          <td className="py-2 pr-4 capitalize text-gray-500">{p.method || '—'}</td>
                          <td className="py-2 pr-4 text-right font-bold text-gray-900 dark:text-white">{fmtLe(p.amount)}</td>
                          <td className="py-2 pr-4 text-gray-500">{p.date ? new Date(p.date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <AnnouncementsWidget />
        </div>

        {/* Top defaulters (outstanding) */}
        <Card>
          <CardHeader><CardTitle>Top Outstanding Balances</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
            ) : defaulters.length === 0 ? (
              <EmptyState message="No outstanding balances" description="Students with unpaid balances will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                      <th className="py-2 pr-4">Student</th>
                      <th className="py-2 pr-4">Admission No.</th>
                      <th className="py-2 pr-4">Class</th>
                      <th className="py-2 pr-4 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defaulters.map((d, i) => (
                      <tr key={`${d.admissionNo}-${i}`} className="border-b border-gray-50 dark:border-gray-800">
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
