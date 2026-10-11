/**
 * PlatformDemoRequestsPage — /platform/demo-requests (super admin).
 * Everyone who asked for the live demo: who opened it, which portals, whether
 * they went on to register a school, plus resend links, notes and follow-up
 * emails (only to people who agreed to them).
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Mail, Phone, MessageCircle, RefreshCw, Trash2, X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import demoService, { DEMO_ROLES, type DemoRequestRow } from '@services/demoService';
import { DEMO_PORTALS } from '@lib/demo';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'opened', label: 'Opened the demo' },
  { key: 'not_opened', label: 'Not opened yet' },
  { key: 'followup', label: 'Can follow up' },
  { key: 'converted', label: 'Registered a school' },
];
const roleLabel = (r: string) => DEMO_ROLES.find((x) => x.value === r)?.label || r;
const portalLabel = (k: string) => DEMO_PORTALS.find((p) => p.key === k)?.portal || k;
const when = (v?: string | null) => (v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const waLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;
const errText = (r: any, d: string) => (typeof r?.error === 'string' ? r.error : r?.error?.message) || d;

const FOLLOW_UP_SUBJECT = 'How did you find the WiSkul demo?';
const FOLLOW_UP_MESSAGE = `Hello {name},

Thank you for trying the WiSkul demo. I hope it gave you a good picture of how WiSkul can run admissions, attendance, results, fees and payroll for your school.

If you have any questions, or would like a short guided tour for your team, just reply to this email. Setting up your own school takes a few minutes, and new schools start with a free trial.

Best regards,
The WiSkul team`;

export const PlatformDemoRequestsPage: React.FC = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['demo-requests', filter, search, page],
    queryFn: () => demoService.list({ filter, search: search.trim(), page, limit: 25 }),
    staleTime: 15_000,
  });
  const rows: DemoRequestRow[] = data?.data ?? [];
  const stats = data?.stats ?? { total: 0, this_week: 0, opened: 0, converted: 0 };
  const pages = data?.pagination?.total_pages ?? 1;
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <MainLayout>
      <PageShell
        title="Demo Requests"
        subtitle="People who asked for the live demo, what they opened, and follow-ups"
        breadcrumbs={[{ label: 'Platform', href: '/platform/dashboard' }, { label: 'Demo requests' }]}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={async () => { if (!(await demoService.downloadCsv())) showToast.error('Could not export the list.'); }}>
              <Download size={15} className="mr-1.5" /> Export CSV
            </Button>
            <Button disabled={!selected.size} onClick={() => setCompose(true)}>
              <Mail size={15} className="mr-1.5" /> Email {selected.size ? `${selected.size} selected` : 'selected'}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            ['Requests', stats.total], ['This week', stats.this_week],
            ['Opened the demo', `${stats.opened}${stats.total ? ` (${Math.round((stats.opened / stats.total) * 100)}%)` : ''}`],
            ['Registered a school', `${stats.converted}${stats.total ? ` (${Math.round((stats.converted / stats.total) * 100)}%)` : ''}`],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="text-xs font-semibold text-gray-500">{k}</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">{v}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter">
            {FILTERS.map((f) => (
              <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => { setFilter(f.key); setPage(1); setSelected(new Set()); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === f.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email, phone, school"
            aria-label="Search demo requests"
            className="w-full md:w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="hidden md:grid grid-cols-[32px_1.6fr_1.3fr_1fr_1.2fr_110px] gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
            <input type="checkbox" aria-label="Select all on this page" checked={allOnPage}
              onChange={() => setSelected((s) => { const n = new Set(s); rows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n; })} />
            <span>Person</span><span>School</span><span>Requested</span><span>Demo use</span><span>Status</span>
          </div>
          {isLoading ? (
            <div className="p-10 text-center text-gray-500"><Loader2 className="mx-auto animate-spin" /></div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">No demo requests {filter || search ? 'match this view' : 'yet'}.</div>
          ) : rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[32px_1fr] md:grid-cols-[32px_1.6fr_1.3fr_1fr_1.2fr_110px] gap-x-3 gap-y-1 px-4 py-3 border-b last:border-b-0 border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <input type="checkbox" aria-label={`Select ${r.full_name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="mt-1" />
              <button type="button" onClick={() => setOpenId(r.id)} className="text-left min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate">{r.full_name}</div>
                <div className="text-xs text-gray-500 truncate">{r.email} · {r.phone}</div>
              </button>
              <div className="min-w-0 col-start-2 md:col-start-auto">
                <div className="text-sm text-gray-800 dark:text-gray-200 truncate">{r.school_name}</div>
                <div className="text-xs text-gray-500 truncate">{roleLabel(r.role)}{r.student_count ? ` · ${r.student_count} students` : ''}</div>
              </div>
              <div className="text-xs text-gray-500 col-start-2 md:col-start-auto">{when(r.created_at)}{r.request_count > 1 ? ` · asked ${r.request_count}×` : ''}</div>
              <div className="text-xs col-start-2 md:col-start-auto">
                {r.open_count ? (
                  <>
                    <div className="text-gray-700 dark:text-gray-200 font-semibold">{r.open_count} open{r.open_count === 1 ? '' : 's'} · last {when(r.last_opened_at)}</div>
                    <div className="flex flex-wrap gap-1 mt-1">{Object.keys(r.portals_opened || {}).map((k) => <span key={k} className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">{portalLabel(k)}</span>)}</div>
                  </>
                ) : <span className="text-gray-400">Not opened</span>}
              </div>
              <div className="col-start-2 md:col-start-auto flex flex-wrap gap-1 items-start">
                {r.converted_school ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Registered</span>
                  : r.link_expired ? <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">Link expired</span>
                  : <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">Active</span>}
                {r.followups_sent > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">{r.followups_sent} follow-up{r.followups_sent === 1 ? '' : 's'}</span>}
                {!r.consent_followup && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold" title="Didn't agree to follow-up emails">No emails</span>}
              </div>
            </div>
          ))}
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 mt-4 text-sm">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-gray-500">Page {page} of {pages}</span>
            <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </PageShell>

      {openId && <DetailPanel id={openId} onClose={() => setOpenId(null)} onChanged={() => qc.invalidateQueries({ queryKey: ['demo-requests'] })} />}
      {compose && (
        <ComposeModal
          recipients={rows.filter((r) => selected.has(r.id)).concat([]) as DemoRequestRow[]}
          ids={Array.from(selected)}
          onClose={() => setCompose(false)}
          onSent={() => { setCompose(false); setSelected(new Set()); qc.invalidateQueries({ queryKey: ['demo-requests'] }); }}
        />
      )}
    </MainLayout>
  );
};

const DetailPanel: React.FC<{ id: string; onClose: () => void; onChanged: () => void }> = ({ id, onClose, onChanged }) => {
  const { data, refetch } = useQuery({ queryKey: ['demo-request', id], queryFn: () => demoService.get(id) });
  const r: DemoRequestRow | undefined = data?.data;
  const [notes, setNotes] = useState<string | null>(null);
  const resend = useMutation({
    mutationFn: () => demoService.resend(id),
    onSuccess: (res: any) => { if (res?.success) { showToast.success('New demo links sent.'); refetch(); onChanged(); } else showToast.error(errText(res, 'Could not send the links.')); },
  });
  const save = useMutation({
    mutationFn: () => demoService.saveNotes(id, notes ?? ''),
    onSuccess: (res: any) => { if (res?.success) { showToast.success('Notes saved.'); setNotes(null); refetch(); } else showToast.error(errText(res, 'Could not save.')); },
  });
  const remove = useMutation({
    mutationFn: () => demoService.remove(id),
    onSuccess: (res: any) => { if (res?.success) { showToast.success('Removed.'); onChanged(); onClose(); } else showToast.error(errText(res, 'Could not remove.')); },
  });
  const kindLabel: Record<string, string> = { requested: 'Requested', link_sent: 'Email', opened: 'Opened', followup: 'Follow-up', note: 'Note' };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Demo request">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full overflow-y-auto bg-white dark:bg-gray-900 shadow-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-gray-900 dark:text-white truncate">{r?.full_name || 'Loading…'}</h2>
            {r && <p className="text-sm text-gray-500 truncate">{r.school_name} · {roleLabel(r.role)}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        {r && (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"><Mail size={14} /> {r.email}</a>
              <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"><Phone size={14} /> Call</a>
              <a href={waLink(r.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"><MessageCircle size={14} /> WhatsApp</a>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              {[
                ['Phone', r.phone], ['Students', r.student_count || '—'], ['Requested', when(r.created_at)], ['Links valid until', when(r.expires_at)],
                ['Opens', String(r.open_count)], ['Last opened', when(r.last_opened_at)],
                ['Follow-up emails', r.consent_followup ? 'Agreed' : 'Not agreed'], ['Registered school', r.converted_school || '—'],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0"><dt className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{k}</dt><dd className="text-gray-800 dark:text-gray-200 truncate">{v}</dd></div>
              ))}
            </dl>
            {Object.keys(r.portals_opened || {}).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {Object.entries(r.portals_opened).map(([k, n]) => <span key={k} className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">{portalLabel(k)} · {n}</span>)}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" disabled={resend.isPending} onClick={() => resend.mutate()}>
                <RefreshCw size={14} className={`mr-1.5 ${resend.isPending ? 'animate-spin' : ''}`} /> Send new links
              </Button>
              <Button variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remove ${r.full_name} and their history? This can't be undone.`)) remove.mutate(); }}>
                <Trash2 size={14} className="mr-1.5" /> Remove
              </Button>
            </div>
            <div className="mt-6">
              <label htmlFor="demo-notes" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</label>
              <textarea id="demo-notes" rows={4} value={notes ?? r.notes ?? ''} onChange={(e) => setNotes(e.target.value)}
                placeholder="Call outcome, next step…" className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
              {notes !== null && <Button className="mt-2" disabled={save.isPending} onClick={() => save.mutate()}>Save notes</Button>}
            </div>
            <div className="mt-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Timeline</h3>
              <ol className="space-y-2">
                {(r.events || []).map((e) => (
                  <li key={e.id} className="text-sm border-l-2 border-blue-200 pl-3">
                    <div className="font-semibold text-gray-800 dark:text-gray-200">{kindLabel[e.kind] || e.kind}{e.portal ? `: ${portalLabel(e.portal)} portal` : ''}</div>
                    {e.note && <div className="text-xs text-gray-500">{e.note}</div>}
                    <div className="text-[11px] text-gray-400">{when(e.created_at)}{e.by_name ? ` · ${e.by_name}` : ''}</div>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ComposeModal: React.FC<{ recipients: DemoRequestRow[]; ids: string[]; onClose: () => void; onSent: () => void }> = ({ recipients, ids, onClose, onSent }) => {
  const [subject, setSubject] = useState(FOLLOW_UP_SUBJECT);
  const [message, setMessage] = useState(FOLLOW_UP_MESSAGE);
  const [result, setResult] = useState<{ sent: number; skipped: number; failed: number } | null>(null);
  const noConsent = useMemo(() => recipients.filter((r) => !r.consent_followup).length, [recipients]);
  const send = useMutation({
    mutationFn: () => demoService.followUp(ids, subject, message),
    onSuccess: (res: any) => { if (res?.success) setResult(res.data); else showToast.error(errText(res, 'Could not send.')); },
  });
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Email follow-up">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Email {ids.length} {ids.length === 1 ? 'person' : 'people'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        {result ? (
          <div className="py-6 text-center" role="status">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <p className="mt-3 font-semibold text-gray-900 dark:text-white">Sent to {result.sent}.</p>
            {(result.skipped > 0 || result.failed > 0) && (
              <p className="text-sm text-gray-500 mt-1">
                {result.skipped > 0 ? `${result.skipped} skipped (didn't agree to emails). ` : ''}{result.failed > 0 ? `${result.failed} failed.` : ''}
              </p>
            )}
            <Button className="mt-5" onClick={onSent}>Done</Button>
          </div>
        ) : (
          <>
            {noConsent > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 text-amber-800 text-xs px-3 py-2">
                {noConsent} of the selected didn't agree to follow-up emails and will be skipped. You can still call or WhatsApp them.
              </p>
            )}
            <label htmlFor="fu-subject" className="block mt-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Subject</label>
            <input id="fu-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            <label htmlFor="fu-message" className="block mt-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Message</label>
            <textarea id="fu-message" rows={11} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            <p className="text-[11px] text-gray-500 mt-1">{'{name}'} becomes each person's first name. A "Start your free trial" button is added below the message.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={send.isPending} onClick={() => send.mutate()}>
                {send.isPending ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <Send size={15} className="mr-1.5" />} Send
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlatformDemoRequestsPage;
