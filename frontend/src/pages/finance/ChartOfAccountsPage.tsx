/**
 * Chart of Accounts (bursar Phase C, R1): accounts by type with balances,
 * add / rename / switch off accounts, open an account's ledger.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, BookOpen, Lock, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { Modal } from '@components/admin/feedback/Modal';
import { SearchBar } from '@components/admin/table/SearchBar';
import { showToast } from '@utils/toast';
import { bursarC, ACCOUNT_TYPE_LABEL, type GLAccount } from '@services/bursarService';
import { unwrap, Money, HEADER_BTN, BtnLabel } from '@components/finance/AccountingUi';

const input = 'w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm';

const AccountModal: React.FC<{ account: Partial<GLAccount> & { description?: string } | null; onClose: () => void; onSaved: () => void }> = ({ account, onClose, onSaved }) => {
  const [f, setF] = useState<any>(account || {});
  const [saving, setSaving] = useState(false);
  if (!account) return null;
  const isNew = !account.id;
  const save = async () => {
    setSaving(true);
    try {
      const r: any = await bursarC.saveAccount({ code: f.code, name: f.name, type: f.type, subtype: f.subtype, description: f.description, ...(isNew ? {} : { is_active: f.is_active }) } as any, account.id);
      if (r?.success === false) return showToast.error(r.error || 'Could not save the account');
      showToast.success(isNew ? 'Account added' : 'Account saved'); onSaved();
    } finally { setSaving(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'New account' : `Edit ${account.code} ${account.name}`} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant={isNew ? 'create' : 'default'} onClick={save} disabled={saving || !f.code || !f.name || (isNew && !f.type)}>{saving ? 'Saving…' : 'Save'}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label htmlFor="ac-code" className="text-xs font-semibold text-gray-500">Code</label><input id="ac-code" inputMode="numeric" className={input} value={f.code || ''} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="e.g. 1200" /></div>
        <div className="sm:col-span-2"><label htmlFor="ac-name" className="text-xs font-semibold text-gray-500">Name</label><input id="ac-name" className={input} value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. School bus" /></div>
        <div><label htmlFor="ac-type" className="text-xs font-semibold text-gray-500">Type</label>
          <select id="ac-type" className={input} value={f.type || ''} disabled={!isNew} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="" disabled>Choose…</option>{Object.entries(ACCOUNT_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l.replace(/s$/, '')}</option>)}
          </select></div>
        {isNew && f.type === 'asset' && <label className="sm:col-span-2 flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={f.subtype === 'cash'} onChange={(e) => setF({ ...f, subtype: e.target.checked ? 'cash' : null })} /> Holds money (a bank or mobile-money account you reconcile)</label>}
        <div className="sm:col-span-3"><label htmlFor="ac-desc" className="text-xs font-semibold text-gray-500">Notes (optional)</label><input id="ac-desc" className={input} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Rokel Commercial Bank, account ending 4471" /></div>
        {!isNew && !account.is_system && <label className="sm:col-span-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_active !== false} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Active (switch off to hide it from new journals)</label>}
        {!isNew && account.is_system && <p className="sm:col-span-3 text-xs text-gray-500">A standard account: you can rename it or change its code, but not its type.</p>}
      </div>
    </Modal>
  );
};

export const ChartOfAccountsPage: React.FC = () => {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['fin-gl-accounts'], queryFn: () => unwrap<GLAccount[]>(bursarC.accounts(), 'Could not load the chart of accounts.') });
  const [edit, setEdit] = useState<Partial<GLAccount> | null>(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const rows = useMemo(() => (q.data || []).filter((a) => (showInactive || a.is_active) && (!search || `${a.code} ${a.name}`.toLowerCase().includes(search.toLowerCase()))), [q.data, search, showInactive]);
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-gl') });

  return (
    <MainLayout>
      <PageShell title="Chart of Accounts" subtitle="Every account in the school's books. Assets, liabilities and equity show the balance today; income and expenses show this academic year" onRefresh={() => q.refetch()} isRefreshing={q.isFetching} mobileLabels
        actions={<Button size="sm" variant="create" className={HEADER_BTN} onClick={() => setEdit({})}><Plus size={15} /><BtnLabel>New account</BtnLabel></Button>}>
        <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:items-center">
          <SearchBar placeholder="Search code or account name…" onSearch={setSearch} className="w-full sm:max-w-sm" />
          <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show switched-off accounts</label>
        </div>
        {q.error ? <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
          : q.isLoading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : (
            <div className="space-y-4">
              {Object.entries(ACCOUNT_TYPE_LABEL).map(([type, label]) => {
                const group = rows.filter((a) => a.type === type);
                if (!group.length) return null;
                const total = group.reduce((s, a) => s + a.balance, 0);
                return (
                  <section key={type} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/40"><h2 className="text-sm font-bold">{label}<span className="ml-2 text-[11px] font-normal text-gray-500">{group[0]?.period ? `${group[0].period} only` : 'balance today'}</span></h2><span className="text-sm font-bold"><Money v={total} zero="Le 0.00" /></span></div>
                    <table className="w-full text-sm">
                      <thead className="sr-only"><tr><th>Code</th><th>Account</th><th>Balance</th><th>Actions</th></tr></thead>
                      <tbody>
                        {group.map((a) => (
                          <tr key={a.id} className={`border-t border-gray-100 dark:border-gray-800 ${!a.is_active ? 'opacity-60' : ''}`}>
                            <td className="px-4 py-2.5 w-20 font-mono text-xs text-gray-500 whitespace-nowrap">{a.code}</td>
                            <td className="px-4 py-2.5 min-w-[10rem]">
                              <span className="font-medium">{a.name}</span>
                              {a.control && <span title="Kept by the fees / petty cash records" className="ml-2 inline-flex items-center gap-1 text-[11px] text-gray-400"><Lock size={11} /> automatic</span>}
                              {a.subtype === 'cash' && <span className="ml-2 text-[11px] text-blue-600">money</span>}
                              {a.subtype === 'contra' && <span className="ml-2 text-[11px] text-gray-400">reduces income</span>}
                              {!a.is_active && <span className="ml-2 text-[11px] text-gray-400">switched off</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap"><Money v={a.balance} /></td>
                            <td className="px-2 sm:px-4 py-1.5 text-right whitespace-nowrap w-24">
                              <button type="button" aria-label={`Ledger for ${a.name}`} title="Ledger" onClick={() => nav(`/finance/reports?tab=ledger&account=${a.id}`)} className="inline-flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"><BookOpen size={15} /></button>
                              <button type="button" aria-label={`Edit ${a.name}`} title="Edit" onClick={() => setEdit(a)} className="inline-flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                );
              })}
              {!rows.length && <p className="text-sm text-gray-500">No accounts match.</p>}
            </div>
          )}
        <AccountModal key={edit?.id || 'new'} account={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />
      </PageShell>
    </MainLayout>
  );
};

export default ChartOfAccountsPage;
