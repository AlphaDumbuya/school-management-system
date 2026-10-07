/**
 * InvoicesPage — /finance/invoices
 * Enterprise invoicing: bulk-generate invoices from outstanding fees per
 * class/level/term, inspect invoice line items & payment history, send
 * reminders to defaulters, and pay online (Monime).
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, FileStack, Eye, Bell, X, Loader2, Ban } from 'lucide-react';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { showToast } from '@utils/toast';
import { financeService } from '@services/financeService';
import { classesService } from '@services/classesService';
import { FinanceOverviewCards, fmtMoney, statusPill, SwipeHint } from './FinanceOverviewCards';
import { PayFeesButton } from '@components/finance/PayFeesButton';
import { ExportButton } from '@components/admin/common/ExportButton';
import { YearFilter } from '@components/common/YearFilter';
import { usePaged, TablePager } from '@components/admin/table/TablePager';
import { useAcademicYears } from '@hooks/useAcademicYears';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

export const InvoicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [genOpen, setGenOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Academic-year scope for the KPIs and the invoice list. Opens on the
  // school's ACTIVE year; '' = "All years"; a past year is read-only history
  // (arrears can still be reminded/paid, but no new invoices are generated).
  const [pickedYear, setYear] = useState<string | null>(null);
  const { activeYear } = useAcademicYears();
  const year = pickedYear ?? activeYear;
  const yearReady = pickedYear !== null || !!activeYear;
  const viewingPast = !!year && !!activeYear && year < activeYear;
  const viewingAll = pickedYear === '' && !!activeYear;

  const { data: overviewResp, isLoading: ovLoading, refetch: refetchOv } = useQuery({
    queryKey: ['finance-overview', year], queryFn: () => financeService.getOverview(year || undefined), enabled: yearReady, staleTime: 30_000,
  });
  const { data: invResp, isLoading, refetch, error: listError } = useQuery({
    queryKey: ['finance-invoices', statusFilter, year],
    queryFn: async () => {
      const r: any = await financeService.listInvoices(statusFilter || undefined, year || undefined);
      if (r?.success === false) throw new Error(r.error || 'Could not load invoices.');
      return r;
    },
    enabled: yearReady, staleTime: 15_000,
  });

  const overview = (overviewResp as any)?.data?.data ?? (overviewResp as any)?.data;
  const invoices = ((invResp as any)?.data?.data ?? (invResp as any)?.data ?? []) as any[];
  const levels = useMemo(() => Array.from(new Set(invoices.map((i) => i.class_level).filter(Boolean))).sort(), [invoices]);

  const filtered = invoices.filter((i) => {
    const t = search.trim().toLowerCase();
    const matchSearch = !t || i.invoice_number?.toLowerCase().includes(t) || i.student_name?.toLowerCase().includes(t) || (i.admission_no || '').toLowerCase().includes(t);
    return matchSearch && (!levelFilter || i.class_level === levelFilter);
  });
  const pg = usePaged(filtered, [year, search, statusFilter, levelFilter]);

  const refetchAll = async () => {
    await Promise.all([refetch(), refetchOv()]);
  };

  // Void (needs a reason; invoices with payments can't be voided).
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const doVoid = async () => {
    const res: any = await financeService.voidInvoice(voidTarget.id, voidReason.trim());
    if (res?.success === false) { showToast.error(res.error || 'Could not void the invoice'); throw new Error('void failed'); }
    showToast.success(`${voidTarget.invoice_number} voided. Its fees can be invoiced again.`);
    setVoidTarget(null); setVoidReason('');
    queryClient.invalidateQueries({ queryKey: ['finance-invoices'] });
  };

  // Per-invoice sending state so a double-tap can't send two reminders.
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const remind = async (id: string) => {
    if (remindingId) return;
    setRemindingId(id);
    try {
      const res: any = await financeService.sendInvoiceReminder(id);
      if (res?.success === false) showToast.error(res?.error || res?.message || 'Failed to send reminder');
      else if (res?.data?.emailSent === false) showToast.error(res?.data?.message || 'No email on file for this student or their parent, so no reminder was sent.');
      else showToast.success(res?.data?.message || 'Reminder sent');
    } catch {
      showToast.error('Failed to send reminder');
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <MainLayout>
      <PageShell
        title="Invoices"
        subtitle="Generate and track student fee invoices"
        onRefresh={refetchAll}
        isRefreshing={isLoading || ovLoading}
        actions={
          <div className="flex items-center gap-2">
            <YearFilter value={year} onChange={setYear} includeAllOption />
            <ExportButton endpoint="/api/v1/finance/invoices/export" filename="invoices" params={{ status: statusFilter || undefined, academic_year: year || undefined }} />
            {!viewingPast && !viewingAll && (
              <Button variant="create" size="sm" onClick={() => setGenOpen(true)}><FileStack size={15} className="sm:mr-1.5" /><span className="hidden sm:inline">Generate Invoices</span></Button>
            )}
          </div>
        }
      >
        {(viewingPast || viewingAll) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <span>
              {viewingPast
                ? <>Showing <strong>{year}</strong> invoices as history. Outstanding invoices can still be reminded and paid.</>
                : <>Showing invoices from <strong>all years</strong>.</>}
            </span>
            <button type="button" onClick={() => setYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          </div>
        )}

        <FinanceOverviewCards overview={overview} loading={ovLoading} />

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
          <SearchBar placeholder="Search by invoice # or student…" onSearch={setSearch} isLoading={isLoading} resultCount={search ? filtered.length : undefined} defaultValue={search} className="w-full sm:max-w-md" />
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
            <div className="relative w-full sm:w-40">
              <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All levels</option>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
            <div className="relative w-full sm:w-40">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Void</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
          </div>
        </div>

        {listError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <span>{(listError as Error).message}</span>
            <button type="button" onClick={() => refetch()} className="text-xs font-bold hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          viewingPast || viewingAll
            ? <EmptyState message="No invoices found" description={viewingPast ? `No invoices were issued in ${year}.` : 'No invoices have been issued yet.'} />
            : <EmptyState message="No invoices found" description="Generate invoices from students' outstanding fees." action={{ label: 'Generate Invoices', onClick: () => setGenOpen(true) }} />
        ) : (
          <>
          <SwipeHint />
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] text-xs text-white uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap">Invoice #</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Student</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Class</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Balance</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {pg.pageRows.map((inv, rowIndex) => {
                  const bal = Number(inv.balance) || 0;
                  return (
                    <tr key={inv.id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-gray-700/30 ${rowIndex % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/30' : 'bg-white dark:bg-transparent'}`}>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{inv.invoice_number}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-white">{inv.student_name}</div>
                        <div className="text-xs text-gray-400">{inv.admission_no}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{inv.class_name || '—'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{fmtMoney(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{fmtMoney(inv.balance)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{statusPill(inv.status)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setDetailId(inv.id)} aria-label={`View invoice ${inv.invoice_number}`} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="View"><Eye size={15} /></button>
                          {inv.status !== 'cancelled' && Number(inv.total_paid || 0) <= 0 && (
                            <button onClick={() => { setVoidReason(''); setVoidTarget(inv); }} aria-label={`Void invoice ${inv.invoice_number}`} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title="Void invoice"><Ban size={15} /></button>
                          )}
                          {bal > 0 && inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <>
                              <button onClick={() => remind(inv.id)} disabled={remindingId === inv.id} aria-label="Send reminder" className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50" title="Send reminder">{remindingId === inv.id ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}</button>
                              <PayFeesButton invoiceId={inv.id} size="sm">Pay</PayFeesButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePager {...pg.pager} label="invoices" />
          </div>
          </>
        )}

        {genOpen && (
          <GenerateInvoicesModal academicYear={activeYear} onClose={() => setGenOpen(false)} onDone={() => { setGenOpen(false); queryClient.invalidateQueries({ queryKey: ['finance-invoices'] }); refetchOv(); }} />
        )}
        {detailId && <InvoiceDetailModal invoiceId={detailId} onClose={() => setDetailId(null)} />}
        <ConfirmationDialog
          isOpen={!!voidTarget}
          onClose={() => setVoidTarget(null)}
          onConfirm={doVoid}
          title="Void invoice"
          message={voidTarget ? `Void ${voidTarget.invoice_number} for ${voidTarget.student_name}? The fees stay on the student's account and can be invoiced again.` : ''}
          confirmLabel="Void invoice"
          confirmDisabled={voidReason.trim().length < 5}
        >
          <label htmlFor="void-reason" className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mt-2">Reason (required)</label>
          <textarea id="void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={2} maxLength={500}
            placeholder="e.g. Issued twice by mistake"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
        </ConfirmationDialog>
      </PageShell>
    </MainLayout>
  );
};

// ── Generate invoices (bulk from outstanding fees) ────────────────────────────
type GenScope = 'class' | 'level' | 'all';

const GenerateInvoicesModal: React.FC<{ academicYear: string; onClose: () => void; onDone: () => void }> = ({ academicYear, onClose, onDone }) => {
  const [scope, setScope] = useState<GenScope>('class');
  const [classId, setClassId] = useState('');
  const [level, setLevel] = useState('');
  const [term, setTerm] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Only the active year's classes — invoices are generated for the current year.
  const { data: classesResp } = useQuery({
    queryKey: ['gen-classes', academicYear],
    queryFn: () => classesService.listClasses({ limit: 200, academic_year: academicYear } as any),
    enabled: !!academicYear,
    staleTime: 60_000,
  });
  const classes = ((classesResp as any)?.data?.data ?? (classesResp as any)?.data ?? []) as any[];
  const levels = useMemo(() => Array.from(new Set(classes.map((c: any) => c.level).filter(Boolean))).sort(), [classes]);

  const submit = async () => {
    if (scope === 'class' && !classId) { showToast.error('Select a class'); return; }
    if (scope === 'level' && !level) { showToast.error('Select a level'); return; }
    setSaving(true);
    try {
      const res: any = await financeService.bulkInvoice({ scope, classId: scope === 'class' ? classId : undefined, level: scope === 'level' ? level : undefined, term: term || undefined, academicYear, dueDate: dueDate || undefined });
      if (res?.success === false) { showToast.error(res.error || 'Failed to generate invoices'); return; }
      const gen = Number(res?.data?.generated ?? 0);
      const failed = Number(res?.data?.failed ?? 0);
      if (failed > 0) showToast.error(`Generated ${gen}; ${failed} student${failed === 1 ? '' : 's'} failed. Try again for them.`);
      else showToast.success(gen > 0 ? `Generated ${gen} invoice${gen === 1 ? '' : 's'}` : 'No uninvoiced fees to bundle.');
      onDone();
    } catch (err: any) {
      showToast.error(err?.response?.data?.error || 'Failed to generate invoices');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white">Generate Invoices</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">Bundles each student's outstanding (unbilled) <strong>{academicYear}</strong> fees into a single invoice.</p>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Scope</label>
            <div className="grid grid-cols-3 gap-1 mt-1 bg-gray-100 dark:bg-gray-900/50 rounded-xl p-1">
              {(['class', 'level', 'all'] as GenScope[]).map((s) => (
                <button key={s} onClick={() => setScope(s)} className={`px-2 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${scope === s ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>{s === 'all' ? 'All' : s}</button>
              ))}
            </div>
          </div>
          {scope === 'class' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                <option value="">Select a class…</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.level ? `(${c.level})` : ''}</option>)}
              </select>
            </div>
          )}
          {scope === 'level' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                <option value="">Select a level…</option>
                {levels.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Term (optional)</label>
              <select value={term} onChange={(e) => setTerm(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
                <option value="">All unbilled fees</option>
                {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="create" size="sm" onClick={submit} disabled={saving}>{saving ? 'Generating…' : 'Generate'}</Button>
        </div>
      </div>
    </div>
  );
};

// ── Invoice detail (line items + payments) ────────────────────────────────────
const InvoiceDetailModal: React.FC<{ invoiceId: string; onClose: () => void }> = ({ invoiceId, onClose }) => {
  const { data, isLoading } = useQuery({ queryKey: ['invoice-detail', invoiceId], queryFn: () => financeService.getInvoiceDetail(invoiceId) });
  const detailError = (data as any)?.success === false ? ((data as any).error || 'Could not load this invoice.') : null;
  const detail = (data as any)?.data?.data ?? (data as any)?.data;
  const invoice = detail?.invoice;
  const items = detail?.items ?? [];
  const payments = detail?.payments ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="font-bold text-gray-900 dark:text-white">{invoice?.invoice_number || 'Invoice'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><X size={18} /></button>
        </div>
        {detailError ? (
          <p role="alert" className="p-5 text-sm text-red-600">{detailError}</p>
        ) : isLoading || !invoice ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
        ) : (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-xs text-gray-400">Student</div><div className="font-semibold text-gray-900 dark:text-white">{invoice.student_name}</div><div className="text-xs text-gray-400">{invoice.admission_no}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">Status</div>{statusPill(invoice.status)}</div>
              <div><div className="text-xs text-gray-400">Total</div><div className="font-semibold">{fmtMoney(invoice.total_amount)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">Balance</div><div className="font-semibold text-rose-600">{fmtMoney(invoice.balance)}</div></div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Line items</div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {items.length === 0 ? <p className="text-sm text-gray-400 p-3">No line items.</p> : items.map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <span className="capitalize">{it.type || 'Fee'}</span>
                    <span className="font-medium">{fmtMoney(it.balance ?? it.amount)}{Number(it.balance) !== Number(it.amount) && <span className="ml-1 text-[11px] text-gray-400">of {fmtMoney(it.amount)}</span>}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Payments</div>
              <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {payments.length === 0 ? <p className="text-sm text-gray-400 p-3">No payments yet.</p> : payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <span className="text-gray-500">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : ''} · <span className="capitalize">{p.method}</span></span>
                    <span className="font-medium text-emerald-600">{fmtMoney(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {invoice.status === 'cancelled' && (
              <p className="text-xs text-gray-500">Voided{invoice.void_reason ? `: ${invoice.void_reason}` : ''}.</p>
            )}
            {Number(invoice.balance) > 0 && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <div className="flex justify-end"><PayFeesButton invoiceId={invoice.id}>Pay {fmtMoney(invoice.balance)}</PayFeesButton></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoicesPage;
