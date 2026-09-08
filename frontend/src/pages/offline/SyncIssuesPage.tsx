/**
 * SyncIssuesPage — /sync-issues
 *
 * Lists local writes the server rejected (e.g. a locked grade) so the teacher
 * can Retry or Discard each one. Nothing is dropped silently (Req 10).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import useAuthStore from '@store/authStore';
import { listSyncIssues, retryIssue, discardIssue, type SyncIssue } from '../../offline/syncIssues';

const ENTITY_LABEL: Record<SyncIssue['entity'], string> = {
  attendance: 'Attendance',
  grade: 'Grade',
  assignment: 'Assignment',
};

export const SyncIssuesPage: React.FC = () => {
  const userId = useAuthStore((s) => s.user?.id) || null;
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      setIssues(await listSyncIssues(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const onRetry = async (issue: SyncIssue) => {
    if (!userId) return;
    setBusy(issue.clientId);
    try { await retryIssue(userId, issue); showToast.success('Retrying…'); await load(); }
    finally { setBusy(null); }
  };

  const onDiscard = async (issue: SyncIssue) => {
    if (!userId) return;
    setBusy(issue.clientId);
    try { await discardIssue(userId, issue); showToast.success('Discarded'); await load(); }
    finally { setBusy(null); }
  };

  return (
    <MainLayout>
      <PageShell
        title="Sync Issues"
        subtitle="Changes that couldn't be saved to the server"
        breadcrumbs={[{ label: 'Sync Issues' }]}
      >
        {loading ? (
          <div className="py-20 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={26} /></div>
        ) : issues.length === 0 ? (
          <div className="max-w-md mx-auto text-center bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={26} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">All caught up</h2>
            <p className="text-sm text-gray-500 mt-1">Every change has synced — no issues to resolve.</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 flex gap-2 text-xs text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>These changes were rejected by the server. Fix the cause if needed, then <strong>Retry</strong>, or <strong>Discard</strong> to remove them. Nothing is deleted automatically.</div>
            </div>
            {issues.map((issue) => (
              <div key={issue.clientId} className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{ENTITY_LABEL[issue.entity]}</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{issue.label}</p>
                  {issue.error && <p className="text-xs text-red-600 mt-0.5">{issue.error}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" disabled={busy === issue.clientId} onClick={() => onRetry(issue)}>
                    <RefreshCw size={14} className="mr-1" /> Retry
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busy === issue.clientId} onClick={() => onDiscard(issue)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default SyncIssuesPage;
