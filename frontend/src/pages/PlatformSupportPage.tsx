/**
 * PlatformSupportPage — /platform/support
 * Super-admin support triage across ALL tenants.
 * Rich help-desk UI: stats, filters, ticket cards, slide-in thread panel.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy, Loader2, X, Send, Building2, MessageSquare,
  Clock, CheckCircle2, AlertCircle, CircleDot, Filter,
  Paperclip, ChevronDown, RefreshCw, Image as ImageIcon,
  User, Mail, Tag, ArrowUpRight, ChevronRight,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { showToast } from '@utils/toast';
import {
  supportService, SupportTicket, TicketStatus, TICKET_STATUSES,
} from '@services/supportService';

// ── Config ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<TicketStatus, {
  badge: string; panel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  dot: string;
}> = {
  open:         { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',          panel: 'border-blue-400',    icon: CircleDot,    dot: 'bg-blue-500' },
  'in-progress':{ badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',       panel: 'border-amber-400',   icon: Clock,        dot: 'bg-amber-500' },
  resolved:     { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', panel: 'border-emerald-400', icon: CheckCircle2, dot: 'bg-emerald-500' },
  closed:       { badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',              panel: 'border-gray-400',    icon: AlertCircle,  dot: 'bg-gray-400' },
};

const PRIORITY_CONFIG: Record<string, { text: string; dot: string; badge: string }> = {
  low:    { text: 'text-gray-500',  dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  medium: { text: 'text-blue-600',  dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  high:   { text: 'text-amber-600', dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  urgent: { text: 'text-red-600',   dot: 'bg-red-500',     badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const StatusBadge: React.FC<{ status: TicketStatus; sm?: boolean }> = ({ status, sm }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold ${sm ? 'text-[11px]' : 'text-xs'} ${cfg.badge}`}>
      <Icon size={10} />{status.replace('-', ' ')}
    </span>
  );
};

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {priority.toUpperCase()}
    </span>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export const PlatformSupportPage: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: resp, isLoading, refetch } = useQuery({
    queryKey: ['platform-tickets', search, statusFilter, priorityFilter],
    queryFn: () => supportService.listAllTickets({
      search: search || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
    }),
    staleTime: 20_000,
    retry: 1,
  });
  const tickets: SupportTicket[] = (resp as any)?.data ?? [];

  const counts = useMemo(() => ({
    open:        tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in-progress').length,
    resolved:    tickets.filter((t) => t.status === 'resolved').length,
    urgent:      tickets.filter((t) => t.priority === 'urgent').length,
  }), [tickets]);

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) ?? null : null;

  return (
    <MainLayout>
      <PageShell
        title="Support Triage"
        subtitle="Manage support tickets across all schools"
        breadcrumbs={[{ label: 'Platform', href: '/platform/dashboard' }, { label: 'Support' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
      >
        {/* KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Open',        count: counts.open,        dot: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300',    hi: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'In Progress', count: counts.in_progress, dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300',  hi: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'Resolved',    count: counts.resolved,    dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', hi: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Urgent',      count: counts.urgent,      dot: 'bg-red-500',     text: 'text-red-700 dark:text-red-300',      hi: 'bg-red-50 dark:bg-red-900/20' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border border-gray-200 dark:border-gray-700 ${s.hi} px-4 py-3.5 flex items-center gap-3`}>
              <span className={`h-3 w-3 rounded-full flex-shrink-0 ${s.dot}`} />
              <div>
                <p className={`text-2xl font-black ${s.text}`}>{s.count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <SearchBar
            placeholder="Search subject, school or requester…"
            onSearch={setSearch}
            defaultValue={search}
            className="flex-1 min-w-[200px] sm:max-w-sm"
          />
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
            >
              <option value="">All statuses</option>
              {TICKET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
            >
              <option value="">All priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🔵 Medium</option>
              <option value="low">⚪ Low</option>
            </select>
          </div>
        </div>

        {/* Ticket list */}
        {isLoading ? (
          <div className="py-20 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : tickets.length === 0 ? (
          <EmptyState
            message="No tickets found"
            description={search || statusFilter || priorityFilter ? 'Try adjusting your filters.' : 'Support tickets from schools will appear here.'}
          />
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => {
              const isActive = t.id === activeId;
              const statusCfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.open;
              const attachCount = Array.isArray((t as any).attachments) ? (t as any).attachments.length : 0;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(isActive ? null : t.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    isActive
                      ? `border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10 ring-1 ring-blue-200 dark:ring-blue-900/40`
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs text-gray-400">{t.reference}</span>
                        <PriorityBadge priority={t.priority} />
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{t.category}</span>
                        {attachCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
                            <Paperclip size={11} />{attachCount}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 dark:text-white truncate">{t.subject}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1"><Building2 size={12} />{t.tenantName || '—'}</span>
                        {t.requesterName && <><span>·</span><span className="inline-flex items-center gap-1"><User size={11} />{t.requesterName}</span></>}
                        <span>·</span>
                        <span>{new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={t.status} sm />
                      <ChevronRight size={14} className={`text-gray-400 transition-transform ${isActive ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PageShell>

      {/* Slide-in thread panel */}
      {activeId && (
        <TicketPanel
          ticketId={activeId}
          preloadedTicket={activeTicket}
          onClose={() => setActiveId(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ['platform-tickets'] });
            qc.invalidateQueries({ queryKey: ['platform-ticket', activeId] });
          }}
        />
      )}
    </MainLayout>
  );
};

// ── Slide-in ticket panel ─────────────────────────────────────────────────────
const TicketPanel: React.FC<{
  ticketId: string;
  preloadedTicket: SupportTicket | null;
  onClose: () => void;
  onChanged: () => void;
}> = ({ ticketId, preloadedTicket, onClose, onChanged }) => {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [showAttach, setShowAttach] = useState(false);

  const { data: resp, isLoading, isError, refetch } = useQuery({
    queryKey: ['platform-ticket', ticketId],
    queryFn: () => supportService.getAdminTicket(ticketId),
    staleTime: 5_000,
    retry: 2,
  });

  const ticket: SupportTicket | undefined = (resp as any)?.data?.ticket ?? preloadedTicket ?? undefined;
  const responses: any[] = (resp as any)?.data?.responses ?? [];

  const attachments: any[] = useMemo(() => {
    const raw = (ticket as any)?.attachments;
    if (!raw) return [];
    try { return Array.isArray(raw) ? raw : JSON.parse(raw); } catch { return []; }
  }, [ticket]);

  const reply = useMutation({
    mutationFn: () => supportService.adminReply(ticketId, message),
    onSuccess: (res: any) => {
      if (res?.success === false) { showToast.apiError(res.error); return; }
      setMessage('');
      qc.invalidateQueries({ queryKey: ['platform-ticket', ticketId] });
      onChanged();
      showToast.success('Reply sent');
    },
    onError: () => showToast.error('Reply failed.'),
  });

  const changeStatus = useMutation({
    mutationFn: (status: TicketStatus) => supportService.adminSetStatus(ticketId, status),
    onSuccess: (res: any) => {
      if (res?.success === false) { showToast.apiError(res.error); return; }
      showToast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['platform-ticket', ticketId] });
      onChanged();
    },
    onError: () => showToast.error('Status update failed.'),
  });

  const statusCfg = ticket ? (STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open) : STATUS_CONFIG.open;
  const priCfg = ticket ? (PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium) : PRIORITY_CONFIG.medium;

  return (
    <>
      {/* Thin click-to-close strip on the left edge — no full overlay so the
          ticket list stays fully visible and readable behind the panel */}
      <div
        className="fixed inset-y-0 left-0 z-40"
        style={{ right: '512px' }} /* matches panel max-w-xl = 512px */
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700">

        {/* Panel header */}
        <div className={`flex-shrink-0 border-b-2 ${ticket ? statusCfg.panel : 'border-gray-200'} dark:border-opacity-40 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {ticket ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-gray-400">{ticket.reference}</span>
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} sm />
                  </div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white leading-snug">{ticket.subject}</h2>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Building2 size={12} />{ticket.tenantName || '—'}</span>
                    {ticket.requesterName && <span className="inline-flex items-center gap-1"><User size={11} />{ticket.requesterName}</span>}
                    {ticket.requesterEmail && (
                      <a href={`mailto:${ticket.requesterEmail}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <Mail size={11} />{ticket.requesterEmail}
                      </a>
                    )}
                    <span className="inline-flex items-center gap-1"><Tag size={11} />{ticket.category}</span>
                  </div>
                  {attachments.length > 0 && (
                    <button
                      onClick={() => setShowAttach((v) => !v)}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <Paperclip size={11} />{attachments.length} screenshot{attachments.length > 1 ? 's' : ''}
                      <ChevronDown size={11} className={`transition-transform ${showAttach ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </>
              ) : isLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 size={16} className="animate-spin" /> Loading ticket…</div>
              ) : isError ? (
                <div className="text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle size={16} /> Failed to load ticket.
                  <button onClick={() => refetch()} className="text-blue-600 underline">Retry</button>
                </div>
              ) : null}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mt-0.5">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Screenshot previews */}
        {showAttach && attachments.length > 0 && (
          <div className="flex-shrink-0 px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attached screenshots</p>
            <div className="grid grid-cols-3 gap-2">
              {attachments.map((a: any, i: number) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 aspect-video">
                  {a.data ? (
                    <img src={a.data} alt={a.name || `screenshot-${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={24} /></div>
                  )}
                  {a.name && <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">{a.name}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status controls */}
        {ticket && (
          <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
            <span className="text-xs font-semibold text-gray-500 mr-1">Set status:</span>
            {TICKET_STATUSES.map((s) => {
              const cfg = STATUS_CONFIG[s.value as TicketStatus];
              const isActive = ticket.status === s.value;
              const Icon = cfg.icon;
              return (
                <button
                  key={s.value}
                  onClick={() => !isActive && changeStatus.mutate(s.value)}
                  disabled={changeStatus.isPending || isActive}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    isActive
                      ? `${cfg.badge} border-transparent cursor-default shadow-sm`
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 bg-transparent'
                  }`}
                >
                  <Icon size={12} />{s.label}
                  {changeStatus.isPending && isActive && <Loader2 size={10} className="animate-spin" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading && !ticket ? (
            <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
              <Loader2 className="animate-spin" size={24} />
              <p className="text-sm">Loading ticket…</p>
            </div>
          ) : isError && !ticket ? (
            <div className="py-12 flex flex-col items-center gap-3 text-red-500">
              <AlertCircle size={28} />
              <p className="text-sm font-semibold">Failed to load ticket details</p>
              <button onClick={() => refetch()} className="text-sm text-blue-600 underline flex items-center gap-1">
                <RefreshCw size={13} /> Try again
              </button>
            </div>
          ) : ticket ? (
            <>
              {/* Original request */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <User size={13} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{ticket.requesterName || 'Requester'}</span>
                    {ticket.requesterEmail && (
                      <a href={`mailto:${ticket.requesterEmail}`} className="text-xs text-blue-600 hover:underline">&lt;{ticket.requesterEmail}&gt;</a>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(ticket.createdAt).toLocaleString()}</span>
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                </div>
              </div>

              {/* Responses */}
              {responses.length === 0 && !isLoading && (
                <p className="text-center text-xs text-gray-400 py-3">No replies yet. Be the first to respond.</p>
              )}
              {responses.map((r: any, i: number) => (
                <div key={r.id ?? i} className={`rounded-xl border overflow-hidden ${r.isInternal ? 'border-amber-200 dark:border-amber-900/40' : 'border-blue-200 dark:border-blue-900/30'}`}>
                  <div className={`flex items-center justify-between px-4 py-2.5 border-b ${r.isInternal ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/40' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center ${r.isInternal ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                        <MessageSquare size={13} className={r.isInternal ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                        WiSkul Support
                        {r.isInternal && <span className="ml-1.5 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase">(internal)</span>}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{r.message}</p>
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </div>

        {/* Reply box */}
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
          {ticket?.status === 'closed' ? (
            <div className="text-center text-xs text-gray-400 py-1">
              This ticket is closed. Change the status above to reopen it and reply.
            </div>
          ) : (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Write a reply to the school… Be clear and helpful."
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-400">{message.length} characters</p>
                <Button
                  variant="default"
                  size="sm"
                  disabled={!message.trim() || reply.isPending || !ticket}
                  onClick={() => reply.mutate()}
                >
                  {reply.isPending
                    ? <><Loader2 size={14} className="animate-spin mr-1.5" /> Sending…</>
                    : <><Send size={14} className="mr-1.5" /> Send reply</>}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default PlatformSupportPage;
