/**
 * StudentHistoryDialog — one student's complete record across every academic
 * year, opened from the Academic Archive.
 *
 * - Several name matches → a pick list (with admission no. and class).
 * - Profile header: photo, name, admission no., status, current class.
 * - Year tabs (newest first). For the chosen year: class + status, KPIs
 *   (average, best position, attendance, fees outstanding), term results,
 *   a subject × term grid with the yearly mean, attendance and fees, and a
 *   link straight to that year's report card.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ChevronRight, ArrowRight, UserCircle2, SearchX, CalendarCheck, Wallet, Award, Trophy } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import schoolConfigService, { StudentHistory } from '@services/schoolConfigService';

const TERMS = ['first_term', 'second_term', 'third_term'] as const;
const TERM_LABEL: Record<string, string> = { first_term: 'Term 1', second_term: 'Term 2', third_term: 'Term 3' };
const TERM_LONG: Record<string, string> = { first_term: 'First Term', second_term: 'Second Term', third_term: 'Third Term' };
const fmtLe = (n: number) => `Le ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const round1 = (n: number) => Math.round(n * 10) / 10;

const STATUS_PILL: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  enrolled: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  promoted: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  graduated: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  repeated: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};
const pill = (s?: string | null) => (s ? (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_PILL[s] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>{s}</span>
) : null);

export interface StudentHistoryDialogProps {
  /** Name, admission number or student id. Empty = closed. */
  query: string;
  onClose: () => void;
}

