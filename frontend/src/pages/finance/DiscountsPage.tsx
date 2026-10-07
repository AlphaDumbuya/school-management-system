/**
 * Discounts & Scholarships (bursar Phase A, R1).
 * Tabs: Discounts given (per year, with principal approval of pending ones),
 * and Discount types (sibling, staff child, scholarship/bursary, custom).
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { showToast } from '@utils/toast';
import useAuthStore from '@store/authStore';
import { bursarService, type DiscountRule, type DiscountGrant } from '@services/bursarService';
import { StudentPicker, type PickedStudent } from '@components/finance/StudentPicker';
import { GrantDiscountForm, StudentAccountModal, Pill, le } from '@components/finance/StudentAccount';
import { usePaged, TablePager } from '@components/admin/table/TablePager';

const KIND_LABEL: Record<string, string> = { sibling: 'Sibling', staff_child: 'Staff child', scholarship: 'Scholarship / bursary', custom: 'Custom' };
async function ok<T>(p: Promise<any>): Promise<T> { const r = await p; if (r?.success === false) throw new Error(r.error || 'Could not load.'); return r?.data as T; }

const RuleModal: React.FC<{ rule: Partial<DiscountRule> | null; onClose: () => void; onSaved: () => void }> = ({ rule, onClose, onSaved }) => {
  const [f, setF] = useState<Partial<DiscountRule>>(rule || {});
  const [saving, setSaving] = useState(false);
  if (!rule) return null;
  const set = (k: keyof DiscountRule, v: any) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...f, value: Number(f.value), sibling_order: f.kind === 'sibling' ? Number(f.sibling_order || 2) : null };
      const r: any = f.id ? await bursarService.updateRule(f.id, body) : await bursarService.createRule(body);
      if (r?.success === false) return showToast.error(r.error || 'Could not save');
      showToast.success('Saved'); onSaved();
    } finally { setSaving(false); }
  };
  const input = 'w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm';
  return (
    <Modal isOpen onClose={onClose} title={f.id ? 'Edit discount type' : 'New discount type'} size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="create" onClick={save} disabled={saving || !f.name || !(Number(f.value) > 0) || !f.kind || !f.basis}>{saving ? 'Saving…' : 'Save'}</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label htmlFor="r-name" className="text-xs font-semibold text-gray-500">Name</label><input id="r-name" className={input} value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder={f.kind === 'custom' ? 'Type your own discount name, e.g. Orphan support' : 'e.g. Second child discount'} /></div>
        <div><label htmlFor="r-kind" className="text-xs font-semibold text-gray-500">Type</label>
          <select id="r-kind" className={input} value={f.kind || ''} onChange={(e) => set('kind', e.target.value)}><option value="" disabled>Choose…</option>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {f.kind === 'sibling' && <div><label htmlFor="r-order" className="text-xs font-semibold text-gray-500">From which child</label>
          <select id="r-order" className={input} value={String(f.sibling_order || 2)} onChange={(e) => set('sibling_order', Number(e.target.value))}><option value="2">2nd child and later</option><option value="3">3rd child and later</option><option value="4">4th child and later</option></select></div>}
        <div><label htmlFor="r-basis" className="text-xs font-semibold text-gray-500">Discount is</label>
          <select id="r-basis" className={input} value={f.basis || ''} onChange={(e) => set('basis', e.target.value)}><option value="" disabled>Choose…</option><option value="percent">A percentage</option><option value="fixed">A fixed amount (Le)</option></select></div>
        <div><label htmlFor="r-value" className="text-xs font-semibold text-gray-500">{f.basis === 'percent' ? 'Percent' : 'Amount (Le)'}</label><input id="r-value" type="number" min={0} placeholder={f.basis === 'percent' ? 'e.g. 10' : 'e.g. 200'} max={f.basis === 'percent' ? 100 : undefined} className={input} value={String(f.value ?? '')} onChange={(e) => set('value', e.target.value)} /></div>
        <div><label htmlFor="r-applies" className="text-xs font-semibold text-gray-500">Applies to</label>
          <select id="r-applies" className={input} value={f.applies_to || 'tuition'} onChange={(e) => set('applies_to', e.target.value)}><option value="tuition">Tuition only</option><option value="all">All charges</option></select></div>
        {f.id && <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={f.active !== false} onChange={(e) => set('active', e.target.checked)} /> Active</label>}
      </div>
    </Modal>
  );
};

export const DiscountsPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isPrincipal = user?.role === 'principal' || user?.role === 'super_admin';
  const { activeYear } = useAcademicYears();
  const [picked, setPicked] = useState('');
  const year = picked || activeYear;
  const viewingPast = !!year && !!activeYear && year < activeYear;
  const [tab, setTab] = useState<'grants' | 'rules'>('grants');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [ruleEdit, setRuleEdit] = useState<Partial<DiscountRule> | null>(null);
  const [grantFor, setGrantFor] = useState<PickedStudent | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [decide, setDecide] = useState<{ g: DiscountGrant; d: 'approve' | 'reject' | 'revoke' } | null>(null);
  const [givingTo, setGivingTo] = useState<string | null>(null);
  // The bursar may withdraw any request and take back a discount they gave within their own limit.
  const canRevoke = (g: DiscountGrant) => !viewingPast && (g.status === 'pending' || (g.status === 'approved' && (isPrincipal || ((g as any).requested_by === user?.id && (g as any).decided_by === user?.id))));
  const [reason, setReason] = useState('');
  const [account, setAccount] = useState<{ id: string; name: string; admissionNo?: string } | null>(null);
  const [siblingRule, setSiblingRule] = useState<DiscountRule | null>(null);

  const rulesQ = useQuery({ queryKey: ['fin-rules'], queryFn: () => ok<DiscountRule[]>(bursarService.listRules()) });
  const grantsQ = useQuery({ queryKey: ['fin-grants-all', year, status], queryFn: () => ok<DiscountGrant[]>(bursarService.listGrants({ academic_year: year, status })), enabled: !!year });
  const siblingsQ = useQuery({ queryKey: ['fin-siblings', siblingRule?.id, year], queryFn: () => ok<any[]>(bursarService.siblingCandidates(siblingRule!.id, year)), enabled: !!siblingRule && !!year });
  const refresh = () => qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('fin-') || String(x.queryKey[0]).startsWith('finance-') });

  const grants = (grantsQ.data || []).filter((g) => !search || `${g.student_name} ${g.admission_no} ${g.label}`.toLowerCase().includes(search.toLowerCase()));
  const pending = (grantsQ.data || []).filter((g) => g.status === 'pending').length;
  const pg = usePaged(grants, [year, search, status]);
  const totalApplied = (grantsQ.data || []).filter((g) => g.status === 'approved').reduce((s, g) => s + Number(g.applied_amount || 0), 0);

  return (
    <MainLayout>
      <PageShell title="Discounts & Scholarships" subtitle="Sibling and staff discounts, scholarships, bursaries and one-off waivers"
        actions={<div className="flex items-center gap-2">
          <YearFilter value={year} onChange={(y) => setPicked(!y || y === activeYear ? '' : y)} noAutoSelect />
          {!viewingPast && <Button size="sm" variant="create" onClick={() => { setGrantFor(null); setGrantOpen(true); }}><Plus size={15} className="sm:mr-1.5" /><span className="hidden sm:inline">Give a discount</span></Button>}
        </div>}>
        {viewingPast && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">Showing {year} as history. New discounts are given in {activeYear}.</div>}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"><div className="text-xl font-black">{le(totalApplied)}</div><div className="text-xs text-gray-500">Taken off fees · {year}</div></div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"><div className="text-xl font-black">{new Set((grantsQ.data || []).filter((g) => g.status === 'approved').map((g) => g.student_id)).size}</div><div className="text-xs text-gray-500">Students with a discount</div></div>
          <button type="button" onClick={() => { setTab('grants'); setStatus('pending'); }} className="text-left rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4"><div className="text-xl font-black text-amber-700">{pending}</div><div className="text-xs text-amber-800">{isPrincipal ? 'Waiting for your approval' : 'Waiting for the principal'}</div></button>
        </div>

        <div role="tablist" aria-label="Discounts" className="mb-4 inline-flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-900/50 p-1">
          {(['grants', 'rules'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === t ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>{t === 'grants' ? 'Discounts given' : 'Discount types'}</button>
          ))}
        </div>

        {tab === 'grants' && (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <SearchBar placeholder="Search student or discount…" onSearch={setSearch} className="w-full sm:max-w-md" />
              <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                <option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="revoked">Revoked</option>
              </select>
            </div>
            {grantsQ.error ? <p role="alert" className="text-sm text-red-600">{(grantsQ.error as Error).message} <button type="button" className="font-bold underline" onClick={() => grantsQ.refetch()}>Retry</button></p>
              : grantsQ.isLoading ? <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
              : grants.length === 0 ? <EmptyState message={`No discounts in ${year}`} description="Give a sibling, staff-child or scholarship discount, or a one-off waiver." />
              : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500"><tr><th className="px-4 py-3 text-left">Student</th><th className="px-4 py-3 text-left">Discount</th><th className="px-4 py-3 text-left">Covers</th><th className="px-4 py-3 text-right">Taken off</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3" /></tr></thead>
                    <tbody>
                      {pg.pageRows.map((g) => (
                        <tr key={g.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-3"><button type="button" onClick={() => setAccount({ id: g.student_id, name: g.student_name, admissionNo: g.admission_no })} className="font-medium text-blue-700 hover:underline dark:text-blue-300">{g.student_name}</button><div className="text-xs text-gray-400">{g.admission_no}</div></td>
                          <td className="px-4 py-3">{g.label}<div className="text-xs text-gray-500">{g.basis === 'percent' ? `${Number(g.value)}%` : le(g.value)} on {g.applies_to === 'all' ? 'all charges' : 'tuition'}{g.reason ? ` · ${g.reason}` : ''}</div></td>
                          <td className="px-4 py-3 text-xs">{g.term || 'Whole year'}</td>
                          <td className="px-4 py-3 text-right">{g.status === 'approved' ? le(g.applied_amount) : '—'}</td>
                          <td className="px-4 py-3"><Pill s={g.status} /><div className="text-[11px] text-gray-400">{g.status === 'pending' ? `by ${g.requested_by_name || 'bursar'}` : g.decided_by_name ? `by ${g.decided_by_name}` : ''}</div></td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {g.status === 'pending' && isPrincipal && !viewingPast && <>
                              <button type="button" onClick={() => { setReason(''); setDecide({ g, d: 'approve' }); }} className="text-xs font-semibold text-emerald-700 hover:underline mr-3">Approve</button>
                              <button type="button" onClick={() => { setReason(''); setDecide({ g, d: 'reject' }); }} className="text-xs font-semibold text-red-600 hover:underline mr-3">Reject</button>
                            </>}
                            {canRevoke(g) && !(g.status === 'pending' && isPrincipal) && (
                              <button type="button" onClick={() => { setReason(''); setDecide({ g, d: 'revoke' }); }} className="text-xs font-semibold text-red-600 hover:underline">{g.status === 'pending' ? 'Withdraw' : 'Revoke'}</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <TablePager {...pg.pager} label="discounts" />
                </div>
              )}
          </>
        )}

        {tab === 'rules' && (
          <>
            <div className="flex justify-end mb-3"><Button size="sm" variant="create" onClick={() => setRuleEdit({ kind: 'sibling', basis: 'percent', applies_to: 'tuition', sibling_order: 2 })}><Plus size={14} className="mr-1" /> New discount type</Button></div>
            {(rulesQ.data || []).length === 0 ? <EmptyState message="No discount types yet" description="Set up sibling, staff-child and scholarship discounts once, then give them to students." /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(rulesQ.data || []).map((r) => (
                  <div key={r.id} className={`rounded-2xl border p-4 ${r.active ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800' : 'border-dashed border-gray-300 opacity-70'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div><div className="font-semibold">{r.name}</div><div className="text-xs text-gray-500">{KIND_LABEL[r.kind]}{r.kind === 'sibling' ? ` · from child ${r.sibling_order || 2}` : ''} · {r.basis === 'percent' ? `${Number(r.value)}%` : le(r.value)} on {r.applies_to === 'all' ? 'all charges' : 'tuition'}</div></div>
                      {!r.active && <Pill s="revoked" label="Inactive" />}
                    </div>
                    <div className="mt-3 flex gap-3 text-xs font-semibold">
                      <button type="button" onClick={() => setRuleEdit(r)} className="text-blue-600 hover:underline">Edit</button>
                      {r.kind === 'sibling' && r.active && !viewingPast && <button type="button" onClick={() => setSiblingRule(r)} className="inline-flex items-center gap-1 text-blue-600 hover:underline"><Users size={12} /> Find eligible siblings</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <RuleModal rule={ruleEdit} onClose={() => setRuleEdit(null)} onSaved={() => { setRuleEdit(null); refresh(); }} />

        <Modal isOpen={grantOpen} onClose={() => setGrantOpen(false)} title={`Give a discount · ${year}`} size="lg">
          <div className="space-y-3">
            <StudentPicker value={grantFor} onChange={setGrantFor} />
            {grantFor && <GrantDiscountForm studentId={grantFor.id} year={year} onDone={() => { setGrantOpen(false); refresh(); }} />}
            {!isPrincipal && <p className="text-[11px] text-gray-500">Discounts above the approval limit set by the principal (Settings → Financial) wait for the principal's approval before they reduce any fees.</p>}
          </div>
        </Modal>

        <Modal isOpen={!!siblingRule} onClose={() => setSiblingRule(null)} title={`Eligible for ${siblingRule?.name || ''} · ${year}`} size="lg">
          {siblingsQ.isLoading ? <p className="text-sm text-gray-400">Looking for families…</p> : (siblingsQ.data || []).length === 0 ? <p className="text-sm text-gray-500">No more eligible students. Children at school this year are matched into a family by their parent account or guardian phone number, oldest first.</p> : (
            <div className="space-y-2">
              {(siblingsQ.data || []).map((c) => (
                <div key={c.student_id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2 text-sm">
                  <span>{c.name} <span className="text-xs text-gray-500">{c.admission_no} · child {c.child_number} of {c.siblings}</span></span>
                  <Button size="sm" variant="create" disabled={givingTo === c.student_id} onClick={async () => {
                    setGivingTo(c.student_id);
                    try {
                      const r: any = await bursarService.grant({ student_id: c.student_id, rule_id: siblingRule!.id, academic_year: year });
                      if (r?.success === false) return showToast.error(r.error || 'Could not give the discount');
                      showToast.success(r.data.needsApproval ? 'Sent to the principal for approval' : `Approved · ${le(r.data.applied)} off`); refresh();
                    } finally { setGivingTo(null); }
                  }}>{givingTo === c.student_id ? 'Giving…' : 'Give'}</Button>
                </div>
              ))}
            </div>
          )}
        </Modal>

        <ConfirmationDialog isOpen={!!decide} onClose={() => setDecide(null)} isDestructive={decide?.d === 'reject'}
          title={decide?.d === 'approve' ? 'Approve discount' : decide?.d === 'reject' ? 'Reject discount' : decide?.g.status === 'pending' ? 'Withdraw request' : 'Revoke discount'}
          confirmLabel={decide?.d === 'approve' ? 'Approve' : decide?.d === 'reject' ? 'Reject' : decide?.g.status === 'pending' ? 'Withdraw' : 'Revoke'}
          message={decide ? `${decide.g.label} for ${decide.g.student_name} (${decide.g.basis === 'percent' ? `${Number(decide.g.value)}%` : le(decide.g.value)}, ${decide.g.term || 'whole year'}).${decide.d === 'approve' ? ' It reduces the fees as soon as you approve.' : decide.d === 'revoke' && decide.g.status === 'approved' ? ` ${le(decide.g.applied_amount)} will be owed again.` : ''}` : ''}
          confirmDisabled={decide?.d !== 'approve' && reason.trim().length < 5}
          onConfirm={async () => {
            const r: any = await bursarService.decide(decide!.g.id, decide!.d, reason.trim());
            if (r?.success === false) { showToast.error(r.error || 'Failed'); throw new Error('x'); }
            showToast.success(decide!.d === 'approve' ? `Approved · ${le(r.data.applied)} taken off` : decide!.d === 'reject' ? 'Rejected' : decide!.g.status === 'pending' ? 'Request withdrawn' : `Revoked · ${le(r.data.restored)} owed again`); refresh();
          }}>
          <label htmlFor="decide-reason" className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mt-2">{decide?.d === 'approve' ? 'Note (optional)' : 'Reason (required)'}</label>
          <textarea id="decide-reason" placeholder={decide?.d === 'reject' ? 'e.g. Family does not meet the scholarship criteria' : decide?.d === 'revoke' ? 'e.g. Given to the wrong student' : 'Optional note'} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm" />
        </ConfirmationDialog>

        <StudentAccountModal student={account} onClose={() => setAccount(null)} initialTab="discounts" />
      </PageShell>
    </MainLayout>
  );
};

export default DiscountsPage;
