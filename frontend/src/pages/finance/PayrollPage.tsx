/**
 * Payroll (bursar Phase B, R4). Tabs:
 *  - Pay runs: generate a month → edit (bonus/overtime, deductions) →
 *    principal approves → mark paid (records the salary expenses) → email payslips.
 *  - Staff pay: basic salary, allowances, deductions, bank, PAYE/NASSIT per staff.
 *  - Settings: PAYE bands and NASSIT rates (principal edits).
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Download, Mail, CheckCircle2, Banknote, RefreshCw, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { ExportButton } from '@components/admin/common/ExportButton';
import { showToast } from '@utils/toast';
import useAuthStore from '@store/authStore';
import { bursarB, type PayRun, type PayStaff, type PayLine } from '@services/bursarService';
import { le, Pill } from '@components/finance/StudentAccount';
import { usePaged, TablePager } from '@components/admin/table/TablePager';

const input = 'w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm';
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const parse = (v: any): PayLine[] => (typeof v === 'string' ? JSON.parse(v || '[]') : v || []);
const RUN_PILL: Record<string, [string, string]> = { draft: ['pending', 'Draft'], approved: ['part_paid', 'Approved'], paid: ['approved', 'Paid'], cancelled: ['revoked', 'Cancelled'] };
async function ok<T>(p: Promise<any>, msg = 'Could not load.'): Promise<T> { const r = await p; if (r?.success === false) throw new Error(r.error || msg); return r.data as T; }

const LinesEditor: React.FC<{ label: string; lines: PayLine[]; onChange: (l: PayLine[]) => void; taxable?: boolean; idp: string }> = ({ label, lines, onChange, taxable, idp }) => (
  <div>
    <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
    {lines.map((l, i) => (
      <div key={i} className="flex gap-2 mb-1.5 items-center">
        <input aria-label={`${label} name`} id={`${idp}-n-${i}`} value={l.name} onChange={(e) => onChange(lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder={taxable ? 'e.g. Transport allowance' : 'e.g. Staff loan repayment'} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        <input aria-label={`${label} amount`} type="number" min={0} value={String(l.amount ?? '')} onChange={(e) => onChange(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value as any } : x)))} placeholder="Amount (Le)" className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        {taxable && <label className="text-[11px] flex items-center gap-1"><input type="checkbox" checked={l.taxable !== false} onChange={(e) => onChange(lines.map((x, j) => (j === i ? { ...x, taxable: e.target.checked } : x)))} /> taxable</label>}
        <button type="button" aria-label="Remove" onClick={() => onChange(lines.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
      </div>
    ))}
    <Button type="button" size="sm" variant="create" onClick={() => onChange([...lines, { name: '', amount: 0, taxable: true }])}><Plus size={13} /> Add</Button>
  </div>
);

// ── Run detail ───────────────────────────────────────────────────────────────
const RunDetail: React.FC<{ runId: string; onClose: () => void; isPrincipal: boolean }> = ({ runId, onClose, isPrincipal }) => {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fin-run', runId], queryFn: () => ok<PayRun>(bursarB.run(runId)) });
  const [slip, setSlip] = useState<any | null>(null);
  const [extras, setExtras] = useState<PayLine[]>([]);
  const [deds, setDeds] = useState<PayLine[]>([]);
  const [act, setAct] = useState<null | 'approve' | 'pay' | 'cancel'>(null);
  const [payDate, setPayDate] = useState(todayLocal());
  const [paidFrom, setPaidFrom] = useState('bank');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const r = q.data;
  const [slipSearch, setSlipSearch] = useState('');
  const slipRows = (r?.payslips || []).filter((s: any) => !slipSearch || `${s.staff_name} ${s.staff_number || ''}`.toLowerCase().includes(slipSearch.toLowerCase()));
  const slipPg = usePaged<any>(slipRows, [runId, slipSearch]);
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') });
  const draft = r?.status === 'draft';
  const doAction = async (a: 'regenerate' | 'approve' | 'pay' | 'cancel' | 'email', body?: any) => {
    const res: any = await bursarB.runAction(runId, a, body);
    if (res?.success === false) { showToast.error(res.error || 'Failed'); throw new Error('x'); }
    if (a === 'email') showToast.success(`${res.data.sent} payslip${res.data.sent === 1 ? '' : 's'} emailed${res.data.skipped ? ` · ${res.data.skipped} without an email` : ''}`);
    else showToast.success({ regenerate: 'Recalculated from staff pay', approve: 'Pay run approved', pay: 'Marked paid. The salary cost is now under School Expenses.', cancel: 'Pay run cancelled' }[a]);
    refresh();
  };
  return (
    <Modal isOpen onClose={onClose} title={r ? `Payroll ${r.period}` : 'Payroll'} size="2xl">
      {q.isLoading || !r ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Pill s={RUN_PILL[r.status][0]} label={RUN_PILL[r.status][1]} /><span className="text-xs text-gray-500">{r.staff_count} staff{r.approved_by_name ? ` · approved by ${r.approved_by_name}` : ''}{r.payment_date ? ` · paid ${String(r.payment_date).slice(0, 10)}${(r as any).paid_from ? ` from ${({ bank: 'bank', cash: 'cash on hand', mobile: 'mobile money' } as Record<string, string>)[(r as any).paid_from] || (r as any).paid_from}` : ''}` : ''}{r.cancelled_reason ? ` · ${r.cancelled_reason}` : ''}</span></div>
            <div className="flex flex-wrap gap-2">
              {draft && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await doAction('regenerate'); } catch { /* toast shown */ } finally { setBusy(false); } }}><RefreshCw size={14} className="mr-1" /> Recalculate</Button>}
              {draft && isPrincipal && <Button size="sm" onClick={() => setAct('approve')}><CheckCircle2 size={14} className="mr-1" /> Approve</Button>}
              {draft && !isPrincipal && <span className="text-xs text-amber-700 self-center">Waiting for the principal to approve</span>}
              {r.status === 'approved' && <Button size="sm" onClick={() => setAct('pay')}><Banknote size={14} className="mr-1" /> Mark paid</Button>}
              {(r.status === 'approved' || r.status === 'paid') && <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await doAction('email'); } catch { /* toast shown */ } finally { setBusy(false); } }}><Mail size={14} className="mr-1" /> Email payslips</Button>}
              <ExportButton endpoint={`/api/v1/finance/payroll/runs/${r.id}/export`} filename={`payroll-${r.period}`} params={{}} />
              {r.status !== 'cancelled' && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => { setReason(''); setAct('cancel'); }}>Cancel run</Button>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-sm">
            {[['Gross', r.gross], ['PAYE (to NRA)', r.paye], ['NASSIT staff 5%', r.nassit_employee], ['NASSIT school 10%', r.nassit_employer], ['Other deductions', r.other_deductions], ['Net pay', r.net]].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2.5"><div className="text-[11px] text-gray-500">{l}</div><div className="font-bold">{le(v as any)}</div></div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            {(r.payslips || []).length > 10 && <div className="p-2 border-b border-gray-100 dark:border-gray-800"><input aria-label="Search payslips" placeholder="Search staff name or number…" value={slipSearch} onChange={(e) => setSlipSearch(e.target.value)} className="w-full sm:max-w-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs" /></div>}
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500"><tr><th className="px-3 py-2 text-left">Staff</th><th className="px-3 py-2 text-right">Basic</th><th className="px-3 py-2 text-right">Gross</th><th className="px-3 py-2 text-right">PAYE</th><th className="px-3 py-2 text-right">NASSIT</th><th className="px-3 py-2 text-right">Other</th><th className="px-3 py-2 text-right">Net</th><th className="px-3 py-2" /></tr></thead>
              <tbody>
                {slipPg.pageRows.map((s: any) => (
                  <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2"><div className="font-medium">{s.staff_name}</div><div className="text-[10px] text-gray-400">{s.staff_number} · {String(s.designation || '').replace(/_/g, ' ')}{parse(s.extras).length ? ` · +${parse(s.extras).map((x) => x.name).join(', ')}` : ''}</div></td>
                    <td className="px-3 py-2 text-right">{le(s.basic)}</td><td className="px-3 py-2 text-right">{le(s.gross)}</td><td className="px-3 py-2 text-right">{le(s.paye)}</td><td className="px-3 py-2 text-right">{le(s.nassit_employee)}</td>
                    <td className="px-3 py-2 text-right">{le(Number(s.total_deductions) - Number(s.paye) - Number(s.nassit_employee))}</td><td className="px-3 py-2 text-right font-bold">{le(s.net)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {draft && <button type="button" onClick={() => { setSlip(s); setExtras(parse(s.extras)); setDeds([]); }} className="font-semibold text-blue-600 hover:underline mr-2">Adjust</button>}
                      {draft && <button type="button" aria-label={`Remove ${s.staff_name}`} onClick={async () => { const x: any = await bursarB.removeSlip(s.id); x?.success === false ? showToast.error(x.error || 'Failed') : refresh(); }} className="text-gray-400 hover:text-red-600 mr-2"><Trash2 size={13} /></button>}
                      <button type="button" aria-label={`Download payslip for ${s.staff_name}`} onClick={() => bursarB.downloadSlip(s.id, `${r.period}-${s.staff_number || 'staff'}`).catch((e) => showToast.error(e.message))} className="text-blue-600"><Download size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePager {...slipPg.pager} label="payslips" />
          </div>
        </div>
      )}
      {slip && (
        <Modal isOpen onClose={() => setSlip(null)} title={`Adjust ${slip.staff_name} · ${r?.period}`} size="md"
          footer={<><Button variant="ghost" onClick={() => setSlip(null)}>Cancel</Button><Button onClick={async () => {
            const x: any = await bursarB.editSlip(slip.id, { extras: extras.map((e) => ({ ...e, amount: Number(e.amount) })), one_off_deductions: deds.map((e) => ({ ...e, amount: Number(e.amount) })) });
            if (x?.success === false) return showToast.error(x.error || 'Failed');
            showToast.success('Payslip updated'); setSlip(null); refresh();
          }}>Save</Button></>}>
          <div className="space-y-4">
            <LinesEditor idp="ex" label="One-off pay this month (bonus, overtime…)" lines={extras} onChange={setExtras} taxable />
            <LinesEditor idp="dd" label="One-off deductions this month (salary advance…)" lines={deds} onChange={setDeds} />
            <p className="text-[11px] text-gray-500">Recurring allowances and deductions are set under Staff pay. PAYE and NASSIT are recalculated automatically.</p>
          </div>
        </Modal>
      )}
      <ConfirmationDialog isOpen={act === 'approve'} onClose={() => setAct(null)} isDestructive={false} title="Approve pay run" confirmLabel="Approve"
        message={r ? `Approve payroll ${r.period}: ${r.staff_count} staff, net pay ${le(r.net)}. It can't be changed after approval.` : ''} onConfirm={() => doAction('approve')} />
      <ConfirmationDialog isOpen={act === 'pay'} onClose={() => setAct(null)} isDestructive={false} title="Mark as paid" confirmLabel="Mark paid"
        message={r ? `Record that salaries for ${r.period} were paid. ${le(r.gross)} (salaries) and ${le(r.nassit_employer)} (employer NASSIT) are added to School Expenses.` : ''}
        onConfirm={() => doAction('pay', { payment_date: payDate, paid_from: paidFrom })}>
        <label htmlFor="pay-date-run" className="block text-xs font-semibold text-gray-600 mt-2">Payment date</label>
        <input id="pay-date-run" type="date" max={todayLocal()} value={payDate} onChange={(e) => setPayDate(e.target.value)} className={input} />
        <label htmlFor="pay-from-run" className="block text-xs font-semibold text-gray-600 mt-2">Paid from</label>
        <select id="pay-from-run" value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)} className={input}><option value="bank">Bank</option><option value="cash">Cash on hand</option><option value="mobile">Mobile money</option></select>
        <p className="text-[11px] text-gray-500 mt-1">The net pay comes out of this account in the books.</p>
      </ConfirmationDialog>
      <ConfirmationDialog isOpen={act === 'cancel'} onClose={() => setAct(null)} title="Cancel pay run" confirmLabel="Cancel run" confirmDisabled={reason.trim().length < 5}
        message={r?.status === 'paid' ? 'This run is marked paid: its salary expenses are voided. Make sure no salaries were actually paid.' : 'The run is cancelled; you can generate a new one for the month.'}
        onConfirm={() => doAction('cancel', { reason: reason.trim() })}>
        <label htmlFor="run-cancel-reason" className="block text-xs font-semibold text-gray-600 mt-2">Reason (required)</label>
        <textarea id="run-cancel-reason" rows={2} placeholder="e.g. Wrong month generated" value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
      </ConfirmationDialog>
    </Modal>
  );
};

