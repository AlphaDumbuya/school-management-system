/**
 * AcademicArchivePage — the school administrator's single window into ANY
 * academic year. Pick a year (the school's real sessions) and see a full
 * snapshot: headline counts, results (per class + school-wide), finance,
 * attendance, the classes that existed that year (enrolment, class teacher,
 * average, top student), result releases, promotions and examinations — plus a
 * per-student history across every year (search by name or admission number).
 * Deep-links into Report Cards for the same year. Printable.
 *
 * Read-only. Principal / super-admin only (route-guarded).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import schoolConfigService from '@services/schoolConfigService';
import {
  GraduationCap, Users, BookOpen, Wallet, Megaphone, TrendingUp, FileText, ArrowRight,
  CalendarCheck, Search, X, Loader2, Printer, Award, ChevronRight,
} from 'lucide-react';

const fmtLe = (n: number) => `Le ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number | null | undefined) => (n == null ? '—' : `${n}%`);

const TERM_LABEL: Record<string, string> = {
  first_term: 'First Term', second_term: 'Second Term', third_term: 'Third Term',
};
const MAX_PROMOTIONS = 100;
const MAX_EXAMS = 50;

export const AcademicArchivePage: React.FC = () => {
  const navigate = useNavigate();
  // Real years only; opens on the school's ACTIVE year.
  const [pickedYear, setYear] = useState('');
  const { activeYear } = useAcademicYears();
  const year = pickedYear || activeYear;
  const viewingPast = !!year && !!activeYear && year < activeYear;

  // Per-student history: search box → query (name or admission number).
  const [historyInput, setHistoryInput] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const lookUp = () => { const q = historyInput.trim(); if (q) setHistoryQuery(q); };
  const closeHistory = () => setHistoryQuery('');

  const { data: snapResp, isLoading, isError, refetch } = useQuery({
    queryKey: ['academic-archive', year],
    queryFn: () => schoolConfigService.getYearArchive(year),
    enabled: !!year,
    staleTime: 30_000,
  });
  const snap = (snapResp as any)?.data ?? null;

  const { data: historyResp, isLoading: historyLoading } = useQuery({
    queryKey: ['academic-archive-student', historyQuery],
    queryFn: () => schoolConfigService.getStudentHistory(historyQuery),
    enabled: !!historyQuery,
    staleTime: 30_000,
  });
  const history = (historyResp as any)?.data ?? null;

  // Escape closes the history dialog.
  useEffect(() => {
    if (!historyQuery) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeHistory(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [historyQuery]);

  const collectionRate = snap?.finance?.billed > 0 ? Math.round((snap.finance.collected / snap.finance.billed) * 1000) / 10 : null;

  return (
    <MainLayout>
      <PageShell
        title="Academic Archive"
        subtitle="Retrieve any academic year — classes, results, finance, attendance, promotions and more"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Academic Archive' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <YearFilter value={year} onChange={setYear} />
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!snap} className="gap-1.5">
              <Printer size={15} /> <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        }
      >
        {/* Which year, and whether it's history */}
        {year && (
          <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${
            viewingPast
              ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
          }`}>
            <span>
              {viewingPast
                ? <>Archived record for <strong>{year}</strong>.</>
                : <><strong>{year}</strong> is the current year — figures are still changing.</>}
            </span>
            {viewingPast && (
              <button type="button" onClick={() => setYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300 print:hidden">
                Back to {activeYear}
              </button>
            )}
          </div>
        )}

        {/* Per-student full history lookup (across ALL years) */}
        <div className="p-4 mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 print:hidden">
          <label htmlFor="archive-student-search" className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-1">
            Student history (every year)
          </label>
          <div className="flex gap-2 sm:max-w-lg">
            <input
              id="archive-student-search"
              type="text"
              value={historyInput}
              onChange={(e) => setHistoryInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') lookUp(); }}
              placeholder="Student name or admission number…"
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={lookUp} disabled={!historyInput.trim()} className="gap-1.5">
              <Search size={15} /> Look up
            </Button>
          </div>
        </div>

        {!year ? (
          <EmptyState message="Select an academic year" description="Choose a year above to view its complete record." />
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        ) : isError || !snap ? (
          <EmptyState message="Couldn't load this year" description="Please refresh and try again." action={{ label: 'Retry', onClick: () => { refetch(); } }} />
        ) : (
          <div className="space-y-6">
            {/* Print-only heading */}
            <h2 className="hidden print:block text-xl font-bold">Academic Archive — {year}</h2>

            {/* Headline counts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard icon={<BookOpen size={18} />} label="Classes" value={snap.counts.classes} tint="bg-blue-50 text-blue-600 dark:bg-blue-950/40" />
              <StatCard icon={<Users size={18} />} label="Students enrolled" value={snap.counts.students_enrolled} tint="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40" />
              <StatCard icon={<GraduationCap size={18} />} label="Subjects" value={snap.counts.subjects} tint="bg-purple-50 text-purple-600 dark:bg-purple-950/40" />
              <StatCard icon={<Award size={18} />} label="Average result" value={fmtPct(snap.results?.average)} tint="bg-amber-50 text-amber-600 dark:bg-amber-950/40" />
              <StatCard icon={<TrendingUp size={18} />} label="Promotions" value={snap.promotions.length} tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40" />
            </div>

            {/* Results */}
            <Section title="Results" icon={<Award size={16} />}>
              {snap.results ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <MiniStat label="School average" value={fmtPct(snap.results.average)} valueClass="text-emerald-600" />
                  <MiniStat label="Students with results" value={String(snap.results.students)} />
                  <MiniStat
                    label="Terms recorded"
                    value={snap.results.terms.length ? snap.results.terms.map((t: string) => TERM_LABEL[t] || t).join(', ') : '—'}
                    small
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No report-card results recorded for this year.</p>
              )}
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Finance */}
              <Section title="Finance" icon={<Wallet size={16} />}>
                {snap.finance && snap.finance.billed > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Billed" value={fmtLe(snap.finance.billed)} />
                    <MiniStat label="Collected" value={fmtLe(snap.finance.collected)} valueClass="text-emerald-600" />
                    <MiniStat label="Outstanding" value={fmtLe(snap.finance.outstanding)} valueClass="text-amber-600" />
                    <MiniStat label="Collection rate" value={fmtPct(collectionRate)} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No fees billed for this year.</p>
                )}
              </Section>

              {/* Attendance */}
              <Section title="Attendance" icon={<CalendarCheck size={16} />}>
                {snap.attendance ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <MiniStat label="Attendance rate" value={`${snap.attendance.rate}%`} valueClass="text-emerald-600" />
                    <MiniStat label="Present" value={String(snap.attendance.present)} />
                    <MiniStat label="Late" value={String(snap.attendance.late)} />
                    <MiniStat label="Excused" value={String(snap.attendance.excused)} />
                    <MiniStat label="Absent" value={String(snap.attendance.absent)} valueClass="text-amber-600" />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No attendance recorded for this year.</p>
                )}
              </Section>
            </div>

            {/* Classes */}
            <Section title={`Classes (${snap.classes.length})`} icon={<BookOpen size={16} />}>
              {snap.classes.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        <th className="py-2 pr-3 font-semibold">Class</th>
                        <th className="py-2 pr-3 font-semibold">Level</th>
                        <th className="py-2 pr-3 font-semibold">Class teacher</th>
                        <th className="py-2 pr-3 font-semibold text-right">Enrolled</th>
                        <th className="py-2 pr-3 font-semibold text-right">Average</th>
                        <th className="py-2 pr-3 font-semibold">Top student</th>
                        <th className="py-2 font-semibold text-right print:hidden">Report cards</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.classes.map((c: any) => (
                        <tr key={c.id} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">{c.name}{c.section ? ` ${c.section}` : ''}</td>
                          <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{c.level || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{c.class_teacher || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 text-right tabular-nums">{c.enrolled}</td>
                          <td className="py-2 pr-3 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{fmtPct(c.results?.average)}</td>
                          <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {c.results?.top_student ? <>{c.results.top_student} <span className="text-gray-400">({c.results.top_average}%)</span></> : '—'}
                          </td>
                          <td className="py-2 text-right print:hidden">
                            <button
                              onClick={() => navigate(`/academic/report-cards?year=${encodeURIComponent(year)}&class_id=${c.id}`)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
                            >
                              View <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No classes recorded for this year.</p>
              )}
            </Section>

            {/* Publications */}
            <Section title="Result releases" icon={<Megaphone size={16} />}>
              {snap.publications.length ? (
                <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                  {snap.publications.map((p: any) => (
                    <li key={p.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-800 dark:text-gray-200">
                        {p.class_name || 'Class'} · {p.term ? (TERM_LABEL[p.term] || p.term) : 'Full Year'}
                      </span>
                      <span className={p.is_published ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                        {p.is_published ? 'Released' : 'Not released'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No result releases recorded for this year.</p>
              )}
            </Section>

            {/* Promotions */}
            <Section title={`Promotions (${snap.promotions.length})`} icon={<TrendingUp size={16} />}>
              {snap.promotions.length ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                          <th className="py-2 pr-3 font-semibold">Student</th>
                          <th className="py-2 pr-3 font-semibold">From</th>
                          <th className="py-2 pr-3 font-semibold">To</th>
                          <th className="py-2 font-semibold">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snap.promotions.slice(0, MAX_PROMOTIONS).map((p: any) => (
                          <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800">
                            <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">{(p.student_name || '').trim() || p.student_reg_id || '—'}</td>
                            <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{p.from_class_name || '—'}</td>
                            <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{p.to_class_name || (p.outcome === 'graduated' ? 'Graduated' : '—')}</td>
                            <td className="py-2 text-gray-600 dark:text-gray-400 capitalize">{String(p.outcome || '').replace('_', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {snap.promotions.length > MAX_PROMOTIONS && (
                    <p className="mt-2 text-xs text-gray-500">Showing the first {MAX_PROMOTIONS} of {snap.promotions.length}. The full list is on the Promotions page.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No promotions recorded for this year.</p>
              )}
            </Section>

            {/* Examinations */}
            <Section title={`Examinations (${snap.examinations.length})`} icon={<FileText size={16} />}>
              {snap.examinations.length ? (
                <>
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                    {snap.examinations.slice(0, MAX_EXAMS).map((e: any) => (
                      <li key={e.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-800 dark:text-gray-200">{e.name || e.title || 'Examination'}</span>
                        <span className="text-xs text-gray-500">
                          {[e.term ? (TERM_LABEL[e.term] || e.term) : null, e.exam_date || e.start_date ? new Date(e.exam_date || e.start_date).toLocaleDateString('en-GB') : null].filter(Boolean).join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {snap.examinations.length > MAX_EXAMS && (
                    <p className="mt-2 text-xs text-gray-500">Showing the first {MAX_EXAMS} of {snap.examinations.length}.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No examinations scheduled for this year.</p>
              )}
            </Section>

            <div className="flex justify-end print:hidden">
              <Button variant="outline" onClick={() => navigate(`/academic/report-cards?year=${encodeURIComponent(year)}`)}>
                Open Report Cards for {year}
              </Button>
            </div>
          </div>
        )}

        {/* Per-student history dialog */}
        {historyQuery && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 print:hidden" onClick={closeHistory}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="archive-history-title"
              className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 sticky top-0 bg-white dark:bg-gray-900">
                <h3 id="archive-history-title" className="text-lg font-bold text-gray-900 dark:text-white">
                  {history?.student?.name || 'Student history'}
                  {history?.student?.admission_no && <span className="text-sm font-normal text-gray-500"> · {history.student.admission_no}</span>}
                </h3>
                <button onClick={closeHistory} aria-label="Close" className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-6">
                {historyLoading ? (
                  <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
                ) : history?.matches?.length ? (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{history.matches.length} students match “{historyQuery}”. Pick one:</p>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800">
                      {history.matches.map((m: any) => (
                        <li key={m.id}>
                          <button
                            onClick={() => setHistoryQuery(m.id)}
                            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <span>
                              <span className="font-semibold text-gray-900 dark:text-white">{m.name}</span>
                              <span className="text-gray-500"> · {m.admission_no || '—'}{m.class_name ? ` · ${m.class_name}` : ''}</span>
                            </span>
                            <ChevronRight size={15} className="text-gray-400" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : !history?.student ? (
                  <p className="text-sm text-gray-500">No student found for “{historyQuery}”.</p>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Class placements by year</h4>
                      {history.enrollments.length ? (
                        <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                          {history.enrollments.map((e: any, i: number) => (
                            <li key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-800 dark:text-gray-200">{e.class_name || '—'}{e.level ? ` · ${e.level}` : ''}</span>
                              <span className="text-gray-500">{e.academic_year || '—'} · <span className="capitalize">{e.status || ''}</span></span>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-gray-500">No enrolment history.</p>}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Term results</h4>
                      {history.terms?.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-800">
                                <th className="py-2 pr-3 font-semibold">Year</th>
                                <th className="py-2 pr-3 font-semibold">Term</th>
                                <th className="py-2 pr-3 font-semibold">Class</th>
                                <th className="py-2 pr-3 font-semibold text-right">Overall</th>
                                <th className="py-2 font-semibold text-right">Position</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.terms.map((t: any, i: number) => (
                                <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                                  <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{t.academic_year}</td>
                                  <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{TERM_LABEL[t.term] || t.term}</td>
                                  <td className="py-1.5 pr-3 text-gray-800 dark:text-gray-200">{t.class_name || '—'}</td>
                                  <td className="py-1.5 pr-3 text-right font-semibold text-gray-900 dark:text-white">{fmtPct(t.percentage)}</td>
                                  <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{t.position != null ? `${t.position}${t.class_size ? ` of ${t.class_size}` : ''}` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="text-sm text-gray-500">No term results recorded.</p>}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Subject results</h4>
                      {history.results.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-800">
                                <th className="py-2 pr-3 font-semibold">Year</th>
                                <th className="py-2 pr-3 font-semibold">Term</th>
                                <th className="py-2 pr-3 font-semibold">Subject</th>
                                <th className="py-2 font-semibold text-right">Mean</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.results.slice(0, 200).map((r: any, i: number) => (
                                <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                                  <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{r.academic_year}</td>
                                  <td className="py-1.5 pr-3 text-gray-600 dark:text-gray-400">{TERM_LABEL[r.term] || r.term}</td>
                                  <td className="py-1.5 pr-3 text-gray-800 dark:text-gray-200">{r.subject_name || '—'}</td>
                                  <td className="py-1.5 text-right font-semibold text-gray-900 dark:text-white">{r.mean ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="text-sm text-gray-500">No subject results recorded.</p>}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number | string; tint: string }> = ({ icon, label, value, tint }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tint}`}>{icon}</div>
    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{value}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
  </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 break-inside-avoid">
    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
      <span className="text-gray-400">{icon}</span> {title}
    </h3>
    {children}
  </section>
);

const MiniStat: React.FC<{ label: string; value: string; valueClass?: string; small?: boolean }> = ({ label, value, valueClass, small }) => (
  <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className={`${small ? 'text-sm' : 'text-lg'} font-bold ${valueClass || 'text-gray-900 dark:text-white'}`}>{value}</p>
  </div>
);

export default AcademicArchivePage;
