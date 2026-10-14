/**
 * School Expenses (bursar Phase B, R1): what the school spends, per year.
 * Categories, vendor, method, receipt photo; void (never delete) with a reason;
 * petty-cash and payroll expenses are linked and managed from their source;
 * fees-vs-expenses and budget usage per category.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Ban, Pencil, TrendingUp, TrendingDown, Wallet, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { HEADER_BTN, HEADER_EXPORT, BtnLabel } from '@components/finance/AccountingUi';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { ExportButton } from '@components/admin/common/ExportButton';
import { FileUploader } from '@components/admin/forms/FileUploader';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { showToast } from '@utils/toast';
import { bursarB, EXPENSE_CATEGORIES, EXPENSE_METHODS, type Expense } from '@services/bursarService';
import { le, Pill } from '@components/finance/StudentAccount';
import { CategorySelect } from '@components/finance/CategorySelect';
import { usePaged, TablePager } from '@components/admin/table/TablePager';
import { ChartCard } from '@components/admin/charts/ChartCard';
import { fmtLeShort, monthlyTotals, NO_SERIES } from '@lib/chartFormat';

const TERMS = [{ value: '', label: 'Whole year' }, { value: 'first_term', label: 'First Term' }, { value: 'second_term', label: 'Second Term' }, { value: 'third_term', label: 'Third Term' }];
const SOURCE_LABEL: Record<string, string> = { manual: 'Recorded', petty_cash: 'Petty cash', payroll: 'Payroll' };
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const d10 = (v: any) => String(v || '').slice(0, 10);
const input = 'w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm';

const ExpenseModal: React.FC<{ expense: Partial<Expense> | null; onClose: () => void; onSaved: () => void }> = ({ expense, onClose, onSaved }) => {
  const [f, setF] = useState<any>(expense ? { ...expense, expense_date: d10(expense.expense_date) || todayLocal() } : {});
  const [saving, setSaving] = useState(false);
  if (!expense) return null;
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const body = { category: f.category, amount: Number(f.amount), expense_date: f.expense_date, term: f.term || null, description: f.description, vendor: f.vendor, payment_method: f.payment_method || null, reference: f.reference, receipt_url: f.receipt_url || null, department: f.department };
      const r: any = f.id ? await bursarB.updateExpense(f.id, body) : await bursarB.createExpense(body);
      if (r?.success === false) return showToast.error(r.error || 'Could not save');
      showToast.success('Expense saved');
      if (r.data?.budget_warning) showToast.error(r.data.budget_warning);
      onSaved();
    } finally { setSaving(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title={f.id ? 'Edit expense' : 'Record an expense'} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="create" onClick={save} disabled={saving || !f.category?.trim() || !(Number(f.amount) > 0) || !f.expense_date}>{saving ? 'Saving…' : 'Save'}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label htmlFor="x-cat" className="text-xs font-semibold text-gray-500">Category</label>
          <CategorySelect id="x-cat" value={f.category || ''} onChange={(v) => set('category', v)} /></div>
        <div><label htmlFor="x-amt" className="text-xs font-semibold text-gray-500">Amount (Le)</label><input id="x-amt" type="number" min={0} placeholder="e.g. 1500" className={input} value={f.amount ?? ''} onChange={(e) => set('amount', e.target.value)} /></div>
        <div><label htmlFor="x-date" className="text-xs font-semibold text-gray-500">Date</label><input id="x-date" type="date" max={todayLocal()} className={input} value={f.expense_date || ''} onChange={(e) => set('expense_date', e.target.value)} /></div>
        <div><label htmlFor="x-term" className="text-xs font-semibold text-gray-500">Term</label>
          <select id="x-term" className={input} value={f.term || ''} onChange={(e) => set('term', e.target.value)}>{TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div><label htmlFor="x-vendor" className="text-xs font-semibold text-gray-500">Paid to (vendor / payee)</label><input id="x-vendor" className={input} value={f.vendor || ''} onChange={(e) => set('vendor', e.target.value)} placeholder="e.g. EDSA" /></div>
        <div><label htmlFor="x-method" className="text-xs font-semibold text-gray-500">Paid by</label>
          <select id="x-method" className={input} value={f.payment_method || ''} onChange={(e) => set('payment_method', e.target.value)}><option value="">—</option>{EXPENSE_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
        <div><label htmlFor="x-ref" className="text-xs font-semibold text-gray-500">Reference / cheque no.</label><input id="x-ref" placeholder="e.g. Cheque 004512 or bank ref" className={input} value={f.reference || ''} onChange={(e) => set('reference', e.target.value)} /></div>
        <div><label htmlFor="x-dept" className="text-xs font-semibold text-gray-500">Department (optional)</label><input id="x-dept" placeholder="e.g. Science, Kitchen" className={input} value={f.department || ''} onChange={(e) => set('department', e.target.value)} /></div>
        <div className="sm:col-span-2"><label htmlFor="x-desc" className="text-xs font-semibold text-gray-500">Description</label><input id="x-desc" className={input} value={f.description || ''} onChange={(e) => set('description', e.target.value)} placeholder="e.g. September electricity bill" /></div>
        <div className="sm:col-span-2">
          <FileUploader label="Receipt (photo or PDF, optional)" value={f.receipt_url || ''} onChange={(v) => set('receipt_url', v)} accept="image/*,.pdf" previewType="file" enableCamera cameraGuide="frame" cameraAspect={3 / 4} maxSizeMB={5} />
        </div>
      </div>
    </Modal>
  );
};

export const ExpensesPage: React.FC = () => {
  const qc = useQueryClient();
  const { activeYear } = useAcademicYears();
  const [picked, setPicked] = useState('');
  const year = picked || activeYear;
  const viewingPast = !!year && !!activeYear && year < activeYear;
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [term, setTerm] = useState('');
  const [showVoided, setShowVoided] = useState(false);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<Partial<Expense> | null>(null);
  const [voidTarget, setVoidTarget] = useState<Expense | null>(null);
  const [reason, setReason] = useState('');

  const params = { academic_year: year, category: category || undefined, source: source || undefined, term: term || undefined, include_voided: showVoided ? 'true' : undefined };
  const q = useQuery({
    queryKey: ['fin-expenses', params],
    queryFn: async () => { const r: any = await bursarB.expenses(params); if (r?.success === false) throw new Error(r.error || 'Could not load expenses.'); return r.data; },
    enabled: !!year,
  });
  const fve = useQuery({ queryKey: ['fin-fve', year], queryFn: async () => { const r: any = await bursarB.feesVsExpenses(year); if (r?.success === false) throw new Error(r.error); return r.data; }, enabled: !!year });
  const budget = useQuery({ queryKey: ['fin-budget', year], queryFn: async () => { const r: any = await bursarB.budget(year); if (r?.success === false) throw new Error(r.error); return r.data; }, enabled: !!year });
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') });
  const rows: Expense[] = useMemo(() => (q.data?.rows || []).filter((e: Expense) => !search || `${e.category} ${e.description || ''} ${e.vendor || ''} ${e.reference || ''}`.toLowerCase().includes(search.toLowerCase())), [q.data, search]);
  const pg = usePaged(rows, [year, search, category, source, term, showVoided]);
  // Charts use every non-void expense in the year/filters (not the search box).
  const monthlyChart = useMemo(() => {
    const m = monthlyTotals((q.data?.rows || []).filter((e: Expense) => !e.voided_at), (e: Expense) => e.expense_date, (e: Expense) => Number(e.amount));
    return m.labels.length ? { labels: m.labels, series: [{ name: 'Spent', data: m.data }] } : NO_SERIES;
  }, [q.data]);
  const categoryChart = useMemo(() => {
    const cats = ((q.data?.by_category || []) as any[]).filter((c) => Number(c.total) > 0);
    if (!cats.length) return NO_SERIES;
    // Top 6 categories, the rest grouped as "Other" so the donut stays readable.
    const top = cats.slice(0, 6);
    const rest = cats.slice(6).reduce((s, c) => s + Number(c.total), 0);
    const labels = [...top.map((c) => c.category), ...(rest > 0 ? ['Other'] : [])];
    const data = [...top.map((c) => Number(c.total)), ...(rest > 0 ? [rest] : [])];
    return { labels, series: [{ name: 'Spent', data }] };
  }, [q.data]);
  const budgetFor = (cat: string) => (budget.data?.lines || []).filter((l: any) => l.category === cat).reduce((s: number, l: any) => s + l.amount, 0);

  return (
    <MainLayout>
      <PageShell title="School Expenses" subtitle="What the school spends: salaries, utilities, supplies, maintenance and more" onRefresh={() => q.refetch()} isRefreshing={q.isFetching}
        mobileLabels
        actions={<div className="flex flex-wrap items-center gap-2">
          <YearFilter value={year} onChange={(y) => setPicked(!y || y === activeYear ? '' : y)} noAutoSelect />
          <ExportButton className={HEADER_EXPORT} endpoint="/api/v1/finance/expenses-v2/export" filename="expenses" params={{ academic_year: year, category: category || undefined, source: source || undefined, term: term || undefined }} />
          {!viewingPast && <Button size="sm" variant="create" className={HEADER_BTN} onClick={() => setEdit({ expense_date: todayLocal() })}><Plus size={15} /><BtnLabel>Record expense</BtnLabel></Button>}
        </div>}>
        {viewingPast && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">Showing {year} as history (closed). Record new expenses in {activeYear}.</div>}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { l: 'Fees collected', v: fve.data?.collected, i: <TrendingUp size={18} />, t: 'text-emerald-700' },
            { l: 'Spent', v: q.data?.total, i: <TrendingDown size={18} />, t: 'text-rose-700' },
            { l: 'Net (collected − spent)', v: fve.data ? Number(fve.data.collected) - Number(q.data?.total || 0) : undefined, i: <Wallet size={18} />, t: 'text-gray-900 dark:text-white' },
            { l: `Budget ${budget.data?.budget?.status === 'approved' ? '(approved)' : budget.data?.budget ? '(draft)' : '(none)'}`, v: budget.data?.total_budget, i: <Wallet size={18} />, t: 'text-blue-700' },
          ].map((k) => (
            <div key={k.l} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="text-gray-400 mb-1">{k.i}</div><div className={`text-lg font-black ${k.t}`}>{k.v === undefined ? '—' : le(k.v)}</div><div className="text-xs text-gray-500">{k.l}</div>
            </div>
          ))}
        </div>

        {!q.error && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
            <div className="lg:col-span-2">
              <ChartCard title="Spending by month" subtitle={`What the school paid out · ${year}`} type="line" height={260}
                isLoading={q.isLoading} colors={['#ef4444']} valueFormatter={fmtLeShort}
                emptyState={{ message: 'No spending yet', description: 'Recorded expenses will chart here by month.' }}
                {...monthlyChart} />
            </div>
            <ChartCard title="Where the money goes" subtitle="Spending by category" type="donut" height={260}
              isLoading={q.isLoading} valueFormatter={fmtLeShort}
              emptyState={{ message: 'No spending yet', description: 'Categories will break down here.' }}
              {...categoryChart} />
          </div>
        )}
        {!fve.error && fve.data && (Number(fve.data.collected) > 0 || Number(q.data?.total) > 0) && (
          <div className="mb-5">
            <ChartCard title="Fees collected vs spent" subtitle={`Money in against money out · ${year}`} type="bar" height={220}
              colors={['#10b981', '#ef4444', '#3b82f6']} valueFormatter={fmtLeShort}
              labels={['Collected', 'Spent', 'Net']}
              series={[{ name: 'Le', data: [Number(fve.data.collected) || 0, Number(q.data?.total) || 0, Math.max(0, (Number(fve.data.collected) || 0) - (Number(q.data?.total) || 0))] }]} />
          </div>
        )}

        {(q.data?.by_category || []).length > 0 && (
          <div className="mb-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <h3 className="text-sm font-bold mb-3">By category · {year}</h3>
            <div className="space-y-2">
              {q.data.by_category.map((c: any) => {
                const b = budgetFor(c.category);
                const pct = b > 0 ? Math.min(100, (c.total / b) * 100) : 0;
                return (
                  <button key={c.category} type="button" onClick={() => setCategory(category === c.category ? '' : c.category)} aria-pressed={category === c.category} className="w-full text-left">
                    <div className="flex justify-between text-xs"><span className="font-semibold">{c.category}</span><span>{le(c.total)}{b > 0 ? ` of ${le(b)}` : ''}</span></div>
                    {b > 0 && <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"><div className={`h-full ${c.total > b ? 'bg-red-500' : c.total >= b * 0.9 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} /></div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2 mb-3 lg:items-center">
          <SearchBar placeholder="Search description, vendor, reference…" onSearch={setSearch} className="w-full lg:max-w-sm" />
          <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"><option value="">All categories</option>{Array.from(new Set([...EXPENSE_CATEGORIES, ...((q.data?.by_category || []) as any[]).map((c) => c.category)])).map((c) => <option key={c}>{c}</option>)}</select>
          <select aria-label="Term" value={term} onChange={(e) => setTerm(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"><option value="">All terms</option>{TERMS.slice(1).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"><option value="">All sources</option><option value="manual">Recorded here</option><option value="petty_cash">Petty cash</option><option value="payroll">Payroll</option></select>
          <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> Show voided</label>
        </div>

        {q.error ? <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
          : q.isLoading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : rows.length === 0 ? <EmptyState message={`No expenses in ${year}`} description="Record salaries, utilities, supplies and repairs as they are paid." />
          : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500"><tr><th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Category</th><th className="px-3 py-3 text-left">Details</th><th className="px-3 py-3 text-left">Source</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3" /></tr></thead>
                <tbody>
                  {pg.pageRows.map((e) => (
                    <tr key={e.id} className={`border-t border-gray-100 dark:border-gray-800 ${e.voided_at ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{d10(e.expense_date)}</td>
                      <td className="px-3 py-2.5">{e.category}</td>
                      <td className="px-3 py-2.5"><div>{e.description || '—'}</div><div className="text-[11px] text-gray-400">{[e.vendor, e.payment_method?.replace(/_/g, ' '), e.reference, e.department].filter(Boolean).join(' · ')}{e.receipt_url && <> · <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">receipt</a></>}{e.voided_at && <span className="text-red-600"> · Void: {e.void_reason}</span>}</div></td>
                      <td className="px-3 py-2.5 text-xs">{e.voided_at ? <Pill s="revoked" label="Void" /> : SOURCE_LABEL[e.source]}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${e.voided_at ? 'line-through' : ''}`}>{le(e.amount)}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {!e.voided_at && e.source === 'manual' && !viewingPast && <>
                          <button type="button" aria-label="Edit expense" onClick={() => setEdit(e)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                          <button type="button" aria-label="Void expense" onClick={() => { setReason(''); setVoidTarget(e); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600"><Ban size={14} /></button>
                        </>}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-bold"><td className="px-3 py-3" colSpan={4}>Total (excluding void)</td><td className="px-3 py-3 text-right">{le(q.data?.total)}</td><td /></tr>
                </tbody>
              </table>
              <TablePager {...pg.pager} label="expenses" />
            </div>
          )}

        <ExpenseModal key={edit?.id || 'new'} expense={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />
        <ConfirmationDialog isOpen={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void expense" confirmLabel="Void"
          message={voidTarget ? `Void ${voidTarget.category} · ${le(voidTarget.amount)} on ${d10(voidTarget.expense_date)}? It stays on record but no longer counts.` : ''}
          confirmDisabled={reason.trim().length < 5}
          onConfirm={async () => { const r: any = await bursarB.voidExpense(voidTarget!.id, reason.trim()); if (r?.success === false) { showToast.error(r.error || 'Failed'); throw new Error('x'); } showToast.success('Expense voided'); refresh(); }}>
          <label htmlFor="xv-reason" className="block text-xs font-semibold text-gray-600 mt-2">Reason (required)</label>
          <textarea id="xv-reason" rows={2} placeholder="e.g. Recorded twice by mistake" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
        </ConfirmationDialog>
      </PageShell>
    </MainLayout>
  );
};

export default ExpensesPage;
