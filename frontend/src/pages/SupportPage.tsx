/**
 * SupportPage — /support
 * The help-center HOME: a clean directory of module topics (role-aware), a
 * search, a short FAQ, and the support-ticket system. Each topic links to its
 * own descriptive guide at /support/:topicId (see SupportTopicPage).
 */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy, Plus, Loader2, MessageSquare, X, Send, Search, ArrowRight,
  ChevronDown, Rocket, HelpCircle, Ticket, Mail,
  Settings, Users, GraduationCap, ClipboardCheck, Wallet, CreditCard,
  CalendarDays, Megaphone, BookOpen, Building, ShieldCheck,
  Wrench, CreditCard as BillingIcon, UserCog, Lightbulb, BookMarked,
  MoreHorizontal, AlertTriangle, AlertCircle, CheckCircle2, ChevronLeft,
  FileQuestion, Star, ImagePlus, Paperclip, Trash2,
} from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { showToast } from '@utils/toast';
import { useAuth } from '@hooks/useAuth';
import { getModulesForRole, richToPlain, HelpModule } from '@lib/helpCenter';
import {
  supportService, SupportTicket, TicketStatus,
  TICKET_CATEGORIES, TICKET_PRIORITIES,
} from '@services/supportService';

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-gray-200 text-gray-700',
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-600',
  high: 'text-amber-600',
  urgent: 'text-red-600',
};

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Settings, Users, GraduationCap, ClipboardCheck, Wallet, CreditCard,
  CalendarDays, Megaphone, BookOpen, Building, ShieldCheck,
};

const TOPIC_ACCENTS = [
  'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300',
  'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
  'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300',
  'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300',
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300',
];

interface Faq { q: string; a: string }

const COMMON_FAQ: Faq[] = [
  { q: 'How do I secure my account with two-factor authentication?', a: 'Open Settings → Security and follow the prompts to enable 2FA using an authenticator app. We strongly recommend this for every account.' },
  { q: 'I forgot my password — what do I do?', a: 'Sign out and use the "Forgot password" link on the login screen. A secure reset link is emailed to you. If you don\'t receive it, check spam or raise a ticket below.' },
  { q: 'How do I update my profile photo?', a: 'Go to your Profile / Verification page and upload a photo. Once verified, a badge appears next to your name across the app.' },
  { q: 'The app isn\'t showing my latest changes.', a: 'The app caches for offline use. Pull to refresh, or if an update badge appears at the top, tap it to load the newest version.' },
];

