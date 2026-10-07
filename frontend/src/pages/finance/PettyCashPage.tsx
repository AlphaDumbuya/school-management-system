/**
 * Petty Cash (bursar Phase B, R2): small day-to-day cash. Funds with a float;
 * top up, spend (becomes an expense), return to bank; void with a reason.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowDownCircle, ArrowUpCircle, Undo2, Ban, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { FileUploader } from '@components/admin/forms/FileUploader';
import { showToast } from '@utils/toast';
import { bursarB, EXPENSE_CATEGORIES } from '@services/bursarService';
import { le, Pill } from '@components/finance/StudentAccount';
import { CategorySelect } from '@components/finance/CategorySelect';
import { usePaged, TablePager } from '@components/admin/table/TablePager';

const input = 'w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm';
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const KIND: Record<string, { label: string; sign: string; tone: string }> = {
  top_up: { label: 'Top up', sign: '+', tone: 'text-emerald-700' }, spend: { label: 'Spend', sign: '−', tone: 'text-rose-700' }, return: { label: 'Returned to bank', sign: '−', tone: 'text-gray-700' },
};

export const PettyCashPage: React.FC = () => {
  const qc = useQueryClient();
  const funds = useQuery({ queryKey: ['fin-funds'], queryFn: async () => { const r: any = await bursarB.funds(); if (r?.success === false) throw new Error(r.error || 'Could not load petty cash.'); return r.data as any[]; } });
  const [selected, setSelected] = useState('');
  const fundId = selected || funds.data?.[0]?.id || '';
  const entries = useQuery({ queryKey: ['fin-fund-entries', fundId], queryFn: async () => { const r: any = await bursarB.fundEntries(fundId); if (r?.success === false) throw new Error(r.error); return r.data; }, enabled: !!fundId });
  const [fundEdit, setFundEdit] = useState<any | null>(null);
  const [entry, setEntry] = useState<{ kind: string; amount: string; category: string; description: string; entry_date: string; receipt_url: string } | null>(null);
  const [voidT, setVoidT] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') });
  const fund = (funds.data || []).find((f) => f.id === fundId);
  const pg = usePaged<any>(entries.data?.entries || [], [fundId]);

  return (
    <MainLayout>
      <PageShell title="Petty Cash" subtitle="Small day-to-day cash: top up the float, record spends with receipts, return what's left"
        actions={<Button size="sm" variant="create" onClick={() => setFundEdit({ name: '', float_amount: '' })}><Plus size={14} className="mr-1" /> New fund</Button>}>
        {funds.error ? <p role="alert" className="text-sm text-red-600">{(funds.error as Error).message}</p>
          : funds.isLoading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : (funds.data || []).length === 0 ? <EmptyState message="No petty cash fund yet" description="Create a fund (for example 'Office float') to track small cash spending." action={{ label: 'New fund', onClick: () => setFundEdit({ name: '', float_amount: '' }) }} />
          : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                {funds.data!.map((f) => (
                  <button key={f.id} type="button" aria-pressed={f.id === fundId} onClick={() => setSelected(f.id)}
                    className={`text-left rounded-2xl border p-4 bg-white dark:bg-gray-800 ${f.id === fundId ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200 dark:border-gray-700'} ${!f.active ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between"><span className="font-semibold">{f.name}</span>{f.below_float && <Pill s="overdue" label="Low" />}{!f.active && <Pill s="revoked" label="Closed" />}</div>
                    <div className="text-2xl font-black mt-1">{le(f.balance)}</div>
                    <div className="text-xs text-gray-500">Float {le(f.float_amount)}{f.custodian_name ? ` · held by ${f.custodian_name}` : ''}</div>
                  </button>
                ))}
              </div>
              {fund && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {fund.active && <>
                    <Button size="sm" variant="create" onClick={() => setEntry({ kind: 'spend', amount: '', category: 'Supplies', description: '', entry_date: todayLocal(), receipt_url: '' })}><ArrowUpCircle size={14} className="mr-1" /> Record a spend</Button>
                    <Button size="sm" variant="create" className="!bg-teal-600 hover:!bg-teal-700" onClick={() => setEntry({ kind: 'top_up', amount: fund.float_amount > fund.balance ? String((fund.float_amount - fund.balance).toFixed(2)) : '', category: '', description: '', entry_date: todayLocal(), receipt_url: '' })}><ArrowDownCircle size={14} className="mr-1" /> Top up</Button>
                    <Button size="sm" variant="outline" disabled={fund.balance <= 0} onClick={() => setEntry({ kind: 'return', amount: String(fund.balance), category: '', description: 'Returned to bank', entry_date: todayLocal(), receipt_url: '' })}><Undo2 size={14} className="mr-1" /> Return to bank</Button>
                  </>}
                  <Button size="sm" variant="ghost" onClick={() => setFundEdit(fund)}>Edit fund</Button>
                </div>
              )}
              {entries.error ? <p role="alert" className="text-sm text-red-600">{(entries.error as Error).message}</p>
                : entries.isLoading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
                : (entries.data?.entries || []).length === 0 ? <EmptyState message="No entries yet" description="Top up the fund, then record each spend with its receipt." />
                : (
                  <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500"><tr><th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Type</th><th className="px-3 py-3 text-left">Details</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3" /></tr></thead>
                      <tbody>
                        {pg.pageRows.map((e: any) => (
                          <tr key={e.id} className={`border-t border-gray-100 dark:border-gray-800 ${e.voided_at ? 'opacity-60' : ''}`}>
                            <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{String(e.entry_date).slice(0, 10)}</td>
                            <td className="px-3 py-2.5">{e.voided_at ? <Pill s="revoked" label="Void" /> : KIND[e.kind]?.label}</td>
                            <td className="px-3 py-2.5">{e.category ? <span className="font-medium">{e.category}: </span> : null}{e.description || '—'}
                              <div className="text-[11px] text-gray-400">{e.recorded_by_name}{e.receipt_url && <> · <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">receipt</a></>}{e.voided_at && <span className="text-red-600"> · {e.void_reason}</span>}</div></td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${KIND[e.kind]?.tone} ${e.voided_at ? 'line-through' : ''}`}>{KIND[e.kind]?.sign}{le(e.amount)}</td>
                            <td className="px-3 py-2.5 text-right">{!e.voided_at && <button type="button" aria-label="Void entry" onClick={() => { setReason(''); setVoidT(e); }} className="p-1.5 text-gray-400 hover:text-red-600"><Ban size={14} /></button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <TablePager {...pg.pager} label="entries" />
                  </div>
                )}
            </>
          )}

        {fundEdit && (
          <Modal isOpen onClose={() => setFundEdit(null)} title={fundEdit.id ? 'Edit fund' : 'New petty cash fund'} size="sm"
            footer={<><Button variant="ghost" onClick={() => setFundEdit(null)}>Cancel</Button><Button variant="create" disabled={saving || !fundEdit.name} onClick={async () => {
              setSaving(true);
              try {
                const r: any = await bursarB.saveFund({ name: fundEdit.name, float_amount: Number(fundEdit.float_amount) || 0, active: fundEdit.active !== false }, fundEdit.id);
                if (r?.success === false) return showToast.error(r.error || 'Could not save');
                showToast.success('Saved'); setFundEdit(null); refresh();
              } finally { setSaving(false); }
            }}>Save</Button></>}>
            <div className="space-y-3">
              <div><label htmlFor="pf-name" className="text-xs font-semibold text-gray-500">Name</label><input id="pf-name" className={input} value={fundEdit.name} onChange={(e) => setFundEdit({ ...fundEdit, name: e.target.value })} placeholder="Office float" /></div>
              <div><label htmlFor="pf-float" className="text-xs font-semibold text-gray-500">Float (Le) — the usual amount kept in the box</label><input id="pf-float" type="number" min={0} placeholder="e.g. 500" className={input} value={fundEdit.float_amount} onChange={(e) => setFundEdit({ ...fundEdit, float_amount: e.target.value })} /></div>
              {fundEdit.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fundEdit.active !== false} onChange={(e) => setFundEdit({ ...fundEdit, active: e.target.checked })} /> Open (untick to close the fund)</label>}
            </div>
          </Modal>
        )}

        {entry && fund && (
          <Modal isOpen onClose={() => setEntry(null)} title={`${KIND[entry.kind].label} · ${fund.name}`} size="md"
            footer={<><Button variant="ghost" onClick={() => setEntry(null)}>Cancel</Button><Button variant="create" disabled={saving || !(Number(entry.amount) > 0) || (entry.kind === 'spend' && (!entry.description.trim() || !entry.category.trim()))} onClick={async () => {
              setSaving(true);
              try {
                const r: any = await bursarB.addEntry(fund.id, { ...entry, amount: Number(entry.amount) });
                if (r?.success === false) return showToast.error(r.error || 'Could not save');
                showToast.success(`Saved · balance ${le(r.data.balance)}`); setEntry(null); refresh();
              } finally { setSaving(false); }
            }}>Save</Button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label htmlFor="pe-amt" className="text-xs font-semibold text-gray-500">Amount (Le)</label><input id="pe-amt" type="number" min={0} placeholder="e.g. 150" className={input} value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} /></div>
              <div><label htmlFor="pe-date" className="text-xs font-semibold text-gray-500">Date</label><input id="pe-date" type="date" max={todayLocal()} className={input} value={entry.entry_date} onChange={(e) => setEntry({ ...entry, entry_date: e.target.value })} /></div>
              {entry.kind === 'spend' && <div><label htmlFor="pe-cat" className="text-xs font-semibold text-gray-500">Spent on</label>
                <CategorySelect id="pe-cat" value={entry.category} onChange={(v) => setEntry({ ...entry, category: v })} exclude={['Salaries', 'Statutory (PAYE/NASSIT)']} /></div>}
              <div className={entry.kind === 'spend' ? '' : 'sm:col-span-2'}><label htmlFor="pe-desc" className="text-xs font-semibold text-gray-500">Description{entry.kind === 'spend' ? ' (required)' : ''}</label><input id="pe-desc" className={input} value={entry.description} onChange={(e) => setEntry({ ...entry, description: e.target.value })} placeholder={entry.kind === 'spend' ? 'e.g. Chalk and markers' : entry.kind === 'top_up' ? 'e.g. Cash from the bank, cheque 0045' : 'e.g. Returned to the school account'} /></div>
              {entry.kind === 'spend' && <div className="sm:col-span-2"><FileUploader label="Receipt (optional)" value={entry.receipt_url} onChange={(v) => setEntry({ ...entry, receipt_url: v })} accept="image/*,.pdf" previewType="file" enableCamera cameraGuide="frame" /></div>}
              {entry.kind !== 'top_up' && <p className="sm:col-span-2 text-[11px] text-gray-500">In the fund now: {le(fund.balance)}.{entry.kind === 'spend' ? ' The spend is also recorded under School Expenses.' : ''}</p>}
            </div>
          </Modal>
        )}

        <ConfirmationDialog isOpen={!!voidT} onClose={() => setVoidT(null)} title="Void entry" confirmLabel="Void" confirmDisabled={reason.trim().length < 5}
          message={voidT ? `Void this ${KIND[voidT.kind]?.label.toLowerCase()} of ${le(voidT.amount)}?${voidT.kind === 'spend' ? ' Its expense is voided too.' : ''}` : ''}
          onConfirm={async () => { const r: any = await bursarB.voidEntry(voidT.id, reason.trim()); if (r?.success === false) { showToast.error(r.error || 'Failed'); throw new Error('x'); } showToast.success('Voided'); refresh(); }}>
          <label htmlFor="pv-reason" className="block text-xs font-semibold text-gray-600 mt-2">Reason (required)</label>
          <textarea id="pv-reason" rows={2} placeholder="e.g. Entered against the wrong fund" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
        </ConfirmationDialog>
      </PageShell>
    </MainLayout>
  );
};

export default PettyCashPage;
