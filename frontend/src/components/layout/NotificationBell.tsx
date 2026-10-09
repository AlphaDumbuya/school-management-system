/**
 * NotificationBell — production-ready notifications dropdown.
 *
 * Displays a single unified feed that merges:
 *  - The user's in-app notifications (/api/v1/notifications) — admissions,
 *    discipline, payments, appeals, report cards, etc.
 *  - School-wide announcements.
 *  - System alerts (principals/super_admins only) from the dashboard alerts feed.
 *
 * All items are role-scoped (user only sees their own notifications) and
 * tenant-scoped (notifications belong to the user's school).
 *
 * Features: unread badge, per-item mark-read + navigate, mark-all-read,
 * relative timestamps, type icons, empty/loading states, click-away,
 * polling with focus refresh.
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { announceNew } from '@lib/nativeNotifications';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCheck, GraduationCap, Wallet, ShieldAlert, CalendarCheck,
  UserPlus, FileText, Info, X, Loader2, Megaphone,
} from 'lucide-react';
import clsx from 'clsx';
import notificationService, { type AppNotification } from '@services/notificationService';
import { dashboardService } from '@services/dashboardService';
import announcementService, { type Announcement } from '@services/announcementService';

interface SystemAlert {
  id: string;
  title: string;
  message: string;
  severity?: string;
  actionUrl?: string;
  dismissible?: boolean;
}

/** A single unified feed item — normalised from notifications, announcements, and alerts. */
interface FeedItem {
  id: string;
  kind: 'notification' | 'announcement' | 'alert';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  url?: string;
  icon: React.ReactNode;
  tint: string;
  severity?: string;
  /** For notifications — the original object (to call markRead). */
  notif?: AppNotification;
  /** For announcements — navigate to announcements page. */
  isAnnouncement?: boolean;
  /** For alerts — dismissible. */
  dismissible?: boolean;
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Pick an icon + tint for a notification type. */
function typeVisual(type?: string): { icon: React.ReactNode; tint: string } {
  const t = (type || '').toLowerCase();
  if (t.includes('payment') || t.includes('fee') || t.includes('invoice'))
    return { icon: <Wallet size={15} />, tint: 'bg-emerald-50 text-emerald-600' };
  if (t.includes('admission') || t.includes('enroll') || t.includes('application'))
    return { icon: <UserPlus size={15} />, tint: 'bg-blue-50 text-blue-600' };
  if (t.includes('grade') || t.includes('result') || t.includes('report'))
    return { icon: <GraduationCap size={15} />, tint: 'bg-indigo-50 text-indigo-600' };
  if (t.includes('attendance'))
    return { icon: <CalendarCheck size={15} />, tint: 'bg-amber-50 text-amber-600' };
  if (t.includes('detention') || t.includes('infraction') || t.includes('appeal') || t.includes('conduct') || t.includes('discipline'))
    return { icon: <ShieldAlert size={15} />, tint: 'bg-red-50 text-red-600' };
  if (t.includes('schedule') || t.includes('event'))
    return { icon: <FileText size={15} />, tint: 'bg-purple-50 text-purple-600' };
  return { icon: <Info size={15} />, tint: 'bg-gray-100 text-gray-500' };
}

const ALERT_TONE: Record<string, string> = {
  critical: 'border-red-200 bg-red-50 text-red-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

const ALERT_ICON_TINT: Record<string, { icon: React.ReactNode; tint: string }> = {
  critical: { icon: <ShieldAlert size={15} />, tint: 'bg-red-50 text-red-600' },
  error: { icon: <ShieldAlert size={15} />, tint: 'bg-red-50 text-red-600' },
  warning: { icon: <Info size={15} />, tint: 'bg-amber-50 text-amber-600' },
  info: { icon: <Info size={15} />, tint: 'bg-blue-50 text-blue-600' },
  success: { icon: <CheckCheck size={15} />, tint: 'bg-emerald-50 text-emerald-600' },
};

interface NotificationBellProps {
  canSeeAlerts: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ canSeeAlerts }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Notifications — poll every 60s, refetch on window focus.
  const { data: notifResp, isLoading: notifLoading } = useQuery({
    queryKey: ['bell-notifications'],
    queryFn: () => notificationService.list({ limit: 30 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const notifications: AppNotification[] = Array.isArray(notifResp?.data) ? notifResp!.data : [];
  const unreadNotifications = notifications.filter((n) => !n.readAt);

  // Android app: surface new notifications in the phone's notification shade.
  useEffect(() => {
    if (notifications.length) void announceNew(notifications, (url) => navigate(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifResp]);

  // System alerts (principals only).
  const { data: alertsResp } = useQuery({
    queryKey: ['bell-system-alerts'],
    queryFn: () => dashboardService.getAlerts(),
    enabled: canSeeAlerts,
    staleTime: 120_000,
    refetchInterval: 300_000,
  });
  const alerts: SystemAlert[] = useMemo(() => {
    const raw = (alertsResp as any)?.data ?? (alertsResp as any) ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [alertsResp]);
  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id));

  // Announcements — recent list + unread count.
  const { data: annResp } = useQuery({
    queryKey: ['bell-announcements'],
    queryFn: () => announcementService.list({ limit: 15 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const announcements: Announcement[] = Array.isArray((annResp as any)?.data) ? (annResp as any).data : [];
  const { data: annUnreadResp } = useQuery({
    queryKey: ['announcements-unread'],
    queryFn: () => announcementService.unreadCount(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const announcementsUnread = Number((annUnreadResp as any)?.data?.count ?? 0);

  const totalUnread = unreadNotifications.length + announcementsUnread + (canSeeAlerts ? visibleAlerts.length : 0);

  // ── Build the unified feed ──────────────────────────────────────────
  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];

    // System alerts first (highest priority)
    if (canSeeAlerts) {
      for (const a of visibleAlerts) {
        const av = ALERT_ICON_TINT[a.severity || 'info'] ?? ALERT_ICON_TINT.info;
        items.push({
          id: `alert-${a.id}`,
          kind: 'alert',
          title: a.title,
          body: a.message,
          createdAt: new Date().toISOString(), // alerts don't have timestamps
          read: false,
          url: a.actionUrl,
          icon: av.icon,
          tint: av.tint,
          severity: a.severity,
          dismissible: a.dismissible !== false,
        });
      }
    }

    // In-app notifications
    for (const n of notifications) {
      const v = typeVisual(n.notificationType);
      items.push({
        id: `notif-${n.id}`,
        kind: 'notification',
        title: n.subject || n.notificationType,
        body: n.message,
        createdAt: n.createdAt,
        read: !!n.readAt,
        url: (n.data as any)?.url || (n.data as any)?.actionUrl,
        icon: v.icon,
        tint: v.tint,
        notif: n,
      });
    }

    // Announcements
    for (const a of announcements) {
      items.push({
        id: `ann-${a.id}`,
        kind: 'announcement',
        title: a.title,
        body: a.body,
        createdAt: a.created_at,
        read: !!a.is_read,
        url: '/communication/announcements',
        icon: <Megaphone size={15} />,
        tint: a.priority === 'high' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600',
        isAnnouncement: true,
      });
    }

    // Sort: unread first, then by recency
    items.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return items.slice(0, 30); // cap at 30 for performance
  }, [canSeeAlerts, visibleAlerts, notifications, announcements]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bell-notifications'] });
  }, [queryClient]);

  const openItem = useCallback(async (item: FeedItem) => {
    // Mark as read if applicable
    if (item.kind === 'notification' && item.notif && !item.read) {
      try { await notificationService.markRead(item.notif.id); refresh(); } catch { /* ignore */ }
    } else if (item.isAnnouncement && !item.read) {
      // Announcements are marked read via the announcements API
      try {
        await announcementService.markAllRead();
        queryClient.invalidateQueries({ queryKey: ['bell-announcements'] });
        queryClient.invalidateQueries({ queryKey: ['announcements-unread'] });
      } catch { /* ignore */ }
    }
    setOpen(false);
    if (item.url) navigate(item.url);
  }, [navigate, refresh, queryClient]);

  const markAllRead = useCallback(async () => {
    try {
      // Mark all notifications read
      await notificationService.markAllRead();
      // Mark all announcements read
      await announcementService.markAllRead();
      queryClient.invalidateQueries({ queryKey: ['bell-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['bell-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcements-unread'] });
    } catch { /* ignore */ }
  }, [queryClient]);

  const dismissAlert = (id: string) => setDismissedAlerts((prev) => new Set([...prev, id]));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
        className="text-gray-600 hover:text-gray-900 p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 relative"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
              {totalUnread > 0 && (
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto">
              {notifLoading && feed.length === 0 ? (
                <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
              ) : feed.length === 0 ? (
                <EmptyBlock text="You're all caught up — no notifications yet." />
              ) : (
                <ul className="divide-y divide-gray-50">
                  {feed.map((item) => (
                    <li key={item.id}>
                      {item.kind === 'alert' ? (
                        // Alert items have a card-style layout with dismiss
                        <div className="px-3 py-2">
                          <div className={clsx('p-3 rounded-xl border text-xs flex items-start justify-between gap-2',
                            ALERT_TONE[item.severity || 'info'] ?? ALERT_TONE.info)}>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">{item.title}</p>
                              <p className="mt-0.5 opacity-80">{item.body}</p>
                              {item.url && (
                                <button onClick={() => { setOpen(false); navigate(item.url!); }}
                                  className="mt-1 text-xs font-medium underline underline-offset-2 hover:opacity-80">
                                  View details
                                </button>
                              )}
                            </div>
                            {item.dismissible && (
                              <button aria-label="Dismiss" onClick={() => dismissAlert(item.id.replace('alert-', ''))}
                                className="flex-shrink-0 opacity-60 hover:opacity-100">
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => openItem(item)}
                          className={clsx(
                            'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors',
                            !item.read && 'bg-blue-50/40'
                          )}
                        >
                          <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', item.tint)}>
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-gray-900 truncate">{item.title}</span>
                            <span className="block text-xs text-gray-600 line-clamp-2">{item.body}</span>
                            <span className="block text-[11px] text-gray-400 mt-0.5">{relativeTime(item.createdAt)}</span>
                          </span>
                          {!item.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const EmptyBlock: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-10 px-6 text-center">
    <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
      <Bell size={22} />
    </div>
    <p className="text-sm text-gray-500">{text}</p>
  </div>
);

export default NotificationBell;
