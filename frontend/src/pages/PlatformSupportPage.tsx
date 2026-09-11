/**
 * PlatformSupportPage — /platform/support
 * Super-admin support triage across ALL tenants.
 * Aligned with the upgraded tenant support UI: same status/priority palette,
 * attachment previews, and a clean thread modal with inline status control.
 */
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy, Loader2, X, Send, Building2, MessageSquare,
  Clock, CheckCircle2, AlertCircle, CircleDot, Filter,
  Image as ImageIcon, Paperclip, ChevronDown,
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

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<TicketStatus, {
  badge: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  dot: string;
}> = {
  open:        { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',         icon: CircleDot,    dot: 'bg-blue-500' },
  'in-progress':{ badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',     icon: Clock,        dot: 'bg-amber-500' },
  resolved:    { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle2, dot: 'bg-emerald-500' },
  closed:      { badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',             icon: AlertCircle,  dot: 'bg-gray-400' },
};

const PRIORITY_CONFIG: Record<string, { text: string; dot: string }> = {
  low:    { text: 'text-gray-500',    dot: 'bg-gray-400' },
  medium: { text: 'text-blue-600',    dot: 'bg-blue-500' },
  high:   { text: 'text-amber-600',   dot: 'bg-amber-500' },
  urgent: { text: 'text-red-600',     dot: 'bg-red-500' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: TicketStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${cfg.badge}`}>
      <Icon size={11} />{status.replace('-', ' ')}
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
    queryKey: ['platform-tickets', { search, statusFilter, priorityFilter }],
    queryFn: () => supportService.listAllTickets({
      search: search || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
    }),
    staleTime: 20_000,
  });
  const tickets: SupportTicket[] = (resp as any)?.data ?? [];

  // Summary counts
  const counts = useMemo(() => ({
    open:        tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in-progress').length,
    resolved:    tickets.filter((t) => t.status === 'resolved').length,
    urgent:      tickets.filter((t) => t.priority === 'urgent').length,
  }), [tickets]);

  return (
    <MainLayout>
      <PageShell
        title="Support Triage"
        subtitle="Manage support tickets across all schools"
        breadcrumbs={[{ label: 'Platform', href: '/platform/dashboard' }, { label: 'Support' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
      >
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Open',        count: counts.open,        dot: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300' },
            { label: 'In Progress', count: counts.in_progress, dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300' },
            { label: 'Resolved',    count: counts.resolved,    dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
            { label: 'Urgent',      count: counts.urgent,      dot: 'bg-red-500',     text: 'text-red-700 dark:text-red-300' },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
              <div>
                <p className={`text-xl font-black ${s.text}`}>{s.count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <SearchBar placeholder="Search subject, school or requester…" onSearch={setSearch} defaultValue={search} className="flex-1 min-w-[200px] sm:max-w-sm" />
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
            >
              <option value="">All statuses</option>
              {TICKET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
            >
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Ticket list */}
        {isLoading ? (
          <div className="py-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
        ) : tickets.length === 0 ? (
          <EmptyState message="No tickets found" description={search || statusFilter || priorityFilter ? 'Try adjusting your filters.' : 'Support tickets from schools will appear here.'} />
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => {
              const priCfg = PRIORITY_CONFIG[t.priority] ?? PRIORITY_CONFIG.medium;
              const attachCount = Array.isArray((t as any).attachments) ? (t as any).attachments.length : 0;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gray-400">{t.reference}</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${priCfg.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${priCfg.dot}`} />
                          {t.priority.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">{t.category}</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white truncate mt-0.5">{t.subject}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Building2 size={12} />{t.tenantName || '—'}
                        </span>
                        {t.requesterName && (
                          <span className="text-xs text-gray-400">· {t.requesterName}</span>
                        )}
                        <span className="text-xs text-gray-400">· {new Date(t.createdAt).toLocaleDateString()}</span>
                        {attachCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <Paperclip size={11} />{attachCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PageShell>

      {activeId && (
        <AdminTicketModal
          ticketId={activeId}
          onClose={() => setActiveId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ['platform-tickets'] })}
        />
      )}
    </MainLayout>
  );
};

// ── Admin thread modal ────────────────────────────────────────────────────────
const AdminTicketModal: React.FC<{ ticketId: string; onClose: () => void; onChanged: () => void }> = ({ ticketId, onClose, onChanged }) => {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [showAttach, setShowAttach] = useState(false);

  const { data: resp, isLoading } = useQuery({
    queryKey: ['platform-ticket', ticketId],
    queryFn: () => supportService.getAdminTicket(ticketId),
    staleTime: 5_000,
  });
  const ticket: SupportTicket | undefined = (resp as any)?.data?.ticket;
  const responses: any[] = (resp as any)?.data?.responses ?? [];

  // Ticket attachments (screenshots submitted with the ticket)
  const ticketAttachments: any[] = useMemo(() => {
    const raw = (ticket as any)?.attachments;
    if (!raw) return [];
    try { return Array.isArray(raw) ? raw : JSON.parse(raw); }
    catch { return []; }
  }, [ticket]);

  const reply = useMutation({
    mutationFn: () => supportService.adminReply(ticketId, message),
    onSuccess: (res: any) => {
      if (res?.success === false) { showToast.apiError(res.error); return; }
      setMessage('');
      qc.invalidateQueries({ queryKey: ['platform-ticket', ticketId] });
      onChanged();
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

  const priCfg = ticket ? (PRIORITY_CONFIG[ticket.priority] ?? PRIORITY_CONFIG.medium) : PRIORITY_CONFIG.medium;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-gray-900 shadow-2xl max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="min-w-0">
            {ticket && (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-mono text-xs text-gray-400">{ticket.reference}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${priCfg.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${priCfg.dot}`} />
                    {ticket.priority.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400">{ticket.category}</span>
                  {ticketAttachments.length > 0 && (
                    <button
                      onClick={() => setShowAttach((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <Paperclip size={11} />{ticketAttachments.length} screenshot{ticketAttachments.length > 1 ? 's' : ''}
                      <ChevronDown size={11} className={`transition-transform ${showAttach ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{ticket.subject}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                  <Building2 size={12} /><span>{ticket.tenantName || '—'}</span>
                  {ticket.requesterName && <><span>·</span><span>{ticket.requesterName}</span></>}
                  {ticket.requesterEmail && <><span>·</span><a href={`mailto:${ticket.requesterEmail}`} className="text-blue-600 hover:underline">{ticket.requesterEmail}</a></>}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mt-0.5"><X size={20} /></button>
        </div>

        {/* Attachment previews (collapsed by default) */}
        {showAttach && ticketAttachments.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ticketAttachments.map((a: any, i: number) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  {a.data ? (
                    <img src={a.data} alt={a.name || `screenshot-${i + 1}`} className="w-full h-20 object-cover" />
                  ) : (
                    <div className="w-full h-20 flex items-center justify-center text-gray-400">
                      <ImageIcon size={22} />
                    </div>
                  )}
                  {a.name && <p className="text-[10px] text-gray-500 px-1.5 py-0.5 truncate">{a.name}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status controls */}
        {ticket && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-500 mr-1">Status:</span>
            {TICKET_STATUSES.map((s) => {
              const cfg = STATUS_CONFIG[s.value as TicketStatus];
              const isActive = ticket.status === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => !isActive && changeStatus.mutate(s.value)}
                  disabled={changeStatus.isPending || isActive}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors
                    ${isActive ? cfg.badge + ' border-transparent cursor-default' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  {isActive && <cfg.icon size={11} />}
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading || !ticket ? (
            <div className="py-8 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
          ) : (
            <>
              {/* Original ticket */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{ticket.requesterName || 'Requester'}</p>
                  <p className="text-xs text-gray-400">{new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
              </div>

              {/* Responses */}
              {responses.map((r: any) => (
                <div key={r.id} className={`rounded-xl border p-4 ${r.isInternal ? 'border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10' : 'border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <MessageSquare size={12} className="text-blue-500" />
                      WiSkul Support
                      {r.isInternal && <span className="ml-1 text-amber-600 text-[10px] font-bold uppercase">(internal)</span>}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{r.message}</p>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Reply box */}
        {ticket?.status !== 'closed' && (
          <div className="border-t border-gray-100 dark:border-gray-800 p-4 flex-shrink-0">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Write a reply to the school…"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-2"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={!message.trim() || reply.isPending}
                onClick={() => reply.mutate()}
              >
                {reply.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Send size={14} className="mr-1.5" />}
                Send reply
              </Button>
            </div>
          </div>
        )}
        {ticket?.status === 'closed' && (
          <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 text-center text-xs text-gray-400 flex-shrink-0">
            This ticket is closed. Change the status above to reopen it.
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default PlatformSupportPage;
