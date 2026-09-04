/**
 * NotificationBell — production-ready notifications dropdown.
 *
 * Captures:
 *  - The user's in-app notifications (/api/v1/notifications) — admissions,
 *    discipline, payments, appeals, report cards, etc.
 *  - System alerts (principals/super_admins) from the dashboard alerts feed.
 *
 * Features: unread badge (notifications + alerts), tabbed view, per-item
 * mark-read + navigate, mark-all-read, relative timestamps, type icons,
 * empty/loading states, click-away, polling with focus refresh.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCheck, GraduationCap, Wallet, ShieldAlert, CalendarCheck,
  UserPlus, FileText, Info, X, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import notificationService, { type AppNotification } from '@services/notificationService';
import { dashboardService } from '@services/dashboardService';

interface SystemAlert {
  id: string;
  title: string;
  message: string;
  severity?: string;
  actionUrl?: string;
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

interface NotificationBellProps {
  canSeeAlerts: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ canSeeAlerts }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'notifications' | 'alerts'>('notifications');
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Notifications — poll every 60s, refetch on window focus.
  const { data: notifResp, isLoading: notifLoading } = useQuery({
    queryKey: ['bell-notifications'],
    queryFn: () => notificationService.list({ limit: 20 }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const notifications: AppNotification[] = Array.isArray(notifResp?.data) ? notifResp!.data : [];
  const unreadNotifications = notifications.filter((n) => !n.readAt);

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

  const totalUnread = unreadNotifications.length + (canSeeAlerts ? visibleAlerts.length : 0);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bell-notifications'] });
  }, [queryClient]);

  const openItem = useCallback(async (n: AppNotification) => {
    if (!n.readAt) {
      try { await notificationService.markRead(n.id); refresh(); } catch { /* ignore */ }
    }
    const url = (n.data as any)?.url || (n.data as any)?.actionUrl;
    setOpen(false);
    if (url) navigate(url);
  }, [navigate, refresh]);

  const markAll = useCallback(async () => {
    try { await notificationService.markAllRead(); refresh(); } catch { /* ignore */ }
  }, [refresh]);

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
              {unreadNotifications.length > 0 && (
                <button
                  onClick={markAll}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
            </div>

            {/* Tabs (only show alerts tab for principals) */}
            {canSeeAlerts && (
              <div className="px-3 flex gap-1 border-b border-gray-100">
                <TabBtn active={tab === 'notifications'} onClick={() => setTab('notifications')}
                  label="Activity" count={unreadNotifications.length} />
                <TabBtn active={tab === 'alerts'} onClick={() => setTab('alerts')}
                  label="System" count={visibleAlerts.length} />
              </div>
            )}

            <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto">
              {/* Activity / notifications */}
              {(!canSeeAlerts || tab === 'notifications') && (
                notifLoading ? (
                  <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
                ) : notifications.length === 0 ? (
                  <EmptyBlock text="You're all caught up — no notifications yet." />
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {notifications.map((n) => {
                      const v = typeVisual(n.notificationType);
                      return (
                        <li key={n.id}>
                          <button
                            onClick={() => openItem(n)}
                            className={clsx(
                              'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors',
                              !n.readAt && 'bg-blue-50/40'
                            )}
                          >
                            <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', v.tint)}>
                              {v.icon}
                            </span>
                            <span className="min-w-0 flex-1">
                              {n.subject && <span className="block text-sm font-semibold text-gray-900 truncate">{n.subject}</span>}
                              <span className="block text-xs text-gray-600 line-clamp-2">{n.message}</span>
                              <span className="block text-[11px] text-gray-400 mt-0.5">{relativeTime(n.createdAt)}</span>
                            </span>
                            {!n.readAt && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )
              )}

              {/* System alerts */}
              {canSeeAlerts && tab === 'alerts' && (
                visibleAlerts.length === 0 ? (
                  <EmptyBlock text="No active system alerts." />
                ) : (
                  <div className="p-3 space-y-2">
                    {visibleAlerts.map((a) => (
                      <div key={a.id} className={clsx('p-3 rounded-xl border text-xs flex items-start justify-between gap-2', ALERT_TONE[a.severity || 'info'] ?? ALERT_TONE.info)}>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{a.title}</p>
                          <p className="mt-0.5 opacity-80">{a.message}</p>
                          {a.actionUrl && (
                            <button onClick={() => { setOpen(false); navigate(a.actionUrl!); }}
                              className="mt-1 text-xs font-medium underline underline-offset-2 hover:opacity-80">
                              View details
                            </button>
                          )}
                        </div>
                        {a.dismissible !== false && (
                          <button aria-label="Dismiss" onClick={() => dismissAlert(a.id)} className="flex-shrink-0 opacity-60 hover:opacity-100">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const TabBtn: React.FC<{ active: boolean; onClick: () => void; label: string; count: number }> = ({ active, onClick, label, count }) => (
  <button
    onClick={onClick}
    className={clsx(
      'px-3 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5',
      active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
    )}
  >
    {label}
    {count > 0 && (
      <span className="min-w-[16px] h-4 px-1 bg-red-100 text-red-600 text-[10px] font-bold rounded-full flex items-center justify-center">{count}</span>
    )}
  </button>
);

const EmptyBlock: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-10 px-6 text-center">
    <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
      <Bell size={22} />
    </div>
    <p className="text-sm text-gray-500">{text}</p>
  </div>
);

export default NotificationBell;
