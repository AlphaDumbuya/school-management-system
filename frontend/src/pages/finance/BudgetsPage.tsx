/**
 * Budgets (bursar Phase B, R3): plan the year's spending per category,
 * the principal approves, and spending is tracked against it live.
 */
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { showToast } from '@utils/toast';
import useAuthStore from '@store/authStore';
import { bursarB, EXPENSE_CATEGORIES } from '@services/bursarService';
import { le, Pill } from '@components/finance/StudentAccount';
import { CategorySelect } from '@components/finance/CategorySelect';
import { ChartCard } from '@components/admin/charts/ChartCard';
import { fmtLeShort, NO_SERIES } from '@lib/chartFormat';

type L = { category: string; department: string; amount: string; notes: string };

export const BudgetsPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isPrincipal = user?.role === 'principal' || user?.role === 'super_admin';
  const { activeYear } = useAcademicYears();
  const [picked, setPicked] = useState('');
  const year = picked || activeYear;
  const viewingPast = !!year && !!activeYear && year < activeYear;
  const q = useQuery({ queryKey: ['fin-budget', year], queryFn: async () => { const r: any = await bursarB.budget(year); if (r?.success === false) throw new Error(r.error || 'Could not load the budget.'); return r.data; }, enabled: !!year });
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<L[]>([]);
  const [saving, setSaving] = useState(false);
  const [approve, setApprove] = useState(false);
  useEffect(() => {
    setLines((q.data?.lines || []).map((l: any) => ({ category: l.category, department: l.department || '', amount: String(l.amount), notes: l.notes || '' })));
    setEditing(false);
  }, [q.data]);
  const d = q.data;
  const status = d?.budget?.status;
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') });
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const save = async () => {
    setSaving(true);
    try {
      const r: any = await bursarB.saveBudget(year, lines.filter((l) => l.category).map((l) => ({ ...l, amount: Number(l.amount) || 0 })));
      if (r?.success === false) return showToast.error(r.error || 'Could not save');
      showToast.success(r.data.reopened ? 'Saved. The budget needs the principal\'s approval again.' : 'Budget saved');
      refresh();
    } finally { setSaving(false); }
  };

  return (
    <MainLayout>
      <PageShell title="Budget" subtitle="Plan the year's spending per category and track it against actual expenses"
        actions={<div className="flex items-center gap-2">
          <YearFilter value={year} onChange={(y) => setPicked(!y || y === activeYear ? '' : y)} noAutoSelect />
          {!viewingPast && !editing && <Button size="sm" variant={d?.budget ? 'outline' : 'create'} onClick={() => { setEditing(true); if (!lines.length) setLines([{ category: 'Salaries', department: '', amount: '', notes: '' }]); }}>{d?.budget ? 'Edit budget' : 'Create budget'}</Button>}
          {isPrincipal && status === 'draft' && !editing && <Button size="sm" onClick={() => setApprove(true)}><CheckCircle2 size={14} className="mr-1" /> Approve</Button>}
        </div>}>
        {q.error ? <p role="alert" className="text-sm text-red-600">{(q.error as Error).message}</p>
          : q.isLoading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"><div className="text-lg font-black">{le(d?.total_budget)}</div><div className="text-xs text-gray-500">Budgeted · {year}</div></div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"><div className="text-lg font-black text-rose-700">{le(d?.total_spent)}</div><div className="text-xs text-gray-500">Spent so far</div></div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"><div className={`text-lg font-black ${(d?.total_budget || 0) - (d?.total_spent || 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{le((d?.total_budget || 0) - (d?.total_spent || 0))}</div><div className="text-xs text-gray-500">Remaining</div></div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"><div className="mt-1">{status ? <Pill s={status === 'approved' ? 'approved' : 'pending'} label={status === 'approved' ? 'Approved' : 'Draft · needs approval'} /> : <span className="text-sm text-gray-500">No budget yet</span>}</div><div className="text-xs text-gray-500 mt-1">{d?.budget?.approved_by_name ? `by ${d.budget.approved_by_name}` : 'Status'}</div></div>
              </div>

              {!editing && (d?.lines || []).length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
                  <div className="lg:col-span-2">
                    <ChartCard title="Budget vs spent" subtitle={`Per budget line · ${year}`} type="bar" height={280}
                      colors={['#3b82f6', '#ef4444']} valueFormatter={fmtLeShort}
                      labels={d.lines.slice(0, 12).map((l: any) => (l.department ? `${l.category} · ${l.department}` : l.category))}
                      series={[
                        { name: 'Budget', data: d.lines.slice(0, 12).map((l: any) => Number(l.amount) || 0) },
                        { name: 'Spent', data: d.lines.slice(0, 12).map((l: any) => Number(l.spent) || 0) },
                      ]} />
                  </div>
                  <ChartCard title="Budget used" subtitle="Spent vs what is left" type="donut" height={280}
                    colors={['#ef4444', '#10b981']} valueFormatter={fmtLeShort}
                    donutCenterLabel={d.total_budget > 0 ? `${Math.round((Number(d.total_spent) / Number(d.total_budget)) * 100)}%` : undefined}
                    emptyState={{ message: 'Nothing budgeted', description: 'Add budget amounts to see usage.' }}
                    {...(Number(d.total_budget) > 0
                      ? { labels: ['Spent', 'Remaining'], series: [{ name: 'Le', data: [Number(d.total_spent) || 0, Math.max(0, Number(d.total_budget) - Number(d.total_spent))] }] }
                      : NO_SERIES)} />
                </div>
              )}

              {editing ? (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2">
                  {status === 'approved' && <p className="text-xs text-amber-700">Saving changes returns the budget to draft until the principal approves it again.</p>}
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 sm:col-span-4"><label htmlFor={`bl-c-${i}`} className="text-[11px] text-gray-500">Category</label>
                        <CategorySelect compact id={`bl-c-${i}`} value={l.category} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, category: v } : x)))} className="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" /></div>
                      <div className="col-span-6 sm:col-span-3"><label htmlFor={`bl-d-${i}`} className="text-[11px] text-gray-500">Department (optional)</label><input id={`bl-d-${i}`} placeholder="e.g. Science" value={l.department} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, department: e.target.value } : x)))} className="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" /></div>
                      <div className="col-span-5 sm:col-span-4"><label htmlFor={`bl-a-${i}`} className="text-[11px] text-gray-500">Amount (Le)</label><input id={`bl-a-${i}`} type="number" min={0} placeholder="e.g. 50000" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} className="w-full px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" /></div>
                      <div className="col-span-1"><button type="button" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button></div>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <Button size="sm" variant="create" onClick={() => setLines([...lines, { category: EXPENSE_CATEGORIES.find((c) => c !== 'Other' && !lines.some((l) => l.category === c)) || '', department: '', amount: '', notes: '' }])}><Plus size={14} className="mr-1" /> Add line</Button>
                    <div className="flex items-center gap-3 text-sm"><span>Total <strong>{le(total)}</strong></span><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button size="sm" variant="create" onClick={save} disabled={saving || lines.some((l) => !l.category.trim())}>{saving ? 'Saving…' : 'Save budget'}</Button></div>
                  </div>
                </div>
              ) : (d?.lines || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No budget for {year} yet. Create one to track spending against plan.</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500"><tr><th className="px-3 py-3 text-left">Category</th><th className="px-3 py-3 text-right">Budget</th><th className="px-3 py-3 text-right">Spent</th><th className="px-3 py-3 text-right">Remaining</th><th className="px-3 py-3 w-48">Used</th></tr></thead>
                    <tbody>
                      {d.lines.map((l: any) => (
                        <tr key={l.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2.5">{l.category}{l.department && <span className="text-xs text-gray-500"> · {l.department}</span>}</td>
                          <td className="px-3 py-2.5 text-right">{le(l.amount)}</td>
                          <td className="px-3 py-2.5 text-right">{le(l.spent)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold ${l.remaining < 0 ? 'text-red-600' : ''}`}>{le(l.remaining)}</td>
                          <td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"><div className={`h-full ${l.status === 'over' ? 'bg-red-500' : l.status === 'near' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, l.pct)}%` }} /></div><span className={`text-xs w-12 text-right ${l.status === 'over' ? 'text-red-600 font-bold' : ''}`}>{l.pct > 999 ? '—' : `${l.pct}%`}</span></div></td>
                        </tr>
                      ))}
                      {(d.unbudgeted || []).map((u: any) => (
                        <tr key={u.category} className="border-t border-gray-100 dark:border-gray-800 text-amber-800 bg-amber-50/50 dark:bg-amber-950/10"><td className="px-3 py-2.5">{u.category} <span className="text-[11px]">(not in budget)</span></td><td className="px-3 py-2.5 text-right">—</td><td className="px-3 py-2.5 text-right">{le(u.spent)}</td><td colSpan={2} /></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        <ConfirmationDialog isOpen={approve} onClose={() => setApprove(false)} isDestructive={false} title="Approve budget" confirmLabel="Approve"
          message={`Approve the ${year} budget of ${le(d?.total_budget)}? Spending is then tracked against it.`}
          onConfirm={async () => { const r: any = await bursarB.approveBudget(year); if (r?.success === false) { showToast.error(r.error || 'Failed'); throw new Error('x'); } showToast.success('Budget approved'); refresh(); }} />
      </PageShell>
    </MainLayout>
  );
};

export default BudgetsPage;
