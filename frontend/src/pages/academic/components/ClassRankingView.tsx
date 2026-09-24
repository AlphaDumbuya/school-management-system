/**
 * ClassRankingView — results directory ordered by position (1st, 2nd, 3rd …).
 *
 * Shows every student in the selected class ranked by their term/year position.
 * The class leader(s) are celebrated with a podium + trophy treatment. Staff
 * see live rankings any time; students/parents are publish-gated by the server.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Award, Crown, Loader2, Users, Sparkles } from 'lucide-react';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { reportCardService, SL_TERMS } from '@services/reportCardService';
import type { ClassRankingStudent } from '@services/reportCardService';

type ViewTerm = 'first_term' | 'second_term' | 'third_term' | 'full';

interface Props {
  classId: string;
  academicYear: string;
  /** Terms the viewer may open (staff: all; others: released only). */
  availableTerms?: ViewTerm[];
}

const TERM_LABEL: Record<string, string> = Object.fromEntries(
  (SL_TERMS as any[]).map((t: any) => [t.value ?? t, t.label ?? t]),
);

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Podium tile for a top-3 student. */
const PodiumCard: React.FC<{ student: ClassRankingStudent; rank: 1 | 2 | 3 }> = ({ student, rank }) => {
  const cfg = {
    1: { grad: 'from-amber-400 to-yellow-500', ring: 'ring-amber-300', icon: <Crown size={20} />, label: '1st', order: 'sm:order-2', scale: 'sm:scale-110 sm:-translate-y-2', text: 'text-amber-900' },
    2: { grad: 'from-slate-300 to-slate-400', ring: 'ring-slate-300', icon: <Medal size={18} />, label: '2nd', order: 'sm:order-1', scale: '', text: 'text-slate-800' },
    3: { grad: 'from-orange-300 to-amber-600', ring: 'ring-orange-300', icon: <Award size={18} />, label: '3rd', order: 'sm:order-3', scale: '', text: 'text-orange-900' },
  }[rank];

  return (
    <div className={`relative flex flex-col items-center ${cfg.order} ${cfg.scale} transition-transform`}>
      {rank === 1 && (
        <div className="absolute -top-3 z-10 animate-bounce"><Sparkles className="text-amber-400" size={18} /></div>
      )}
      <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden ring-4 ${cfg.ring} shadow-lg bg-gradient-to-br ${cfg.grad} flex items-center justify-center`}>
        {student.photo_url ? (
          <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg sm:text-xl font-black text-white">{initials(student.name)}</span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-gray-700">
          {cfg.icon}
        </span>
      </div>
      <p className={`mt-2 text-xs sm:text-sm font-bold text-center leading-tight ${cfg.text} dark:text-gray-100 max-w-[7rem] truncate`}>{student.name}</p>
      <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${cfg.grad} px-2.5 py-0.5 text-[10px] font-black text-white shadow-sm`}>
        {cfg.label}{student.percentage != null ? ` · ${student.percentage}%` : ''}
      </span>
    </div>
  );
};

