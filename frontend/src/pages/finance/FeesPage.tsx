/**
 * FeesPage — /finance/fees
 * Tenant-wide fees list with a quick "Create Fee" action.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Plus, X } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { showToast } from '@utils/toast';
import { financeService } from '@services/financeService';
import { studentsService } from '@services/studentsService';
import { FinanceOverviewCards, fmtMoney, statusPill, SwipeHint } from './FinanceOverviewCards';

export const FeesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: overviewResp, isLoading: ovLoading, refetch: refetchOv } = useQuery({
    queryKey: ['finance-overview'], queryFn: () => financeService.getOverview(), staleTime: 30_000,
  });
  const { data: feesResp, isLoading, refetch } = useQuery({
    queryKey: ['finance-fees'], queryFn: () => financeService.listFees(), staleTime: 15_000,
  });

  const overview = (overviewResp as any)?.data?.data ?? (overviewResp as any)?.data;
  const fees = ((feesResp as any)?.data?.data ?? (feesResp as any)?.data ?? []) as any[];
  const filtered = fees.filter((f) => {
    const t = search.trim().toLowerCase();
    return !t || f.student_name?.toLowerCase().includes(t) || (f.type || '').toLowerCase().includes(t);
  });

  return (
    <MainLayout>
      <PageShell
        title="Fee Structures"
        subtitle="Fees billed to students"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetch(); refetchOv(); }} disabled={isLoading}><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /><span className="hidden sm:inline">Refresh</span></Button>
            <Button variant="default" size="sm" onClick={() => setCreateOpen(true)}><Plus size={15} className="sm:mr-1.5" /><span className="hidden sm:inline">Create Fee</span></Button>
          </div>
        }
      >
        <FinanceOverviewCards overview={overview} loading={ovLoading} />

        <div className="mb-4">
          <SearchBar
            placeholder="Search by student or fee type…"
            onSearch={setSearch}
            isLoading={isLoading}
            resultCount={search ? filtered.length : undefined}
            defaultValue={search}
            className="w-full sm:max-w-md"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState message="No fees on record" description="Create a fee to start billing students." action={{ label: 'Create Fee', onClick: () => setCreateOpen(true) }} />
        ) : (
          <>
          <SwipeHint />
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Student</th>
                  <th className="px-4 py-3 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Balance</th>
                  <th className="px-4 py-3 whitespace-nowrap">Due</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{f.student_name}</td>
                    <td className="px-4 py-3 capitalize whitespace-nowrap">{f.type || '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{fmtMoney(f.amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{fmtMoney(f.balance ?? f.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{f.due_date ? new Date(f.due_date).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{statusPill(f.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {createOpen && (
          <CreateFeeModal
            onClose={() => setCreateOpen(false)}
            onCreated={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['finance-fees'] }); refetchOv(); }}
          />
        )}
      </PageShell>
    </MainLayout>
  );
};

// ── Create Fee modal ──────────────────────────────────────────────────────────
const CreateFeeModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [studentQuery, setStudentQuery] = useState('');
  const [studentId, setStudentId] = useState('');
  const [type, setType] = useState('Tuition');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: studentsResp } = useQuery({
    queryKey: ['fee-students', studentQuery],
    queryFn: () => studentsService.listStudents({ search: studentQuery, limit: 10 } as any),
    enabled: studentQuery.trim().length > 1,
    staleTime: 30_000,
  });
  const students = ((studentsResp as any)?.data?.data ?? (studentsResp as any)?.data ?? []) as any[];

  const submit = async () => {
    if (!studentId || !amount || !dueDate) { showToast.error('Student, amount and due date are required'); return; }
    setSaving(true);
    try {
      await financeService.createFee({ studentId, type, amount: Number(amount), dueDate });
      showToast.success('Fee created');
      onCreated();
    } catch (err: any) {
      showToast.error(err?.response?.data?.message || 'Failed to create fee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">Create Fee</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Student</label>
            <input value={studentQuery} onChange={(e) => { setStudentQuery(e.target.value); setStudentId(''); }} placeholder="Search student…" className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
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
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Fee Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              {['Tuition', 'Registration', 'Exam', 'Library', 'Transport', 'Uniform', 'Other'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Amount (Le)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="default" size="sm" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create Fee'}</Button>
        </div>
      </div>
    </div>
  );
};

export default FeesPage;
