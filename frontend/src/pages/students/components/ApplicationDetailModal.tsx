/**
 * ApplicationDetailModal: one admission application, end to end.
 *  - Details (child, parent, medical, emergency, interview, decision)
 *  - Documents checklist
 *  - Timeline (every move, note and email) + add a note
 *  - Actions allowed from the current stage (the server enforces the same rules)
 *  - Enrol: picks a current-year class (with capacity), creates the student once
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, Copy, FileText, GraduationCap, History, Loader2,
  MessageSquarePlus, Pencil, RotateCcw, Search, Trash2, UserX, XCircle, Clock3,
} from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import useAuthStore from '@store/authStore';
import { HouseChip } from './houses/houseUi';
import {
  admissionsService, type AdmissionDetail, type AdmissionStatus, type AdmissionsMeta, type EnrolResult,
} from '@services/admissionsService';

export const ADM_LABEL: Record<string, string> = {
  pending: 'New', under_review: 'Under review', interview_scheduled: 'Interview scheduled', approved: 'Approved',
  waitlist: 'Waitlist', rejected: 'Rejected', withdrawn: 'Withdrawn', enrolled: 'Enrolled',
};
export const ADM_PILL: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40',
  under_review: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40',
  interview_scheduled: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/40',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40',
  waitlist: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/40',
  rejected: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40',
  withdrawn: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  enrolled: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800/40',
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border ${ADM_PILL[status] || ADM_PILL.withdrawn}`}>{ADM_LABEL[status] || status}</span>
);

const input = 'w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const childName = (a: { child_first_name?: string; child_middle_name?: string; child_last_name?: string }) =>
  [a.child_first_name, a.child_middle_name, a.child_last_name].filter(Boolean).join(' ');

/** What each move is called, and what it asks for. */
const ACTIONS: Record<string, { label: string; icon: React.ReactNode; tone: 'default' | 'destructive' | 'outline'; needsReason?: boolean; interview?: boolean; score?: boolean; hint: string }> = {
  under_review: { label: 'Start review', icon: <Search size={14} />, tone: 'outline', hint: 'The application is being checked. Nothing is sent to the family.' },
  interview_scheduled: { label: 'Schedule interview', icon: <CalendarClock size={14} />, tone: 'outline', interview: true, hint: 'The family is emailed the date, time and place.' },
  approved: { label: 'Approve', icon: <CheckCircle2 size={14} />, tone: 'default', score: true, hint: 'The family is emailed that the child is accepted. Enrol them when they confirm.' },
  waitlist: { label: 'Waitlist', icon: <Clock3 size={14} />, tone: 'outline', score: true, hint: 'The family is emailed that the child is on the waiting list.' },
  rejected: { label: 'Reject', icon: <XCircle size={14} />, tone: 'destructive', needsReason: true, score: true, hint: 'The family is emailed that a place can’t be offered. The reason stays internal.' },
  withdrawn: { label: 'Mark withdrawn', icon: <UserX size={14} />, tone: 'outline', needsReason: true, hint: 'Use this when the family no longer wants the place. No email is sent.' },
};

