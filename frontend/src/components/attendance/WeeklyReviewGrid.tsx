/**
 * WeeklyReviewGrid: the teacher's "Weekly Review" tab on the Attendance page.
 *
 * Built for a phone on Friday afternoon with ~40 students: one card per student
 * (attendance chips, two tap-to-rate scales, a comment with quick phrases),
 * a sticky save bar that sends only the changed rows, and drafts that survive
 * a tab switch or reload (sessionStorage, per class + week).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Lock, WifiOff } from 'lucide-react';
import { showToast } from '@utils/toast';
import {
  weeklyReviewService,
  type WeeklyClassData,
  type WeeklyClassStudent,
  type WeeklyReviewInput,
} from '@services/weeklyReviewService';
import {
  COMMENT_MAX,
  WEEKDAY_LABELS,
  WEEKLY_RATINGS_ASC,
  addDaysToKey,
  currentWeekStart,
  formatWeekRange,
  getRatingStyle,
  localDateKey,
  mondayOfKey,
  normalizeDayStatus,
  weekdayFull,
} from '@lib/weeklyReview';
import { DayChip } from './WeeklyReviewBadges';

// ── Types & draft helpers ────────────────────────────────────────────────────

interface Draft {
  performance: number | null;
  behaviour: number | null;
  comment: string;
}
type Edits = Record<string, Draft>;
type RowAction = 'none' | 'save' | 'clear' | 'incomplete';

const EMPTY_DRAFT: Draft = { performance: null, behaviour: null, comment: '' };

function baselineOf(s: WeeklyClassStudent): Draft {
  return s.review
    ? { performance: s.review.performance_rating ?? null, behaviour: s.review.behaviour_rating ?? null, comment: s.review.comment ?? '' }
    : EMPTY_DRAFT;
}

function sameDraft(a: Draft, b: Draft): boolean {
  return a.performance === b.performance && a.behaviour === b.behaviour && a.comment.trim() === b.comment.trim();
}

/** What saving this row would do. 'incomplete' = has a comment/behaviour but no performance rating. */
function rowAction(edit: Draft | undefined, s: WeeklyClassStudent): RowAction {
  if (!edit || sameDraft(edit, baselineOf(s))) return 'none';
  if (edit.performance !== null) return 'save';
  if (edit.behaviour === null && !edit.comment.trim()) return s.review ? 'clear' : 'none';
  return 'incomplete';
}

const QUICK_PHRASES: Array<{ text: string; tone: 'positive' | 'support' }> = [
  { text: 'Participated well in class.', tone: 'positive' },
  { text: 'Completed all homework.', tone: 'positive' },
  { text: 'Showed real improvement this week.', tone: 'positive' },
  { text: 'Helpful and kind to classmates.', tone: 'positive' },
  { text: 'Needs to complete homework on time.', tone: 'support' },
  { text: 'Needs to focus more in class.', tone: 'support' },
  { text: 'Please encourage reading at home.', tone: 'support' },
  { text: 'Missed days affected progress this week.', tone: 'support' },
];

function appendPhrase(current: string, phrase: string): string {
  if (current.includes(phrase)) return current;
  const next = current.trim() ? `${current.replace(/\s+$/, '')} ${phrase}` : phrase;
  return next.length > COMMENT_MAX ? current : next;
}

// ── Draft persistence (sessionStorage; never throws) ─────────────────────────

const draftsKey = (classId: string, week: string) => `weekly-review-drafts:${classId}:${week}`;