// ── Staff pay profile editor ─────────────────────────────────────────────────
const ProfileModal: React.FC<{ staff: PayStaff | null; onClose: () => void; onSaved: () => void }> = ({ staff, onClose, onSaved }) => {
  const p = staff?.profile;
  const [basic, setBasic] = useState(String(p?.basic_salary ?? ''));
  const [allow, setAllow] = useState<PayLine[]>(parse(p?.allowances));
  const [deds, setDeds] = useState<PayLine[]>(parse(p?.deductions));
  const [paye, setPaye] = useState(p?.paye_applies !== false);
  const [nassit, setNassit] = useState(p?.nassit_applies !== false);
  const [method, setMethod] = useState(p?.payment_method || 'bank');
  const [bank, setBank] = useState(p?.bank_name || '');
  const [acct, setAcct] = useState(p?.account_number || '');
  const [active, setActive] = useState(p?.active !== false);
  const [saving, setSaving] = useState(false);
  if (!staff) return null;
  return (
    <Modal isOpen onClose={onClose} title={`Pay details · ${staff.name}`} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="create" disabled={saving || !(Number(basic) >= 0)} onClick={async () => {
        setSaving(true);
        try {
          const r: any = await bursarB.saveProfile({ staff_kind: staff.kind, staff_ref_id: staff.ref, basic_salary: Number(basic) || 0, allowances: allow.map((a) => ({ ...a, amount: Number(a.amount) })), deductions: deds.map((a) => ({ ...a, amount: Number(a.amount) })), paye_applies: paye, nassit_applies: nassit, payment_method: method, bank_name: bank, account_number: acct, active });
          if (r?.success === false) return showToast.error(r.error || 'Could not save');
          showToast.success('Pay details saved'); onSaved();
        } finally { setSaving(false); }
      }}>Save</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label htmlFor="pp-basic" className="text-xs font-semibold text-gray-500">Basic monthly salary (Le)</label><input id="pp-basic" type="number" min={0} placeholder="e.g. 3000" className={input} value={basic} onChange={(e) => setBasic(e.target.value)} /></div>
          <div><label htmlFor="pp-method" className="text-xs font-semibold text-gray-500">Paid by</label>
            <select id="pp-method" className={input} value={method} onChange={(e) => setMethod(e.target.value)}><option value="bank">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="cash">Cash</option><option value="cheque">Cheque</option></select></div>
          <div><label htmlFor="pp-bank" className="text-xs font-semibold text-gray-500">Bank / provider</label><input id="pp-bank" placeholder="e.g. SLCB, Orange Money" className={input} value={bank} onChange={(e) => setBank(e.target.value)} /></div>
          <div><label htmlFor="pp-acct" className="text-xs font-semibold text-gray-500">Account / phone number</label><input id="pp-acct" placeholder="e.g. 0011223344 or 076123456" className={input} value={acct} onChange={(e) => setAcct(e.target.value)} /></div>
        </div>
        <LinesEditor idp="al" label="Monthly allowances (transport, housing…)" lines={allow} onChange={setAllow} taxable />
        <LinesEditor idp="de" label="Monthly deductions (loan, union dues…)" lines={deds} onChange={setDeds} />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={paye} onChange={(e) => setPaye(e.target.checked)} /> Deduct PAYE</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={nassit} onChange={(e) => setNassit(e.target.checked)} /> NASSIT applies</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Include in payroll</label>
        </div>
      </div>
    </Modal>
  );
};

