/**
 * WeeklyReviewHistory: "Weekly reviews" section for the parent and student
 * attendance views. Newest week first, each card merges the week's attendance
 * (already loaded by the page) with the teacher's rating and comment.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { weeklyReviewService, type WeeklyReviewItem } from '@services/weeklyReviewService';
import {
  WEEKDAY_LABELS,
  averageRating,
  bestStatus,
  formatShortDate,
  formatWeekOf,
  getRatingStyle,
  normalizeDayStatus,
  weekDayKeys,
  weekdayFull,
  type WeekDayStatus,
} from '@lib/weeklyReview';
import { DayChip, RatingBadge } from './WeeklyReviewBadges';

export type WeeklyReviewHistoryProps = (
  | { mode: 'my' }
  | { mode: 'child'; studentId: string }
) & {
  /** Canonical academic year (YYYY/YYYY) the page is showing. */
  year: string;
  /** '' = whole year, otherwise first_term | second_term | third_term. */
  term?: string;
  /** Attendance rows the page already loaded for the same year/term. */
  attendanceRecords: Array<{ date: string; status: string }>;
};

const TREND_WEEKS = 8;
const FIRST_PAGE = 10;
const TERM_LABELS: Record<string, string> = { first_term: 'Term 1', second_term: 'Term 2', third_term: 'Term 3' };

export const WeeklyReviewHistory: React.FC<WeeklyReviewHistoryProps> = (props) => {
  const { year, term = '', attendanceRecords } = props;
  const studentId = props.mode === 'child' ? props.studentId : '';
  const [showAll, setShowAll] = useState(false);

  const enabled = !!year && (props.mode === 'my' || !!studentId);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['weekly-reviews', props.mode, studentId, year, term],
    queryFn: async () => {
      const params = { academic_year: year, term: term || undefined };
      const res = props.mode === 'my'
        ? await weeklyReviewService.getMy(params)
        : await weeklyReviewService.getChild(studentId, params);
      // apiClient never throws: a failed load must not read as "no reviews yet".
      if (res.success === false || !res.data) throw new Error(res.error || "Couldn't load weekly reviews");
      return res.data;
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
  });

  // Best status per calendar day across all sessions, keyed 'YYYY-MM-DD'.
  const statusByDate = useMemo(() => {
    const m = new Map<string, WeekDayStatus>();
    for (const r of attendanceRecords) {
      const key = String(r.date ?? '').slice(0, 10);
      if (!key) continue;
      m.set(key, bestStatus(m.get(key) ?? 'none', normalizeDayStatus(r.status)));
    }
    return m;
  }, [attendanceRecords]);

  const reviews: WeeklyReviewItem[] = data?.reviews ?? [];
  const trend = useMemo(() => reviews.slice(0, TREND_WEEKS).reverse(), [reviews]);
  const avgPerformance = averageRating(reviews.map((r) => r.performance_rating));
  const avgBehaviour = averageRating(reviews.map((r) => r.behaviour_rating));
  const scope = term ? (TERM_LABELS[term] ?? 'this term') : year;
  const visible = showAll ? reviews : reviews.slice(0, FIRST_PAGE);

  if (!enabled) return null;

  return (
    <section aria-labelledby="weekly-reviews-title" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
        <h3 id="weekly-reviews-title" className="font-bold text-gray-900 dark:text-white">Weekly reviews</h3>
        {avgPerformance && (
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
            Average for {scope}: <span className={`font-bold ${avgPerformance.text}`}>{avgPerformance.label}</span>
            {avgBehaviour && <span className="text-gray-500 dark:text-gray-400"> · behaviour <span className={`font-semibold ${avgBehaviour.text}`}>{avgBehaviour.label}</span></span>}
          </p>
        )}
      </div>

      {isLoading ? (
        <div role="status" className="flex items-center justify-center py-10 text-sm text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> Loading weekly reviews…
        </div>
      ) : error ? (
        <div role="alert" className="py-10 text-center text-sm text-gray-500">
          <p>{(error as Error).message || "Couldn't load weekly reviews"}</p>
          <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-bold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Try again
          </button>
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState message="No weekly reviews yet." description="Teachers add them on Fridays." />
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          {trend.length > 1 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Performance, last {trend.length} weeks</p>
              <ul aria-label={`Performance trend for the last ${trend.length} weeks, oldest to newest`} className="flex h-16 items-end gap-1.5 sm:max-w-md">
                {trend.map((r) => {
                  const style = getRatingStyle(r.performance_rating);
                  const text = `${formatWeekOf(r.week_start)}: ${style?.label ?? 'Not rated'}`;
                  return (
                    <li key={r.week_start} aria-label={text} title={text} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                      <div className={`w-full rounded-t ${style?.bar ?? 'bg-gray-300'}`} style={{ height: `${Math.max(1, Number(r.performance_rating) || 0) * 20}%` }} />
                    </li>
                  );
                })}
              </ul>
              <ul aria-hidden="true" className="mt-0.5 flex gap-1.5 sm:max-w-md">
                {trend.map((r) => (
                  <li key={r.week_start} className="min-w-0 flex-1 truncate text-center text-[9px] text-gray-400">{formatShortDate(r.week_start)}</li>
                ))}
              </ul>
            </div>
          )}

          <ol className="space-y-3">
            {visible.map((r) => {
              const days = weekDayKeys(r.week_start).map((date, i) => ({ date, label: WEEKDAY_LABELS[i], status: statusByDate.get(date) ?? 'none' as WeekDayStatus }));
              const hasRegister = days.some((d) => d.status !== 'none');
              return (
                <li key={r.week_start} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">{formatWeekOf(r.week_start)}</h4>
                    {r.term && TERM_LABELS[r.term] && <span className="text-xs text-gray-400">{TERM_LABELS[r.term]}</span>}
                  </div>

                  <div role="group" aria-label="Attendance that week" className="mt-2 sm:max-w-md">
                    <div className="flex gap-1.5">
                      {days.map((d, i) => <DayChip key={d.date} day={d.label} fullDay={weekdayFull(i)} status={d.status} />)}
                    </div>
                    {!hasRegister && <p className="mt-1 text-xs text-gray-400">No register that week</p>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <RatingBadge kind="Performance" value={r.performance_rating} />
                    {r.behaviour_rating != null && <RatingBadge kind="Behaviour" value={r.behaviour_rating} />}
                  </div>

                  {r.comment && (
                    <blockquote className="mt-3 whitespace-pre-line rounded-r-lg border-l-4 border-blue-300 bg-gray-50 px-3 py-2 text-sm italic text-gray-700 dark:border-blue-700 dark:bg-gray-900/40 dark:text-gray-200">
                      {r.comment}
                    </blockquote>
                  )}
                  {r.teacher_name && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Review by {r.teacher_name}</p>}
                </li>
              );
            })}
          </ol>

          {reviews.length > FIRST_PAGE && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="min-h-10 w-full rounded-xl border border-gray-200 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:text-blue-300 dark:hover:bg-blue-950/30"
            >
              {showAll ? 'Show fewer weeks' : `Show ${reviews.length - FIRST_PAGE} older ${reviews.length - FIRST_PAGE === 1 ? 'week' : 'weeks'}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default WeeklyReviewHistory;
