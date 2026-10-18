/**
 * VerificationReview — the super admin's review of one school's verification
 * submission: everything the owner submitted, the full ID number (on demand,
 * audited server-side), the account owner, the school profile, the history,
 * and the Approve / Reject / Revoke actions.
 *
 * Shared by the review drawer on /platform/verifications and the
 * Verification tab of /platform/tenants/:tenantId.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Eye, EyeOff, Mail, Phone, CheckCircle2, XCircle, Undo2, AlertTriangle, ExternalLink, RefreshCw,
} from 'lucide-react';
import { Button } from '@components/ui/button';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { showToast } from '@utils/toast';
import { ID_TYPE_LABEL, type VerificationState } from '@services/verificationService';
import platformVerificationService, {
  QUICK_REJECT_REASONS,
  REASON_MAX,
  REASON_MIN,
  verificationKeys,
  type VerificationDetail,
} from '@services/platformVerificationService';

export const fmtVerificationDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_CHIP: Record<VerificationState, { label: string; cls: string }> = {
  pending: { label: 'Pending review', cls: 'bg-amber-100 text-amber-800' },
  verified: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  unverified: { label: 'Unverified', cls: 'bg-gray-100 text-gray-600' },
};

export const VerificationStatusChip: React.FC<{ status: VerificationState }> = ({ status }) => {
  const c = STATUS_CHIP[status] || STATUS_CHIP.unverified;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${c.cls}`}>{c.label}</span>;
};

export const NameMatchChip: React.FC<{ match: boolean | null | undefined }> = ({ match }) => {
  if (match === null || match === undefined) return null;
  return match ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 whitespace-nowrap">
      <CheckCircle2 size={12} aria-hidden="true" /> Matches
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 whitespace-nowrap">
      <XCircle size={12} aria-hidden="true" /> Does not match
    </span>
  );
};

export const EmisConflictFlag: React.FC = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 whitespace-nowrap">
    <AlertTriangle size={12} aria-hidden="true" /> EMIS also used by another school
  </span>
);

// The server sends audit actions ("verification.submitted"); older records use
// "school_verified" (the old instant self-verification) and "school_verification_failed".
const HISTORY_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  resubmitted: 'Resubmitted',
  approved: 'Approved',
  rejected: 'Rejected',
  revoked: 'Verification revoked',
  id_viewed: 'ID number viewed',
  school_verified: 'Verified (self-declared, before WiSkul review)',
  school_verification_failed: 'Submission failed the automatic checks',
};
const actionKey = (a: string) => String(a || '').replace(/^verification\./, '');
const historyLabel = (a: string) => {
  const k = actionKey(a);
  return HISTORY_LABEL[k] || k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
};
const historyDot = (a: string) => {
  const k = actionKey(a);
  return k === 'approved' || k === 'school_verified' ? 'border-emerald-300'
    : k === 'rejected' || k === 'revoked' || k === 'school_verification_failed' ? 'border-red-300'
    : 'border-blue-200';
};

type Action = 'approve' | 'reject' | 'revoke' | null;

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</dt>
    <dd className="text-sm text-gray-800 dark:text-gray-200 break-words">{children}</dd>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
    {children}
  </section>
);

export interface VerificationReviewProps {
  tenantId: string;
  /** Called after an approve / reject / revoke succeeds. */
  onChanged?: (status: VerificationState) => void;
  /** Show a link to the school's tenant page (from the review drawer). */
  showTenantLink?: boolean;
  /** Tells a parent dialog that a confirm dialog is open (so Escape closes only that one). */
  onDialogChange?: (open: boolean) => void;
}

