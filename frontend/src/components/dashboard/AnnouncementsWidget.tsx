/**
 * AnnouncementsWidget — a compact dashboard card showing the announcements
 * relevant to the current user.
 *
 * Scoping is enforced server-side: the /api/v1/announcements endpoint filters by
 * the caller's tenant AND their role audience (e.g. a teacher sees only 'all' +
 * 'teacher' announcements from their own school). This widget just renders what
 * the API returns, so tenant + role isolation is guaranteed by the backend.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, AlertTriangle, ArrowRight } from 'lucide-react';
import announcementService, { type Announcement } from '@services/announcementService';

interface AnnouncementsWidgetProps {
  /** How many to show. */
  limit?: number;
  /** Optional heading override. */
  title?: string;
  className?: string;
}

function relTime(iso?: string): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const AnnouncementsWidget: React.FC<AnnouncementsWidgetProps> = ({
  limit = 5,
  title = 'Announcements',
  className = '',
}) => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-announcements', limit],
    queryFn: () => announcementService.list({ limit }),
    staleTime: 60_000,
  });

  const items: Announcement[] = useMemo(() => (data as any)?.data ?? [], [data]);
  const unread = items.filter((a) => !a.is_read).length;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Megaphone size={16} className="text-blue-500" /> {title}
          {unread > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </h3>
        <button
          onClick={() => navigate('/communication/announcements')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700"
        >
          View all <ArrowRight size={13} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          No announcements yet. Updates from your school will appear here.
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate('/communication/announcements')}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                a.is_read
                  ? 'border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                  : 'border-blue-200 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-900/10 hover:bg-blue-50'
              }`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                a.priority === 'high' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {a.priority === 'high' ? <AlertTriangle size={15} /> : <Megaphone size={15} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  {!a.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.title}</span>
                </span>
                <span className="block text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{a.body}</span>
                <span className="block text-[11px] text-gray-400 mt-0.5">
                  {a.author_name ? `${a.author_name} · ` : ''}{relTime(a.created_at)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsWidget;
