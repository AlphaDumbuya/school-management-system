/**
 * SupportPage — /support
 * Tenant-facing support: raise a ticket, see your tickets, and follow the thread.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Plus, Loader2, MessageSquare, X, Send } from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { showToast } from '@utils/toast';
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

export const SupportPage: React.FC = () => {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<SupportTicket | null>(null);

  const { data: resp, isLoading, refetch } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => supportService.listMyTickets(),
    staleTime: 30_000,
  });
  const tickets: SupportTicket[] = (resp as any)?.data ?? [];

  return (
    <MainLayout>
      <PageShell
        title="Support"
        subtitle="Raise a ticket and track responses from the WiSkul team"
        breadcrumbs={[{ label: 'Support' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <Button variant="default" size="sm" onClick={() => setCreating(true)}>
            <Plus size={15} className="mr-1.5" /> New Ticket
          </Button>
        }
      >
        {isLoading ? (
          <div className="py-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
        ) : tickets.length === 0 ? (
          <EmptyState
            message="No support tickets yet"
            description="Need help? Raise a ticket and our team will get back to you."
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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
    </div>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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
    </div>
  );
};

export default SupportPage;
