/**
 * ExpensesPage — /finance/expenses
 * School operating-expense tracking + fees-vs-expenses summary for a year.
 * Staff-only (enforced server-side). Distinct from student charges.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Wallet, TrendingUp, TrendingDown, Loader2, X } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { showToast } from '@utils/toast';
import { financeService, SchoolExpense } from '@services/financeService';
import { useAcademicYears } from '@hooks/useAcademicYears';

const fmtLe = (v: number | string | null | undefined) =>
  `Le ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TERMS = [
  { value: '', label: 'Whole year' },
  { value: 'first_term', label: 'First Term' },
  { value: 'second_term', label: 'Second Term' },
  { value: 'third_term', label: 'Third Term' },
];
const CATEGORIES = ['Salaries', 'Utilities', 'Supplies', 'Maintenance', 'Transport', 'Rent', 'Events', 'Other'];

export const ExpensesPage: React.FC = () => {
  const queryClient = useQueryClient();
  // Real academic years only; open on the school's active year.
  const { years, activeYear } = useAcademicYears();
  const [pickedYear, setYear] = useState('');
  const year = pickedYear || activeYear;
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SchoolExpense | null>(null);

  const { data: expResp, isLoading, refetch } = useQuery({
    queryKey: ['school-expenses', year],
    queryFn: () => financeService.listExpenses({ academicYear: year }),
    enabled: !!year,
    staleTime: 15_000,
  });
  const expenses: SchoolExpense[] = ((expResp as any)?.data?.data ?? (expResp as any)?.data ?? []);

  const { data: summaryResp } = useQuery({
    queryKey: ['fees-vs-expenses', year],
    queryFn: () => financeService.getFeesVsExpenses(year),
    enabled: !!year,
    staleTime: 15_000,
  });
  const summary = (summaryResp as any)?.data?.data ?? (summaryResp as any)?.data;

  const total = useMemo(() => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [expenses]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res: any = await financeService.deleteExpense(deleteTarget.id);
    const body = res?.data ?? res;
    if (body?.success === false) { showToast.error(body?.error || 'Failed to delete'); return; }
    showToast.success('Expense deleted');
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ['school-expenses'] });
    queryClient.invalidateQueries({ queryKey: ['fees-vs-expenses'] });
  };

  return (
    <MainLayout>
      <PageShell
        title="School Expenses"
        subtitle="Track operating costs and compare against fee collection"
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <div className="flex items-center gap-2">
            <select value={year} onChange={(e) => setYear(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5"><Plus size={15} /> Add Expense</Button>
          </div>
        }
      >
        {/* Fees vs expenses summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <SummaryTile label="Fees Collected" value={fmtLe(summary?.collected)} icon={<TrendingUp size={18} />} tone="emerald" />
          <SummaryTile label="Outstanding" value={fmtLe(summary?.outstanding)} icon={<Wallet size={18} />} tone="amber" />
          <SummaryTile label="Expenses" value={fmtLe(summary?.expenses ?? total)} icon={<TrendingDown size={18} />} tone="rose" />
          <SummaryTile label="Net (Collected − Expenses)" value={fmtLe(summary?.net)} icon={<Wallet size={18} />} tone={(summary?.net ?? 0) >= 0 ? 'emerald' : 'rose'} />
        </div>

        {/* Expense list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…</div>
        ) : expenses.length === 0 ? (
          <EmptyState message="No expenses recorded" description={`Add your school's operating costs for ${year}.`} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                <tr className="text-white">
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Term</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Amount</th>
                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {expenses.map((e, i) => (
                  <tr key={e.id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-blue-950/20 ${i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{new Date(e.expense_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{e.category}</td>
                    <td className="px-4 py-3 text-gray-500">{e.description || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{TERMS.find((t) => t.value === (e.term || ''))?.label || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtLe(e.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDeleteTarget(e)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" title="Delete"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 dark:bg-gray-800/40 font-bold">
                  <td className="px-4 py-3" colSpan={4}>Total</td>
                  <td className="px-4 py-3 text-right">{fmtLe(total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </PageShell>

      {showAdd && (
        <AddExpenseModal
          year={year}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['school-expenses'] }); queryClient.invalidateQueries({ queryKey: ['fees-vs-expenses'] }); }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-xl p-5">
            <h4 className="font-bold text-gray-900 dark:text-white mb-2">Delete expense?</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{deleteTarget.category} · {fmtLe(deleteTarget.amount)} on {new Date(deleteTarget.expense_date).toLocaleDateString()}.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

const SummaryTile: React.FC<{ label: string; value: string; icon: React.ReactNode; tone: 'emerald' | 'amber' | 'rose' }> = ({ label, value, icon, tone }) => {
  const tones = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400',
  }[tone];
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2 ${tones}`}>{icon}</div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
};

const AddExpenseModal: React.FC<{ year: string; onClose: () => void; onSaved: () => void }> = ({ year, onClose, onSaved }) => {
  const [category, setCategory] = useState('Salaries');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [term, setTerm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!(Number(amount) > 0)) { showToast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const res: any = await financeService.createExpense({
        category, description: description || undefined, amount: Number(amount),
        expense_date: date, academic_year: year, term: term || null,
      });
      const body = res?.data ?? res;
      if (body?.success === false) { showToast.error(body?.error || 'Failed to add expense'); return; }
      showToast.success('Expense added');
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h4 className="font-bold text-gray-900 dark:text-white">Add Expense · {year}</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Amount (Le)</label>
              <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Term</label>
              <select value={term} onChange={(e) => setTerm(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" placeholder="e.g. September electricity bill" />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add</Button>
        </div>
      </div>
    </div>
  );
};

export default ExpensesPage;