// ── Credentials shown once after enrolment ───────────────────────────────────
export const EnrolCredentials: React.FC<{ result: EnrolResult; childLabel: string }> = ({ result, childLabel }) => {
  const a = result.accounts;
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); showToast.success('Copied'); } catch { showToast.error('Select and copy it instead'); } };
  const all = a ? [
    `${childLabel}: student number ${result.student.student_id}${result.class ? `, ${result.class.name}` : ''}`,
    a.student_username ? `Student sign-in: ${a.student_username}${a.student_password ? ` / ${a.student_password}` : ''}` : '',
    a.parent_email ? `Parent sign-in: ${a.parent_email}${a.parent_password ? ` / ${a.parent_password}` : ''}` : '',
  ].filter(Boolean).join('\n') : '';
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-3 text-sm text-emerald-900 dark:text-emerald-200">
        {result.already ? 'Already enrolled' : 'Enrolled'}: <strong>{childLabel}</strong> is student <strong>{result.student.student_id}</strong>{result.class ? <> in <strong>{result.class.name}</strong></> : null}.
      </div>
      {result.house && (
        <p className="text-sm text-gray-700 dark:text-gray-300">House: <HouseChip name={result.house.name} color={result.house.color} /></p>
      )}
      {a && (a.student_password || a.parent_password) ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-1.5">
          <p className="text-xs font-semibold text-gray-500">Portal sign-in (give these to the family; they are shown once here and again in Student Profiles)</p>
          {a.student_username && <p>Student: <span className="font-mono">{a.student_username}</span>{a.student_password && <> · <span className="font-mono">{a.student_password}</span></>}</p>}
          {a.parent_email && <p>Parent: <span className="font-mono">{a.parent_email}</span>{a.parent_password && <> · <span className="font-mono">{a.parent_password}</span></>}</p>}
          <Button size="sm" variant="outline" onClick={() => copy(all)}><Copy size={13} className="mr-1" /> Copy all</Button>
        </div>
      ) : !result.already ? <p className="text-xs text-gray-500">Portal sign-ins already existed for this family. See Student Profiles.</p> : null}
      {result.fees && (result.fees.billed.length > 0 || result.fees.not_billed.length > 0) && (
        <p className="text-xs text-gray-600 dark:text-gray-300">Fees: {result.fees.billed.length ? <>billed {result.fees.billed.join(', ')} (Le {result.fees.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })})</> : 'nothing billed'}{result.fees.not_billed.length ? <>; not billed {result.fees.not_billed.join(', ')}</> : null}. The bursar has been told.</p>
      )}
      {(result.warnings || []).map((w) => <p key={w} role="alert" className="text-xs text-amber-700">{w}</p>)}
      <Link to="/students/profiles" state={{ studentId: result.student.id }} className="inline-block text-xs font-bold text-blue-600 hover:underline">Open the student profile →</Link>
    </div>
  );
};

// ── Enrol dialog ─────────────────────────────────────────────────────────────
export const EnrolDialog: React.FC<{ app: { id: string; class_applying_for?: string | null; child_first_name?: string; child_last_name?: string } | null; meta?: AdmissionsMeta; onClose: () => void; onDone: (r: EnrolResult) => void }> = ({ app, meta, onClose, onDone }) => {
  const classes = meta?.classes || [];
  const preferred = app && classes.some((c) => c.id === app.class_applying_for) ? String(app.class_applying_for) : '';
  const [classId, setClassId] = useState(preferred);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState<string[]>([]);
  React.useEffect(() => { setClassId(preferred); setOver(false); }, [app?.id, preferred]);
  const cls = classes.find((c) => c.id === classId);
  // Default: bill every term the class has already been billed.
  React.useEffect(() => { setTerms(cls?.billed_terms || []); }, [cls?.id, cls?.billed_terms?.length]);
  if (!app) return null;
  return (
    <Modal isOpen onClose={onClose} title={`Enrol ${childName(app)}`} size="md"
      footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button disabled={busy || !classId || (!!cls?.full && !over)} onClick={async () => {
          setBusy(true);
          try {
            const r: any = await admissionsService.enrol(app.id, { class_id: classId, allow_over_capacity: over, bill_terms: terms });
            if (r?.success === false) return showToast.error(r.error || 'Could not enrol');
            onDone(r.data);
          } finally { setBusy(false); }
        }}>{busy ? <><Loader2 size={14} className="animate-spin mr-1" /> Enrolling…</> : 'Enrol as a student'}</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">This creates the student record, puts them in the class for <strong>{meta?.active_year || 'this year'}</strong>, links the parent and creates their portal sign-ins. It can only happen once.</p>
        {!preferred && app.class_applying_for && <p role="note" className="text-xs text-amber-700">The class they applied for isn’t open this year (it belongs to an earlier year or was closed). Choose this year’s class.</p>}
        <div>
          <label htmlFor="enrol-class" className="text-xs font-semibold text-gray-600 dark:text-gray-300">Class ({meta?.active_year})</label>
          <select id="enrol-class" className={input} value={classId} onChange={(e) => { setClassId(e.target.value); setOver(false); }}>
            <option value="">Choose a class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.capacity ? ` · ${c.enrolled}/${c.capacity}${c.full ? ' (full)' : ''}` : ` · ${c.enrolled} students`}</option>)}
          </select>
        </div>
        {cls && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-xs">
            {cls.billed_terms.length === 0
              ? <p className="text-gray-500">No fees are billed to {cls.name} yet this year. The bursar bills them from Fee Structures and is told about this student.</p>
              : <>
                <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Fees already billed to {cls.name}: bill them to this student too</p>
                {cls.billed_terms.map((t) => (
                  <label key={t} className="flex items-center gap-2 py-0.5">
                    <input type="checkbox" checked={terms.includes(t)} onChange={(e) => setTerms(e.target.checked ? [...terms, t] : terms.filter((x) => x !== t))} /> {t}
                  </label>
                ))}
                <p className="text-gray-500 mt-1">Untick a term the child is not paying for (e.g. joining late). The bursar is notified either way.</p>
              </>}
          </div>
        )}
        {cls?.full && (
          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs text-amber-900 dark:text-amber-200">
            <input type="checkbox" className="mt-0.5" checked={over} onChange={(e) => setOver(e.target.checked)} />
            <span>{cls.name} is full ({cls.enrolled} of {cls.capacity}). Enrol over capacity anyway.</span>
          </label>
        )}
      </div>
    </Modal>
  );
};