export const ClassRankingView: React.FC<Props> = ({ classId, academicYear, availableTerms }) => {
  const allTabs: ViewTerm[] = ['first_term', 'second_term', 'third_term', 'full'];
  const tabs = availableTerms && availableTerms.length ? availableTerms : allTabs;
  // Default the active tab to the LATEST released term. Prefer the last real
  // term over the "full" tab so a single-term release lands on that term.
  const preferredTerm = useMemo<ViewTerm>(() => {
    const realTerms = tabs.filter((t) => t !== 'full');
    return (realTerms[realTerms.length - 1] ?? tabs[tabs.length - 1] ?? 'full') as ViewTerm;
  }, [tabs]);
  const [term, setTerm] = useState<ViewTerm>(preferredTerm);

  // Keep the active tab valid & aligned with the released terms as they load or
  // change (e.g. a parent switching between children with different releases).
  useEffect(() => {
    if (!tabs.includes(term)) setTerm(preferredTerm);
  }, [tabs, term, preferredTerm]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['class-ranking', classId, academicYear, term],
    queryFn: () => reportCardService.getClassRanking({
      class_id: classId, academic_year: academicYear,
      ...(term === 'full' ? {} : { term }),
    }),
    enabled: !!classId && !!academicYear,
    staleTime: 30_000,
  });

  const ranking = (data as any)?.data ?? null;
  const students: ClassRankingStudent[] = ranking?.students ?? [];
  const ranked = useMemo(() => students.filter((s) => s.position != null), [students]);
  const unranked = useMemo(() => students.filter((s) => s.position == null), [students]);
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const leaders = ranked.filter((s) => s.is_top);

  return (
    <div className="space-y-5">
      {/* Term selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ranking for:</span>
        {allTabs.map((t) => {
          const avail = tabs.includes(t);
          return (
            <button
              key={t}
              onClick={() => avail && setTerm(t)}
              disabled={!avail}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                term === t ? 'bg-blue-600 text-white shadow-sm'
                : avail ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
              }`}
              title={avail ? undefined : 'Not released yet'}
            >
              {t === 'full' ? 'Full Year' : TERM_LABEL[t] || t}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading ranking…</div>
      ) : error ? (
        <EmptyState message="Couldn't load ranking" description="Please refresh and try again." />
      ) : ranking && !ranking.published ? (
        <EmptyState message="Not released yet" description="The ranking will appear once results for this term are released." />
      ) : ranked.length === 0 ? (
        <EmptyState message="No ranked results" description="No scored results have been recorded for this selection yet." />
      ) : (
        <>
          {/* Celebration banner for the class leader(s) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 px-5 py-4 text-white shadow-lg">
            <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '18px 18px' }} />
            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 ring-2 ring-white/40">
                <Trophy size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                  {ranking.class_name || 'Class'} · {term === 'full' ? 'Overall' : (TERM_LABEL[term] || term)}
                </p>
                <p className="text-base sm:text-lg font-black leading-tight truncate">
                  {leaders.length > 1
                    ? `${leaders.map((l) => l.name.split(' ')[0]).join(' & ')} tie for 1st! 🎉`
                    : `${leaders[0]?.name || '—'} is 1st in class! 🎉`}
                </p>
              </div>
            </div>
          </div>

          {/* Podium (top 3) */}
          {podium.length > 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-b from-blue-50/50 to-white dark:from-gray-800/40 dark:to-gray-800 p-5">
              <div className="flex items-end justify-center gap-4 sm:gap-8">
                {podium.map((s) => (
                  <PodiumCard key={s.student_id} student={s} rank={(s.position as 1 | 2 | 3)} />
                ))}
              </div>
            </div>
          )}

          {/* Full ranked list */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Users size={15} className="text-blue-500" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Full Ranking ({ranked.length})</h3>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {[...podium, ...rest].map((s) => (
                <li
                  key={s.student_id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${s.is_top ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}
                >
                  <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                    s.position === 1 ? 'bg-amber-100 text-amber-700'
                    : s.position === 2 ? 'bg-slate-100 text-slate-600'
                    : s.position === 3 ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
                  }`}>
                    {s.position != null ? ordinal(s.position).replace(/(st|nd|rd|th)/, '') : '—'}
                  </span>
                  <div className="h-8 w-8 flex-shrink-0 rounded-full overflow-hidden bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">{initials(s.name)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                      {s.name}
                      {s.is_top && <Crown size={13} className="text-amber-500 flex-shrink-0" />}
                    </p>
                    {s.admission_no && <p className="text-[11px] text-gray-400">{s.admission_no}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{s.percentage != null ? `${s.percentage}%` : '—'}</p>
                    <p className="text-[10px] text-gray-400">{ordinal(s.position || 0)}{s.class_size ? ` / ${s.class_size}` : ''}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Students without results yet */}
          {unranked.length > 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Not yet scored ({unranked.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {unranked.map((s) => (
                  <span key={s.student_id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClassRankingView;