export const VerificationReview: React.FC<VerificationReviewProps> = ({ tenantId, onChanged, showTenantLink, onDialogChange }) => {
  const qc = useQueryClient();
  const [showId, setShowId] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const { data: res, isLoading, isFetching, refetch } = useQuery({
    queryKey: verificationKeys.detail(tenantId),
    queryFn: () => platformVerificationService.detail(tenantId),
    staleTime: 15_000,
  });
  const d: VerificationDetail | undefined = res?.success ? res.data : undefined;

  useEffect(() => { onDialogChange?.(action !== null); }, [action, onDialogChange]);
  // Hide the ID again when switching to another school.
  useEffect(() => { setShowId(false); }, [tenantId]);

  const openAction = (a: Action) => { setNotes(''); setReason(''); setAction(a); };

  const run = async () => {
    if (!action) return;
    const call =
      action === 'approve' ? platformVerificationService.approve(tenantId, notes.trim() || undefined)
        : action === 'reject' ? platformVerificationService.reject(tenantId, reason.trim())
        : platformVerificationService.revoke(tenantId, reason.trim());
    const r = await call;
    if (!r.success) {
      showToast.error(r.error || 'Could not save the decision. Please try again.');
      throw new Error('failed'); // keeps the confirm dialog open
    }
    const next: VerificationState = action === 'approve' ? 'verified' : action === 'reject' ? 'rejected' : 'unverified';
    showToast.success(
      action === 'approve' ? `${d?.school_name || 'The school'} is now verified.`
        : action === 'reject' ? 'Submission rejected. The owner will see your reason.'
        : 'Verification revoked. The owner will see your reason.',
    );
    await qc.invalidateQueries({ queryKey: verificationKeys.all });
    onChanged?.(next);
  };

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center text-gray-400" role="status" aria-label="Loading verification">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  if (!d) {
    const notFound = res?.statusCode === 404;
    return (
      <div className="py-10 text-center text-sm text-gray-500 space-y-3" role={notFound ? 'status' : 'alert'}>
        <p>{notFound ? "This school hasn't submitted verification details yet." : res?.error || 'Could not load the verification details.'}</p>
        {!notFound && (
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" /> Try again
          </Button>
        )}
      </div>
    );
  }

  const reasonLen = reason.trim().length;
  const reasonValid = reasonLen >= REASON_MIN && reasonLen <= REASON_MAX;
  const idTypeLabel = d.id_type ? ID_TYPE_LABEL[d.id_type] || d.id_type : 'ID';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-gray-900 dark:text-white truncate">{d.school_name}</h3>
            <VerificationStatusChip status={d.status} />
            {d.tenant_status && d.tenant_status !== 'active' && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600">School {d.tenant_status}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Submitted {fmtVerificationDate(d.submitted_at)}
            {d.reviewed_at ? ` · Reviewed ${fmtVerificationDate(d.reviewed_at)}${d.reviewed_by_name ? ` by ${d.reviewed_by_name}` : ''}` : ''}
          </p>
        </div>
        {showTenantLink && (
          <Link to={`/platform/tenants/${encodeURIComponent(d.tenant_id)}`} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
            Open school <ExternalLink size={12} aria-hidden="true" />
          </Link>
        )}
      </div>

      {d.last_reason && (d.status === 'rejected' || d.status === 'unverified') && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">{d.status === 'rejected' ? 'Rejection reason' : 'Revocation reason'}: </span>{d.last_reason}
        </div>
      )}
      {d.review_notes && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
          <span className="font-semibold">Review notes: </span>{d.review_notes}
        </div>
      )}

      <Section title="Submitted details">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Row label="EMIS code">
            <span className="font-mono">{d.emis_code || '—'}</span>
            {d.emis_conflict && <span className="block mt-1"><EmisConflictFlag /></span>}
          </Row>
          <Row label="School level">{d.school_level || '—'}</Row>
          <Row label="District">{d.district || '—'}</Row>
          <Row label="Year founded">{d.year_established || '—'}</Row>
          <Row label="ID type">{idTypeLabel}</Row>
          <Row label="ID number">
            <span className="font-mono">{showId && d.id_number ? d.id_number : d.id_last4 ? `•••• ${d.id_last4}` : '—'}</span>
            {d.id_number && (
              <span className="block mt-1">
                <button
                  type="button"
                  onClick={() => setShowId((v) => !v)}
                  aria-pressed={showId}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                >
                  {showId ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                  {showId ? 'Hide ID number' : 'Show ID number'}
                </button>
                <span className="block text-[11px] text-gray-400 mt-0.5">Access to the full ID number is recorded in the audit log.</span>
              </span>
            )}
          </Row>
          <Row label="Name on ID">
            <span className="mr-2">{d.id_name || '—'}</span>
            <NameMatchChip match={d.name_match} />
          </Row>
        </dl>
      </Section>

      <Section title="Account owner">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Row label="Name">{d.owner_name || '—'}</Row>
          <Row label="Email">
            {d.owner_email ? <a href={`mailto:${d.owner_email}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline break-all"><Mail size={13} aria-hidden="true" />{d.owner_email}</a> : '—'}
          </Row>
          <Row label="Phone">
            {d.owner_phone ? <a href={`tel:${d.owner_phone}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline"><Phone size={13} aria-hidden="true" />{d.owner_phone}</a> : '—'}
          </Row>
        </dl>
      </Section>

      <Section title="School profile">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Row label="Name">{d.school?.name || d.school_name}</Row>
          <Row label="EMIS code in settings"><span className="font-mono">{d.school?.emis_code || '—'}</span></Row>
          <Row label="School level in settings">{d.school?.school_type || '—'}</Row>
          <Row label="Phone">{d.school?.phone || '—'}</Row>
          <Row label="Email">{d.school?.email || '—'}</Row>
          <Row label="Address">{d.school?.address || '—'}</Row>
        </dl>
      </Section>

      <Section title="History">
        {d.history?.length ? (
          <ol className="space-y-2.5">
            {d.history.map((h, i) => (
              <li key={`${h.action}-${h.at}-${i}`} className={`text-sm border-l-2 pl-3 ${historyDot(h.action)}`}>
                <div className="font-semibold text-gray-800 dark:text-gray-200">{historyLabel(h.action)}</div>
                {h.reason && <div className="text-xs text-gray-600 dark:text-gray-400">{h.reason}</div>}
                <div className="text-[11px] text-gray-400">{fmtVerificationDate(h.at)}{h.by_name ? ` · ${h.by_name}` : ''}</div>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-gray-500">No history yet.</p>}
      </Section>

      {/* Actions */}
      {d.status === 'pending' && (
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => openAction('reject')} className="text-red-700 border-red-200 hover:bg-red-50">
            <XCircle size={15} aria-hidden="true" /> Reject
          </Button>
          <Button variant="create" onClick={() => openAction('approve')}>
            <CheckCircle2 size={15} aria-hidden="true" /> Approve
          </Button>
        </div>
      )}
      {d.status === 'verified' && (
        <div className="flex sm:justify-end">
          <Button variant="outline" onClick={() => openAction('revoke')} className="text-red-700 border-red-200 hover:bg-red-50 w-full sm:w-auto">
            <Undo2 size={15} aria-hidden="true" /> Revoke verification
          </Button>
        </div>
      )}
      {d.status === 'rejected' && (
        <p className="text-xs text-gray-500 text-right" role="status">Waiting for the owner to fix the details and submit again.</p>
      )}

      <ConfirmationDialog
        isOpen={action === 'approve'}
        onClose={() => setAction(null)}
        onConfirm={run}
        title="Approve verification"
        message={`Mark ${d.school_name} as verified? The owner is told by email and in the app, and can then change their plan.`}
        confirmLabel="Approve"
        isDestructive={false}
      >
        <label htmlFor="vr-notes" className="block mt-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
          Notes <span className="normal-case font-normal">(optional, only WiSkul sees these)</span>
        </label>
        <textarea
          id="vr-notes" rows={3} maxLength={REASON_MAX} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. EMIS confirmed with the MBSSE list"
          className="mt-1.5 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        />
      </ConfirmationDialog>

      <ConfirmationDialog
        isOpen={action === 'reject' || action === 'revoke'}
        onClose={() => setAction(null)}
        onConfirm={run}
        title={action === 'revoke' ? 'Revoke verification' : 'Reject submission'}
        message={
          action === 'revoke'
            ? `Remove ${d.school_name}'s verified status? The owner sees your reason and must submit again before changing their plan.`
            : `Reject ${d.school_name}'s submission? The owner sees your reason and can fix the details and submit again.`
        }
        confirmLabel={action === 'revoke' ? 'Revoke' : 'Reject'}
        confirmDisabled={!reasonValid}
      >
        {action === 'reject' && (
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5" id="vr-quick-label">Quick reasons</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="vr-quick-label">
              {QUICK_REJECT_REASONS.map((q) => (
                <button
                  key={q} type="button" onClick={() => setReason(q)} aria-pressed={reason === q}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border text-left ${reason === q ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <label htmlFor="vr-reason" className="block mt-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
          Reason <span className="normal-case font-normal">(the owner sees this)</span>
        </label>
        <textarea
          id="vr-reason" rows={4} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)}
          required aria-required="true" aria-describedby="vr-reason-hint" aria-invalid={reasonLen > 0 && !reasonValid}
          placeholder={action === 'revoke' ? 'e.g. The EMIS code belongs to another school' : 'Explain what the owner needs to fix'}
          className="mt-1.5 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        />
        <p id="vr-reason-hint" className={`text-[11px] mt-1 ${reasonLen > 0 && !reasonValid ? 'text-red-600' : 'text-gray-500'}`}>
          {REASON_MIN}–{REASON_MAX} characters · {reasonLen}/{REASON_MAX}
        </p>
      </ConfirmationDialog>
    </div>
  );
};

export default VerificationReview;