function readDrafts(key: string): Edits {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || '{}');
    const out: Edits = {};
    for (const [id, d] of Object.entries(parsed as Record<string, any>)) {
      if (d && typeof d === 'object') {
        out[id] = {
          performance: typeof d.performance === 'number' ? d.performance : null,
          behaviour: typeof d.behaviour === 'number' ? d.behaviour : null,
          comment: typeof d.comment === 'string' ? d.comment.slice(0, COMMENT_MAX) : '',
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeDrafts(key: string, edits: Edits) {
  try {
    if (Object.keys(edits).length === 0) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(edits));
  } catch {
    /* storage full / blocked: drafts just won't survive a reload */
  }
}

function clearDrafts(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── Rating scale (native radios: arrow keys + radiogroup semantics for free) ─

const RatingScale: React.FC<{
  label: string;
  studentName: string;
  groupName: string;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
  /** Optional scales can be cleared by tapping the selected value again. */
  optional?: boolean;
}> = ({ label, studentName, groupName, value, onChange, disabled, optional }) => {
  const selected = getRatingStyle(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</span>
        <span className={`text-xs font-bold ${selected ? selected.text : 'text-gray-400 dark:text-gray-500'}`}>
          {selected ? selected.label : 'Not rated'}
        </span>
      </div>
      <div role="radiogroup" aria-label={`${label} for ${studentName}`} className="flex gap-1.5">
        {WEEKLY_RATINGS_ASC.map((r) => {
          const checked = value === r.value;
          return (
            <label key={r.value} className="relative min-w-0 flex-1" title={optional && checked ? `${r.label} (tap again to remove)` : r.label}>
              <input
                type="radio"
                name={groupName}
                value={r.value}
                checked={checked}
                disabled={disabled}
                aria-label={`${r.value}, ${r.label}`}
                onChange={() => onChange(r.value)}
                onClick={() => { if (optional && checked) onChange(null); }}
                className="peer sr-only"
              />
              <span
                className={`flex h-11 w-full cursor-pointer select-none items-center justify-center rounded-xl border text-base font-bold transition peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 dark:peer-focus-visible:ring-offset-gray-800 ${checked ? r.solid : r.idle}`}
              >
                {r.value}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

// ── One student ──────────────────────────────────────────────────────────────

const ReviewRow = React.memo(function ReviewRow({
  student,
  edit,
  canEdit,
  onPatch,
}: {
  student: WeeklyClassStudent;
  edit: Draft | undefined;
  canEdit: boolean;
  onPatch: (s: WeeklyClassStudent, change: Partial<Draft> | 'clear') => void;
}) {
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const draft = edit ?? baselineOf(student);
  const action = rowAction(edit, student);
  const dirty = action !== 'none';
  const hasContent = draft.performance !== null || draft.behaviour !== null || draft.comment.length > 0;
  const days = student.attendance?.days ?? [];
  const summary = student.attendance?.summary;
  const commentId = `wr-comment-${student.student_id}`;

  return (
    <li
      className={`rounded-2xl border bg-white p-3 shadow-sm dark:bg-gray-800 sm:p-4 ${
        dirty ? 'border-amber-300 dark:border-amber-700' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6">
        {/* Who + the week's attendance */}
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{student.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{student.student_number || 'No student number'}</p>
            </div>
            {dirty ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {action === 'incomplete' ? 'Needs a rating' : action === 'clear' ? 'Will be cleared' : 'Unsaved'}
              </span>
            ) : student.review ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <Check size={12} aria-hidden="true" /> Saved
              </span>
            ) : null}
          </div>

          <div className="mt-2" role="group" aria-label={`Attendance this week for ${student.name}`}>
            <div className="flex gap-1">
              {days.length > 0
                ? days.map((d, i) => (
                    <DayChip key={d.date || i} day={d.label || WEEKDAY_LABELS[i] || ''} fullDay={weekdayFull(i)} status={normalizeDayStatus(d.status)} compact />
                  ))
                : WEEKDAY_LABELS.map((l, i) => <DayChip key={l} day={l} fullDay={weekdayFull(i)} status="none" compact />)}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600 dark:text-gray-300">
              {!summary || summary.recorded === 0 ? (
                <span className="text-gray-400 dark:text-gray-500">No register this week</span>
              ) : (
                <>
                  <span>{Math.round(summary.rate)}% attendance</span>
                  {summary.absent > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400">
                      <AlertTriangle size={12} aria-hidden="true" /> {summary.absent} absent
                    </span>
                  )}
                  {summary.late > 0 && <span className="text-amber-700 dark:text-amber-400">{summary.late} late</span>}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Ratings + comment */}
        <div className="mt-3 space-y-3 lg:mt-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <RatingScale
              label="Performance"
              studentName={student.name}
              groupName={`wr-perf-${student.student_id}`}
              value={draft.performance}
              onChange={(v) => onPatch(student, { performance: v })}
              disabled={!canEdit}
            />
            <RatingScale
              label="Behaviour (optional)"
              studentName={student.name}
              groupName={`wr-beh-${student.student_id}`}
              value={draft.behaviour}
              onChange={(v) => onPatch(student, { behaviour: v })}
              disabled={!canEdit}
              optional
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor={commentId} className="text-xs font-semibold text-gray-600 dark:text-gray-300">Comment (optional)</label>
              <span className={`text-xs ${draft.comment.length >= COMMENT_MAX - 60 ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {draft.comment.length}/{COMMENT_MAX}
              </span>
            </div>
            <textarea
              id={commentId}
              rows={2}
              maxLength={COMMENT_MAX}
              value={draft.comment}
              disabled={!canEdit}
              onChange={(e) => onPatch(student, { comment: e.target.value })}
              placeholder={canEdit ? `A line or two on ${student.name.split(' ')[0]}'s week…` : 'No comment'}
              className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800"
            />
            {canEdit && (
              <>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-expanded={phrasesOpen}
                    aria-controls={`wr-phrases-${student.student_id}`}
                    onClick={() => setPhrasesOpen((o) => !o)}
                    className="min-h-9 rounded-lg px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-950/40"
                  >
                    {phrasesOpen ? 'Hide quick phrases' : 'Quick phrases'}
                  </button>
                  {hasContent && (
                    <button
                      type="button"
                      onClick={() => onPatch(student, 'clear')}
                      aria-label={`Clear the review for ${student.name}`}
                      className="min-h-9 rounded-lg px-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {phrasesOpen && (
                  <div id={`wr-phrases-${student.student_id}`} className="mt-1 flex flex-wrap gap-1.5">
                    {QUICK_PHRASES.map((p) => {
                      const used = draft.comment.includes(p.text);
                      const blocked = !used && appendPhrase(draft.comment, p.text) === draft.comment;
                      return (
                        <button
                          key={p.text}
                          type="button"
                          aria-pressed={used}
                          disabled={used || blocked}
                          onClick={() => onPatch(student, { comment: appendPhrase(draft.comment, p.text) })}
                          className={`min-h-9 rounded-full border px-3 py-1 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                            p.tone === 'positive'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                          }`}
                        >
                          {used && <Check size={11} className="mr-1 inline" aria-hidden="true" />}
                          {p.text}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
});

// ── One class, one week ──────────────────────────────────────────────────────

const ClassWeekPanel: React.FC<{
  classId: string;
  week: string;
  online: boolean;
  onDirtyChange: (n: number) => void;
}> = ({ classId, week, online, onDirtyChange }) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['weekly-review', classId, week] as const, [classId, week]);
  const storageKey = draftsKey(classId, week);

  const { data, isLoading, error, refetch, isFetching } = useQuery<WeeklyClassData, Error>({
    queryKey,
    queryFn: async () => {
      const res = await weeklyReviewService.getClassWeek(classId, week);
      // apiClient never throws: a failed load must not look like an empty class.
      if (res.success === false || !res.data) throw new Error(res.error || "Couldn't load this class's reviews");
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const [edits, setEdits] = useState<Edits>(() => readDrafts(storageKey));
  const students = data?.students ?? [];
  const canEdit = !!data?.can_edit;

  const { changed, incomplete, unrated } = useMemo(() => {
    let changedN = 0;
    let incompleteN = 0;
    let unratedN = 0;
    for (const s of students) {
      const edit = edits[s.student_id];
      const a = rowAction(edit, s);
      if (a === 'save' || a === 'clear') changedN++;
      else if (a === 'incomplete') incompleteN++;
      if ((edit ?? baselineOf(s)).performance === null) unratedN++;
    }
    return { changed: changedN, incomplete: incompleteN, unrated: unratedN };
  }, [students, edits]);
  const pending = changed + incomplete;
  const saved = students.filter((s) => s.review).length;

  // Keep drafts across tab switches / reloads. Wait for the roster so a restored
  // draft isn't pruned before it can be compared with the server data.
  useEffect(() => {
    if (!data) return;
    const byId = new Map(data.students.map((s) => [s.student_id, s] as const));
    const live: Edits = {};
    for (const [id, d] of Object.entries(edits)) {
      const s = byId.get(id);
      if (s && rowAction(d, s) !== 'none') live[id] = d;
    }
    writeDrafts(storageKey, live);
  }, [edits, data, storageKey]);

  useEffect(() => {
    onDirtyChange(pending);
    return () => onDirtyChange(0);
  }, [pending, onDirtyChange]);

  useEffect(() => {
    if (pending === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  const patch = useCallback((s: WeeklyClassStudent, change: Partial<Draft> | 'clear') => {
    setEdits((prev) => {
      const current = prev[s.student_id] ?? baselineOf(s);
      return { ...prev, [s.student_id]: change === 'clear' ? { ...EMPTY_DRAFT } : { ...current, ...change } };
    });
  }, []);

  const setAllGood = () => {
    setEdits((prev) => {
      const next = { ...prev };
      for (const s of students) {
        const cur = next[s.student_id] ?? baselineOf(s);
        if (cur.performance === null) next[s.student_id] = { ...cur, performance: 3 };
      }
      return next;
    });
  };

  const buildPayload = (): WeeklyReviewInput[] =>
    students.flatMap((s): WeeklyReviewInput[] => {
      const d = edits[s.student_id];
      const action = rowAction(d, s);
      if (action === 'clear' && s.review) {
        return [{ student_id: s.student_id, performance_rating: s.review.performance_rating, clear: true }];
      }
      if (action !== 'save' || !d || d.performance === null) return [];
      const item: WeeklyReviewInput = { student_id: s.student_id, performance_rating: d.performance };
      const comment = d.comment.trim();
      // Omit empty optional fields; send null only to remove a value that was saved before.
      if (d.behaviour !== null) item.behaviour_rating = d.behaviour;
      else if (s.review?.behaviour_rating != null) item.behaviour_rating = null;
      if (comment) item.comment = comment;
      else if (s.review?.comment) item.comment = null;
      return [item];
    });

  const save = useMutation({
    mutationFn: async () => {
      const reviews = buildPayload();
      if (reviews.length === 0) throw new Error('Nothing to save');
      const res = await weeklyReviewService.saveClassWeek(classId, { week, reviews });
      if (res.success === false) throw new Error(res.error || "Couldn't save the reviews");
      return res.data ?? { saved: reviews.length, cleared: 0, skipped: 0, notified: 0 };
    },
    onSuccess: async (result) => {
      const done = (result.saved ?? 0) + (result.cleared ?? 0);
      const notified = result.notified ?? 0;
      showToast.success(
        `Saved ${plural(done, 'review')}${notified > 0 ? ` · ${plural(notified, 'parent')} notified` : ''}`,
      );
      if ((result.skipped ?? 0) > 0) {
        showToast.warning(`${plural(result.skipped, 'review')} could not be saved. They are still marked as unsaved.`);
      }
      // The server is the source of truth: reload it, then drop drafts that now match it.
      await Promise.all([
        queryClient.refetchQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: ['weekly-review-progress'] }),
      ]);
      const fresh = queryClient.getQueryData<WeeklyClassData>(queryKey);
      if (fresh) {
        const byId = new Map(fresh.students.map((s) => [s.student_id, s] as const));
        setEdits((prev) => {
          const next: Edits = {};
          for (const [id, d] of Object.entries(prev)) {
            const s = byId.get(id);
            if (s && rowAction(d, s) !== 'none') next[id] = d;
          }
          return next;
        });
      }
    },
    onError: (e: Error) => showToast.error(e.message || "Couldn't save the reviews"),
  });

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading class" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-3 flex gap-1">{[0, 1, 2, 3, 4].map((j) => <div key={j} className="h-10 flex-1 rounded-lg bg-gray-100 dark:bg-gray-700/60" />)}</div>
            <div className="mt-3 h-11 rounded-xl bg-gray-100 dark:bg-gray-700/60" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        <p>{error?.message || "Couldn't load this class's reviews"}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 min-h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        There are no students in this class yet.
      </div>
    );
  }

  const pct = students.length ? Math.round((saved / students.length) * 100) : 0;
  const statusText = !online
    ? 'Needs a connection to save.'
    : incomplete > 0
      ? `${plural(incomplete, 'student')} need a performance rating before saving.`
      : changed > 0
        ? `${plural(changed, 'unsaved change')}.`
        : saved > 0
          ? 'All changes saved.'
          : 'Nothing to save yet.';

  return (
    <div className="space-y-3">
      {!canEdit && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
          <Lock size={16} aria-hidden="true" /> Read-only: you can view this class but can't edit its weekly reviews.
        </div>
      )}

      <section aria-label="Review progress" className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {saved} of {students.length} reviewed
            {isFetching && <Loader2 size={14} className="ml-2 inline animate-spin text-gray-400" aria-label="Refreshing" />}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={setAllGood}
              disabled={unrated === 0}
              title={unrated ? `Sets performance to Good for the ${plural(unrated, 'student')} without a rating` : 'Every student already has a performance rating'}
              className="min-h-10 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
            >
              Set all to Good{unrated > 0 ? ` (${unrated})` : ''}
            </button>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="Students with a saved review"
          aria-valuemin={0}
          aria-valuemax={students.length}
          aria-valuenow={saved}
          className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
        >
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          Attendance key: <b>P</b> Present · <b>L</b> Late · <b>E</b> Excused · <b>A</b> Absent · <b>–</b> No register.
          Ratings: 5 Excellent · 4 Very good · 3 Good · 2 Needs support · 1 Concern.
        </p>
      </section>

      <ul className="space-y-3" aria-label="Students">
        {students.map((s) => (
          <ReviewRow key={s.student_id} student={s} edit={edits[s.student_id]} canEdit={canEdit} onPatch={patch} />
        ))}
      </ul>

      {canEdit && (
        <div className="sticky bottom-0 z-20 -mx-2 border-t border-gray-200 bg-white/95 px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.625rem)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:mx-0 sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between gap-3">
            <p role="status" className={`min-w-0 text-xs ${!online || incomplete > 0 ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'}`}>
              {statusText}
            </p>
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={changed === 0 || !online || save.isPending}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-5 text-sm font-bold text-white shadow-md shadow-blue-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-gray-900"
            >
              {save.isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {save.isPending ? 'Saving…' : `Save reviews${changed > 0 ? ` (${changed} changed)` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Pickers + panel ──────────────────────────────────────────────────────────

export interface WeeklyReviewGridProps {
  /** The Attendance page's class list for the selected year. */
  classes: Array<{ id: string | number; name: string }>;
  year: string;
}

export const WeeklyReviewGrid: React.FC<WeeklyReviewGridProps> = ({ classes, year }) => {
  const online = useOnline();
  const [pickedClass, setPickedClass] = useState('');
  const [week, setWeek] = useState(() => currentWeekStart());
  const thisWeek = currentWeekStart();
  const dirtyRef = useRef(0);
  const onDirtyChange = useCallback((n: number) => { dirtyRef.current = n; }, []);

  // Default to the first class; a class that isn't in this year's list falls back to it.
  const classId = classes.some((c) => String(c.id) === pickedClass) ? pickedClass : classes[0] ? String(classes[0].id) : '';

  const { data: progress } = useQuery({
    queryKey: ['weekly-review-progress', week, year],
    queryFn: async () => {
      const res = await weeklyReviewService.getProgress(week);
      if (res.success === false) throw new Error(res.error || "Couldn't load progress");
      return res.data ?? [];
    },
    enabled: online && classes.length > 0,
    staleTime: 30_000,
    retry: 1,
  });
  const progressByClass = useMemo(() => {
    const m = new Map<string, { students: number; reviewed: number }>();
    for (const p of progress ?? []) m.set(String(p.class_id), { students: p.students, reviewed: p.reviewed });
    return m;
  }, [progress]);

  /** Ask before leaving a class/week with unsaved rows; discards them if the user agrees. */
  const go = (nextClass: string, nextWeek: string) => {
    if (nextClass === classId && nextWeek === week) return;
    if (dirtyRef.current > 0) {
      if (!window.confirm('You have unsaved weekly reviews. Leave without saving them?')) return;
      clearDrafts(draftsKey(classId, week));
    }
    setPickedClass(nextClass);
    setWeek(nextWeek > thisWeek ? thisWeek : nextWeek);
  };

  if (classes.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        No classes are available to review yet.
      </div>
    );
  }

  const isThisWeek = week === thisWeek;
  const navBtn =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-300">Parents get this with Friday's attendance summary.</p>

      {!online && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <WifiOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Weekly reviews need a connection to load and save. Anything you type here is kept on this device until you're back online.</span>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:p-4 lg:flex lg:items-end lg:gap-6 lg:space-y-0">
        <div className="lg:w-80">
          <label htmlFor="wr-class" className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">Class</label>
          <select
            id="wr-class"
            value={classId}
            onChange={(e) => go(e.target.value, week)}
            className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            {classes.map((c) => {
              const p = progressByClass.get(String(c.id));
              return (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.name}{p ? ` · ${p.reviewed}/${p.students} reviewed` : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div className="min-w-0 flex-1">
          <span id="wr-week-label" className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">Week</span>
          <div role="group" aria-labelledby="wr-week-label" className="flex flex-wrap items-center gap-2">
            <button type="button" className={navBtn} aria-label="Previous week" onClick={() => go(classId, addDaysToKey(week, -7))}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-sm font-bold text-gray-900 dark:text-white" aria-live="polite">{formatWeekRange(week)}</p>
              {isThisWeek && <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">This week</p>}
            </div>
            <button type="button" className={navBtn} aria-label="Next week" disabled={isThisWeek} onClick={() => go(classId, addDaysToKey(week, 7))}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            <input
              type="date"
              aria-label="Jump to the week containing this date"
              value={week}
              max={localDateKey(new Date())}
              onChange={(e) => { if (e.target.value) go(classId, mondayOfKey(e.target.value)); }}
              className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 sm:w-auto"
            />
          </div>
        </div>
      </div>

      {classId && (
        <ClassWeekPanel key={`${classId}|${week}`} classId={classId} week={week} online={online} onDirtyChange={onDirtyChange} />
      )}
    </div>
  );
};

export default WeeklyReviewGrid;
