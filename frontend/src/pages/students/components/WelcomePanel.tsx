/**
 * WelcomePanel: what a parent reads first when they open the school's link. It explains why the school is asking
 * (the move to a digital system), what to have ready and how long it takes, and only then starts the form.
 * The wording comes from the server (the school's own message, or the default), with the school's name filled in.
 */
import React from 'react';
import { CalendarDays, Camera, HeartPulse, Phone, ShieldCheck } from 'lucide-react';

const READY = [
  { icon: <CalendarDays size={18} aria-hidden="true" />, text: "Your child's date of birth and home address" },
  { icon: <Phone size={18} aria-hidden="true" />, text: 'Your phone number and an email address you use' },
  { icon: <Phone size={18} aria-hidden="true" />, text: "An emergency contact's name and phone number" },
  { icon: <HeartPulse size={18} aria-hidden="true" />, text: 'Any medical condition or allergy the school should know about' },
];

interface Props {
  title?: string;
  school: string;
  message: string;
  /** Shown when a draft from an earlier visit was kept. */
  hasDraft?: boolean;
  onStart: () => void;
}

export const WelcomePanel: React.FC<Props> = ({ title = 'Update your child’s school record', school, message, hasDraft, onStart }) => {
  const paragraphs = message.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <section aria-labelledby="welcome-title" className="rounded-3xl bg-white p-6 text-gray-800 shadow-xl shadow-black/20 ring-1 ring-white/40 dark:bg-gray-900 dark:text-gray-200 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-300">Student records update</p>
      <h2 id="welcome-title" className="mt-2 text-2xl font-black tracking-tight text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-3 leading-relaxed">
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      <div className="mt-6 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
        <p className="text-sm font-bold text-gray-900 dark:text-white">Please have ready</p>
        <ul className="mt-2 space-y-2">
          {READY.map((r) => (
            <li key={r.text} className="flex items-start gap-3 text-sm"><span className="mt-0.5 text-primary-700 dark:text-primary-300">{r.icon}</span><span>{r.text}</span></li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-3 border-t border-gray-200 pt-3 text-sm dark:border-gray-700">
          <Camera size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-gray-500" />
          <span>You do not need to upload a photo. The school will take your child’s photo at school.</span>
        </p>
      </div>

      <p className="mt-5 text-sm font-semibold text-gray-700 dark:text-gray-300">With thanks,<br />The Administration, {school}</p>

      <button type="button" onClick={onStart}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
        {hasDraft ? 'Continue where I stopped' : 'Start the form'}
      </button>
      <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-gray-500">
        <ShieldCheck size={14} aria-hidden="true" /> Your details are seen only by the school.
      </p>
    </section>
  );
};
export default WelcomePanel;