// ── Main modal ───────────────────────────────────────────────────────────────
export const ApplicationDetailModal: React.FC<{
  id: string | null; meta?: AdmissionsMeta; onClose: () => void; onEdit: (a: AdmissionDetail) => void; onChanged: () => void;
}> = ({ id, meta, onClose, onEdit, onChanged }) => {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isPrincipal = user?.role === 'principal' || user?.role === 'super_admin';
  const [tab, setTab] = useState<'details' | 'documents' | 'timeline'>('details');
  const [act, setAct] = useState<AdmissionStatus | 'reopen' | null>(null);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');
  const [score, setScore] = useState('');
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [docsDraft, setDocsDraft] = useState<Record<string, boolean> | null>(null);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [enrolled, setEnrolled] = useState<EnrolResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const q = useQuery({
    queryKey: ['admission-detail', id],
    queryFn: async () => { const r: any = await admissionsService.getDetail(id!); if (r?.success === false) throw new Error(r.error || 'Could not load the application'); return r.data as AdmissionDetail; },
    enabled: !!id,
  });
  const a = q.data;
  React.useEffect(() => { setTab('details'); setDocsDraft(null); setEnrolled(null); setNewNote(''); }, [id]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admission-detail', id] }); onChanged(); };
  const openAct = (s: AdmissionStatus | 'reopen') => {
    setNote(''); setScore(a?.assessment_score != null ? String(a.assessment_score) : '');
    setWhen(a?.interview_date ? new Date(a.interview_date).toISOString().slice(0, 16) : ''); setWhere(a?.interview_location || '');
    setAct(s);
  };
  const actTarget: AdmissionStatus | null = act === 'reopen' ? 'under_review' : act;
  const cfg = act === 'reopen' ? { label: 'Reopen', icon: <RotateCcw size={14} />, tone: 'outline' as const, hint: 'The application goes back to Under review.' } : act ? ACTIONS[act] : null;

  const docs = docsDraft ?? a?.documents ?? {};
  const docList = a?.documents_list || meta?.documents || [];
  const docsDone = docList.filter((d) => docs[d.key]).length;
  const allowed = (a?.allowed || []) as AdmissionStatus[];
  const reopenable = !!a && ['rejected', 'withdrawn', 'approved'].includes(a.status) && allowed.includes('under_review');
  const forward = allowed.filter((s) => s !== 'under_review' || !reopenable).filter((s) => s !== 'interview_scheduled' || a?.status !== 'interview_scheduled');

  const Row: React.FC<{ k: string; v?: React.ReactNode }> = ({ k, v }) => (
    <div className="flex justify-between gap-3 py-1.5 border-b border-gray-100 dark:border-gray-800 text-sm"><span className="text-gray-500">{k}</span><span className="text-right text-gray-900 dark:text-gray-100 break-words">{v || v === 0 ? v : '—'}</span></div>
  );

  return (
    <>
      <Modal isOpen={!!id} onClose={onClose} size="xl" title={a ? `${childName(a)} · ${a.application_number}` : 'Application'}
        footer={a ? (
          <div className="flex flex-wrap items-center gap-2 w-full">
            {a.status !== 'enrolled' && <Button size="sm" variant="ghost" onClick={() => onEdit(a)}><Pencil size={14} className="mr-1" /> Edit</Button>}
            {isPrincipal && a.status !== 'enrolled' && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}><Trash2 size={14} className="mr-1" /> Delete</Button>}
            <div className="flex flex-wrap gap-2 ml-auto">
              {reopenable && <Button size="sm" variant="outline" onClick={() => openAct('reopen')}><RotateCcw size={14} className="mr-1" /> Reopen</Button>}
              {a.status === 'interview_scheduled' && <Button size="sm" variant="outline" onClick={() => openAct('interview_scheduled')}><CalendarClock size={14} className="mr-1" /> Reschedule</Button>}
              {forward.map((s) => ACTIONS[s] && (
                <Button key={s} size="sm" variant={ACTIONS[s].tone} onClick={() => openAct(s)}>{ACTIONS[s].icon}<span className="ml-1">{ACTIONS[s].label}</span></Button>
              ))}
              {a.can_enrol && <Button size="sm" onClick={() => setEnrolOpen(true)}><GraduationCap size={14} className="mr-1" /> Enrol</Button>}
            </div>
          </div>
        ) : undefined}>
        {q.isLoading ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : q.error ? <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
          : a ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <StatusPill status={a.status} />
              <span>{a.academic_year} intake</span><span>·</span>
              <span>{a.application_source === 'online' ? 'Applied online' : 'Entered at the office'} {fmtDate(a.created_at)}</span>
              {a.class_name && <><span>·</span><span>Applying for <strong className="text-gray-700 dark:text-gray-200">{a.class_name}</strong></span></>}
            </div>
            {enrolled && <EnrolCredentials result={enrolled} childLabel={childName(a)} />}
            {a.status === 'enrolled' && !enrolled && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 dark:bg-teal-950/20 dark:border-teal-900 p-3 text-sm text-teal-900 dark:text-teal-200">
                Enrolled {fmtDate(a.enrolled_at)}{a.student_number ? <> as <strong>{a.student_number}</strong></> : null}{a.enrolled_class_name ? <> in <strong>{a.enrolled_class_name}</strong></> : null}.
                {a.student_id && <Link to="/students/profiles" state={{ studentId: a.student_id }} className="ml-2 font-bold text-teal-700 hover:underline">Open profile →</Link>}
              </div>
            )}
            {(a.duplicates?.applications?.length > 0 || a.duplicates?.students?.length > 0) && (
              <div role="alert" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>Possible duplicate: same name and date of birth as
                  {a.duplicates.applications.map((d) => <React.Fragment key={d.id}> application <strong>{d.application_number}</strong> ({ADM_LABEL[d.status] || d.status}, {d.academic_year})</React.Fragment>)}
                  {a.duplicates.students.map((s) => <React.Fragment key={s.id}> student <strong>{s.student_id}</strong> ({s.status})</React.Fragment>)}. Check before you approve.</span>
              </div>
            )}
            {a.can_enrol && !a.class_is_current && <p role="note" className="text-xs text-amber-700">The class applied for belongs to an earlier year. You’ll choose this year’s class when you enrol.</p>}

            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
              {([['details', 'Details', <FileText key="i" size={14} />], ['documents', `Documents (${docsDone}/${docList.length})`, <ClipboardCheck key="i" size={14} />], ['timeline', `Timeline (${a.events.length})`, <History key="i" size={14} />]] as const).map(([k, l, icon]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{icon}{l}</button>
              ))}
            </div>

            {tab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <section><h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Child</h4>
                  {a.child_photo_url && <img src={a.child_photo_url} alt="" className="w-20 h-20 rounded-xl object-cover mb-2" />}
                  <Row k="Name" v={childName(a)} /><Row k="Date of birth" v={fmtDate(a.child_dob)} /><Row k="Sex" v={<span className="capitalize">{a.child_gender}</span>} />
                  <Row k="Nationality" v={a.child_nationality} /><Row k="Religion" v={a.child_religion} /><Row k="Place of birth" v={a.child_place_of_birth} />
                  <Row k="Address" v={a.child_address} /><Row k="Previous school" v={a.previous_school} /><Row k="Last class" v={a.last_grade_attained} />
                </section>
                <section><h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Parent / guardian</h4>
                  <Row k="Name" v={[a.guardian_first_name, a.guardian_middle_name, a.guardian_last_name].filter(Boolean).join(' ')} />
                  <Row k="Relationship" v={a.guardian_relationship} />
                  <Row k="Phone" v={a.guardian_phone ? <a href={`tel:${a.guardian_phone}`} className="text-blue-600 hover:underline">{a.guardian_phone}</a> : null} />
                  <Row k="Other phone" v={a.guardian_alt_phone} />
                  <Row k="Email" v={a.guardian_email ? <a href={`mailto:${a.guardian_email}`} className="text-blue-600 hover:underline">{a.guardian_email}</a> : <span className="text-amber-700">None (no emails can be sent)</span>} />
                  <Row k="Occupation" v={a.guardian_occupation} /><Row k="Address" v={a.guardian_address} /><Row k="ID number" v={a.guardian_national_id} />
                </section>
                <section><h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Medical</h4>
                  <Row k="Medication" v={a.takes_medication ? a.medication_details || 'Yes' : 'No'} /><Row k="Allergies" v={a.has_allergies ? a.allergy_details || 'Yes' : 'No'} />
                  <Row k="Chronic illness" v={a.has_chronic_illness ? a.chronic_illness_details || 'Yes' : 'No'} /><Row k="First aid allowed" v={a.allow_first_aid === false ? 'No' : 'Yes'} />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mt-4 mb-1">Emergency contact</h4>
                  <Row k="Name" v={a.emergency_contact_name} /><Row k="Relationship" v={a.emergency_contact_relationship} /><Row k="Phone" v={a.emergency_contact_phone} />
                </section>
                <section><h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Assessment & decision</h4>
                  <Row k="Interview" v={a.interview_date ? `${fmtDateTime(a.interview_date)}${a.interview_location ? ` · ${a.interview_location}` : ''}` : null} />
                  <Row k="Assessment score" v={a.assessment_score != null ? `${Number(a.assessment_score)} / 100` : null} />
                  <Row k="Decision" v={['approved', 'waitlist', 'rejected', 'enrolled'].includes(a.status) && a.decided_by_name ? `${a.decided_by_name}, ${fmtDate((a as any).decided_at)}` : null} />
                  <Row k="Decision note" v={a.decision_notes} />
                  {a.withdrawn_reason && <Row k="Withdrawn" v={a.withdrawn_reason} />}
                </section>
              </div>
            )}

            {tab === 'documents' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Tick what the family has handed in. Keep the originals in the student’s file.</p>
                {docList.map((d) => (
                  <label key={d.key} className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2 text-sm">
                    <input type="checkbox" disabled={a.status === 'enrolled'} checked={!!docs[d.key]} onChange={(e) => setDocsDraft({ ...docs, [d.key]: e.target.checked })} />
                    {d.label}
                  </label>
                ))}
                {docsDraft && <div className="flex justify-end"><Button size="sm" onClick={async () => {
                  const r: any = await admissionsService.updateApplication(a.id, { documents: docsDraft });
                  if (r?.success === false) return showToast.error(r.error || 'Could not save');
                  showToast.success('Documents saved'); setDocsDraft(null); refresh();
                }}>Save checklist</Button></div>}
              </div>
            )}

            {tab === 'timeline' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="adm-note" className="text-xs font-semibold text-gray-600 dark:text-gray-300">Add a note (staff only)</label>
                  <textarea id="adm-note" rows={2} className={input} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="e.g. Mother called, will bring the birth certificate on Monday" maxLength={2000} />
                  <div className="flex justify-end mt-1"><Button size="sm" variant="outline" disabled={savingNote || newNote.trim().length < 2} onClick={async () => {
                    setSavingNote(true);
                    try { const r: any = await admissionsService.addNote(a.id, newNote.trim()); if (r?.success === false) return showToast.error(r.error || 'Could not save'); setNewNote(''); refresh(); }
                    finally { setSavingNote(false); }
                  }}><MessageSquarePlus size={14} className="mr-1" /> Add note</Button></div>
                </div>
                {a.events.length === 0 ? <p className="text-sm text-gray-500">No activity recorded yet.</p> : (
                  <ol className="relative border-l border-gray-200 dark:border-gray-700 ml-2 space-y-3">
                    {a.events.map((e) => (
                      <li key={e.id} className="ml-4">
                        <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 bg-blue-500" />
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {e.kind === 'status' ? <>Moved {e.from_status ? <>from <strong>{ADM_LABEL[e.from_status] || e.from_status}</strong> </> : null}to <strong>{ADM_LABEL[e.to_status || ''] || e.to_status}</strong></>
                            : e.kind === 'enrolled' ? <strong>Enrolled as a student</strong>
                            : e.kind === 'email' ? <>Email to the family ({ADM_LABEL[e.to_status || ''] || e.to_status})</>
                            : e.kind === 'created' ? <>Application received</>
                            : e.kind === 'note' ? <>Note</> : e.kind === 'documents' ? <>Documents updated</> : <>Details edited</>}
                        </p>
                        {e.note && <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{e.note}</p>}
                        <p className="text-[11px] text-gray-400">{fmtDateTime(e.created_at)}{e.by_name ? ` · ${e.by_name}` : ''}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmationDialog isOpen={!!act && !!a} onClose={() => setAct(null)} isDestructive={cfg?.tone === 'destructive'}
        title={cfg ? `${cfg.label}: ${a ? childName(a) : ''}` : ''} confirmLabel={cfg?.label || 'Save'}
        message={cfg?.hint || ''}
        confirmDisabled={(!!cfg && 'needsReason' in cfg && !!cfg.needsReason && note.trim().length < 5) || (actTarget === 'interview_scheduled' && !when)}
        onConfirm={async () => {
          const r: any = await admissionsService.updateStatus(a!.id, {
            status: actTarget!, note: note.trim() || undefined,
            ...(actTarget === 'interview_scheduled' ? { interview_date: new Date(when).toISOString(), interview_location: where.trim() || undefined } : {}),
            ...(cfg && 'score' in cfg && cfg.score && score !== '' ? { assessment_score: score } : {}),
          });
          if (r?.success === false) { showToast.error(r.error || 'Could not update'); throw new Error('x'); }
          const emailed = r.data?.email_sent;
          showToast.success(`${ADM_LABEL[actTarget!]}${emailed === true ? ' · family emailed' : emailed === false ? ' · the email could not be sent' : ''}`);
          refresh();
        }}>
        <div className="text-left space-y-2 mt-2">
          {actTarget === 'interview_scheduled' && <>
            <label htmlFor="adm-when" className="block text-xs font-semibold text-gray-600">Date and time</label>
            <input id="adm-when" type="datetime-local" className={input} value={when} onChange={(e) => setWhen(e.target.value)} />
            <label htmlFor="adm-where" className="block text-xs font-semibold text-gray-600">Where</label>
            <input id="adm-where" className={input} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. Principal’s office" maxLength={200} />
          </>}
          {cfg && 'score' in cfg && cfg.score && <>
            <label htmlFor="adm-score" className="block text-xs font-semibold text-gray-600">Assessment score (optional, 0–100)</label>
            <input id="adm-score" type="number" min={0} max={100} className={input} value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 68" />
          </>}
          <label htmlFor="adm-act-note" className="block text-xs font-semibold text-gray-600">{cfg && 'needsReason' in cfg && cfg.needsReason ? 'Reason (required)' : actTarget === 'approved' || actTarget === 'waitlist' ? 'Message to the family (optional)' : 'Note (optional)'}</label>
          <textarea id="adm-act-note" rows={2} className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000}
            placeholder={actTarget === 'rejected' ? 'e.g. Class is full for this year' : actTarget === 'withdrawn' ? 'e.g. Family moved to another town' : ''} />
        </div>
      </ConfirmationDialog>

      {enrolOpen && a && <EnrolDialog app={a} meta={meta} onClose={() => setEnrolOpen(false)} onDone={(r) => { setEnrolOpen(false); setEnrolled(r); setTab('details'); showToast.success(r.already ? 'Already enrolled' : `Enrolled as ${r.student.student_id}`); refresh(); }} />}

      <ConfirmationDialog isOpen={confirmDelete && !!a} onClose={() => setConfirmDelete(false)} title="Delete application" confirmLabel="Delete"
        message={a ? `Delete ${a.application_number} for ${childName(a)}? This can’t be undone. To keep a record, mark it withdrawn or rejected instead.` : ''}
        onConfirm={async () => {
          const r: any = await admissionsService.deleteApplication(a!.id);
          if (r?.success === false) { showToast.error(r.error || 'Could not delete'); throw new Error('x'); }
          showToast.success('Application deleted'); onChanged(); onClose();
        }} />
    </>
  );
};

export default ApplicationDetailModal;
