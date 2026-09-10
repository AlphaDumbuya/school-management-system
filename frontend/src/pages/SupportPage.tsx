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

const NewTicketModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () => supportService.createTicket({ subject, category, priority, description }),
    onSuccess: (res: any) => {
      if (res?.success === false) { showToast.apiError(res.error); return; }
      showToast.success('Ticket submitted. We\'ll be in touch.');
      onCreated();
    },
    onError: () => showToast.error('Could not submit the ticket.'),
  });

  const valid = subject.trim() && description.trim();

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">New Support Ticket</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Brief summary of the issue" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                {TICKET_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Describe what's happening, and any steps to reproduce." />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="default" size="sm" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Send size={15} className="mr-1.5" />} Submit
            </Button>
          </div>
        </div>
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