export const SupportPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = user?.role;

  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [search, setSearch] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: resp, isLoading, refetch } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => supportService.listMyTickets(),
    staleTime: 30_000,
  });
  const tickets: SupportTicket[] = (resp as any)?.data ?? [];

  const modules = useMemo(() => getModulesForRole(role), [role]);
  const q = search.trim().toLowerCase();

  const filteredModules = useMemo(() => {
    if (!q) return modules;
    return modules.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      richToPlain(m.intro).toLowerCase().includes(q) ||
      m.articles.some((a) => a.heading.toLowerCase().includes(q))
    );
  }, [modules, q]);

  const filteredFaqs = useMemo(() => {
    if (!q) return COMMON_FAQ;
    return COMMON_FAQ.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [q]);

  return (
    <MainLayout>
      <PageShell
        title="Help & Support"
        subtitle="Browse guides by topic, or reach the WiSkul team"
        breadcrumbs={[{ label: 'Support' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <Button variant="default" size="sm" onClick={() => setCreating(true)}>
            <Plus size={15} className="mr-1.5" /> New Ticket
          </Button>
        }
      >
        {/* Hero + search */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 sm:p-8 text-white shadow-sm">
          <div className="flex items-center gap-2 text-blue-100 text-sm font-medium">
            <LifeBuoy size={18} /> WiSkul Help Center
          </div>
          <h2 className="mt-2 text-xl sm:text-2xl font-bold">How can we help you today?</h2>
          <p className="mt-1 text-sm text-blue-100 max-w-xl">
            Pick a topic to see a step-by-step guide, search for something specific, or raise a ticket.
          </p>
          <div className="mt-4 relative max-w-xl">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search help topics…"
              className="w-full rounded-xl border border-transparent bg-white pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/60"
            />
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction icon={Rocket} label="Getting started" to="/guide" accent="blue" />
          <QuickAction icon={Ticket} label="My tickets" onClick={() => document.getElementById('tickets-section')?.scrollIntoView({ behavior: 'smooth' })} accent="violet" />
          <QuickAction icon={Mail} label="Email support" href="mailto:support@wiskulsl.com" accent="emerald" />
          <QuickAction icon={ShieldCheck} label="Account security" to="/settings?tab=security" accent="amber" />
        </div>

        {/* Topic directory */}
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={18} className="text-blue-600" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Browse by topic</h3>
          </div>

          {filteredModules.length === 0 ? (
            <p className="text-sm text-gray-500">No topics match “{search}”. Try a different search or raise a ticket below.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModules.map((m, i) => (
                <TopicCard key={m.id} module={m} accent={TOPIC_ACCENTS[i % TOPIC_ACCENTS.length]} />
              ))}
            </div>
          )}
        </section>

        {/* FAQ */}
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle size={18} className="text-blue-600" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Quick answers</h3>
          </div>
          {filteredFaqs.length === 0 ? (
            <p className="text-sm text-gray-500">No answers match “{search}”.</p>
          ) : (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden bg-white dark:bg-gray-800">
              {filteredFaqs.map((f, i) => (
                <div key={i}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{f.q}</span>
                    <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 -mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{f.a}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Contact CTA */}
        <section className="mt-8 rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Still need a hand?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
              Raise a ticket and the WiSkul team will follow up. You can also email <a href="mailto:support@wiskulsl.com" className="text-blue-600 font-medium underline">support@wiskulsl.com</a>.
            </p>
          </div>
          <Button variant="default" onClick={() => setCreating(true)} className="shrink-0">
            <Plus size={16} className="mr-1.5" /> Contact support
          </Button>
        </section>

        {/* Tickets */}
        <section id="tickets-section" className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Ticket size={18} className="text-blue-600" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Your support tickets</h3>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} className="mr-1" /> New
            </Button>
          </div>

          {isLoading ? (
            <div className="py-12 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
          ) : tickets.length === 0 ? (
            <EmptyState
              message="No support tickets yet"
              description="Need help beyond the guides above? Raise a ticket and our team will get back to you."
              action={{ label: 'New Ticket', onClick: () => setCreating(true) }}
            />
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActive(t)}
                  className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">{t.reference}</span>
                        <span className={`text-xs font-semibold ${PRIORITY_BADGE[t.priority]}`}>{t.priority.toUpperCase()}</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white truncate mt-0.5">{t.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.category} · {new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded ${STATUS_BADGE[t.status]}`}>
                      {t.status.replace('-', ' ')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </PageShell>

      {creating && (
        <NewTicketModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['my-tickets'] }); }}
        />
      )}
      {active && (
        <TicketThreadModal ticket={active} onClose={() => setActive(null)} onChanged={() => qc.invalidateQueries({ queryKey: ['my-tickets'] })} />
      )}
    </MainLayout>
  );
};

// ── Quick action tile ─────────────────────────────────────────────────────────
const QUICK_ACCENT: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
};

const QuickAction: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  accent: keyof typeof QUICK_ACCENT;
}> = ({ icon: Icon, label, to, href, onClick, accent }) => {
  const inner = (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-center hover:border-blue-300 transition-colors h-full">
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${QUICK_ACCENT[accent]}`}>
        <Icon size={20} />
      </span>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{label}</span>
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  if (href) return <a href={href}>{inner}</a>;
  return <button type="button" onClick={onClick} className="w-full">{inner}</button>;
};

// ── Topic card → links to the module guide ─────────────────────────────────────
const TopicCard: React.FC<{ module: HelpModule; accent: string }> = ({ module, accent }) => {
  const Icon = ICONS[module.icon] || BookOpen;
  return (
    <Link
      to={`/support/${module.id}`}
      className="group rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 flex flex-col hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
        <Icon size={22} />
      </span>
      <h4 className="mt-3 font-bold text-gray-900 dark:text-white">{module.title}</h4>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex-1">{module.summary}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:gap-1.5 transition-all">
        View guide <ArrowRight size={14} />
      </span>
    </Link>
  );
};

// ── New Ticket Modal — polished multi-step ────────────────────────────────────

const CATEGORY_OPTIONS = [
  {
    value: 'Technical Issue',
    icon: Wrench,
    color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40',
    selected: 'ring-2 ring-red-400 border-red-400 bg-red-50 dark:bg-red-900/30',
    desc: 'Something is broken or not working',
  },
  {
    value: 'Billing',
    icon: BillingIcon,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40',
    selected: 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
    desc: 'Subscription, payments or invoices',
  },
  {
    value: 'Account',
    icon: UserCog,
    color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40',
    selected: 'ring-2 ring-blue-400 border-blue-400 bg-blue-50 dark:bg-blue-900/30',
    desc: 'Login, access, users or settings',
  },
  {
    value: 'Feature Request',
    icon: Star,
    color: 'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-900/40',
    selected: 'ring-2 ring-violet-400 border-violet-400 bg-violet-50 dark:bg-violet-900/30',
    desc: 'Suggest an improvement or new feature',
  },
  {
    value: 'How-to / Guidance',
    icon: BookMarked,
    color: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40',
    selected: 'ring-2 ring-amber-400 border-amber-400 bg-amber-50 dark:bg-amber-900/30',
    desc: 'How does something work?',
  },
  {
    value: 'Other',
    icon: MoreHorizontal,
    color: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
    selected: 'ring-2 ring-gray-400 border-gray-400 bg-gray-100 dark:bg-gray-600',
    desc: 'Anything else',
  },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'low' as const, label: 'Low', sub: 'General questions', dot: 'bg-gray-400' },
  { value: 'medium' as const, label: 'Medium', sub: 'Minor impact on work', dot: 'bg-blue-500' },
  { value: 'high' as const, label: 'High', sub: 'Blocking important tasks', dot: 'bg-amber-500' },
  { value: 'urgent' as const, label: 'Urgent', sub: 'School operations halted', dot: 'bg-red-500' },
];

const CATEGORY_TIPS: Record<string, string> = {
  'Technical Issue': 'Include the page or feature where the issue appears, what you did, what happened, and what you expected.',
  'Billing': 'Include your subscription plan, the date of the charge or invoice, and the amount in question.',
  'Account': 'Include the affected user\'s email or role, and whether the issue affects just one account or multiple.',
  'Feature Request': 'Describe your workflow and what problem the feature would solve. Screenshots or examples help.',
  'How-to / Guidance': 'Tell us which feature you\'re trying to use and what you\'ve already tried.',
  'Other': 'Describe the situation clearly so we can route it to the right team.',
};

const NewTicketModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; data: string; mimeType: string; preview: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const catOpt = CATEGORY_OPTIONS.find((c) => c.value === category);
  const tip = category ? CATEGORY_TIPS[category] : '';
  const valid = subject.trim().length >= 5 && description.trim().length >= 20;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    const maxSizeMB = 5;
    Array.from(files).slice(0, 4 - attachments.length).forEach((file) => {
      if (!allowed.includes(file.type)) { showToast.error(`${file.name}: only PNG, JPG, WEBP or GIF allowed`); return; }
      if (file.size > maxSizeMB * 1024 * 1024) { showToast.error(`${file.name}: max ${maxSizeMB}MB per file`); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          { name: file.name, data, mimeType: file.type, preview: data },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (i: number) =>
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));

  const mutation = useMutation({
    mutationFn: () => supportService.createTicket({
      subject, category, priority, description,
      attachments: attachments.map(({ name, data, mimeType }) => ({ name, data, mimeType })),
    }),
    onSuccess: (res: any) => {
      if (res?.success === false) { showToast.apiError(res.error); return; }
      setStep(3);
    },
    onError: () => showToast.error('Could not submit the ticket. Please try again.'),
  });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col max-h-[92dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mr-1">
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {step === 1 && 'What can we help with?'}
                {step === 2 && 'Tell us more'}
                {step === 3 && 'Ticket submitted'}
              </h3>
              {step < 3 && (
                <p className="text-xs text-gray-400 mt-0.5">Step {step} of 2</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress dots */}
            {step < 3 && (
              <div className="flex gap-1.5">
                {[1, 2].map((s) => (
                  <span key={s} className={`h-1.5 rounded-full transition-all ${step >= s ? 'w-4 bg-blue-600' : 'w-1.5 bg-gray-200 dark:bg-gray-700'}`} />
                ))}
              </div>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Step 1: Category pick */}
          {step === 1 && (
            <div className="p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Choose the type that best describes your issue and we'll route it to the right team.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = category === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setCategory(opt.value); setStep(2); }}
                      className={`group relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all
                        ${isSelected ? opt.selected : `hover:border-blue-300 dark:hover:border-blue-700 ${opt.color}`}`}
                    >
                      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg
                        ${isSelected ? '' : opt.color}`}>
                        <Icon size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{opt.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div className="p-5 space-y-5">
              {/* Category badge */}
              {catOpt && (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${catOpt.color}`}>
                  <catOpt.icon size={13} />
                  {catOpt.value}
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Summarise the issue in a few words…"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{subject.length}/120</p>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Priority <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all
                        ${priority === p.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${p.dot}`} />
                      <div>
                        <p className={`text-xs font-bold ${priority === p.value ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>{p.label}</p>
                        <p className="text-[10px] text-gray-400 leading-snug">{p.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Description <span className="text-red-500">*</span>
                </label>
                {tip && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 px-3 py-2.5 mb-2">
                    <Lightbulb size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{tip}</p>
                  </div>
                )}
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Describe the issue in detail. Include what you were doing, what went wrong, and any error messages you saw."
                />
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-xs ${description.trim().length < 20 && description.length > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {description.trim().length < 20 ? `${20 - description.trim().length} more characters needed` : ''}
                  </p>
                  <p className="text-xs text-gray-400">{description.length} chars</p>
                </div>
              </div>

              {/* Screenshots (optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Screenshots <span className="text-xs font-normal text-gray-400 ml-1">Optional · up to 4 images · max 5 MB each</span>
                  </label>
                </div>

                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors
                    ${attachments.length >= 4
                      ? 'border-gray-200 dark:border-gray-700 opacity-50 pointer-events-none'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-blue-900/10'}`}
                >
                  <ImagePlus size={22} className="text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Click to upload</span> or drag &amp; drop
                  </p>
                  <p className="text-xs text-gray-400">PNG, JPG, WEBP or GIF</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>

                {/* Previews */}
                {attachments.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {attachments.map((a, i) => (
                      <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <img src={a.preview} alt={a.name} className="w-full h-24 object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full bg-red-500 text-white transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5 truncate">{a.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="p-8 flex flex-col items-center text-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mb-4">
                <CheckCircle2 size={32} />
              </span>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">We've got your ticket!</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-xs leading-relaxed">
                Our team will review it and get back to you. You can track replies here in your{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-200">Support Tickets</span> list.
              </p>
              <div className="mt-6 w-full rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-left space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Summary</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{subject}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {catOpt && (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${catOpt.color}`}>
                      <catOpt.icon size={11} /> {catOpt.value}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">·</span>
                  <span className={`text-xs font-semibold ${PRIORITY_OPTIONS.find(p => p.value === priority)?.dot.replace('bg-', 'text-').replace('-500', '-600') ?? 'text-gray-600'}`}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)} priority
                  </span>
                </div>
                {attachments.length > 0 && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Paperclip size={11} /> {attachments.length} screenshot{attachments.length > 1 ? 's' : ''} attached
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 3 && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 flex-shrink-0">
            <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">
              Cancel
            </button>
            {step === 1 ? (
              <Button variant="default" size="sm" disabled={!category} onClick={() => setStep(2)}>
                Continue <ArrowRight size={14} className="ml-1.5" />
              </Button>
            ) : (
              <Button variant="default" size="sm" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin mr-1.5" /> Submitting…</>
                ) : (
                  <><Send size={14} className="mr-1.5" /> Submit ticket</>
                )}
              </Button>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
            <Button variant="default" className="w-full" onClick={onCreated}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

const TicketThreadModal: React.FC<{ ticket: SupportTicket; onClose: () => void; onChanged: () => void }> = ({ ticket, onClose, onChanged }) => {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');

  const { data: resp, isLoading } = useQuery({
    queryKey: ['ticket-responses', ticket.id],
    queryFn: () => supportService.getResponses(ticket.id),
    staleTime: 10_000,
  });
  const responses = (resp as any)?.data ?? [];

  const reply = useMutation({
    mutationFn: () => supportService.reply(ticket.id, message),
    onSuccess: (res: any) => {
      if (res?.success === false) { showToast.apiError(res.error); return; }
      setMessage('');
      qc.invalidateQueries({ queryKey: ['ticket-responses', ticket.id] });
      onChanged();
    },
    onError: () => showToast.error('Could not send your reply.'),
  });

  const canReply = ticket.status !== 'closed';

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-gray-400">{ticket.reference}</p>
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{ticket.subject}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3">
            <p className="text-xs text-gray-500 mb-1">You · {new Date(ticket.createdAt).toLocaleString()}</p>
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{ticket.description}</p>
          </div>
          {isLoading ? (
            <div className="py-6 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={18} /></div>
          ) : (
            responses.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><MessageSquare size={12} /> {new Date(r.createdAt).toLocaleString()}</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{r.message}</p>
              </div>
            ))
          )}
        </div>

        {canReply ? (
          <div className="border-t border-gray-100 dark:border-gray-700 p-3 flex items-end gap-2">
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Write a reply…" className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm resize-none" />
            <Button variant="default" size="sm" disabled={!message.trim() || reply.isPending} onClick={() => reply.mutate()}>
              {reply.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </Button>
          </div>
        ) : (
          <div className="border-t border-gray-100 dark:border-gray-700 p-3 text-center text-xs text-gray-400">This ticket is closed.</div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SupportPage;
