/**
 * AnnouncementsPage — /communication/announcements
 *
 * Full-width feed of announcements the user is allowed to see (tenant + role +
 * class scoped by the API). Staff who can post get a "New Announcement" button
 * in the header that opens a large compose/edit modal (hidden by default).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Send, Trash2, Loader2, AlertTriangle, Users, Pencil, Plus, X, CheckCheck } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { cardTint } from '@lib/cardTint';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { Button } from '@components/ui/button';
import { useAuth } from '@hooks/useAuth';
import { showToast } from '@utils/toast';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
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

// Keep in sync with the backend caps in announcementService.ts.
const MAX_TITLE = 200;
const MAX_BODY = 10000;

// Colour theme per audience — drives the card accent bar, icon chip and badge.
const AUDIENCE_THEME: Record<string, { bar: string; chip: string; badge: string }> = {
  all:                { bar: 'bg-blue-500',    chip: 'bg-blue-100 text-blue-600',       badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  teacher:            { bar: 'bg-violet-500',  chip: 'bg-violet-100 text-violet-600',   badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  student:            { bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  parent:             { bar: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-600',     badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  accountant:         { bar: 'bg-teal-500',    chip: 'bg-teal-100 text-teal-600',       badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  admissions_officer: { bar: 'bg-rose-500',    chip: 'bg-rose-100 text-rose-600',       badge: 'bg-rose-50 text-rose-700 border-rose-200' },
};
const themeFor = (a: string) => AUDIENCE_THEME[a] ?? AUDIENCE_THEME.all;

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
  const isTeacher = role === 'teacher';
  const isAdmin = role === 'principal' || role === 'super_admin';
  const isDeptStaff = role === 'accountant' || role === 'admissions_officer';
  const canPost = isAdmin || isTeacher || isDeptStaff;

  // Compose modal state
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('all');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [notifyByEmail, setNotifyByEmail] = useState(false);
  const [classId, setClassId] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Teachers can only post to classes they teach (this year's, server-side).
  const { activeYear: classesYear } = useAcademicYears();
  const { data: myClassesResp } = useQuery({
    // Keyed by the active year so a rollover refreshes the list.
    queryKey: ['announcement-my-classes', classesYear],
    queryFn: () => announcementService.myClasses(),
    enabled: isTeacher,
    staleTime: 300_000,
  });
  const myClasses = useMemo(() => (myClassesResp as any)?.data ?? [], [myClassesResp]);

  // Teachers and department staff can only target students/parents; admins any.
  const audienceOptions = (isTeacher || isDeptStaff)
    ? AUDIENCES.filter((a) => ['all', 'student', 'parent'].includes(a.value))
    : AUDIENCES;

  const resetForm = () => {
    setEditingId(null); setTitle(''); setBody(''); setAudience('all'); setPriority('normal'); setNotifyByEmail(false); setClassId('');
  };

  const openCompose = () => { resetForm(); setComposeOpen(true); };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setAudience(a.audience);
    setPriority(a.priority);
    setNotifyByEmail(false);
    setClassId((a as any).class_id ?? '');
    setComposeOpen(true);
  };

  const closeCompose = () => { setComposeOpen(false); resetForm(); };

  const PAGE_SIZE = 10;
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Academic-year scope: opens on the ACTIVE year; '' = all years; a past year
  // is read-only history (no posting or editing — new posts go to this year).
  const [pickedYear, setPickedYear] = useState<string | null>(null);
  const { activeYear } = useAcademicYears();
  const year = pickedYear ?? activeYear;
  const yearReady = pickedYear !== null || !!activeYear;
  const viewingPast = !!year && !!activeYear && year < activeYear;
  const viewingAll = pickedYear === '' && !!activeYear;
  // The current year is stored as "not picked" so the page follows a rollover.
  const setYear = (y: string) => { setPickedYear(y === activeYear ? null : y); setLimit(PAGE_SIZE); };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['announcements', limit, year],
    queryFn: () => announcementService.list({ limit, offset: 0, academic_year: year || undefined }),
    enabled: yearReady,
    staleTime: 30_000,
  });
  const announcements: Announcement[] = useMemo(() => (data as any)?.data ?? [], [data]);
  // apiClient never throws: a failed load comes back as success:false.
  const loadError: string | null = error ? 'error' : (data as any)?.success === false ? ((data as any)?.error || 'error') : null;
  const total: number = (data as any)?.pagination?.total ?? announcements.length;
  const hasMore = announcements.length < total;
  const unreadOnPage = useMemo(() => announcements.filter((a) => !a.is_read).length, [announcements]);

  const markAllRead = async () => {
    const res: any = await announcementService.markAllRead();
    if (res?.success === false) { showToast.error(res.error || 'Could not mark announcements as read'); return; }
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
    queryClient.invalidateQueries({ queryKey: ['announcements-unread'] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? announcementService.update(editingId, { title, body, audience, priority })
        : announcementService.create({ title, body, audience, priority, notifyByEmail, classId: isTeacher ? classId : (classId || null) }),
    onSuccess: (res) => {
      if ((res as any)?.success === false) {
        showToast.error((res as any).error || 'Failed to save announcement');
        return;
      }
      showToast.success(editingId ? 'Announcement updated' : 'Announcement posted');
      closeCompose();
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

  // Auto-mark loaded announcements as read shortly after viewing.
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

  const canSubmit = title.trim() && body.trim() && !(isTeacher && !editingId && !classId);

  return (
    <MainLayout>
      <PageShell
        title="Announcements"
        subtitle="Broadcast updates to your school community"
        breadcrumbs={[{ label: 'Communication' }, { label: 'Announcements' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <div className="flex items-center gap-2">
            <YearFilter value={year} onChange={setYear} includeAllOption />
            {canPost && !viewingPast && (
              <Button onClick={openCompose} size="sm" className="whitespace-nowrap shadow-sm">
                <Plus size={16} className="mr-1.5" /> New Announcement
              </Button>
            )}
          </div>
        }
      >
        {(viewingPast || viewingAll) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <span>
              {viewingPast
                ? <>Showing <strong>{year}</strong> announcements as history (read-only).</>
                : <>Showing announcements from <strong>all years</strong>.</>}
            </span>
            <button type="button" onClick={() => setYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          </div>
        )}
        {/* List toolbar */}
        {!isLoading && !loadError && announcements.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {total} announcement{total === 1 ? '' : 's'}
              {unreadOnPage > 0 && <span className="ml-2 text-xs font-bold text-[#1d4ed8]">{unreadOnPage} unread</span>}
            </p>
            {unreadOnPage > 0 && (
              <button onClick={markAllRead} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d4ed8] hover:text-[#1e40af]">
                <CheckCheck size={14} /> Mark all as read
              </button>
            )}
          </div>
        )}

        {/* Feed (full width) */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : loadError ? (
          <EmptyState message="Couldn't load announcements" description={loadError !== 'error' ? loadError : 'Please refresh and try again.'} action={{ label: 'Retry', onClick: () => refetch() }} />
        ) : announcements.length === 0 ? (
          <EmptyState
            message={viewingPast ? `No announcements in ${year}` : viewingAll ? 'No announcements yet' : `No announcements in ${year || 'this year'} yet`}
            description={viewingPast
              ? 'Nothing was posted during this academic year.'
              : isTeacher
                ? (myClasses.length ? 'Post to one of your classes to reach its students and parents.' : 'You have no classes this year yet. Once the principal assigns you, you can post to them here.')
                : canPost ? 'Create your first announcement to reach your school community.' : 'Check back later for updates.'}
            action={canPost && !viewingPast ? { label: 'New Announcement', onClick: openCompose } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {announcements.map((a, idx) => {
              const mine = a.author_id === user?.id;
              // Past-year posts are history: no edit/delete.
              // is_history also covers past posts mixed into the "All years" view.
              const canManageThis = !viewingPast && !a.is_history && (isAdmin || (canPost && mine));
              const theme = a.priority === 'high'
                ? { bar: 'bg-red-500', chip: 'bg-red-100 text-red-600', badge: 'bg-red-50 text-red-700 border-red-200' }
                : themeFor(a.audience);
              return (
                <div
                  key={a.id}
                  className={`relative ${cardTint(idx)} sm:bg-white rounded-2xl ring-1 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden ${a.is_read ? 'ring-gray-200/70' : 'ring-blue-200'}`}
                >
                  {/* Coloured left accent bar */}
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${theme.bar}`} />

                  {/* Header strip — tinted for unread / high priority */}
                  <div className={`pl-6 pr-4 pt-4 pb-3 flex items-start justify-between gap-3 ${
                    a.priority === 'high' ? 'bg-gradient-to-r from-red-50 to-transparent'
                    : !a.is_read ? 'bg-gradient-to-r from-blue-50 to-transparent' : ''
                  }`}>
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${theme.chip}`}>
                        {a.priority === 'high' ? <AlertTriangle size={18} /> : <Megaphone size={18} />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!a.is_read && <span className="w-2 h-2 rounded-full bg-[#1d4ed8] flex-shrink-0" title="Unread" />}
                          <h3 className="font-bold text-slate-900 truncate">{a.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {a.priority === 'high' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={10} /> High
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${theme.badge}`}>
                            <Users size={10} /> {a.class_name
                              ? `${a.class_name}${a.audience === 'all' ? '' : ` · ${audienceLabel(a.audience)}`}`
                              : audienceLabel(a.audience)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {canManageThis && (
                      <div className="flex-shrink-0 flex items-center gap-1">
                        <button type="button" onClick={() => startEdit(a)} className="p-2 rounded-lg text-gray-400 hover:text-[#1d4ed8] hover:bg-blue-50 transition-colors" title="Edit" aria-label={`Edit "${a.title}"`}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(a)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete" aria-label={`Delete "${a.title}"`}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Body + footer */}
                  <div className="pl-6 pr-4 pb-4 flex flex-col flex-1">
                    <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed flex-1">{a.body}</p>
                    <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-slate-400">
                      {(a.author_display || a.author_name) ? <span className="font-semibold text-slate-500">{a.author_display || a.author_name}</span> : null}
                      {(a.author_display || a.author_name) ? ' · ' : ''}{fmtDate(a.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && !isLoading && !loadError && (
          <div className="pt-6 text-center">
            <button
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white ring-1 ring-gray-200 hover:ring-blue-200 hover:bg-blue-50 text-sm font-semibold text-[#1d4ed8] transition-all"
            >
              Load more ({total - announcements.length} more)
            </button>
          </div>
        )}
      </PageShell>

      {/* ── Compose / Edit modal (big) ── */}
      {composeOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeCompose} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center"><Megaphone size={18} /></span>
                <div>
                  <h3 className="font-black">{editingId ? 'Edit Announcement' : 'New Announcement'}</h3>
                  <p className="text-xs text-white/80">
                    {isTeacher ? 'Reaches the class you select' : isDeptStaff ? 'Reaches students and parents' : 'Reaches your chosen audience'}
                  </p>
                </div>
              </div>
              <button onClick={closeCompose} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form
              className="p-6 space-y-5 flex-1 overflow-y-auto"
              onSubmit={(e) => {
                e.preventDefault();
                if (!title.trim() || !body.trim()) return;
                if (isTeacher && !editingId && !classId) { showToast.error('Please select one of your classes'); return; }
                saveMutation.mutate();
              }}
            >
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={MAX_TITLE}
                  autoFocus
                  placeholder="e.g. Mid-term break dates"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30 focus:border-[#1d4ed8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
                  maxLength={MAX_BODY}
                  rows={8}
                  placeholder="Write your announcement…"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-y min-h-[160px] focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30 focus:border-[#1d4ed8]"
                />
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">Line breaks are preserved. Keep it clear and concise.</p>
                  <p className={`text-[11px] tabular-nums ${body.length >= MAX_BODY ? 'text-rose-600 font-semibold' : body.length > MAX_BODY * 0.9 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {body.length.toLocaleString()}/{MAX_BODY.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Teacher: class selector */}
              {isTeacher && !editingId && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Class</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30"
                  >
                    <option value="">Select a class you teach…</option>
                    {myClasses.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}{c.level ? ` · ${c.level}` : ''}</option>
                    ))}
                  </select>
                  {myClasses.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-600">You have no classes in {activeYear || 'this year'} yet. Ask your principal to assign you.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{isTeacher ? 'Send to' : 'Audience'}</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30"
                  >
                    {audienceOptions.map((a) => (
                      <option key={a.value} value={a.value}>
                        {isTeacher && a.value === 'all' ? 'Whole class' : a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/30"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High priority</option>
                  </select>
                </div>
              </div>

              {!editingId && (
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={notifyByEmail} onChange={(e) => setNotifyByEmail(e.target.checked)} className="rounded border-gray-300 text-[#1d4ed8] focus:ring-[#1d4ed8]/30" />
                  Also notify recipients by email
                </label>
              )}
            </form>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={closeCompose} className="px-4 py-2.5 rounded-xl bg-white ring-1 ring-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-sm">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!title.trim() || !body.trim()) return;
                  if (isTeacher && !editingId && !classId) { showToast.error('Please select one of your classes'); return; }
                  saveMutation.mutate();
                }}
                disabled={saveMutation.isPending || !canSubmit}
                className="inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {editingId ? 'Save Changes' : 'Post Announcement'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Delete announcement"
        message={`Delete "${deleteTarget?.title ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </MainLayout>
  );
};

export default AnnouncementsPage;
