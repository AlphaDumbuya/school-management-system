/**
 * PaymentsPage — /finance/payments
 * The school's finance command center: monitor collections across all classes
 * and levels, analyse payment methods & trends, record manual payments, view
 * receipts, and export the ledger.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, Smartphone, CreditCard, Banknote, Landmark, Wallet, Plus, Download,
  TrendingUp, Receipt, ChevronDown, X,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { ChartCard } from '@components/admin/charts/ChartCard';
import { showToast } from '@utils/toast';
import { exportToCSV } from '@utils/exportUtils';
import { financeService } from '@services/financeService';
import { studentsService } from '@services/studentsService';
import { FinanceOverviewCards, fmtMoney, statusPill, SwipeHint } from './FinanceOverviewCards';

const methodMeta = (m?: string) => {
  const s = (m || '').toLowerCase();
  if (s === 'monime') return { icon: <Smartphone size={14} className="text-emerald-600" />, label: 'Monime (Online)' };
  if (s.includes('mobile') || s.includes('momo')) return { icon: <Smartphone size={14} className="text-emerald-600" />, label: 'Mobile Money' };
  if (s.includes('card')) return { icon: <CreditCard size={14} className="text-blue-600" />, label: 'Card' };
  if (s.includes('bank')) return { icon: <Landmark size={14} className="text-violet-600" />, label: 'Bank' };
  if (s.includes('wallet')) return { icon: <Wallet size={14} className="text-amber-600" />, label: 'Wallet' };
  if (s.includes('cash')) return { icon: <Banknote size={14} className="text-gray-500" />, label: 'Cash' };
  return { icon: <Banknote size={14} className="text-gray-400" />, label: m || '—' };
};

export const PaymentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  const { data: overviewResp, isLoading: ovLoading, refetch: refetchOv } = useQuery({
    queryKey: ['finance-overview'], queryFn: () => financeService.getOverview(), staleTime: 30_000,
  });
  const { data: analyticsResp, refetch: refetchAn } = useQuery({
    queryKey: ['finance-analytics'], queryFn: () => financeService.getAnalytics(), staleTime: 30_000,
  });
  const { data: payResp, isLoading, refetch } = useQuery({
    queryKey: ['finance-payments'], queryFn: () => financeService.listPayments(), staleTime: 15_000,
  });

  const overview = (overviewResp as any)?.data?.data ?? (overviewResp as any)?.data;
  const analytics = (analyticsResp as any)?.data?.data ?? (analyticsResp as any)?.data;
  const payments = ((payResp as any)?.data?.data ?? (payResp as any)?.data ?? []) as any[];

  const levels = useMemo(
    () => Array.from(new Set(payments.map((p) => p.class_level).filter(Boolean))).sort(),
    [payments],
  );
  const methods = useMemo(
    () => Array.from(new Set(payments.map((p) => (p.method || p.payment_method || '').toLowerCase()).filter(Boolean))).sort(),
    [payments],
  );

  const filtered = payments.filter((p) => {
    const t = search.trim().toLowerCase();
    const matchSearch = !t || p.student_name?.toLowerCase().includes(t) || (p.reference_number || '').toLowerCase().includes(t) || (p.admission_no || '').toLowerCase().includes(t);
    const matchLevel = !levelFilter || p.class_level === levelFilter;
    const matchMethod = !methodFilter || (p.method || p.payment_method || '').toLowerCase() === methodFilter;
    return matchSearch && matchLevel && matchMethod;
  });

  const refetchAll = () => { refetch(); refetchOv(); refetchAn(); };

  const handleExport = () => {
    exportToCSV(
      filtered.map((p) => ({
        Date: p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '',
        Student: p.student_name,
        Admission: p.admission_no || '',
        Class: p.class_name || '',
        Level: p.class_level || '',
        Amount: Number(p.amount) || 0,
        Method: p.method || p.payment_method || '',
        Reference: p.reference_number || p.provider_reference || '',
        Status: p.status,
      })),
      [
        { header: 'Date', accessor: 'Date' }, { header: 'Student', accessor: 'Student' },
        { header: 'Admission', accessor: 'Admission' }, { header: 'Class', accessor: 'Class' },
        { header: 'Level', accessor: 'Level' }, { header: 'Amount (Le)', accessor: 'Amount' },
        { header: 'Method', accessor: 'Method' }, { header: 'Reference', accessor: 'Reference' },
        { header: 'Status', accessor: 'Status' },
      ] as any,
      'payments',
    );
  };

  // Chart data
  const trendSeries = analytics?.trend?.length
    ? { series: [{ name: 'Collected (Le)', data: analytics.trend.map((t: any) => t.total) }], labels: analytics.trend.map((t: any) => t.label) }
    : { series: [], labels: [] };
  const methodSeries = analytics?.byMethod?.length
    ? { series: [{ name: 'Amount', data: analytics.byMethod.map((m: any) => m.total) }], labels: analytics.byMethod.map((m: any) => methodMeta(m.method).label) }
    : { series: [], labels: [] };

  return (
    <MainLayout>
      <PageShell
        title="Payments & Collections"
        subtitle="Monitor and manage fee payments across all classes and levels"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}><Download size={14} className="sm:mr-1.5" /><span className="hidden sm:inline">Export</span></Button>
            <Button variant="outline" size="sm" onClick={refetchAll} disabled={isLoading}><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span></Button>
            <Button variant="default" size="sm" onClick={() => setRecordOpen(true)}><Plus size={15} className="sm:mr-1.5" /><span className="hidden sm:inline">Record Payment</span></Button>
          </div>
        }
      >
        <FinanceOverviewCards overview={overview} loading={ovLoading} />

        {/* This-month highlight + method breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-wider"><TrendingUp size={14} /> Collected this month</div>
            <div className="text-3xl font-black mt-2">{fmtMoney(analytics?.thisMonth?.total)}</div>
            <div className="text-sm text-white/80 mt-1">{analytics?.thisMonth?.count ?? 0} payment{(analytics?.thisMonth?.count ?? 0) === 1 ? '' : 's'}</div>
          </div>
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Payment Methods</h3>
            {analytics?.byMethod?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {analytics.byMethod.map((m: any) => {
                  const meta = methodMeta(m.method);
                  return (
                    <div key={m.method} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">{meta.icon}{meta.label}</div>
                      <div className="text-lg font-black text-gray-900 dark:text-white mt-1">{fmtMoney(m.total)}</div>
                      <div className="text-[11px] text-gray-400">{m.count} payment{m.count === 1 ? '' : 's'}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 py-6 text-center">No payments recorded yet.</p>
            )}
          </div>
        </div>

        {/* Trend + collection by level */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <ChartCard title="Collection Trend" subtitle="Last 6 months" type="line" height={260}
            emptyState={{ message: 'No collections yet', description: 'Recorded payments will chart here.' }}
            {...trendSeries} />
          <ChartCard title="By Payment Method" type="donut" height={260}
            emptyState={{ message: 'No method data yet', description: 'Payment methods will break down here.' }}
            {...methodSeries} />
        </div>

        {analytics?.byLevel?.length ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-6">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Collection by Class Level</h3>
            <SwipeHint />
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="py-2 pr-4 whitespace-nowrap">Level</th>
                    <th className="py-2 px-4 text-right whitespace-nowrap">Collected</th>
                    <th className="py-2 px-4 text-right whitespace-nowrap">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {analytics.byLevel.map((l: any) => (
                    <tr key={l.level}>
                      <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap capitalize">{l.level}</td>
                      <td className="py-2 px-4 text-right text-emerald-600 whitespace-nowrap">{fmtMoney(l.collected)}</td>
                      <td className={`py-2 px-4 text-right whitespace-nowrap ${Number(l.outstanding) > 0 ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>{fmtMoney(l.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
          <SearchBar placeholder="Search by student, admission # or reference…" onSearch={setSearch} isLoading={isLoading} resultCount={search ? filtered.length : undefined} defaultValue={search} className="w-full sm:max-w-md" />
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-40">
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All levels</option>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
            <div className="relative flex-1 sm:w-40">
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All methods</option>
                {methods.map((m) => <option key={m} value={m}>{methodMeta(m).label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
          </div>
        </div>

        {/* Ledger */}
        {filtered.length === 0 ? (
          <EmptyState message="No payments found" description="Manual and online (Monime) payments will appear here." />
        ) : (
          <>
          <SwipeHint />
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Student</th>
                  <th className="px-4 py-3 whitespace-nowrap">Class</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 whitespace-nowrap">Method</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filtered.map((p) => {
                  const meta = methodMeta(p.method || p.payment_method);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-white">{p.student_name}</div>
                        <div className="text-xs text-gray-400">{p.admission_no}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{p.class_name || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{fmtMoney(p.amount)}</td>
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

        {recordOpen && (
          <RecordPaymentModal onClose={() => setRecordOpen(false)} onSaved={() => { setRecordOpen(false); refetchAll(); }} />
        )}
        {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
      </PageShell>
    </MainLayout>
  );
};

// ── Record manual payment (cash/bank/cheque) against a student's fee ──────────
const RecordPaymentModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [studentQuery, setStudentQuery] = useState('');
  const [studentId, setStudentId] = useState('');
  const [feeId, setFeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: studentsResp } = useQuery({
    queryKey: ['pay-students', studentQuery],
    queryFn: () => studentsService.listStudents({ search: studentQuery, limit: 10 } as any),
    enabled: studentQuery.trim().length > 1,
    staleTime: 30_000,
  });
  const students = ((studentsResp as any)?.data?.data ?? (studentsResp as any)?.data ?? []) as any[];

  const { data: feesResp } = useQuery({
    queryKey: ['pay-student-fees', studentId],
    queryFn: () => financeService.getStudentFees(studentId),
    enabled: !!studentId,
    staleTime: 15_000,
  });
  const fees = (((feesResp as any)?.data?.data ?? (feesResp as any)?.data ?? []) as any[]).filter((f) => (Number(f.balance ?? f.amount) || 0) > 0);

  const submit = async () => {
    if (!feeId || !amount) { showToast.error('Select a fee and enter an amount'); return; }
    setSaving(true);
    try {
      await financeService.recordPayment({ feeId, amount: Number(amount), method, transactionReference: reference || undefined });
      showToast.success('Payment recorded');
      onSaved();
    } catch (err: any) {
      showToast.error(err?.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">Record Payment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Student</label>
            <input value={studentQuery} onChange={(e) => { setStudentQuery(e.target.value); setStudentId(''); setFeeId(''); }} placeholder="Search student…" className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            {studentQuery && !studentId && students.length > 0 && (
              <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {students.map((s: any) => (
                  <button key={s.id} onClick={() => { setStudentId(s.id); setStudentQuery(`${s.first_name} ${s.last_name}`); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                    {s.first_name} {s.last_name} <span className="text-xs text-gray-400">{s.student_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {studentId && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Fee (with balance)</label>
              <select value={feeId} onChange={(e) => { setFeeId(e.target.value); const f = fees.find((x) => x.id === e.target.value); if (f) setAmount(String(f.balance ?? f.amount)); }} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                <option value="">Select a fee…</option>
                {fees.map((f) => <option key={f.id} value={f.id}>{f.type || 'Fee'} — {fmtMoney(f.balance ?? f.amount)} due</option>)}
              </select>
              {fees.length === 0 && <p className="text-xs text-gray-400 mt-1">No outstanding fees for this student.</p>}
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
    </div>
  );
};

// ── Receipt view ──────────────────────────────────────────────────────────────
const ReceiptModal: React.FC<{ payment: any; onClose: () => void }> = ({ payment, onClose }) => {
  const meta = methodMeta(payment.method || payment.payment_method);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Receipt size={18} /><span className="font-bold">Payment Receipt</span></div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Row label="Student" value={payment.student_name} />
          <Row label="Admission #" value={payment.admission_no || '—'} />
          <Row label="Class" value={payment.class_name || '—'} />
          <Row label="Date" value={payment.payment_date ? new Date(payment.payment_date).toLocaleString() : '—'} />
          <Row label="Method" value={meta.label} />
          <Row label="Reference" value={payment.reference_number || payment.provider_reference || '—'} />
          <Row label="Status" value={payment.status} />
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between">
            <span className="text-gray-500">Amount paid</span>
            <span className="text-xl font-black text-emerald-600">{fmtMoney(payment.amount)}</span>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900 dark:text-white text-right">{value}</span>
  </div>
);

export default PaymentsPage;
