/**
 * ResultReleasePopup — a one-time celebratory card shown to STUDENTS and
 * PARENTS when a result is released.
 *
 * It reads the user's in-app notifications, finds the newest UNREAD
 * `result_released` one, shows a modal, and marks it read on dismiss so it only
 * appears once. For a promotional (whole-year) release it welcomes the pupil to
 * the new class; for a single-term release it announces the term result.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Sparkles, FileText, X, ArrowRight, PartyPopper } from 'lucide-react';
import notificationService, { AppNotification } from '@services/notificationService';
import useAuthStore from '@store/authStore';

export const ResultReleasePopup: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const eligible = role === 'student' || role === 'parent';

  const [notif, setNotif] = useState<AppNotification | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!eligible || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await notificationService.list({ unreadOnly: true, limit: 30 });
        const hit = res.data.find((n) => n.notificationType === 'result_released' && !n.readAt);
        if (!cancelled && hit) {
          // Small delay so the dashboard renders behind the modal first.
          setTimeout(() => { if (!cancelled) setNotif(hit); }, 700);
        }
      } catch { /* ignore — no popup */ }
    })();
    return () => { cancelled = true; };
  }, [eligible, user?.id]);

  const dismiss = useCallback(async (goView: boolean) => {
    const current = notif;
    setClosing(true);
    setTimeout(() => { setNotif(null); setClosing(false); }, 180);
    if (current) {
      // Mark read so it never shows again (one-time).
      notificationService.markRead(current.id).catch(() => {});
    }
    if (goView) {
      const url = (current?.data as any)?.url || '/academic/report-cards';
      navigate(url);
    }
  }, [notif, navigate]);

  if (!notif) return null;

  const d = (notif.data || {}) as any;
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
