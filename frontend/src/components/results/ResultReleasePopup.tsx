/**
 * ResultReleasePopup — a one-time celebratory card shown to STUDENTS and
 * PARENTS when a result is released.
 *
 * Once per app load it reads the user's UNREAD `result_released` notifications,
 * shows the newest one (mentioning any others), and marks them all read on the
 * server and seen on this device the moment they are picked, so each release
 * pops up exactly once, on any device. For a promotional (whole-year) release
 * it welcomes the pupil to the new class; for a single term it announces the
 * term result.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Sparkles, FileText, X, ArrowRight, PartyPopper } from 'lucide-react';
import notificationService, { AppNotification } from '@services/notificationService';
import useAuthStore from '@store/authStore';

/** The notification payload as an object (older rows may hold a JSON string). */
function payload(n: AppNotification): Record<string, any> {
  const raw: any = n.data;
  if (raw && typeof raw === 'string') {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  return raw && typeof raw === 'object' ? raw : {};
}

/**
 * A stable identity for ONE release (student + year + term), so a duplicate
 * notification for the same release never shows again.
 */
function releaseId(n: AppNotification): string {
  const d = payload(n);
  const student = d.student_id ?? n.sourceId ?? 'self';
  const year = d.academic_year ?? '';
  const term = d.is_year ? 'year' : (d.term ?? d.term_label ?? 'term');
  return `${student}.${year}.${term}`;
}
const releaseKey = (n: AppNotification, userId: string) => `wiskul.resultPopup.seen.${userId}.${releaseId(n)}`;
/** The key used before it was per user, so popups closed earlier stay closed. */
const legacyKey = (n: AppNotification) => `wiskul.resultPopup.seen.${releaseId(n)}`;
const idKey = (n: AppNotification) => `wiskul.resultPopup.seen.id.${n.id}`;

/** Has this release already been shown on this device? */
function alreadySeen(n: AppNotification, userId: string): boolean {
  try {
    return [releaseKey(n, userId), legacyKey(n), idKey(n)].some((k) => localStorage.getItem(k) === '1');
  } catch { return false; }
}

/** Remember, permanently, that this release has been shown. */
function markSeen(n: AppNotification, userId: string): void {
  try {
    localStorage.setItem(releaseKey(n, userId), '1');
    localStorage.setItem(idKey(n), '1');
  } catch { /* ignore */ }
}

/** Only real releases to a family: not withdrawals (same type) or staff notices. */
const isFamilyRelease = (n: AppNotification) => {
  if (n.notificationType !== 'result_released' || n.readAt) return false;
  const kind = payload(n).kind;
  return !kind || kind === 'result_released';
};

/**
 * Users already checked during this app load. MainLayout is rendered by each
 * page, so the popup remounts on every navigation; without this it would query
 * again and could show the next pending release on every page.
 */
const checkedThisLoad = new Set<string>();
/**
 * The popup waiting to be shown. Kept outside the component so that changing
 * page before it appears (or while it is open) carries it over instead of
 * losing it. Cleared when the user closes it.
 */
let queued: { userId: string; notif: AppNotification; others: number } | null = null;

export const ResultReleasePopup: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const eligible = role === 'student' || role === 'parent';

  const [notif, setNotif] = useState<AppNotification | null>(null);
  const [others, setOthers] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const userId = user?.id ? String(user.id) : '';
    if (!eligible || !userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (delay: number) => {
      timer = setTimeout(() => {
        if (!queued || queued.userId !== userId) return;
        setOthers(queued.others);
        setNotif(queued.notif);
      }, delay);
    };
    // Already found earlier in this app load: just carry it over to this page.
    if (queued?.userId === userId) { show(0); return () => { if (timer) clearTimeout(timer); }; }
    if (checkedThisLoad.has(userId)) return;
    checkedThisLoad.add(userId);
    (async () => {
      try {
        const res = await notificationService.list({ unreadOnly: true, type: 'result_released', limit: 50 });
        const releases = res.data.filter(isFamilyRelease);
        if (releases.length === 0) return;

        // Newest first (the API sorts by created_at desc). Collapse duplicates
        // for the same release and skip anything already shown on this device.
        const pending: AppNotification[] = [];
        const keys = new Set<string>();
        for (const n of releases) {
          const k = releaseKey(n, userId);
          if (keys.has(k) || alreadySeen(n, userId)) continue;
          keys.add(k);
          pending.push(n);
        }

        // Every unread release is settled now: shown once (newest), with the
        // rest summarised. Marking them read on the server makes it one-time on
        // every device and in the Android app, not just in this browser.
        for (const n of releases) {
          markSeen(n, userId);
          notificationService.markRead(n.id).catch(() => {});
        }

        if (pending.length === 0) return;
        queued = { userId, notif: pending[0], others: pending.length - 1 };
        // Small delay so the dashboard renders behind the modal first.
        show(700);
      } catch {
        // Let a later page try again if the request itself failed.
        checkedThisLoad.delete(userId);
      }
    })();
    return () => { if (timer) clearTimeout(timer); };
  }, [eligible, user?.id]);

  const dismiss = useCallback((goView: boolean) => {
    const current = notif;
    queued = null; // closed: never shown again
    setClosing(true);
    setTimeout(() => { setNotif(null); setClosing(false); }, 180);
    if (goView) {
      const url = (current ? payload(current).url : null) || '/academic/report-cards';
      navigate(url);
    }
  }, [notif, navigate]);

  if (!notif) return null;

  const d = payload(notif);
  const isYear = !!d.is_year;
  const promoted = !!d.promoted;
  const nextClass = d.next_class as string | undefined;
  const termLabel = d.term_label as string | undefined;
  const studentName = (notif.subject || '').replace(/'s.*$/, '') || 'Your child';

  // Themed by release kind.
  const theme = isYear && promoted
    ? { grad: 'from-emerald-500 to-green-600', icon: <PartyPopper size={30} />, eyebrow: 'Promotion' }
    : isYear
      ? { grad: 'from-[#1d4ed8] to-blue-600', icon: <GraduationCap size={30} />, eyebrow: 'End of Year' }
      : { grad: 'from-violet-500 to-purple-600', icon: <FileText size={30} />, eyebrow: termLabel || 'Term Result' };

  return createPortal(
    <div
      className={`fixed inset-0 z-[2147483000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity ${closing ? 'opacity-0' : 'opacity-100'}`}
      onClick={() => dismiss(false)}
    >
      <div
        className={`w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl transition-transform ${closing ? 'scale-95' : 'scale-100'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className={`relative bg-gradient-to-br ${theme.grad} px-6 py-7 text-center text-white`}>
          <button
            onClick={() => dismiss(false)}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <div className="pointer-events-none absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
          <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/30">
            {theme.icon}
          </div>
          <p className="relative text-[11px] font-bold uppercase tracking-widest text-white/80">{theme.eyebrow}</p>
          <h2 className="relative text-xl font-black mt-0.5">
            {isYear && promoted ? 'Congratulations!' : isYear ? 'Results Are Out' : 'New Result Released'}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-center">
          {isYear && promoted && nextClass ? (
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong className="text-gray-900">{studentName}</strong> has completed the year and been
              <strong className="text-emerald-700"> promoted</strong>. Welcome to
              <strong className="text-gray-900"> {nextClass}</strong>! Tap below to view the full report booklet.
            </p>
          ) : isYear && promoted ? (
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong className="text-gray-900">{studentName}</strong> has been
              <strong className="text-emerald-700"> promoted</strong> to the next class. View the full report booklet below.
            </p>
          ) : isYear ? (
            <p className="text-sm text-gray-700 leading-relaxed">
              The end-of-year report booklet for <strong className="text-gray-900">{studentName}</strong> is now available.
              {d.promotion_text ? <> <br/><span className="text-xs text-gray-500">{d.promotion_text}</span></> : null}
            </p>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">
              The <strong className="text-gray-900">{termLabel}</strong> result sheet for
              <strong className="text-gray-900"> {studentName}</strong> has been released. Tap below to view and download it.
            </p>
          )}

          {d.class_name && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              <Sparkles size={12} /> {d.class_name} · {d.academic_year}
            </div>
          )}
          {others > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              {others === 1 ? '1 other result was' : `${others} other results were`} also released. You can see them all under Report Cards.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={() => dismiss(false)}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Later
          </button>
          <button
            onClick={() => dismiss(true)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-95 bg-gradient-to-r ${theme.grad}`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">View Result <ArrowRight size={15} /></span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ResultReleasePopup;
