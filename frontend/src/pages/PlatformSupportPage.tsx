/**
 * PlatformSupportPage — /platform/support
 * Super-admin support triage across ALL tenants: list, filter, view thread,
 * reply, and change status.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Loader2, X, Send, Building2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { showToast } from '@utils/toast';
import {
  supportService, SupportTicket, TicketStatus, TICKET_STATUSES,
} from '@services/supportService';

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  'in-progress': 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-gray-200 text-gray-700',
};
const PRIORITY_BADGE: Record<string, string> = {
  low: 'text-gray-500', medium: 'text-blue-600', high: 'text-amber-600', urgent: 'text-red-600',
};

export const PlatformSupportPage: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: resp, isLoading, refetch } = useQuery({
    queryKey: ['platform-tickets', { search, status }],
    queryFn: () => supportService.listAllTickets({ search: search || undefined, status: status || undefined }),
    staleTime: 20_000,
  });
  const tickets: SupportTicket[] = (resp as any)?.data ?? [];

  return (
    <MainLayout>
      <PageShell
        title="Support Triage"
        subtitle="Manage support tickets across all schools"
        breadcrumbs={[{ label: 'Platform', path: '/platform/dashboard' }, { label: 'Support' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchBar placeholder="Search subject or school…" onSearch={setSearch} defaultValue={search} className="w-full sm:max-w-md" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
        ) : tickets.length === 0 ? (
          <EmptyState message="No tickets" description="Support tickets from schools will appear here." />
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="py-3 px-4">Ref</th>
                  <th className="py-3 px-4">School</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} onClick={() => setActiveId(t.id)} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{t.reference}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-200"><span className="inline-flex items-center gap-1"><Building2 size={13} className="text-gray-400" />{t.tenantName || '—'}</span></td>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{t.subject}</td>
                    <td className={`py-3 px-4 text-xs font-semibold ${PRIORITY_BADGE[t.priority]}`}>{t.priority.toUpperCase()}</td>
                    <td className="py-3 px-4"><span className={`px-2.5 py-1 text-xs font-semibold rounded ${STATUS_BADGE[t.status]}`}>{t.status.replace('-', ' ')}</span></td>
                    <td className="py-3 px-4 text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

const AdminTicketModal: React.FC<{ ticketId: string; onClose: () => void; onChanged: () => void }> = ({ ticketId, onClose, onChanged }) => {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');

  const { data: resp, isLoading } = useQuery({
    queryKey: ['platform-ticket', ticketId],
    queryFn: () => supportService.getAdminTicket(ticketId),
    staleTime: 5_000,
  });
  const ticket: SupportTicket | undefined = (resp as any)?.data?.ticket;
  const responses = (resp as any)?.data?.responses ?? [];

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

  const setStatus = useMutation({
    mutationFn: (status: TicketStatus) => supportService.adminSetStatus(ticketId, status),
    onSuccess: (res: any) => {
      if (res?.success === false) { showToast.apiError(res.error); return; }
      showToast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['platform-ticket', ticketId] });
      onChanged();
    },
    onError: () => showToast.error('Status update failed.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-gray-400">{ticket?.reference}</p>
            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">{ticket?.subject || 'Ticket'}</h3>
            {ticket && <p className="text-xs text-gray-500">{ticket.tenantName} · {ticket.requesterName} · {ticket.category}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {ticket && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-xs text-gray-500 mr-1">Set status:</span>
            {TICKET_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus.mutate(s.value)}
                disabled={setStatus.isPending || ticket.status === s.value}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${ticket.status === s.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading || !ticket ? (
            <div className="py-6 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={18} /></div>
          ) : (
            <>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3">
                <p className="text-xs text-gray-500 mb-1">{ticket.requesterName} · {new Date(ticket.createdAt).toLocaleString()}</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{ticket.description}</p>
              </div>
              {responses.map((r: any) => (
                <div key={r.id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500 mb-1">{new Date(r.createdAt).toLocaleString()}</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{r.message}</p>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700 p-3 flex items-end gap-2">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Reply to the school…" className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm resize-none" />
          <Button variant="default" size="sm" disabled={!message.trim() || reply.isPending} onClick={() => reply.mutate()}>
            {reply.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlatformSupportPage;
