/**
 * InvoicesPage — /finance/invoices
 * Tenant-wide invoices with collection KPIs. Staff/accountant view; parents
 * see their own via the portal.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ChevronDown } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { financeService } from '@services/financeService';
import { FinanceOverviewCards, fmtMoney, statusPill, SwipeHint } from './FinanceOverviewCards';
import { PayFeesButton } from '@components/finance/PayFeesButton';

export const InvoicesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: overviewResp, isLoading: ovLoading, refetch: refetchOv } = useQuery({
    queryKey: ['finance-overview'], queryFn: () => financeService.getOverview(), staleTime: 30_000,
  });
  const { data: invResp, isLoading, refetch } = useQuery({
    queryKey: ['finance-invoices', statusFilter], queryFn: () => financeService.listInvoices(statusFilter || undefined), staleTime: 15_000,
  });

  const overview = (overviewResp as any)?.data?.data ?? (overviewResp as any)?.data;
  const invoices = ((invResp as any)?.data?.data ?? (invResp as any)?.data ?? []) as any[];

  const filtered = invoices.filter((i) => {
    const t = search.trim().toLowerCase();
    return !t || i.invoice_number?.toLowerCase().includes(t) || i.student_name?.toLowerCase().includes(t) || i.admission_no?.toLowerCase().includes(t);
  });

  return (
    <MainLayout>
      <PageShell
        title="Invoices"
        subtitle="Student fee invoices and balances"
        actions={<Button variant="outline" size="sm" onClick={() => { refetch(); refetchOv(); }} disabled={isLoading}><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span></Button>}
      >
        <FinanceOverviewCards overview={overview} loading={ovLoading} />

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
          <SearchBar
            placeholder="Search by invoice # or student…"
            onSearch={setSearch}
            isLoading={isLoading}
            resultCount={search ? filtered.length : undefined}
            defaultValue={search}
            className="w-full sm:max-w-md"
          />
          <div className="relative w-full sm:w-44">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState message="No invoices found" description="Invoices generated for students will appear here." />
        ) : (
          <>
          <SwipeHint />
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Invoice #</th>
                  <th className="px-4 py-3 whitespace-nowrap">Student</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Paid</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Balance</th>
                  <th className="px-4 py-3 whitespace-nowrap">Due</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filtered.map((inv) => {
                  const bal = Number(inv.balance) || 0;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{inv.invoice_number}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-white">{inv.student_name}</div>
                        <div className="text-xs text-gray-400">{inv.admission_no}</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{fmtMoney(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 whitespace-nowrap">{fmtMoney(inv.total_paid)}</td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{fmtMoney(inv.balance)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{statusPill(inv.status)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {bal > 0 && inv.status !== 'paid'
                          ? <PayFeesButton invoiceId={inv.id} size="sm">Pay</PayFeesButton>
                          : <span className="text-xs text-gray-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default InvoicesPage;