export const StudentHistoryDialog: React.FC<StudentHistoryDialogProps> = ({ query, onClose }) => {
  const navigate = useNavigate();
  // Picking a match re-queries by id.
  const [lookup, setLookup] = useState(query);
  useEffect(() => { setLookup(query); }, [query]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['academic-archive-student', lookup],
    queryFn: () => schoolConfigService.getStudentHistory(lookup),
    enabled: !!lookup,
    staleTime: 30_000,
  });
  const h: StudentHistory | null = (data as any)?.data ?? null;

  const years = h?.years ?? [];
  const [year, setYear] = useState('');
  useEffect(() => { setYear(years[0]?.academic_year ?? ''); }, [h?.student?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const yearData = useMemo(() => {
    if (!h?.student || !year) return null;
    const placement = h.enrollments.find((e) => e.academic_year === year) ?? null;
    const terms = h.terms.filter((t) => t.academic_year === year);
    const pcts = terms.map((t) => t.percentage).filter((p): p is number => p != null);
    const positions = terms.filter((t) => t.position != null);
    const best = positions.length ? positions.reduce((a, b) => ((a.position as number) <= (b.position as number) ? a : b)) : null;
    // Subject × term grid.
    const subjects = new Map<string, Record<string, number | null>>();
    for (const r of h.results.filter((x) => x.academic_year === year)) {
      const name = r.subject_name || 'Subject';
      if (!subjects.has(name)) subjects.set(name, {});
      subjects.get(name)![r.term] = r.mean;
    }
    const grid = [...subjects.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, byTerm]) => {
      const vals = TERMS.map((t) => byTerm[t]).filter((v): v is number => v != null);
      return { name, byTerm, yearly: vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
    });
    const termsUsed = TERMS.filter((t) => grid.some((g) => g.byTerm[t] != null));
    return {
      placement,
      terms,
      average: pcts.length ? round1(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
      best,
      grid,
      termsUsed: termsUsed.length ? termsUsed : [...TERMS],
      info: years.find((y) => y.academic_year === year) ?? null,
    };
  }, [h, year, years]);

  const openReportCard = () => {
    const p = yearData?.placement;
    if (!p?.class_id || !h?.student) return;
    navigate(`/academic/report-cards?year=${encodeURIComponent(year)}&class_id=${p.class_id}&student_id=${h.student.id}`);
  };

  const title = h?.matches?.length ? 'Choose a student' : h?.student ? 'Student history' : 'Student history';

  return (
    <Modal isOpen={!!query} onClose={onClose} title={title} size="xl">
      {isLoading ? (
        <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-sm">Looking up “{lookup}”…</span>
        </div>
      ) : isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Couldn't load this student's history.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : h?.matches?.length ? (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {h.matches.length} students match “{query}”. Pick the right one:
          </p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {h.matches.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => setLookup(m.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50/60 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-bold">
                    {m.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{m.name}</span>
                    <span className="block text-xs text-gray-500">{m.admission_no || 'No admission no.'}{m.class_name ? ` · ${m.class_name}` : ''}</span>
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : !h?.student ? (
        <div className="py-12 flex flex-col items-center text-center gap-2">
          <SearchX size={36} className="text-gray-300" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No student found for “{query}”</p>
          <p className="text-xs text-gray-500">Try part of the name, or the full admission number.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Profile header */}
          <div className="flex items-center gap-4">
            {h.student.photo_url ? (
              <img src={h.student.photo_url} alt="" className="w-16 h-16 rounded-2xl object-cover ring-1 ring-gray-200 dark:ring-gray-700" />
            ) : (
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center">
                <UserCircle2 size={32} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{h.student.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {h.student.admission_no || 'No admission no.'}
                {h.student.current_class ? <> · Now in <strong className="text-gray-700 dark:text-gray-200">{h.student.current_class}</strong></> : null}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                {pill(h.student.status)}
                {h.student.gender && <span className="capitalize">{h.student.gender}</span>}
                {h.student.date_of_birth && <span>Born {fmtDate(h.student.date_of_birth)}</span>}
                {h.student.enrollment_date && <span>Joined {fmtDate(h.student.enrollment_date)}</span>}
              </div>
            </div>
          </div>

          {years.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No class placements, results, attendance or fees recorded for this student yet.</p>
          ) : (
            <>
              {/* Year tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Academic year">
                {years.map((y) => (
                  <button
                    key={y.academic_year}
                    role="tab"
                    aria-selected={year === y.academic_year}
                    onClick={() => setYear(y.academic_year)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      year === y.academic_year
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {y.academic_year}
                  </button>
                ))}
              </div>

              {yearData && (
                <div className="space-y-5">
                  {/* Placement + report card link */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
                    <div className="text-sm">
                      <span className="text-gray-500">Class: </span>
                      <strong className="text-gray-900 dark:text-white">{yearData.placement?.class_name || 'Not placed'}</strong>
                      {yearData.placement?.level ? <span className="text-gray-500"> · {yearData.placement.level}</span> : null}
                      <span className="ml-2">{pill(yearData.placement?.status)}</span>
                    </div>
                    {yearData.placement?.class_id && (
                      <Button size="sm" variant="outline" onClick={openReportCard} className="gap-1.5">
                        Open report card <ArrowRight size={14} />
                      </Button>
                    )}
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Kpi icon={<Award size={16} />} label="Average" value={yearData.average != null ? `${yearData.average}%` : '—'} />
                    <Kpi
                      icon={<Trophy size={16} />}
                      label="Best position"
                      value={yearData.best ? `${yearData.best.position}${yearData.best.class_size ? ` / ${yearData.best.class_size}` : ''}` : '—'}
                      sub={yearData.best ? TERM_LONG[yearData.best.term] : undefined}
                    />
                    <Kpi icon={<CalendarCheck size={16} />} label="Attendance" value={yearData.info?.attendance.rate != null ? `${yearData.info.attendance.rate}%` : '—'} />
                    <Kpi
                      icon={<Wallet size={16} />}
                      label="Fees outstanding"
                      value={yearData.info && yearData.info.fees.billed > 0 ? fmtLe(yearData.info.fees.outstanding) : '—'}
                      tone={yearData.info && yearData.info.fees.outstanding > 0 ? 'text-rose-600' : undefined}
                    />
                  </div>

                  {/* Term results */}
                  <Block title="Term results">
                    {yearData.terms.length ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {TERMS.map((t) => {
                          const row = yearData.terms.find((x) => x.term === t);
                          return (
                            <div key={t} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                              <p className="text-xs font-semibold text-gray-500">{TERM_LONG[t]}</p>
                              {row ? (
                                <>
                                  <p className="text-xl font-black text-gray-900 dark:text-white">{row.percentage != null ? `${row.percentage}%` : '—'}</p>
                                  <p className="text-xs text-gray-500">
                                    {row.position != null ? <>Position <strong className="text-gray-700 dark:text-gray-200">{row.position}</strong>{row.class_size ? ` of ${row.class_size}` : ''}</> : 'No position'}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-gray-400 mt-1">No results</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty>No term results recorded for {year}.</Empty>
                    )}
                  </Block>

                  {/* Subject grid */}
                  <Block title="Subjects">
                    {yearData.grid.length ? (
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-800/60">
                            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                              <th className="px-3 py-2 font-semibold">Subject</th>
                              {yearData.termsUsed.map((t) => <th key={t} className="px-3 py-2 font-semibold text-right">{TERM_LABEL[t]}</th>)}
                              <th className="px-3 py-2 font-semibold text-right">Year</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {yearData.grid.map((g) => (
                              <tr key={g.name}>
                                <td className="px-3 py-2 text-gray-900 dark:text-white">{g.name}</td>
                                {yearData.termsUsed.map((t) => (
                                  <td key={t} className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{g.byTerm[t] ?? '—'}</td>
                                ))}
                                <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900 dark:text-white">{g.yearly ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty>No subject scores recorded for {year}.</Empty>
                    )}
                  </Block>

                  {/* Attendance + fees */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Block title="Attendance">
                      {yearData.info && (yearData.info.attendance.present + yearData.info.attendance.late + yearData.info.attendance.absent + yearData.info.attendance.excused) > 0 ? (
                        <dl className="grid grid-cols-4 gap-2 text-center">
                          {([['Present', yearData.info.attendance.present, 'text-emerald-600'], ['Late', yearData.info.attendance.late, 'text-amber-600'], ['Excused', yearData.info.attendance.excused, 'text-blue-600'], ['Absent', yearData.info.attendance.absent, 'text-rose-600']] as const).map(([l, v, c]) => (
                            <div key={l} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 py-2">
                              <dd className={`text-lg font-black ${c}`}>{v}</dd>
                              <dt className="text-[11px] text-gray-500">{l}</dt>
                            </div>
                          ))}
                        </dl>
                      ) : <Empty>No attendance marked for {year}.</Empty>}
                    </Block>
                    <Block title="Fees">
                      {yearData.info && yearData.info.fees.billed > 0 ? (
                        <dl className="space-y-1.5 text-sm">
                          <Row label="Billed" value={fmtLe(yearData.info.fees.billed)} />
                          <Row label="Paid" value={fmtLe(yearData.info.fees.paid)} tone="text-emerald-600" />
                          <Row label="Outstanding" value={fmtLe(yearData.info.fees.outstanding)} tone={yearData.info.fees.outstanding > 0 ? 'text-rose-600' : 'text-gray-500'} />
                        </dl>
                      ) : <Empty>No fees billed for {year}.</Empty>}
                    </Block>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
};

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }> = ({ icon, label, value, sub, tone }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
    <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500"><span className="text-gray-400">{icon}</span>{label}</p>
    <p className={`mt-1 text-lg font-black ${tone || 'text-gray-900 dark:text-white'}`}>{value}</p>
    {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
  </div>
);

const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{title}</h4>
    {children}
  </section>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-3 py-4 text-center">{children}</p>
);

const Row: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div className="flex items-center justify-between">
    <dt className="text-gray-500">{label}</dt>
    <dd className={`font-semibold ${tone || 'text-gray-900 dark:text-white'}`}>{value}</dd>
  </div>
);

export default StudentHistoryDialog;
