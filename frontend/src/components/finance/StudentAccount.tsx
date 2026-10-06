/**
 * StudentAccount: one student's whole fee account for the bursar (Phase A).
 * Tabs: Statement (brought forward, running balance, PDF, waive late fees),
 * Discounts, Credit, Instalment plan, Receipts. Opened from any finance page.
 * Read-only parts are reused by parents/students (`viewer` mode).
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Download, Mail, FileText, Percent, Wallet, CalendarClock, Receipt } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { bursarService, TERMS, type Statement, type PlanSchedule, type ReceiptRow } from '@services/bursarService';

export const le = (v: number | string | null | undefined) =>
  `Le ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function ok<T>(p: Promise<any>, msg = 'Could not load.'): Promise<T> {
  const r = await p;
  if (r?.success === false) throw new Error(r.error || msg);
  return r?.data as T;
}

const ErrorLine: React.FC<{ error: unknown; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
    <span>{(error as Error)?.message || 'Could not load.'}</span>
    {onRetry && <button type="button" onClick={onRetry} className="font-bold hover:underline">Retry</button>}
  </div>
);

const ReasonField: React.FC<{ id: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ id, value, onChange, placeholder }) => (
  <>
    <label htmlFor={id} className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mt-2">Reason (required)</label>
    <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={2} maxLength={500} placeholder={placeholder}
      className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
  </>
);

const PILL: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700', part_paid: 'bg-blue-50 text-blue-700', due: 'bg-gray-100 text-gray-600', overdue: 'bg-red-50 text-red-700',
  approved: 'bg-emerald-50 text-emerald-700', pending: 'bg-amber-50 text-amber-700', rejected: 'bg-gray-100 text-gray-500', revoked: 'bg-gray-100 text-gray-500',
  refunded: 'bg-gray-100 text-gray-500', part_refunded: 'bg-amber-50 text-amber-700',
};
export const Pill: React.FC<{ s: string; label?: string }> = ({ s, label }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PILL[s] || 'bg-gray-100 text-gray-600'}`}>{label || s.replace(/_/g, ' ')}</span>
);

// ── Statement ────────────────────────────────────────────────────────────────
export const StatementPanel: React.FC<{ studentId: string; label: string; year: string; staff?: boolean }> = ({ studentId, label, year, staff }) => {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fin-statement', studentId, year], queryFn: () => ok<Statement>(bursarService.statement(studentId, year)), enabled: !!studentId && !!year });
  const [waive, setWaive] = useState<{ feeId: string; desc: string } | null>(null);
  const [reason, setReason] = useState('');
  const st = q.data;
  if (q.isLoading) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
  if (q.error) return <ErrorLine error={q.error} onRetry={() => q.refetch()} />;
  if (!st) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="text-gray-500">Owed now: </span><strong className={st.closing_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>{le(st.closing_balance)}</strong>
          {st.account_credit > 0 && <span className="ml-3 text-emerald-700">Credit available: {le(st.account_credit)}</span>}
        </div>
        <Button size="sm" variant="outline" onClick={() => bursarService.downloadStatement(studentId, year, label).catch((e) => showToast.error(e.message))}>
          <Download size={14} className="mr-1" /> Statement PDF
        </Button>
      </div>
      {st.opening_balance > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          Balance brought forward from {st.brought_forward_years.join(', ') || 'earlier years'}: <strong>{le(st.opening_balance)}</strong>. It is still owed and can be paid now.
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500">
            <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Charges</th><th className="px-3 py-2 text-right">Credits</th><th className="px-3 py-2 text-right">Balance</th>{staff && <th className="px-3 py-2" />}</tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 dark:border-gray-800 font-semibold"><td className="px-3 py-2" /><td className="px-3 py-2">Brought forward</td><td /><td /><td className="px-3 py-2 text-right">{le(st.opening_balance)}</td>{staff && <td />}</tr>
            {st.lines.length === 0 && <tr><td colSpan={staff ? 6 : 5} className="px-3 py-4 text-center text-gray-400">No charges in {st.academic_year}.</td></tr>}
            {st.lines.map((l, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-3 py-2 whitespace-nowrap text-gray-500">{l.date}</td>
                <td className="px-3 py-2">{l.description}{l.reference && <span className="ml-1 font-mono text-[10px] text-gray-400">{l.reference}</span>}</td>
                <td className="px-3 py-2 text-right">{l.debit ? le(l.debit) : ''}</td>
                <td className="px-3 py-2 text-right text-emerald-700">{l.credit ? le(l.credit) : ''}</td>
                <td className="px-3 py-2 text-right font-semibold">{le(l.balance)}</td>
                {staff && <td className="px-3 py-2 text-right">
                  {l.kind === 'late_fee' && l.fee_id && Number(l.outstanding) > 0 && (
                    <button type="button" onClick={() => { setReason(''); setWaive({ feeId: l.fee_id!, desc: l.description }); }} className="text-[11px] font-semibold text-blue-600 hover:underline">Waive</button>
                  )}
                </td>}
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold"><td /><td className="px-3 py-2">Closing balance</td><td className="px-3 py-2 text-right">{le(st.totals.charges)}</td><td className="px-3 py-2 text-right">{le(st.totals.credits)}</td><td className="px-3 py-2 text-right">{le(st.closing_balance)}</td>{staff && <td />}</tr>
          </tbody>
        </table>
      </div>
      {!st.reconciles && staff && <p className="text-[11px] text-amber-700">The lines don't add up to the live balance (older records made before itemised tracking). The live balance is shown as the closing balance.</p>}
      <ConfirmationDialog isOpen={!!waive} onClose={() => setWaive(null)} title="Waive late fee" isDestructive={false} confirmLabel="Waive"
        message={waive ? `Waive "${waive.desc}"? What is still owed on it is written off.` : ''} confirmDisabled={reason.trim().length < 5}
        onConfirm={async () => {
          const r: any = await bursarService.waiveLateFee(waive!.feeId, reason.trim());
          if (r?.success === false) { showToast.error(r.error || 'Could not waive'); throw new Error('x'); }
          showToast.success('Late fee waived');
          qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') || String(x.queryKey[0]).startsWith('finance-') });
        }}>
        <ReasonField id="waive-reason" value={reason} onChange={setReason} placeholder="e.g. Paid late because of a bank delay" />
      </ConfirmationDialog>
    </div>
  );
};

// ── Discounts for one student ────────────────────────────────────────────────
export const GrantDiscountForm: React.FC<{ studentId: string; year: string; onDone: () => void }> = ({ studentId, year, onDone }) => {
  const rulesQ = useQuery({ queryKey: ['fin-rules'], queryFn: () => ok<any[]>(bursarService.listRules()) });
  const rules = (rulesQ.data || []).filter((r) => r.active);
  const [ruleId, setRuleId] = useState('');
  const [term, setTerm] = useState('');
  const [basis, setBasis] = useState<'percent' | 'fixed'>('fixed');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('Waiver');
  const [appliesTo, setAppliesTo] = useState<'tuition' | 'all'>('all');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const oneOff = ruleId === '';
  const submit = async () => {
    setSaving(true);
    try {
      const r: any = await bursarService.grant({
        student_id: studentId, academic_year: year, term: term || null, reason: reason.trim() || undefined,
        ...(oneOff ? { label, basis, value: Number(value), applies_to: appliesTo } : { rule_id: ruleId }),
      });
      if (r?.success === false) { showToast.error(r.error || 'Could not give the discount'); return; }
      showToast.success(r.data.needsApproval ? 'Sent to the principal for approval.' : `Approved. ${le(r.data.applied)} taken off the fees.`);
      setValue(''); setReason('');
      onDone();
    } finally { setSaving(false); }
  };
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label htmlFor="g-rule" className="text-xs font-semibold text-gray-500">Discount</label>
          <select id="g-rule" value={ruleId} onChange={(e) => setRuleId(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
            <option value="">One-off waiver…</option>
            {rules.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.basis === 'percent' ? `${Number(r.value)}%` : le(r.value)})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="g-term" className="text-xs font-semibold text-gray-500">Covers</label>
          <select id="g-term" value={term} onChange={(e) => setTerm(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
            <option value="">Whole year ({year})</option>
            {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      {oneOff && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2 sm:col-span-1"><label htmlFor="g-label" className="text-xs font-semibold text-gray-500">Name</label>
            <input id="g-label" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" /></div>
          <div><label htmlFor="g-basis" className="text-xs font-semibold text-gray-500">Type</label>
            <select id="g-basis" value={basis} onChange={(e) => setBasis(e.target.value as any)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"><option value="fixed">Amount (Le)</option><option value="percent">Percent</option></select></div>
          <div><label htmlFor="g-value" className="text-xs font-semibold text-gray-500">{basis === 'percent' ? '%' : 'Le'}</label>
            <input id="g-value" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" /></div>
          <div><label htmlFor="g-applies" className="text-xs font-semibold text-gray-500">On</label>
            <select id="g-applies" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as any)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"><option value="all">All charges</option><option value="tuition">Tuition only</option></select></div>
        </div>
      )}
      <ReasonField id="g-reason" value={reason} onChange={setReason} placeholder={oneOff ? 'Why is this waived? (required)' : 'Optional note (required for custom discounts)'} />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={saving || (oneOff && (!(Number(value) > 0) || reason.trim().length < 5))}>{saving ? 'Saving…' : 'Give discount'}</Button>
      </div>
    </div>
  );
};

export const StudentDiscounts: React.FC<{ studentId: string; year: string }> = ({ studentId, year }) => {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fin-grants', studentId, year], queryFn: () => ok<any[]>(bursarService.listGrants({ student_id: studentId, academic_year: year })) });
  const [revoke, setRevoke] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') || String(x.queryKey[0]).startsWith('finance-') });
  return (
    <div className="space-y-3">
      {q.error && <ErrorLine error={q.error} onRetry={() => q.refetch()} />}
      {(q.data || []).length === 0 && !q.isLoading && <p className="text-xs text-gray-400">No discounts in {year}.</p>}
      {(q.data || []).map((g) => (
        <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2 text-sm">
          <div>
            <div className="font-medium">{g.label} <span className="text-xs text-gray-500">{g.basis === 'percent' ? `${Number(g.value)}%` : le(g.value)} · {g.term || 'whole year'} · {g.applies_to === 'all' ? 'all charges' : 'tuition'}</span></div>
            <div className="text-[11px] text-gray-500">{g.reason || ''}{g.status === 'approved' ? ` · ${le(g.applied_amount)} taken off` : ''}{g.decision_reason && g.status !== 'approved' ? ` · ${g.decision_reason}` : ''}</div>
          </div>
          <div className="flex items-center gap-2">
            <Pill s={g.status} />
            {(g.status === 'approved' || g.status === 'pending') && (
              <button type="button" onClick={() => { setReason(''); setRevoke(g); }} className="text-[11px] font-semibold text-red-600 hover:underline">{g.status === 'pending' ? 'Withdraw' : 'Revoke'}</button>
            )}
          </div>
        </div>
      ))}
      <GrantDiscountForm studentId={studentId} year={year} onDone={refresh} />
      <ConfirmationDialog isOpen={!!revoke} onClose={() => setRevoke(null)} title={revoke?.status === 'pending' ? 'Withdraw request' : 'Revoke discount'} confirmLabel={revoke?.status === 'pending' ? 'Withdraw' : 'Revoke'}
        message={revoke ? `${revoke.status === 'pending' ? 'Withdraw' : 'Revoke'} "${revoke.label}"? ${revoke.status === 'approved' ? `${le(revoke.applied_amount)} will be owed again.` : ''}` : ''}
        confirmDisabled={reason.trim().length < 5}
        onConfirm={async () => {
          const r: any = await bursarService.decide(revoke.id, 'revoke', reason.trim());
          if (r?.success === false) { showToast.error(r.error || 'Could not revoke'); throw new Error('x'); }
          showToast.success('Done'); refresh();
        }}>
        <ReasonField id="revoke-reason" value={reason} onChange={setReason} />
      </ConfirmationDialog>
    </div>
  );
};

// ── Credit ───────────────────────────────────────────────────────────────────
export const StudentCredit: React.FC<{ studentId: string; staff?: boolean }> = ({ studentId, staff }) => {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fin-credit', studentId], queryFn: () => ok<{ balance: number; entries: any[] }>(bursarService.credit(studentId)) });
  const [mode, setMode] = useState<'note' | 'refund' | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') || String(x.queryKey[0]).startsWith('finance-') });
  const bal = q.data?.balance || 0;
  const KIND: Record<string, string> = { overpayment: 'Overpayment', credit_note: 'Credit note', applied: 'Applied to fees', refunded: 'Refunded in cash' };
  return (
    <div className="space-y-3">
      {q.error && <ErrorLine error={q.error} onRetry={() => q.refetch()} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">Available credit: <strong className="text-emerald-700">{le(bal)}</strong></div>
        {staff && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setAmount(''); setReason(''); setMode('note'); }}>Credit note</Button>
            <Button size="sm" variant="outline" disabled={bal <= 0} onClick={async () => {
              const r: any = await bursarService.applyCredit(studentId);
              if (r?.success === false) return showToast.error(r.error || 'Could not apply credit');
              showToast.success(`${le(r.data.applied)} applied to fees`); refresh();
            }}>Apply to fees</Button>
            <Button size="sm" variant="outline" disabled={bal <= 0} onClick={() => { setAmount(String(bal)); setReason(''); setMode('refund'); }}>Refund</Button>
          </div>
        )}
      </div>
      {(q.data?.entries || []).length === 0 ? <p className="text-xs text-gray-400">No credit history.</p> : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
          {q.data!.entries.map((e) => (
            <li key={e.id} className="flex justify-between py-1.5"><span>{KIND[e.kind] || e.kind}{e.reason ? ` · ${e.reason}` : ''} <span className="text-gray-400">{String(e.created_at).slice(0, 10)}</span></span><span className={Number(e.amount) >= 0 ? 'text-emerald-700' : 'text-gray-600'}>{Number(e.amount) >= 0 ? '+' : '−'}{le(Math.abs(Number(e.amount)))}</span></li>
          ))}
        </ul>
      )}
      <ConfirmationDialog isOpen={!!mode} onClose={() => setMode(null)} isDestructive={mode === 'refund'}
        title={mode === 'note' ? 'Issue a credit note' : 'Refund credit in cash'} confirmLabel={mode === 'note' ? 'Issue credit' : 'Refund'}
        message={mode === 'note' ? 'Adds credit to this student\'s account without cash (for example after a withdrawal or a billing error).' : 'Records that the credit was handed back in cash.'}
        confirmDisabled={!(Number(amount) > 0) || reason.trim().length < 5}
        onConfirm={async () => {
          const r: any = mode === 'note' ? await bursarService.creditNote(studentId, Number(amount), reason.trim()) : await bursarService.refundCredit(studentId, Number(amount), reason.trim());
          if (r?.success === false) { showToast.error(r.error || 'Failed'); throw new Error('x'); }
          showToast.success('Saved'); refresh();
        }}>
        <label htmlFor="credit-amount" className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mt-2">Amount (Le)</label>
        <input id="credit-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
        <ReasonField id="credit-reason" value={reason} onChange={setReason} />
      </ConfirmationDialog>
    </div>
  );
};

// ── Instalment plan ──────────────────────────────────────────────────────────
export const PlanView: React.FC<{ plan: PlanSchedule }> = ({ plan }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="font-semibold">{plan.academic_year}{plan.term ? ` · ${plan.term}` : ''} · {plan.installments.length} instalments of {le(plan.total_amount)}</div>
      <Pill s={plan.status === 'active' ? (plan.has_overdue ? 'overdue' : 'approved') : 'rejected'} label={plan.status === 'active' ? (plan.has_overdue ? 'Behind' : 'On track') : plan.status} />
    </div>
    {plan.next_due && plan.status === 'active' && <p className="text-xs">Next due: <strong>{le(plan.next_due.remaining)}</strong> by {plan.next_due.due_date}{plan.overdue_amount > 0 ? <span className="text-red-600"> · {le(plan.overdue_amount)} overdue</span> : ''}</p>}
    <table className="w-full text-xs">
      <tbody>
        {plan.installments.map((i) => (
          <tr key={i.number} className="border-t border-gray-100 dark:border-gray-800">
            <td className="py-1.5">#{i.number}</td><td>{i.due_date}</td><td className="text-right">{le(i.amount)}</td><td className="text-right text-gray-500">{i.paid > 0 ? `paid ${le(i.paid)}` : ''}</td><td className="text-right"><Pill s={i.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
    {plan.cancelled_reason && <p className="text-[11px] text-gray-500">Cancelled: {plan.cancelled_reason}</p>}
  </div>
);

export const StudentPlans: React.FC<{ studentId: string; year: string; staff?: boolean }> = ({ studentId, year, staff }) => {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fin-plans', studentId], queryFn: () => ok<PlanSchedule[]>(bursarService.studentPlans(studentId)) });
  const [count, setCount] = useState('3');
  const [first, setFirst] = useState('');
  const [gap, setGap] = useState('1');
  const [term, setTerm] = useState('');
  const [cancel, setCancel] = useState<PlanSchedule | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') });
  const active = (q.data || []).filter((p) => p.status === 'active');
  return (
    <div className="space-y-3">
      {q.error && <ErrorLine error={q.error} onRetry={() => q.refetch()} />}
      {(q.data || []).length === 0 && !q.isLoading && <p className="text-xs text-gray-400">No instalment plan.</p>}
      {(q.data || []).map((p) => (
        <div key={p.id}>
          <PlanView plan={p} />
          {staff && p.status === 'active' && <button type="button" onClick={() => { setReason(''); setCancel(p); }} className="mt-1 text-[11px] font-semibold text-red-600 hover:underline">Cancel plan</button>}
        </div>
      ))}
      {staff && active.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-3 space-y-2">
          <p className="text-xs text-gray-500">Split what is owed for {year} into dated instalments. While the family keeps to the dates, no overdue status or late fee is added.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><label htmlFor="p-term" className="text-xs font-semibold text-gray-500">Covers</label>
              <select id="p-term" value={term} onChange={(e) => setTerm(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"><option value="">Whole year</option>{TERMS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label htmlFor="p-count" className="text-xs font-semibold text-gray-500">Instalments</label>
              <input id="p-count" type="number" min={2} max={24} value={count} onChange={(e) => setCount(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" /></div>
            <div><label htmlFor="p-first" className="text-xs font-semibold text-gray-500">First due</label>
              <input id="p-first" type="date" value={first} onChange={(e) => setFirst(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" /></div>
            <div><label htmlFor="p-gap" className="text-xs font-semibold text-gray-500">Months apart</label>
              <input id="p-gap" type="number" min={1} max={6} value={gap} onChange={(e) => setGap(e.target.value)} className="w-full mt-1 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" /></div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={saving || !first} onClick={async () => {
              setSaving(true);
              try {
                const r: any = await bursarService.createPlan({ student_id: studentId, academic_year: year, term: term || null, count: Number(count), first_due_date: first, months_apart: Number(gap) });
                if (r?.success === false) return showToast.error(r.error || 'Could not create the plan');
                showToast.success('Instalment plan created'); refresh();
              } finally { setSaving(false); }
            }}>{saving ? 'Saving…' : 'Create plan'}</Button>
          </div>
        </div>
      )}
      <ConfirmationDialog isOpen={!!cancel} onClose={() => setCancel(null)} title="Cancel instalment plan" confirmLabel="Cancel plan"
        message="The fees stay owed; normal due dates, reminders and late fees apply again." confirmDisabled={reason.trim().length < 5}
        onConfirm={async () => {
          const r: any = await bursarService.cancelPlan(cancel!.id, reason.trim());
          if (r?.success === false) { showToast.error(r.error || 'Failed'); throw new Error('x'); }
          showToast.success('Plan cancelled'); refresh();
        }}>
        <ReasonField id="plan-reason" value={reason} onChange={setReason} />
      </ConfirmationDialog>
    </div>
  );
};

// ── Receipts ─────────────────────────────────────────────────────────────────
export const ReceiptsList: React.FC<{ studentId: string; staff?: boolean }> = ({ studentId, staff }) => {
  const q = useQuery({ queryKey: ['fin-receipts', studentId], queryFn: () => ok<ReceiptRow[]>(bursarService.studentReceipts(studentId)) });
  const [busy, setBusy] = useState<string | null>(null);
  if (q.isLoading) return <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;
  if (q.error) return <ErrorLine error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data || [];
  if (!rows.length) return <p className="text-xs text-gray-400">No payments yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Receipt</th><th className="px-3 py-2 text-left">Method</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2" /><th className="px-3 py-2" /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.receipt_number} className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-3 py-2 whitespace-nowrap">{String(r.date).slice(0, 10)}</td>
              <td className="px-3 py-2 font-mono">{r.receipt_number}</td>
              <td className="px-3 py-2">{r.method_label}</td>
              <td className="px-3 py-2 text-right font-semibold">{le(r.amount)}</td>
              <td className="px-3 py-2">{r.status !== 'paid' && <Pill s={r.status} />}</td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <button type="button" aria-label={`Download receipt ${r.receipt_number}`} disabled={busy === r.receipt_number}
                  onClick={async () => { setBusy(r.receipt_number); try { await bursarService.downloadReceipt(r.receipt_number); } catch (e: any) { showToast.error(e.message); } finally { setBusy(null); } }}
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline mr-3"><Download size={12} /> PDF</button>
                {staff && <button type="button" aria-label={`Email receipt ${r.receipt_number}`}
                  onClick={async () => { const x: any = await bursarService.emailReceipt(r.receipt_number); x?.success === false ? showToast.error(x.error || 'Not sent') : showToast.success(`Sent to ${x.data.to}`); }}
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"><Mail size={12} /> Email</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── The staff modal ──────────────────────────────────────────────────────────
type Tab = 'statement' | 'discounts' | 'credit' | 'plan' | 'receipts';
const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'statement', label: 'Statement', icon: <FileText size={14} /> },
  { id: 'discounts', label: 'Discounts', icon: <Percent size={14} /> },
  { id: 'credit', label: 'Credit', icon: <Wallet size={14} /> },
  { id: 'plan', label: 'Instalments', icon: <CalendarClock size={14} /> },
  { id: 'receipts', label: 'Receipts', icon: <Receipt size={14} /> },
];

export const StudentAccountModal: React.FC<{ student: { id: string; name: string; admissionNo?: string } | null; onClose: () => void; initialTab?: Tab }> = ({ student, onClose, initialTab = 'statement' }) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { activeYear } = useAcademicYears();
  const [picked, setPicked] = useState('');
  const year = picked || activeYear;
  if (!student) return null;
  return (
    <Modal isOpen={!!student} onClose={onClose} title={`${student.name}${student.admissionNo ? ` · ${student.admissionNo}` : ''}`} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Student account" className="flex flex-wrap gap-1 rounded-xl bg-gray-100 dark:bg-gray-900/50 p-1">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === t.id ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}>{t.icon}{t.label}</button>
            ))}
          </div>
          {(tab === 'statement' || tab === 'discounts' || tab === 'plan') && <YearFilter value={year} onChange={(y) => setPicked(!y || y === activeYear ? '' : y)} noAutoSelect />}
        </div>
        {!year ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : (
          <>
            {tab === 'statement' && <StatementPanel studentId={student.id} label={student.admissionNo || student.name} year={year} staff />}
            {tab === 'discounts' && <StudentDiscounts studentId={student.id} year={year} />}
            {tab === 'credit' && <StudentCredit studentId={student.id} staff />}
            {tab === 'plan' && <StudentPlans studentId={student.id} year={year} staff />}
            {tab === 'receipts' && <ReceiptsList studentId={student.id} staff />}
          </>
        )}
      </div>
    </Modal>
  );
};

export default StudentAccountModal;