// ── Statutory settings ───────────────────────────────────────────────────────
const SettingsTab: React.FC<{ isPrincipal: boolean }> = ({ isPrincipal }) => {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fin-pay-settings'], queryFn: () => ok<any>(bursarB.paySettings()) });
  const [bands, setBands] = useState<any[] | null>(null);
  const [ne, setNe] = useState<string | null>(null);
  const [nr, setNr] = useState<string | null>(null);
  const [after, setAfter] = useState<boolean | null>(null);
  if (!q.data) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
  const b = bands ?? q.data.bands;
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 className="text-sm font-bold mb-1">PAYE monthly bands</h3>
        <p className="text-xs text-gray-500 mb-3">Pre-filled with the Sierra Leone rates (first Le 600 tax-free, then 15%, 20%, 25%, 30% above Le 2,400). Check with the NRA when the Finance Act changes.</p>
        <table className="w-full text-sm"><thead className="text-xs text-gray-500"><tr><th className="text-left">Monthly income up to (Le)</th><th className="text-left">Rate %</th><th /></tr></thead>
          <tbody>{b.map((x: any, i: number) => (
            <tr key={i}>
              <td className="py-1 pr-2"><input aria-label={`Band ${i + 1} upper limit`} placeholder="e.g. 600" disabled={!isPrincipal || i === b.length - 1} value={i === b.length - 1 ? 'and above' : x.upto ?? ''} onChange={(e) => setBands(b.map((y: any, j: number) => (j === i ? { ...y, upto: e.target.value } : y)))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm disabled:opacity-70" /></td>
              <td className="py-1 pr-2"><input aria-label={`Band ${i + 1} rate`} placeholder="%" type="number" min={0} max={100} disabled={!isPrincipal} value={x.rate} onChange={(e) => setBands(b.map((y: any, j: number) => (j === i ? { ...y, rate: e.target.value } : y)))} className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm disabled:opacity-70" /></td>
              <td>{isPrincipal && i < b.length - 1 && b.length > 2 && <button type="button" aria-label="Remove band" onClick={() => setBands(b.filter((_: any, j: number) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>}</td>
            </tr>
          ))}</tbody></table>
        {isPrincipal && <Button type="button" size="sm" variant="create" className="mt-2" onClick={() => setBands([...b.slice(0, -1), { upto: '', rate: 0 }, b[b.length - 1]])}><Plus size={13} /> Add band</Button>}
      </div>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label htmlFor="ns-e" className="text-xs font-semibold text-gray-500">NASSIT employee % (of basic)</label><input id="ns-e" placeholder="5" type="number" disabled={!isPrincipal} value={ne ?? q.data.nassitEmployeePct} onChange={(e) => setNe(e.target.value)} className={input} /></div>
        <div><label htmlFor="ns-r" className="text-xs font-semibold text-gray-500">NASSIT employer % (of basic)</label><input id="ns-r" placeholder="10" type="number" disabled={!isPrincipal} value={nr ?? q.data.nassitEmployerPct} onChange={(e) => setNr(e.target.value)} className={input} /></div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" disabled={!isPrincipal} checked={after ?? q.data.payeAfterNassit} onChange={(e) => setAfter(e.target.checked)} /> Deduct the employee's NASSIT before working out PAYE</label>
      </div>
      {isPrincipal ? (
        <div className="flex gap-2">
          <Button onClick={async () => {
            const r: any = await bursarB.savePaySettings({ bands: b.map((x: any, i: number) => ({ upto: i === b.length - 1 ? null : Number(x.upto), rate: Number(x.rate) })), nassit_employee_pct: Number(ne ?? q.data.nassitEmployeePct), nassit_employer_pct: Number(nr ?? q.data.nassitEmployerPct), paye_after_nassit: after ?? q.data.payeAfterNassit });
            if (r?.success === false) return showToast.error(r.error || 'Could not save');
            showToast.success('Saved. New pay runs use these rates.'); setBands(null); qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') });
          }}>Save rates</Button>
          <Button variant="ghost" onClick={() => setBands(q.data.defaults)}>Reset to Sierra Leone defaults</Button>
        </div>
      ) : <p className="text-xs text-gray-500">Only the principal can change tax and NASSIT rates.</p>}
    </div>
  );
};

export const PayrollPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isPrincipal = user?.role === 'principal' || user?.role === 'super_admin';
  const [tab, setTab] = useState<'runs' | 'staff' | 'settings'>('runs');
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [profile, setProfile] = useState<PayStaff | null>(null);
  const [period, setPeriod] = useState(thisMonth());
  const [genOpen, setGenOpen] = useState(false);
  const [search, setSearch] = useState('');
  const runs = useQuery({ queryKey: ['fin-runs'], queryFn: () => ok<PayRun[]>(bursarB.runs(), 'Could not load pay runs.') });
  const staff = useQuery({ queryKey: ['fin-pay-staff'], queryFn: () => ok<PayStaff[]>(bursarB.payStaff()), enabled: tab === 'staff' || genOpen });
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') });
  const missing = (staff.data || []).filter((s) => s.active && !(s.profile && Number(s.profile.basic_salary) > 0));
  const staffRows = (staff.data || []).filter((s) => !search || `${s.name} ${s.staff_number || ''} ${s.designation || ''}`.toLowerCase().includes(search.toLowerCase()));
  const runPg = usePaged(runs.data || [], []);
  const staffPg = usePaged(staffRows, [search]);

  return (
    <MainLayout>
      <PageShell title="Payroll" subtitle="Monthly salaries, PAYE and NASSIT, payslips"
        actions={tab === 'runs' ? <Button size="sm" variant="create" onClick={() => setGenOpen(true)}><Plus size={15} className="sm:mr-1.5" /><span className="hidden sm:inline">New pay run</span></Button> : undefined}>
        <div role="tablist" aria-label="Payroll" className="mb-4 inline-flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-900/50 p-1">
          {([['runs', 'Pay runs'], ['staff', 'Staff pay'], ['settings', 'PAYE & NASSIT']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === k ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>{l}</button>
          ))}
        </div>

        {tab === 'runs' && (runs.error ? <p role="alert" className="text-sm text-red-600">{(runs.error as Error).message}</p>
          : runs.isLoading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : (runs.data || []).length === 0 ? <EmptyState message="No pay runs yet" description="Set each staff member's salary under Staff pay, then start a pay run for the month." action={{ label: 'Staff pay', onClick: () => setTab('staff') }} />
          : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500"><tr><th className="px-3 py-3 text-left">Month</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-right">Staff</th><th className="px-3 py-3 text-right">Gross</th><th className="px-3 py-3 text-right">PAYE</th><th className="px-3 py-3 text-right">NASSIT (5% + 10%)</th><th className="px-3 py-3 text-right">Net</th><th className="px-3 py-3" /></tr></thead>
                <tbody>
                  {runPg.pageRows.map((r) => (
                    <tr key={r.id} className={`border-t border-gray-100 dark:border-gray-800 ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-2.5 font-semibold">{r.period}</td>
                      <td className="px-3 py-2.5"><Pill s={RUN_PILL[r.status][0]} label={RUN_PILL[r.status][1]} /></td>
                      <td className="px-3 py-2.5 text-right">{r.staff_count}</td>
                      <td className="px-3 py-2.5 text-right">{le(r.gross)}</td><td className="px-3 py-2.5 text-right">{le(r.paye)}</td>
                      <td className="px-3 py-2.5 text-right">{le(Number(r.nassit_employee) + Number(r.nassit_employer))}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{le(r.net)}</td>
                      <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => setOpenRun(r.id)} className="text-xs font-semibold text-blue-600 hover:underline">Open</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePager {...runPg.pager} label="pay runs" />
            </div>
          ))}

        {tab === 'staff' && (
          <>
            {missing.length > 0 && <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">{missing.length} active staff member{missing.length === 1 ? ' has' : 's have'} no salary set and won't be paid.</div>}
            <SearchBar placeholder="Search staff…" onSearch={setSearch} className="w-full sm:max-w-sm mb-3" />
            {staff.isLoading ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500"><tr><th className="px-3 py-3 text-left">Staff</th><th className="px-3 py-3 text-left">Type</th><th className="px-3 py-3 text-right">Basic</th><th className="px-3 py-3 text-right">Gross</th><th className="px-3 py-3 text-right">PAYE</th><th className="px-3 py-3 text-right">Net (est.)</th><th className="px-3 py-3" /></tr></thead>
                  <tbody>
                    {staffPg.pageRows.map((s) => (
                      <tr key={`${s.kind}:${s.ref}`} className={`border-t border-gray-100 dark:border-gray-800 ${!s.active ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-2.5"><div className="font-medium">{s.name}</div><div className="text-[11px] text-gray-400">{s.staff_number} · {String(s.designation || '').replace(/_/g, ' ')}{!s.active ? ' · inactive' : ''}</div></td>
                        <td className="px-3 py-2.5 text-xs">{s.kind === 'support' ? 'Support' : 'Professional'}</td>
                        <td className="px-3 py-2.5 text-right">{s.profile ? le(s.profile.basic_salary) : <span className="text-amber-600">Not set</span>}</td>
                        <td className="px-3 py-2.5 text-right">{s.preview ? le(s.preview.gross) : '—'}</td>
                        <td className="px-3 py-2.5 text-right">{s.preview ? le(s.preview.paye) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{s.preview ? le(s.preview.net) : '—'}</td>
                        <td className="px-3 py-2.5 text-right">{s.profile ? <button type="button" onClick={() => setProfile(s)} className="text-xs font-semibold text-blue-600 hover:underline">Edit</button> : <Button type="button" size="sm" variant="create" onClick={() => setProfile(s)}>Set salary</Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePager {...staffPg.pager} label="staff" />
              </div>
            )}
          </>
        )}

        {tab === 'settings' && <SettingsTab isPrincipal={isPrincipal} />}

        {genOpen && (
          <Modal isOpen onClose={() => setGenOpen(false)} title="New pay run" size="sm"
            footer={<><Button variant="ghost" onClick={() => setGenOpen(false)}>Cancel</Button><Button variant="create" onClick={async () => {
              const r: any = await bursarB.generateRun(period);
              if (r?.success === false) return showToast.error(r.error || 'Could not create the pay run');
              showToast.success(`Draft created for ${period}`); setGenOpen(false); refresh(); setOpenRun(r.data.id);
            }}>Create draft</Button></>}>
            <label htmlFor="pr-month" className="text-xs font-semibold text-gray-500">Month</label>
            <input id="pr-month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={input} />
            <p className="mt-2 text-xs text-gray-500">Creates a payslip for everyone with a salary set. You can add bonuses or deductions before the principal approves.</p>
            {missing.length > 0 && <p className="mt-2 text-xs text-amber-700">{missing.length} active staff have no salary set and won't be included.</p>}
          </Modal>
        )}
        {openRun && <RunDetail runId={openRun} onClose={() => setOpenRun(null)} isPrincipal={isPrincipal} />}
        <ProfileModal key={profile ? `${profile.kind}:${profile.ref}` : 'none'} staff={profile} onClose={() => setProfile(null)} onSaved={() => { setProfile(null); refresh(); }} />
      </PageShell>
    </MainLayout>
  );
};

export default PayrollPage;
