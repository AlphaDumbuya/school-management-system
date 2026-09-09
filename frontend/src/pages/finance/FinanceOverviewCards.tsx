/**
 * Shared finance KPI cards + helpers used by the finance admin pages.
 */
import React from 'react';
import { Banknote, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { FinanceOverview } from '@services/financeService';

export const fmtMoney = (v: number | string | null | undefined) => {
  const n = Number(v) || 0;
  return `Le ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

/** Mobile-only hint that a table scrolls sideways. */
export const SwipeHint: React.FC = () => (
  <p className="sm:hidden text-[11px] text-gray-400 mb-2">Tip: swipe sideways to see all columns.</p>
);

export const statusPill = (status: string) => {
  const s = (status || '').toLowerCase();
  const cls = s === 'paid' || s === 'completed'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : s === 'overdue' || s === 'failed'
    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
    : s === 'partial'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{status ? status[0].toUpperCase() + status.slice(1) : '—'}</span>;
};

export const FinanceOverviewCards: React.FC<{ overview?: FinanceOverview; loading?: boolean }> = ({ overview, loading }) => {
  const cards = [
    { label: 'Total Billed', value: fmtMoney(overview?.totalBilled), icon: <Banknote size={20} />, color: 'text-blue-600 bg-blue-500/10' },
    { label: 'Collected', value: fmtMoney(overview?.totalPaid), icon: <CheckCircle2 size={20} />, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Outstanding', value: fmtMoney(overview?.totalOutstanding), icon: <AlertTriangle size={20} />, color: 'text-amber-600 bg-amber-500/10' },
    { label: 'Overdue Invoices', value: overview?.overdueInvoices ?? 0, icon: <Clock size={20} />, color: 'text-rose-600 bg-rose-500/10' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${c.color} mb-3`}>{c.icon}</div>
          <div className="text-xl font-black text-gray-900 dark:text-white">
            {loading ? <span className="inline-block h-6 w-20 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" /> : c.value}
          </div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
};
