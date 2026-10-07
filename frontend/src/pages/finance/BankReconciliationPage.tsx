/**
 * Bank Reconciliation (bursar Phase C, R6): import a bank / mobile-money
 * statement, auto-match it to the books, match the rest by hand, add missing
 * items (bank charges, interest) to the books, and see the difference.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Wand2, Link2, Unlink, EyeOff, Eye, BookPlus, Undo2, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { usePaged, TablePager } from '@components/admin/table/TablePager';
import { showToast } from '@utils/toast';
import { bursarC, type GLAccount } from '@services/bursarService';
import { unwrap, todayLocal, AccountSelect, Money, CheckBadge } from '@components/finance/AccountingUi';

const input = 'w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm';

// ── CSV ─────────────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell.trim()); if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}
const money = (v: string): number | null => {
  const s = String(v || '').trim();
  if (!s) return null;
  // "-1,200.00", "(1,200.00)" and "1,200.00 DR" are money out.
  const neg = /^\(.*\)$/.test(s) || s.includes('-') || /\bDR\b/i.test(s);
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
};
type DateFmt = 'ymd' | 'dmy' | 'mdy';
const toYmd = (v: string, fmt: DateFmt): string | null => {
  const s = String(v || '').trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (!m) return null;
  const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
  const [d, mo] = fmt === 'mdy' ? [m[2], m[1]] : [m[1], m[2]];
  if (Number(mo) > 12 || Number(d) > 31) return null;
  return `${yr}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

const ImportModal: React.FC<{ accountName: string; onClose: () => void; onImport: (rows: any[]) => Promise<void> }> = ({ accountName, onClose, onImport }) => {
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [header, setHeader] = useState(true);
  const [map, setMap] = useState<{ date: string; desc: string; ref: string; amount: string; inCol: string; outCol: string; bal: string }>({ date: '', desc: '', ref: '', amount: '', inCol: '', outCol: '', bal: '' });
  const [mode, setMode] = useState<'signed' | 'split'>('signed');
  const [fmt, setFmt] = useState<DateFmt>('dmy');
  const [busy, setBusy] = useState(false);
  const cols = grid ? (header ? grid[0] : grid[0].map((_, i) => `Column ${i + 1}`)) : [];
  const body = grid ? (header ? grid.slice(1) : grid) : [];
  const guess = (g: string[][]) => {
    const h = g[0].map((x) => x.toLowerCase());
    const f = (...ks: string[]) => { const i = h.findIndex((x) => ks.some((k) => x.includes(k))); return i >= 0 ? String(i) : ''; };
    const inCol = f('credit', 'money in', 'deposit', 'paid in'), outCol = f('debit', 'money out', 'withdrawal', 'paid out');
    setMap({ date: f('date'), desc: f('description', 'narration', 'details', 'particular'), ref: f('reference', 'ref', 'cheque'), amount: f('amount'), inCol, outCol, bal: f('balance') });
    setMode(f('amount') === '' && inCol !== '' && outCol !== '' ? 'split' : 'signed');
  };
  const parsed = useMemo(() => body.map((r) => {
    const at = (k: string) => (k === '' ? '' : r[Number(k)] ?? '');
    const date = toYmd(at(map.date), fmt);
    const amount = mode === 'signed' ? money(at(map.amount)) : (money(at(map.inCol)) || 0) - Math.abs(money(at(map.outCol)) || 0);
    return { date, description: at(map.desc) || undefined, reference: at(map.ref) || undefined, amount, balance: map.bal === '' ? null : money(at(map.bal)) };
  }), [body, map, mode, fmt]);
  const good = parsed.filter((r) => r.date && r.amount);
  const sel = (id: string, label: string, k: keyof typeof map, optional = false) => (
    <div><label htmlFor={id} className="text-xs font-semibold text-gray-500">{label}</label>
      <select id={id} className={input} value={map[k]} onChange={(e) => setMap({ ...map, [k]: e.target.value })}>
        <option value="">{optional ? '(none)' : 'Choose a column…'}</option>{cols.map((c, i) => <option key={i} value={String(i)}>{c || `Column ${i + 1}`}</option>)}
      </select></div>
  );
  return (
    <Modal isOpen onClose={onClose} title={`Import statement · ${accountName}`} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="create" disabled={busy || !good.length} onClick={async () => { setBusy(true); try { await onImport(good); } finally { setBusy(false); } }}>{busy ? 'Importing…' : `Import ${good.length} line${good.length === 1 ? '' : 's'}`}</Button></>}>
      <label htmlFor="bk-file" className="text-xs font-semibold text-gray-500">Statement file (CSV from your bank or mobile-money provider)</label>
      <input id="bk-file" type="file" accept=".csv,text/csv,.txt" className="block mt-1 text-sm" onChange={async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        if (file.size > 5_000_000) return showToast.error('The file is larger than 5 MB.');
        const g = parseCsv(await file.text());
        if (g.length < 1) return showToast.error('That file has no rows.');
        setGrid(g); guess(g);
      }} />
      {grid && <>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> The first row has column names</label>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sel('bk-date', 'Date', 'date')}
          <div><label htmlFor="bk-fmt" className="text-xs font-semibold text-gray-500">Date format</label>
            <select id="bk-fmt" className={input} value={fmt} onChange={(e) => setFmt(e.target.value as DateFmt)}><option value="dmy">Day/Month/Year (31/12/2027)</option><option value="mdy">Month/Day/Year (12/31/2027)</option><option value="ymd">Year-Month-Day (2027-12-31)</option></select></div>
          {sel('bk-desc', 'Description', 'desc', true)}
          {sel('bk-ref', 'Reference', 'ref', true)}
          <div><label htmlFor="bk-mode" className="text-xs font-semibold text-gray-500">Amounts are in</label>
            <select id="bk-mode" className={input} value={mode} onChange={(e) => setMode(e.target.value as any)}><option value="signed">One column (minus = money out)</option><option value="split">Two columns (money in / money out)</option></select></div>
          {mode === 'signed' ? sel('bk-amt', 'Amount', 'amount') : <>{sel('bk-in', 'Money in', 'inCol')}{sel('bk-out', 'Money out', 'outCol')}</>}
          {sel('bk-bal', 'Running balance', 'bal', true)}
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500"><tr><th className="px-2 py-1.5 text-left">Date</th><th className="px-2 py-1.5 text-left">Description</th><th className="px-2 py-1.5 text-left">Ref</th><th className="px-2 py-1.5 text-right">Amount</th></tr></thead>
            <tbody>{parsed.slice(0, 6).map((r, i) => <tr key={i} className={`border-t border-gray-100 dark:border-gray-800 ${!r.date || !r.amount ? 'text-red-600' : ''}`}><td className="px-2 py-1">{r.date || 'invalid'}</td><td className="px-2 py-1">{r.description || ''}</td><td className="px-2 py-1">{r.reference || ''}</td><td className="px-2 py-1 text-right">{r.amount ? r.amount.toFixed(2) : 'invalid'}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">{good.length} of {parsed.length} rows are ready.{parsed.length - good.length > 0 && ` ${parsed.length - good.length} will be skipped (no date or amount).`} Lines already imported are skipped automatically.</p>
      </>}
    </Modal>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────
export const BankReconciliationPage: React.FC = () => {
  const qc = useQueryClient();
  const accs = useQuery({ queryKey: ['fin-gl-bank-accounts'], queryFn: () => unwrap<any[]>(bursarC.bankAccounts(), 'Could not load accounts.') });
  const glAccounts = useQuery({ queryKey: ['fin-gl-accounts'], queryFn: () => unwrap<GLAccount[]>(bursarC.accounts()) });
  const [picked, setPicked] = useState('');
  const accountId = picked || accs.data?.find((a) => a.system_key === 'bank')?.id || accs.data?.[0]?.id || '';
  const [asAt, setAsAt] = useState(todayLocal());
  const [stmtBal, setStmtBal] = useState('');
  const view = useQuery({ queryKey: ['fin-gl-bank', accountId, asAt, stmtBal], enabled: !!accountId, queryFn: () => unwrap<any>(bursarC.bankView(accountId, { to: asAt, statement_balance: stmtBal })) });
  const [status, setStatus] = useState<'unmatched' | 'matched' | 'ignored' | ''>('unmatched');
  const [importOpen, setImportOpen] = useState(false);
  const [lastBatch, setLastBatch] = useState<string | null>(null);
  const [matching, setMatching] = useState<any | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [booking, setBooking] = useState<any | null>(null);
  const [bookAcc, setBookAcc] = useState('');
  const [bookMemo, setBookMemo] = useState('');
  const [undoOpen, setUndoOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-gl') });
  const d = view.data;
  const acct = accs.data?.find((a) => a.id === accountId);
  const stmtRows = useMemo(() => (d?.statement || []).filter((l: any) => !status || l.status === status), [d, status]);
  const stmtPg = usePaged<any>(stmtRows, [accountId, status, asAt]);
  const bookRows = useMemo(() => (d?.book || []).filter((b: any) => !matching || Math.sign(b.amount) === Math.sign(matching.amount)), [d, matching]);
  const bookPg = usePaged<any>(bookRows, [accountId, asAt, matching?.id]);
  const tickedSum = (d?.book || []).filter((b: any) => ticked.has(b.id)).reduce((s: number, b: any) => s + Math.round(b.amount * 100), 0);
  const act = async (p: Promise<any>, msg: string) => {
    setBusy(true);
    try { const r: any = await p; if (r?.success === false) { showToast.error(r.error || 'Failed'); return false; } showToast.success(msg); refresh(); return true; } finally { setBusy(false); }
  };

  return (
    <MainLayout>
      <PageShell title="Bank Reconciliation" subtitle="Check the school's books against the bank and mobile-money statements" onRefresh={() => view.refetch()} isRefreshing={view.isFetching}
        actions={accountId ? <div className="flex items-center gap-2">
          <Button size="sm" variant="create" onClick={() => setImportOpen(true)}><Upload size={14} className="sm:mr-1.5" /><span className="hidden sm:inline">Import statement</span></Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { const r: any = await bursarC.bankAutoMatch(accountId); if (r?.success === false) return showToast.error(r.error || 'Failed'); showToast.success(`Matched ${r.data.matched} line${r.data.matched === 1 ? '' : 's'} · ${r.data.remaining} left`); refresh(); } finally { setBusy(false); } }}><Wand2 size={14} className="sm:mr-1.5" /><span className="hidden sm:inline">Auto-match</span></Button>
        </div> : undefined}>
        {accs.error ? <p role="alert" className="text-sm text-red-600">{(accs.error as Error).message}</p>
          : accs.isLoading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : !accs.data?.length ? <EmptyState message="No money accounts" description="Add a bank or mobile-money account in the Chart of Accounts first." />
          : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {accs.data.map((a) => (
                  <button key={a.id} type="button" aria-pressed={a.id === accountId} onClick={() => { setPicked(a.id); setMatching(null); setTicked(new Set()); setStmtBal(''); }}
                    className={`text-left rounded-2xl border p-3 bg-white dark:bg-gray-800 ${a.id === accountId ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="text-xs text-gray-500">{a.code} · {a.name}</div>
                    <div className="text-lg font-black"><Money v={a.book_balance} zero="Le 0.00" /></div>
                    <div className="text-[11px] text-gray-500">{a.statement_lines ? `${a.unmatched} to match · statement to ${a.last_statement_date}` : 'No statement imported'}</div>
                  </button>
                ))}
              </div>

              {view.error ? <p role="alert" className="text-sm text-red-600">{(view.error as Error).message}</p> : !d ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
                <>
                  <div className="mb-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                    <div className="flex flex-wrap items-end gap-3 mb-3">
                      <div><label htmlFor="br-asat" className="text-xs font-semibold text-gray-500">As at</label><input id="br-asat" type="date" max={todayLocal()} value={asAt} onChange={(e) => setAsAt(e.target.value || todayLocal())} className="block mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" /></div>
                      <div><label htmlFor="br-bal" className="text-xs font-semibold text-gray-500">Statement closing balance (Le)</label><input id="br-bal" type="number" step="0.01" value={stmtBal} placeholder={d.summary.statement_balance != null ? String(d.summary.statement_balance) : 'From your statement'} onChange={(e) => setStmtBal(e.target.value)} className="block mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm w-48" /></div>
                      <div className="ml-auto">{d.summary.difference == null ? <span className="text-xs text-gray-500">Enter the statement balance to check the difference.</span> : <CheckBadge ok={d.summary.reconciled} okText="Reconciled" badText={`Difference Le ${Math.abs(d.summary.difference).toFixed(2)}`} />}</div>
                    </div>
                    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div><dt className="text-xs text-gray-500">Balance in the books</dt><dd className="font-bold"><Money v={d.summary.book_balance} zero="Le 0.00" /></dd></div>
                      <div><dt className="text-xs text-gray-500">Balance on the statement</dt><dd className="font-bold">{d.summary.statement_balance == null ? '—' : <Money v={d.summary.statement_balance} zero="Le 0.00" />}</dd></div>
                      <div><dt className="text-xs text-gray-500">On the statement, not in the books ({d.summary.unmatched_statement_count})</dt><dd className="font-bold"><Money v={d.summary.unmatched_statement} zero="Le 0.00" /></dd></div>
                      <div><dt className="text-xs text-gray-500">In the books, not on the statement ({d.summary.unmatched_book_count})</dt><dd className="font-bold"><Money v={d.summary.unmatched_book} zero="Le 0.00" /></dd></div>
                    </dl>
                    {lastBatch && <Button size="sm" variant="ghost" className="mt-3" onClick={() => setUndoOpen(true)}><Undo2 size={13} className="mr-1" /> Undo the last import</Button>}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <h2 className="text-sm font-bold">Statement lines</h2>
                        <select aria-label="Statement status" value={status} onChange={(e) => setStatus(e.target.value as any)} className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs">
                          <option value="unmatched">To match</option><option value="matched">Matched</option><option value="ignored">Ignored</option><option value="">All</option>
                        </select>
                      </div>
                      {!stmtRows.length ? <p className="p-4 text-sm text-gray-500">{d.statement.length ? 'Nothing here.' : 'Import a statement to start.'}</p> : (
                        <>
                          <table className="w-full text-sm"><tbody>
                            {stmtPg.pageRows.map((l: any) => (
                              <tr key={l.id} className={`border-t border-gray-100 dark:border-gray-800 ${matching?.id === l.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{l.txn_date}</td>
                                <td className="px-3 py-2"><div className="text-sm">{l.description || '—'}</div><div className="text-[11px] text-gray-400">{l.reference}{l.matches.length > 0 && ` · matched to ${l.matches.map((m: any) => m.entry_no).join(', ')}`}</div></td>
                                <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${l.amount < 0 ? 'text-rose-700' : 'text-emerald-700'}`}><Money v={l.amount} /></td>
                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                  {l.status === 'unmatched' && <>
                                    <button type="button" title="Match to book items" aria-label="Match to book items" onClick={() => { setMatching(matching?.id === l.id ? null : l); setTicked(new Set()); }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600"><Link2 size={14} /></button>
                                    <button type="button" title="Add to the books" aria-label="Add to the books" onClick={() => { setBooking(l); setBookAcc(''); setBookMemo(l.description || ''); }} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600"><BookPlus size={14} /></button>
                                    <button type="button" title="Ignore" aria-label="Ignore line" onClick={() => act(bursarC.bankIgnore(l.id, true), 'Line ignored')} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700"><EyeOff size={14} /></button>
                                  </>}
                                  {l.status === 'matched' && <button type="button" title="Unmatch" aria-label="Unmatch" onClick={() => act(bursarC.bankUnmatch(l.id), 'Unmatched')} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600"><Unlink size={14} /></button>}
                                  {l.status === 'ignored' && <button type="button" title="Restore" aria-label="Restore line" onClick={() => act(bursarC.bankIgnore(l.id, false), 'Line restored')} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600"><Eye size={14} /></button>}
                                </td>
                              </tr>
                            ))}
                          </tbody></table>
                          <TablePager {...stmtPg.pager} label="lines" />
                        </>
                      )}
                    </section>

                    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <h2 className="text-sm font-bold">In the books, not yet on a statement</h2>
                        {matching && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs" aria-live="polite">
                          <span>Tick the items that make up <strong><Money v={matching.amount} /></strong> ({matching.description || matching.txn_date}). Selected: <strong><Money v={tickedSum / 100} zero="Le 0.00" /></strong></span>
                          <Button size="sm" disabled={busy || tickedSum !== Math.round(matching.amount * 100)} onClick={async () => { if (await act(bursarC.bankMatch(matching.id, Array.from(ticked)), 'Matched')) { setMatching(null); setTicked(new Set()); } }}>Match</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setMatching(null); setTicked(new Set()); }}>Cancel</Button>
                        </div>}
                      </div>
                      {!bookRows.length ? <p className="p-4 text-sm text-gray-500">Everything in the books is matched.</p> : (
                        <>
                          <table className="w-full text-sm"><tbody>
                            {bookPg.pageRows.map((b: any) => (
                              <tr key={b.id} className="border-t border-gray-100 dark:border-gray-800">
                                {matching && <td className="pl-3"><input type="checkbox" aria-label={`Select ${b.entry_no}`} checked={ticked.has(b.id)} onChange={(e) => setTicked((s) => { const n = new Set(s); e.target.checked ? n.add(b.id) : n.delete(b.id); return n; })} /></td>}
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{b.entry_date}</td>
                                <td className="px-3 py-2"><div className="text-sm">{b.line_memo || b.memo || '—'}</div><div className="text-[11px] text-gray-400 font-mono">{b.entry_no}</div></td>
                                <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${b.amount < 0 ? 'text-rose-700' : 'text-emerald-700'}`}><Money v={b.amount} /></td>
                              </tr>
                            ))}
                          </tbody></table>
                          <TablePager {...bookPg.pager} label="items" />
                        </>
                      )}
                    </section>
                  </div>
                </>
              )}
            </>
          )}

        {importOpen && acct && <ImportModal accountName={`${acct.code} ${acct.name}`} onClose={() => setImportOpen(false)} onImport={async (rows) => {
          const r: any = await bursarC.bankImport(accountId, rows);
          if (r?.success === false) { showToast.error(r.error || 'Import failed'); return; }
          showToast.success(`Imported ${r.data.inserted} line${r.data.inserted === 1 ? '' : 's'}${r.data.skipped ? ` · ${r.data.skipped} already there` : ''}`);
          setLastBatch(r.data.inserted ? r.data.batch : null); setImportOpen(false); setStatus('unmatched'); refresh();
        }} />}

        {booking && glAccounts.data && (
          <Modal isOpen onClose={() => setBooking(null)} title="Add to the books" size="md"
            footer={<><Button variant="ghost" onClick={() => setBooking(null)}>Cancel</Button><Button variant="create" disabled={busy || !bookAcc} onClick={async () => { if (await act(bursarC.bankBook(booking.id, bookAcc, bookMemo), 'Added to the books and matched')) setBooking(null); }}>Add and match</Button></>}>
            <p className="text-sm mb-3"><Money v={booking.amount} /> on {booking.txn_date}: {booking.description || booking.reference || 'statement item'}. {booking.amount < 0 ? 'Money out of' : 'Money into'} {acct?.name}.</p>
            <label htmlFor="bb-acc" className="text-xs font-semibold text-gray-500">{booking.amount < 0 ? 'What was it for?' : 'Where did it come from?'}</label>
            <AccountSelect id="bb-acc" value={bookAcc} onChange={setBookAcc} accounts={glAccounts.data} excludeControl exclude={[accountId]} className={input} placeholder={booking.amount < 0 ? 'e.g. Bank charges' : 'e.g. Other income'} />
            <label htmlFor="bb-memo" className="text-xs font-semibold text-gray-500 mt-3 block">Description</label>
            <input id="bb-memo" className={input} value={bookMemo} onChange={(e) => setBookMemo(e.target.value)} placeholder="e.g. Monthly account fee" />
          </Modal>
        )}

        <ConfirmationDialog isOpen={undoOpen} onClose={() => setUndoOpen(false)} title="Undo the last import" confirmLabel="Undo import"
          message="Remove every line from the last import? This only works while none of them are matched."
          onConfirm={async () => { const r: any = await bursarC.bankUndoImport(lastBatch!); if (r?.success === false) { showToast.error(r.error || 'Failed'); throw new Error('x'); } showToast.success(`Removed ${r.data.removed} lines`); setLastBatch(null); refresh(); }} />
      </PageShell>
    </MainLayout>
  );
};

export default BankReconciliationPage;
