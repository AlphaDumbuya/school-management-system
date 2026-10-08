/**
 * PromotionWelcomeBanner — a one-time, dismissible welcome-and-guide banner
 * shown to a staff member right after they've been promoted (e.g. to Principal).
 *
 * The backend sets a `promotionWelcome` payload on the user when their
 * designation changes and clears it the moment /auth/me delivers it, so it is
 * inherently one-time per promotion. We additionally remember the dismissal in
 * localStorage keyed by the promotion timestamp so a mid-session reload doesn't
 * resurface a banner the user already closed.
 */
import React, { useMemo, useState } from 'react';
import { PartyPopper, X, ArrowRight } from 'lucide-react';
import useAuthStore from '@store/authStore';

const ROLE_GUIDE: Record<string, { blurb: string; tips: string[] }> = {
  principal: {
    blurb: 'You now have full administrative access to your school.',
    tips: [
      'Manage staff, students and classes from the sidebar',
      'Review finance, attendance and results dashboards',
      'Configure school settings and send announcements',
    ],
  },
  head_teacher: {
    blurb: 'You now lead your primary school with full administrative access.',
    tips: [
      'Manage staff, pupils and classes from the sidebar',
      'Review attendance, results and finance dashboards',
      'Configure school settings and send announcements',
    ],
  },
  vice_head_teacher: {
    blurb: 'Your portal now reflects your Vice Head Teacher responsibilities.',
    tips: ['Oversee classes and staff', 'Monitor attendance and discipline', 'Support the Head Teacher'],
  },
  vice_principal: {
    blurb: 'Your portal now reflects your Vice Principal responsibilities.',
    tips: ['Oversee classes and staff', 'Monitor attendance and discipline', 'Support day-to-day operations'],
  },
  bursar: {
    blurb: 'You now manage the school finances.',
    tips: [
      'Record and track fee payments',
      'Review billing, collections and outstanding balances',
      'Send balance reminders and export finance reports',
    ],
  },
  admissions_officer: {
    blurb: 'You now run admissions for the school.',
    tips: [
      'Share the online application link and review new applications',
      'Interview, decide and enrol accepted children into this year’s classes',
      'Keep student records, parent logins and ID cards up to date',
    ],
  },
  administrator: {
    blurb: 'You now handle admissions and general administration.',
    tips: [
      'Review and process admission applications',
      'Manage student records and enrolment',
      'Coordinate day-to-day administrative tasks',
    ],
  },
  hod: {
    blurb: 'You now lead your department.',
    tips: ['Coordinate your subject teachers', 'Track results across your department', 'Guide lesson planning'],
  },
  senior_teacher: {
    blurb: 'You have been recognised as a Senior Teacher.',
    tips: ['Mentor other teachers', 'Lead by example in your classes'],
  },
  class_teacher: {
    blurb: 'You are now the Class Master for your primary class.',
    tips: ['Take daily attendance', 'Track your class results', 'Be the first point of contact for parents'],
  },
  form_teacher: {
    blurb: 'You are now the Form Master for your secondary class.',
    tips: ['Take daily attendance', 'Track your class results', 'Be the first point of contact for parents'],
  },
  subject_teacher: {
    blurb: 'Your teaching assignments have been updated.',
    tips: ['Check your assigned classes and subjects', 'Record attendance and results'],
  },
};

export const PromotionWelcomeBanner: React.FC = () => {
  const user = useAuthStore((s) => s.user) as any;
  const pw = user?.promotionWelcome as { role?: string; label?: string; at?: string } | null | undefined;

  const storageKey = useMemo(() => (pw?.at ? `wiskul.promo.dismissed.${pw.at}` : ''), [pw?.at]);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return storageKey ? localStorage.getItem(storageKey) === '1' : false; } catch { return false; }
  });

  if (!pw || !pw.label || dismissed) return null;

  const guide = ROLE_GUIDE[String(pw.role)] || ROLE_GUIDE.subject_teacher;

  const close = () => {
    try { if (storageKey) localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/10 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
          <PartyPopper size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm sm:text-base font-black text-amber-900 dark:text-amber-200">
              Welcome, {pw.label}! 🎉
            </h3>
            <button
              onClick={close}
              aria-label="Dismiss"
              className="shrink-0 w-7 h-7 rounded-lg text-amber-700/70 hover:bg-amber-100 dark:hover:bg-amber-900/30 flex items-center justify-center transition"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">{guide.blurb}</p>
          <ul className="mt-2.5 space-y-1">
            {guide.tips.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs sm:text-[13px] text-amber-900/80 dark:text-amber-200/70">
                <ArrowRight size={13} className="mt-0.5 shrink-0 text-amber-600" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={close}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 transition"
          >
            Got it, let's go <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromotionWelcomeBanner;
