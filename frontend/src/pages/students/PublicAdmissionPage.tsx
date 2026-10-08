import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, FileText, School, ShieldCheck, Clock, Users,
  User, Phone, HeartPulse, Copy, Check, Mail, AlertCircle,
  ArrowRight, Sparkles,
} from 'lucide-react';
import { Button } from '@components/ui/button';
import { admissionsService } from '@services/admissionsService';
import { AdmissionFormModal } from './components/AdmissionFormModal';
import { showToast } from '@utils/toast';

// The four form steps, surfaced on the landing page so applicants know what to expect.
const STEPS = [
  { icon: <User size={18} />,       title: "Child's information", desc: 'Name, date of birth, class applying for' },
  { icon: <Users size={18} />,      title: 'Parent / guardian',   desc: 'Contact details and a valid email address' },
  { icon: <HeartPulse size={18} />, title: 'Medical information', desc: 'Allergies, medication, first-aid consent' },
  { icon: <Phone size={18} />,      title: 'Emergency contact',   desc: 'Someone we can reach in an emergency' },
];

// What families should have ready before starting.
const PREPARE = [
  "Child's full name and date of birth",
  'A guardian email address (for your receipt)',
  'Guardian phone number',
  'Any medical or allergy details',
];

const PublicAdmissionPage: React.FC = () => {
  const { schoolSlug = '' } = useParams<{ schoolSlug: string }>();
  const [formOpen, setFormOpen] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['public-admission', schoolSlug],
    queryFn: () => admissionsService.getPublicAdmissionInfo(schoolSlug),
    enabled: !!schoolSlug,
    retry: false,
  });
  const info = data?.success ? data.data : undefined;

  const copyRef = async () => {
    if (!applicationNumber) return;
    try {
      await navigator.clipboard.writeText(applicationNumber);
      setCopied(true);
      showToast.success('Reference number copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast.error('Could not copy — please note it down');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8 sm:py-14 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-2xl">

        {/* ── Card ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">

          {/* Header / branding */}
          <div className="relative border-b border-slate-200 bg-gradient-to-br from-[#1d4ed8] to-[#2563eb] px-6 py-9 text-center dark:border-slate-800">
            <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '18px 18px' }} />
            {isLoading ? (
              <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-xl bg-white/20" />
            ) : info?.school.logo_url ? (
              <img src={info.school.logo_url} alt={`${info.school.name} logo`} className="mx-auto mb-4 h-16 w-16 rounded-xl bg-white object-contain p-1 shadow-md" />
            ) : (
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-white/15">
                <School className="text-white" size={34} aria-hidden="true" />
              </div>
            )}
            <h1 className="relative text-xl font-black text-white sm:text-2xl">
              {isLoading ? <span className="inline-block h-6 w-48 animate-pulse rounded bg-white/20" /> : (info?.school.name ?? 'Online Admissions')}
            </h1>
            {info && (
              <p className="relative mt-1.5 text-sm font-medium text-blue-100">Online Admissions Portal</p>
            )}
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8">
            {isLoading ? (
              <LoadingSkeleton />
            ) : !info ? (
              <UnavailableState />
            ) : applicationNumber ? (
              <SuccessState
                schoolName={info.school.name}
                applicationNumber={applicationNumber}
                emailSent={emailSent}
                copied={copied}
                onCopy={copyRef}
              />
            ) : (
              <LandingState
                classCount={info.classes.length}
                onStart={() => setFormOpen(true)}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-600">
          Powered by <span className="font-bold text-slate-500 dark:text-slate-400">Wi<span className="text-amber-500">Skul</span></span> · Your information is transmitted securely
        </p>
      </div>

      {info && (
        <AdmissionFormModal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          onSuccess={(number, sent) => { setApplicationNumber(number || 'Submitted'); setEmailSent(sent === true); }}
          publicSchoolSlug={schoolSlug}
          publicClasses={info.classes}
          captchaSiteKey={info.captcha_site_key || null}
        />
      )}
    </main>
  );
};

// ── Landing ────────────────────────────────────────────────────────────────

const LandingState: React.FC<{ classCount: number; onStart: () => void }> = ({ classCount, onStart }) => (
  <div>
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
        <FileText size={20} />
      </span>
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Student admission application</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Apply online in a few minutes. Submitting an application does not guarantee admission — the school will review it and contact you.
        </p>
      </div>
    </div>

    {/* Trust chips */}
    <div className="mb-6 flex flex-wrap gap-2">
      <Chip icon={<Clock size={13} />} label="Takes about 5 minutes" />
      <Chip icon={<ShieldCheck size={13} />} label="Secure & private" />
      {classCount > 0 && <Chip icon={<Users size={13} />} label={`${classCount} class${classCount === 1 ? '' : 'es'} open`} />}
    </div>

    {/* Steps overview */}
    <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">What you'll fill in</p>
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-blue-400 dark:ring-slate-700">
              {s.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                <span className="mr-1.5 text-slate-400">{i + 1}.</span>{s.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>

    {/* Prepare list */}
    <div className="mb-6">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">
        <Sparkles size={13} /> Have these ready
      </p>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {PREPARE.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <CheckCircle2 size={15} className="flex-shrink-0 text-emerald-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>

    <Button className="w-full justify-center gap-2 py-6 text-base" onClick={onStart}>
      Start application <ArrowRight size={18} />
    </Button>
    <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
      A guardian email is required to receive your application receipt.
    </p>
  </div>
);

// ── Success ────────────────────────────────────────────────────────────────

const SuccessState: React.FC<{
  schoolName: string;
  applicationNumber: string;
  emailSent: boolean | null;
  copied: boolean;
  onCopy: () => void;
}> = ({ schoolName, applicationNumber, emailSent, copied, onCopy }) => (
  <div className="text-center">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
      <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={40} aria-hidden="true" />
    </div>
    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Application received!</h2>
    <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-300">
      Thank you for applying to {schoolName}. Keep this reference number safe — you'll need it for any follow-up.
    </p>

    {/* Reference number with copy */}
    <div className="mx-auto mt-5 max-w-xs">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">Your reference number</p>
      <button
        onClick={onCopy}
        className="group flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600"
      >
        <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">{applicationNumber}</span>
        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </span>
      </button>
    </div>

    {/* Email status */}
    <div className={`mx-auto mt-5 flex max-w-sm items-start gap-2.5 rounded-xl border p-3 text-left text-sm ${
      emailSent
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
    }`}>
      <Mail size={16} className="mt-0.5 flex-shrink-0" />
      <span>
        {emailSent
          ? 'A confirmation email is on its way to the guardian address you provided.'
          : "We couldn't send a confirmation email right now, but your application is safely saved. Please keep your reference number."}
      </span>
    </div>

    {/* What happens next */}
    <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-left dark:border-slate-800 dark:bg-slate-800/30">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">What happens next</p>
      <ol className="space-y-3">
        {[
          'The school reviews your application.',
          'You may be contacted for an interview or assessment.',
          'You will be notified of the decision by email.',
        ].map((text, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{i + 1}</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">{text}</span>
          </li>
        ))}
      </ol>
    </div>
  </div>
);

// ── Unavailable ──────────────────────────────────────────────────────────────

const UnavailableState: React.FC = () => (
  <div className="py-4 text-center">
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
      <AlertCircle className="text-amber-500" size={30} />
    </div>
    <p className="font-semibold text-slate-900 dark:text-white">This application link is unavailable</p>
    <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600 dark:text-slate-300">
      The link may be incorrect or the school's online admissions may be closed. Please double-check the link with the school.
    </p>
  </div>
);

// ── Loading skeleton ─────────────────────────────────────────────────────────

const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
    <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
    <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-800" />
    <div className="mt-6 space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 flex-1 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      ))}
    </div>
    <div className="mt-6 h-12 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
  </div>
);

// ── Small chip ───────────────────────────────────────────────────────────────

const Chip: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
    <span className="text-blue-600 dark:text-blue-400">{icon}</span>
    {label}
  </span>
);

export default PublicAdmissionPage;
