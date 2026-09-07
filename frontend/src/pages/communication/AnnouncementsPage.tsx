/**
 * AnnouncementsPage — /communication/announcements
 * Compose and broadcast school announcements (principal/teacher), and read the
 * announcements addressed to you. Tenant-scoped via the API.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Trash2, Loader2, AlertTriangle, Users, Pencil } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { useAuth } from '@hooks/useAuth';
import { showToast } from '@utils/toast';
import announcementService, {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
} from '@services/announcementService';

const AUDIENCES: { value: AnnouncementAudience; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'student', label: 'Students' },
  { value: 'parent', label: 'Parents' },
  { value: 'accountant', label: 'Accountants' },
  { value: 'admissions_officer', label: 'Admissions' },
];

const audienceLabel = (a: string) => AUDIENCES.find((x) => x.value === a)?.label ?? a;

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return s;
  }
};

export const AnnouncementsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role;
  const canPost = role === 'principal' || role === 'super_admin' || role === 'teacher';
  const canDelete = role === 'principal' || role === 'super_admin';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('all');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [notifyByEmail, setNotifyByEmail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null); setTitle(''); setBody(''); setAudience('all'); setPriority('normal'); setNotifyByEmail(false);
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setAudience(a.audience);
    setPriority(a.priority);
    setNotifyByEmail(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const PAGE_SIZE = 10;
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['announcements', limit],
    queryFn: () => announcementService.list({ limit, offset: 0 }),
    staleTime: 30_000,
  });
  const announcements: Announcement[] = useMemo(() => (data as any)?.data ?? [], [data]);
  const total: number = (data as any)?.pagination?.total ?? announcements.length;
  const hasMore = announcements.length < total;

  const unreadOnPage = useMemo(() => announcements.filter((a) => !a.is_read).length, [announcements]);

  const markAllRead = async () => {
    await announcementService.markAllRead();
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
    queryClient.invalidateQueries({ queryKey: ['announcements-unread'] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? announcementService.update(editingId, { title, body, audience, priority })
        : announcementService.create({ title, body, audience, priority, notifyByEmail }),
    onSuccess: (res) => {
      if ((res as any)?.success === false) {
        showToast.error((res as any).error || 'Failed to save announcement');
        return;
      }
      showToast.success(editingId ? 'Announcement updated' : 'Announcement posted');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: () => showToast.error('Failed to save announcement'),
  });

  const doDelete = async () => {
    if (!deleteTarget) return;
    const res = await announcementService.remove(deleteTarget.id);
    if ((res as any)?.success === false) {
      showToast.error((res as any).error || 'Failed to delete');
    } else {
      showToast.success('Announcement deleted');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    }
    setDeleteTarget(null);
  };

  // Auto-mark the loaded announcements as read shortly after viewing the page,
  // so the notification bell's unread count clears once the user has seen them.
  useEffect(() => {
    if (!announcements.length) return;
    const unreadIds = announcements.filter((a) => !a.is_read).map((a) => a.id);
    if (!unreadIds.length) return;
    const t = setTimeout(async () => {
      await Promise.allSettled(unreadIds.map((id) => announcementService.markRead(id)));
      queryClient.invalidateQueries({ queryKey: ['announcements-unread'] });
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcements]);

  return (
    <MainLayout>
      <PageShell
        title="Announcements"
        subtitle="Broadcast updates to your school community"
        breadcrumbs={[{ label: 'Communication' }, { label: 'Announcements' }]}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Compose */}
          {canPost && (
            <div className="lg:col-span-1 lg:sticky lg:top-4">
              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white px-5 py-4 flex items-center gap-2">
                  <Megaphone size={18} />
                  <h3 className="font-bold text-sm">{editingId ? 'Edit Announcement' : 'New Announcement'}</h3>
                </div>
                <form
                  className="p-5 space-y-4"
                  onSubmit={(e) => { e.preventDefault(); if (title.trim() && body.trim()) saveMutation.mutate(); }}
                >
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={200}
                      placeholder="e.g. Mid-term break dates"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30 focus:border-[#1d4ed8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Message</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={5}
                      placeholder="Write your announcement…"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30 focus:border-[#1d4ed8]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Audience</label>
                      <select
                        value={audience}
                        onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30"
                      >
                        {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Priority</label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30"
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  {!editingId && (
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                      <input type="checkbox" checked={notifyByEmail} onChange={(e) => setNotifyByEmail(e.target.checked)} className="rounded border-gray-300 text-[#1d4ed8] focus:ring-[#1d4ed8]/30" />
                      Also notify recipients by email
                    </label>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saveMutation.isPending || !title.trim() || !body.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      {editingId ? 'Save Changes' : 'Post Announcement'}
                    </button>
                    {editingId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* List */}
          <div className={canPost ? 'lg:col-span-2' : 'lg:col-span-3'}>
            {/* List header: count + mark all read */}
            {!isLoading && !error && announcements.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">
                  {total} announcement{total === 1 ? '' : 's'}
                  {unreadOnPage > 0 && <span className="ml-2 text-xs font-bold text-[#1d4ed8]">{unreadOnPage} unread</span>}
                </p>
                {unreadOnPage > 0 && (
                  <button onClick={markAllRead} className="text-xs font-semibold text-[#1d4ed8] hover:text-[#1e40af]">
                    Mark all as read
                  </button>
                )}
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <Loader2 size={28} className="animate-spin" />
              </div>
            ) : error ? (
              <EmptyState message="Couldn't load announcements" description="Please refresh and try again." action={{ label: 'Retry', onClick: () => refetch() }} />
            ) : announcements.length === 0 ? (
              <EmptyState message="No announcements yet" description={canPost ? 'Post your first announcement using the form.' : 'Check back later for updates.'} />
            ) : (
              <div className="space-y-4">
                {announcements.map((a) => (
                  <div key={a.id} className={`bg-white rounded-2xl ring-1 shadow-sm p-5 transition-all ${a.is_read ? 'ring-gray-200/70' : 'ring-blue-200 bg-blue-50/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {!a.is_read && <span className="w-2 h-2 rounded-full bg-[#1d4ed8] flex-shrink-0" title="Unread" />}
                          <h3 className="font-bold text-slate-900">{a.title}</h3>
                          {a.priority === 'high' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={11} /> High
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            <Users size={11} /> {audienceLabel(a.audience)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{a.body}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {a.author_name ? `${a.author_name} · ` : ''}{fmtDate(a.created_at)}
                        </p>
                      </div>
                      {canPost && (
                        <div className="flex-shrink-0 flex items-center gap-1">
                          <button
                            onClick={() => startEdit(a)}
                            className="p-2 rounded-lg text-gray-400 hover:text-[#1d4ed8] hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(a)}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {hasMore && (
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => setLimit((l) => l + PAGE_SIZE)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white ring-1 ring-gray-200 hover:ring-blue-200 hover:bg-blue-50 text-sm font-semibold text-[#1d4ed8] transition-all"
                    >
                      Load more ({total - announcements.length} more)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <ConfirmationDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={doDelete}
          title="Delete announcement"
          message={`Delete "${deleteTarget?.title ?? ''}"? This cannot be undone.`}
          confirmLabel="Delete"
        />
      </PageShell>
    </MainLayout>
  );
};

export default AnnouncementsPage;
