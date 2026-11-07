/**
 * ReviewList: what parents sent, waiting for the officer.
 * A form from the school's shared link may not be matched to a student yet (the name was misspelt, or namesakes):
 * the officer picks the right student first. Approving is only possible once a student is chosen.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Search, X } from 'lucide-react';
import { Button } from '@components/ui/button';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { studentRecordsService, recordsError, RecordUpdate } from '@services/studentRecordsService';
import { showToast } from '@utils/toast';

const SELECT = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const shortLabel = (label: string) => label.replace(/ \(.*\)$/, '');

export const ReviewList: React.FC<{ updates: RecordUpdate[]; loading: boolean; onDone: () => void | Promise<void> }> = ({ updates, loading, onDone }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [finding, setFinding] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const found = useQuery({
    queryKey: ['record-find', term],
    enabled: !!finding && term.trim().length >= 2,
    queryFn: () => studentRecordsService.list({ search: term.trim(), filter: 'all', limit: 8 }),
  });

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      showToast.success(ok);
      await onDone();
      setRejecting(null); setFinding(null); setTerm(''); setNote('');
    } catch (e) { showToast.error(recordsError(e)); } finally { setBusy(null); }
  };

  if (loading) return <p className="py-12 text-center text-gray-500">Loading…</p>;
  if (!updates.length) return <EmptyState message="Nothing to review" description="When a parent sends details, they appear here for you to check." />;

  const classSuffix = (name?: string | null) => (name ? ` · ${name}` : '');
  return (
    <ul className="space-y-4">
      {updates.map((u) => (
        <li key={u.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {u.student ? (
              <p className="font-bold text-gray-900 dark:text-white">
                {u.student.name} <span className="text-sm font-normal text-gray-500">{u.student.student_id}{classSuffix(u.student.class_name)}</span>
              </p>
            ) : (
              <p className="font-bold text-amber-700">Needs a student: the parent wrote "{u.claimed?.name}"{u.claimed?.class_name ? ` (${u.claimed.class_name})` : ''}</p>
            )}
            <p className="text-xs text-gray-500">{u.source === 'shared' ? 'School link' : 'Personal link'} · {fmtDate(u.created_at)} · Ref <span className="font-mono">{u.reference}</span></p>
          </div>
          {u.student && u.claimed && (
            <p className="text-xs text-gray-500">The parent wrote: {u.claimed.name}{u.claimed.class_name ? ` (${u.claimed.class_name})` : ''}</p>
          )}

          {!u.student && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/10">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">We could not tell which student this is. Choose the right one:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {u.candidates.map((c) => (
                  <Button key={c.id} size="sm" variant="outline" disabled={busy === u.id}
                    onClick={() => act(u.id, () => studentRecordsService.matchUpdate(u.id, c.id), 'Matched')}>
                    {c.name}{classSuffix(c.class_name)}
                  </Button>
                ))}
                <Button size="sm" variant="outline" onClick={() => { setFinding(finding === u.id ? null : u.id); setTerm(''); }}>
                  <Search size={14} className="mr-1" /> Search another
                </Button>
              </div>
              {finding === u.id && (
                <div className="mt-2">
                  <input autoFocus aria-label="Search students" placeholder="Type a name or ID" value={term} onChange={(e) => setTerm(e.target.value)} className={`${SELECT} w-full`} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(found.data?.data?.items ?? []).map((c) => (
                      <Button key={c.id} size="sm" variant="outline" disabled={busy === u.id}
                        onClick={() => act(u.id, () => studentRecordsService.matchUpdate(u.id, c.id), 'Matched')}>
                        {c.name}{classSuffix(c.class_name)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="py-1 pr-3">Field</th><th className="py-1 pr-3">Now</th><th className="py-1">Parent sent</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {u.changes.map((c) => (
                  <tr key={c.key}>
                    <td className="py-1.5 pr-3 font-medium">{shortLabel(c.label)}</td>
                    <td className="py-1.5 pr-3 text-gray-500">{u.student ? (c.current || <em>empty</em>) : '—'}</td>
                    <td className="py-1.5 font-semibold text-primary-800 dark:text-primary-200">{c.proposed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rejecting === u.id ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input aria-label="Reason (optional)" placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} className={`${SELECT} min-w-[14rem] flex-1`} maxLength={500} />
              <Button size="sm" disabled={busy === u.id} onClick={() => act(u.id, () => studentRecordsService.reject(u.id, note), 'Update rejected')} className="bg-red-600 text-white hover:bg-red-700">Reject</Button>
              <Button size="sm" variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={busy === u.id || !u.student} title={u.student ? undefined : 'Choose the student first'}
                onClick={() => act(u.id, () => studentRecordsService.approve(u.id), 'Record updated')} className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Check size={14} className="mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => setRejecting(u.id)}><X size={14} className="mr-1" /> Reject</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
};
export default ReviewList;
