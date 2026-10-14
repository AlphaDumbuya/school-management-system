/**
 * Journal (bursar Phase C, R2–R4): every entry in the books. Automatic entries
 * come from fees, payments, expenses, petty cash and payroll; finance staff add
 * balanced manual journals and reverse them (never edit or delete). The
 * principal closes the books up to a date.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus, Trash2, RotateCcw, ChevronDown, ChevronRight, Lock, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { TablePager } from '@components/admin/table/TablePager';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import useAuthStore from '@store/authStore';
import { showToast } from '@utils/toast';
import { bursarC, SOURCE_TYPE_LABEL, type GLAccount, type GLEntry, type Paged } from '@services/bursarService';
import { unwrap, todayLocal, AccountSelect, Money, HEADER_BTN, BtnLabel } from '@components/finance/AccountingUi';

const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm';
type Line = { account_id: string; debit: string; credit: string; memo: string };
const blankLine = (): Line => ({ account_id: '', debit: '', credit: '', memo: '' });
const cents = (v: string) => Math.round((Number(v) || 0) * 100);

const TEMPLATES: Array<{ key: string; label: string; memo: string; lines: Array<[string, 'debit' | 'credit']> }> = [
  { key: 'blank', label: 'Blank journal', memo: '', lines: [] },
  { key: 'opening', label: 'Opening balance (money already held)', memo: 'Opening balance', lines: [['bank', 'debit'], ['equity', 'credit']] },
  { key: 'banked', label: 'Cash taken to the bank', memo: 'Cash banked', lines: [['bank', 'debit'], ['cash', 'credit']] },
  { key: 'mobile', label: 'Mobile money moved to the bank', memo: 'Mobile money transferred to bank', lines: [['bank', 'debit'], ['mobile', 'credit']] },
  { key: 'remit', label: 'PAYE / NASSIT paid over', memo: 'PAYE and NASSIT remitted', lines: [['paye', 'debit'], ['nassit', 'debit'], ['bank', 'credit']] },
  { key: 'charges', label: 'Bank charges', memo: 'Bank charges', lines: [['exp:bank charges', 'debit'], ['bank', 'credit']] },
  { key: 'donation', label: 'Donation or grant received', memo: 'Donation received', lines: [['bank', 'debit'], ['inc:misc', 'credit']] },
];

const NewJournal: React.FC<{ accounts: GLAccount[]; lockedUntil: string | null; onClose: () => void; onSaved: () => void }> = ({ accounts, lockedUntil, onClose, onSaved }) => {
  const [date, setDate] = useState(todayLocal());
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine(), blankLine()]);
  const [saving, setSaving] = useState(false);
  const byKey = useMemo(() => new Map(accounts.filter((a) => a.system_key).map((a) => [a.system_key!, a.id])), [accounts]);
  const dr = lines.reduce((s, l) => s + cents(l.debit), 0), cr = lines.reduce((s, l) => s + cents(l.credit), 0);
  const used = lines.filter((l) => l.account_id && (cents(l.debit) || cents(l.credit)));
  const balanced = dr === cr && dr > 0;
  const locked = !!lockedUntil && date <= lockedUntil;
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const applyTemplate = (k: string) => {
    const t = TEMPLATES.find((x) => x.key === k);
    if (!t) return;
    setMemo(t.memo);
    setLines(t.lines.length ? t.lines.map(([key]) => ({ ...blankLine(), account_id: byKey.get(key) || '' })) : [blankLine(), blankLine()]);
  };
  const save = async () => {
    setSaving(true);
    try {
      const r: any = await bursarC.postJournal({ entry_date: date, memo: memo.trim(), lines: used.map((l) => ({ account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo || undefined })) });
      if (r?.success === false) return showToast.error(r.error || 'Could not post the journal');
      showToast.success(`Posted ${r.data.entry_no}`); onSaved();
    } finally { setSaving(false); }
  };
  return (
    <Modal isOpen onClose={onClose} title="New journal" size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="create" onClick={save} disabled={saving || !balanced || used.length < 2 || memo.trim().length < 3 || locked}>{saving ? 'Posting…' : 'Post journal'}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div><label htmlFor="jn-tpl" className="text-xs font-semibold text-gray-500">Start from</label>
          <select id="jn-tpl" className={`${input} mt-1`} defaultValue="blank" onChange={(e) => applyTemplate(e.target.value)}>{TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div>
        <div><label htmlFor="jn-date" className="text-xs font-semibold text-gray-500">Date</label><input id="jn-date" type="date" max={todayLocal()} className={`${input} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label htmlFor="jn-memo" className="text-xs font-semibold text-gray-500">Description</label><input id="jn-memo" className={`${input} mt-1`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. PAYE for September paid to NRA" /></div>
      </div>
      {locked && <p role="alert" className="mb-2 text-xs text-red-600">The books are closed up to {lockedUntil}. Choose a later date.</p>}
      <div className="space-y-2">
        <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] font-semibold text-gray-500"><span className="col-span-5">Account</span><span className="col-span-2 text-right">Debit (Le)</span><span className="col-span-2 text-right">Credit (Le)</span><span className="col-span-2">Line note</span></div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-12 sm:col-span-5"><AccountSelect ariaLabel={`Line ${i + 1} account`} value={l.account_id} onChange={(v) => set(i, { account_id: v })} accounts={accounts} excludeControl className={input} /></div>
            <input aria-label={`Line ${i + 1} debit`} type="number" min={0} step="0.01" placeholder="Debit" value={l.debit} onChange={(e) => set(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} className={`${input} col-span-4 sm:col-span-2 text-right`} />
            <input aria-label={`Line ${i + 1} credit`} type="number" min={0} step="0.01" placeholder="Credit" value={l.credit} onChange={(e) => set(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} className={`${input} col-span-4 sm:col-span-2 text-right`} />
            <input aria-label={`Line ${i + 1} note`} placeholder="Optional" value={l.memo} onChange={(e) => set(i, { memo: e.target.value })} className={`${input} col-span-3 sm:col-span-2`} />
            <button type="button" aria-label={`Remove line ${i + 1}`} disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="col-span-1 p-2 text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 size={15} /></button>
          </div>
        ))}
        <Button type="button" size="sm" variant="create" onClick={() => setLines([...lines, blankLine()])}><Plus size={13} className="mr-1" /> Add line</Button>
      </div>
      <div className={`mt-3 flex flex-wrap justify-end gap-4 text-sm font-semibold ${balanced ? 'text-emerald-700' : 'text-red-600'}`} aria-live="polite">
        <span>Debits Le {(dr / 100).toFixed(2)}</span><span>Credits Le {(cr / 100).toFixed(2)}</span>
        <span>{balanced ? 'Balanced' : dr === cr ? 'Enter amounts' : `Off by Le ${(Math.abs(dr - cr) / 100).toFixed(2)}`}</span>
      </div>
      <p className="mt-2 text-xs text-gray-500">Fees receivable, Student credit and Petty cash are kept by their own pages, so they are not offered here.</p>
    </Modal>
  );
};

export const JournalPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isPrincipal = user?.role === 'principal' || user?.role === 'super_admin';
  const { activeYear } = useAcademicYears();
  const [year, setYear] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [rev, setRev] = useState<GLEntry | null>(null);
  const [reason, setReason] = useState('');
  const [lockEdit, setLockEdit] = useState<string | null>(null);
  const y = year || activeYear || '';
  const params = { academic_year: y || undefined, source: source || undefined, search: search || undefined, page, size };
  const q = useQuery({ queryKey: ['fin-gl-journal', params], queryFn: () => unwrap<Paged<GLEntry>>(bursarC.journal(params), 'Could not load the journal.'), placeholderData: keepPreviousData, enabled: !!y });
  const accounts = useQuery({ queryKey: ['fin-gl-accounts'], queryFn: () => unwrap<GLAccount[]>(bursarC.accounts()) });
  const lock = useQuery({ queryKey: ['fin-gl-lock'], queryFn: () => unwrap<{ locked_until: string | null }>(bursarC.lock()) });
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-gl') });
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const lockedUntil = lock.data?.locked_until || null;
  const d = q.data;

  return (
    <MainLayout>
      <PageShell title="Journal" subtitle="Every entry in the books: automatic from fees, payments, expenses and payroll, plus manual journals"
        onRefresh={async () => { await bursarC.sync(); refresh(); }} isRefreshing={q.isFetching} mobileLabels
        actions={<div className="flex flex-wrap items-center gap-2">
          <YearFilter value={y} onChange={reset((v: string) => setYear(v === activeYear ? '' : v))} noAutoSelect />
          <Button size="sm" variant="create" className={HEADER_BTN} disabled={!accounts.data} onClick={() => setNewOpen(true)}><Plus size={15} /><BtnLabel>New journal</BtnLabel></Button>
        </div>}>
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm">
          <Lock size={14} className="text-gray-400" />
          {lockedUntil ? <span>Books closed up to <strong>{lockedUntil}</strong>. Nothing can be posted on or before it.</span> : <span className="text-gray-600">The books are open. The principal can close them up to a date after a period is checked.</span>}
          {isPrincipal && (lockEdit === null
            ? <Button size="sm" variant="outline" className={`ml-auto ${HEADER_BTN}`} onClick={() => setLockEdit(lockedUntil || todayLocal())}>{lockedUntil ? 'Change' : 'Close the books'}</Button>
            : <div className="ml-auto flex flex-wrap items-center gap-2">
              <label htmlFor="lock-date" className="sr-only">Close up to</label>
              <input id="lock-date" type="date" max={todayLocal()} value={lockEdit} onChange={(e) => setLockEdit(e.target.value)} className="min-h-[40px] sm:min-h-0 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
              <Button size="sm" className={HEADER_BTN} onClick={async () => { const r: any = await bursarC.setLock(lockEdit || null); if (r?.success === false) return showToast.error(r.error || 'Failed'); showToast.success(lockEdit ? `Books closed up to ${lockEdit}` : 'Books reopened'); setLockEdit(null); refresh(); }}>Save</Button>
              {lockedUntil && <Button size="sm" variant="ghost" className={HEADER_BTN} onClick={async () => { const r: any = await bursarC.setLock(null); if (r?.success === false) return showToast.error(r.error || 'Failed'); showToast.success('Books reopened'); setLockEdit(null); refresh(); }}>Reopen</Button>}
              <Button size="sm" variant="ghost" className={HEADER_BTN} onClick={() => setLockEdit(null)}>Cancel</Button>
            </div>)}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <SearchBar placeholder="Search entry number or description…" onSearch={reset(setSearch)} className="w-full sm:max-w-sm" />
          <select aria-label="Source" value={source} onChange={(e) => reset(setSource)(e.target.value)} className="min-h-[40px] sm:min-h-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
            <option value="">All sources</option>{Object.entries(SOURCE_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>

        {q.error ? <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
          : q.isLoading || !d ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : d.rows.length === 0 ? <EmptyState message={`No entries in ${y}`} description="Entries appear as fees are billed, payments come in and expenses are recorded." />
          : (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              {/* The table scrolls sideways on phones instead of squeezing the
                  columns; dates, entry numbers, sources and amounts never wrap. */}
              <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500"><tr><th className="px-3 py-3 w-10"><span className="sr-only">Lines</span></th><th className="px-3 py-3 text-left whitespace-nowrap">Date</th><th className="px-3 py-3 text-left whitespace-nowrap">Entry</th><th className="px-3 py-3 text-left min-w-[16rem]">Details</th><th className="px-3 py-3 text-left whitespace-nowrap">Source</th><th className="px-3 py-3 text-right whitespace-nowrap">Amount</th><th className="px-3 py-3 w-12"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {d.rows.map((e) => (
                    <React.Fragment key={e.id}>
                      <tr className={`border-t border-gray-100 dark:border-gray-800 align-top ${e.reversed_by_id ? 'opacity-60' : ''}`}>
                        <td className="px-1 py-1"><button type="button" aria-expanded={open.has(e.id)} aria-label={`Show lines of ${e.entry_no}`} onClick={() => toggle(e.id)} className="inline-flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700">{open.has(e.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-600 tabular-nums">{e.entry_date}</td>
                        <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{e.entry_no}</td>
                        <td className="px-3 py-2.5 min-w-[16rem] break-words">{e.memo || '—'}{e.reversed_by_id && <span className="ml-2 text-[11px] text-red-600">reversed{e.reverse_reason ? `: ${e.reverse_reason}` : ''}</span>}{e.kind === 'manual' && e.created_by_name && <div className="text-[11px] text-gray-400">by {e.created_by_name}</div>}</td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">{SOURCE_TYPE_LABEL[e.source_type] || e.source_type}</td>
                        <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums"><Money v={e.total} /></td>
                        <td className="px-1 py-1 text-right">{e.kind === 'manual' && !e.reversed_by_id && !e.reverses_id && <button type="button" aria-label={`Reverse ${e.entry_no}`} title="Reverse" onClick={() => { setReason(''); setRev(e); }} className="inline-flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"><RotateCcw size={14} /></button>}</td>
                      </tr>
                      {open.has(e.id) && (
                        <tr className="bg-gray-50/60 dark:bg-gray-900/30"><td /><td colSpan={6} className="px-3 py-2">
                          <table className="w-full text-xs"><thead className="text-gray-400"><tr><th className="text-left py-1 pr-3 min-w-[12rem]">Account</th><th className="text-left pr-3 min-w-[8rem]">Note</th><th className="text-right pr-3 whitespace-nowrap">Debit</th><th className="text-right whitespace-nowrap">Credit</th></tr></thead>
                            <tbody>{e.lines.map((l) => <tr key={l.id} className="align-top"><td className="py-1 pr-3"><span className="font-mono text-gray-400 mr-2 whitespace-nowrap">{l.code}</span>{l.name}</td><td className="py-1 pr-3 text-gray-500 break-words">{l.memo || ''}</td><td className="py-1 pr-3 text-right whitespace-nowrap tabular-nums"><Money v={l.debit} zero="" /></td><td className="py-1 text-right whitespace-nowrap tabular-nums"><Money v={l.credit} zero="" /></td></tr>)}</tbody>
                          </table>
                        </td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              </div>
              <TablePager page={page} pageCount={Math.max(1, Math.ceil(d.total / size))} size={size} total={d.total} onPage={setPage} onSize={(n) => { setSize(n); setPage(0); }} label="entries" />
            </div>
          )}

        {newOpen && accounts.data && <NewJournal accounts={accounts.data} lockedUntil={lockedUntil} onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); refresh(); }} />}
        <ConfirmationDialog isOpen={!!rev} onClose={() => setRev(null)} title="Reverse journal" confirmLabel="Reverse"
          message={rev ? `Post the mirror of ${rev.entry_no} (${rev.memo || 'journal'}) dated today? The original stays on record.` : ''}
          confirmDisabled={reason.trim().length < 5}
          onConfirm={async () => { const r: any = await bursarC.reverse(rev!.id, reason.trim()); if (r?.success === false) { showToast.error(r.error || 'Failed'); throw new Error('x'); } showToast.success(`Reversed with ${r.data.entry_no}`); refresh(); }}>
          <label htmlFor="jr-reason" className="block text-xs font-semibold text-gray-600 mt-2">Reason (required)</label>
          <textarea id="jr-reason" rows={2} placeholder="e.g. Posted to the wrong account" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
        </ConfirmationDialog>
      </PageShell>
    </MainLayout>
  );
};

export default JournalPage;
