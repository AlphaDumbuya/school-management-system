/**
 * AcademicArchivePage — the school administrator's single window into ANY past
 * academic year. Pick a year (sourced from the school's real academic sessions)
 * and see a full snapshot: headline counts, finance summary, the classes that
 * existed that year (with enrolment), report-card publications, promotion
 * history, and examinations. Deep-links into the Report Cards page for the same
 * year so results can be viewed/printed.
 *
 * Read-only. Principal / super-admin only (route-guarded).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { Button } from '@components/ui/button';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import schoolConfigService from '@services/schoolConfigService';
import {
  Archive, GraduationCap, Users, BookOpen, Wallet, Megaphone, TrendingUp, FileText, ArrowRight,
  CalendarCheck, Search, X, Loader2,
} from 'lucide-react';

const fmtLe = (n: number) => `Le ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TERM_LABEL: Record<string, string> = {
  first_term: 'First Term', second_term: 'Second Term', third_term: 'Third Term',
};

export const AcademicArchivePage: React.FC = () => {
  const navigate = useNavigate();
  const [year, setYear] = useState('');
  // Per-student history drill-down.
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyId, setHistoryId] = useState('');

  // Real years from the school's academic sessions.
  const { data: sessionsResp } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => schoolConfigService.listAcademicSessions(),
    staleTime: 60_000,
  });
  const sessions: Array<{ name: string; is_active: boolean }> = ((sessionsResp as any)?.data ?? []) as any;

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => { if (/^\d{4}\/\d{4}$/.test(String(s.name))) set.add(String(s.name)); });
    const cy = new Date().getFullYear();
    for (let y = cy + 1; y >= cy - 5; y--) set.add(`${y}/${y + 1}`);
    return Array.from(set).sort((a, b) => b.localeCompare(a)).map((v) => ({ value: v, label: v }));
  }, [sessions]);

  // Default to the active session's year once loaded.
  useEffect(() => {
    if (year) return;
    const active = sessions.find((s) => s.is_active)?.name;
    if (active && /^\d{4}\/\d{4}$/.test(active)) setYear(active);
    else if (yearOptions.length) setYear(yearOptions[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length, yearOptions.length]);

  const { data: snapResp, isLoading } = useQuery({
    queryKey: ['academic-archive', year],
    queryFn: () => schoolConfigService.getYearArchive(year),
    enabled: !!year,
    staleTime: 30_000,
  });
  const snap = (snapResp as any)?.data ?? null;

  const { data: historyResp, isLoading: historyLoading } = useQuery({
    queryKey: ['academic-archive-student', historyId],
    queryFn: () => schoolConfigService.getStudentHistory(historyId),
    enabled: !!historyId,
    staleTime: 30_000,
  });
  const history = (historyResp as any)?.data ?? null;

  return (
    <MainLayout>
      <PageShell
        title="Academic Archive"
        subtitle="Retrieve any past academic year — classes, results, finance, promotions and more"
        breadcrumbs={[{ label: 'Reports' }, { label: 'Academic Archive' }]}
      >
        {/* Year selector */}
        <div className="p-4 mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="sm:max-w-xs">
            <SearchableSelect label="Academic Year" options={yearOptions} value={year} onChange={setYear} placeholder="Select a year..." />
          </div>
          {snap?.is_active && (
            <p className="text-xs text-emerald-600 font-semibold mt-2">This is the current active year.</p>
          )}

          {/* Per-student full history lookup (across ALL years) */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="text-xs font-semibold text-gray-500 block mb-1">Student full history (any year)</label>
            <div className="flex gap-2 sm:max-w-md">
              <input
                type="text"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && historyQuery.trim()) setHistoryId(historyQuery.trim()); }}
                placeholder="Enter admission number…"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={() => historyQuery.trim() && setHistoryId(historyQuery.trim())} className="gap-1.5">
                <Search size={15} /> Look up
              </Button>
            </div>
          </div>
        </div>

        {!year ? (
          <EmptyState icon={<Archive size={28} />} title="Select an academic year" description="Choose a year above to view its complete record." />
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        ) : !snap ? (
          <EmptyState icon={<Archive size={28} />} title="No data" description="No snapshot could be loaded for this year." />
        ) : (
          <div className="space-y-6">
            {/* Headline counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<BookOpen size={18} />} label="Classes" value={snap.counts.classes} tint="bg-blue-50 text-blue-600" />
              <StatCard icon={<Users size={18} />} label="Students Enrolled" value={snap.counts.students_enrolled} tint="bg-indigo-50 text-indigo-600" />
              <StatCard icon={<GraduationCap size={18} />} label="Subjects" value={snap.counts.subjects} tint="bg-purple-50 text-purple-600" />
              <StatCard icon={<TrendingUp size={18} />} label="Promotions" value={snap.promotions.length} tint="bg-emerald-50 text-emerald-600" />
            </div>

            {/* Finance */}
            <Section title="Finance" icon={<Wallet size={16} />}>
              {snap.finance ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <MiniStat label="Billed" value={fmtLe(snap.finance.billed)} />
                  <MiniStat label="Collected" value={fmtLe(snap.finance.collected)} valueClass="text-emerald-600" />
                  <MiniStat label="Outstanding" value={fmtLe(snap.finance.outstanding)} valueClass="text-amber-600" />
                </div>
              ) : (
                <p className="text-sm text-gray-500">No finance data recorded for this year.</p>
              )}
            </Section>

            {/* Attendance */}
            <Section title="Attendance" icon={<CalendarCheck size={16} />}>
              {snap.attendance ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <MiniStat label="Attendance rate" value={`${snap.attendance.rate}%`} valueClass="text-emerald-600" />
                  <MiniStat label="Present" value={String(snap.attendance.present)} />
                  <MiniStat label="Late" value={String(snap.attendance.late)} />
                  <MiniStat label="Excused" value={String(snap.attendance.excused)} />
                  <MiniStat label="Absent" value={String(snap.attendance.absent)} valueClass="text-amber-600" />
                </div>
              ) : (
                <p className="text-sm text-gray-500">No attendance recorded for this year.</p>
              )}
            </Section>

            {/* Classes */}
            <Section title={`Classes (${snap.classes.length})`} icon={<BookOpen size={16} />}>
              {snap.classes.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="py-2 pr-3 font-semibold">Class</th>
                        <th className="py-2 pr-3 font-semibold">Level</th>
                        <th className="py-2 pr-3 font-semibold">Enrolled</th>
                        <th className="py-2 font-semibold text-right">Results</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.classes.map((c: any) => (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-2 pr-3 font-medium text-gray-900">{c.name}{c.section ? ` ${c.section}` : ''}</td>
                          <td className="py-2 pr-3 text-gray-600">{c.level || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600">{c.enrolled}</td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => navigate(`/academic/report-cards?year=${encodeURIComponent(year)}&class_id=${c.id}`)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                              View report cards <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No classes recorded for this year.</p>
              )}
            </Section>

            {/* Publications */}
            <Section title="Result Releases" icon={<Megaphone size={16} />}>
              {snap.publications.length ? (
                <ul className="divide-y divide-gray-50">
                  {snap.publications.map((p: any) => (
                    <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                      <span className="text-gray-800">
                        {p.class_name || 'Class'} · {p.term ? (TERM_LABEL[p.term] || p.term) : 'Full Year'}
                      </span>
                      <span className={p.is_published ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                        {p.is_published ? 'Released' : 'Not released'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No result releases recorded for this year.</p>
              )}
            </Section>

            {/* Promotions */}
            <Section title={`Promotions (${snap.promotions.length})`} icon={<TrendingUp size={16} />}>
              {snap.promotions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="py-2 pr-3 font-semibold">Student</th>
                        <th className="py-2 pr-3 font-semibold">From</th>
                        <th className="py-2 pr-3 font-semibold">To</th>
                        <th className="py-2 font-semibold">Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.promotions.slice(0, 100).map((p: any) => (
                        <tr key={p.id} className="border-b border-gray-50">
                          <td className="py-2 pr-3 font-medium text-gray-900">{(p.student_name || '').trim() || p.student_reg_id || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600">{p.from_class_name || '—'}</td>
                          <td className="py-2 pr-3 text-gray-600">{p.to_class_name || (p.outcome === 'graduated' ? 'Graduated' : '—')}</td>
                          <td className="py-2 text-gray-600 capitalize">{String(p.outcome || '').replace('_', ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No promotions recorded for this year.</p>
              )}
            </Section>

            {/* Examinations */}
            {snap.examinations.length > 0 && (
              <Section title={`Examinations (${snap.examinations.length})`} icon={<FileText size={16} />}>
                <ul className="divide-y divide-gray-50">
                  {snap.examinations.slice(0, 50).map((e: any) => (
                    <li key={e.id} className="py-2 text-sm text-gray-800">{e.name || e.title || 'Examination'}</li>
                  ))}
                </ul>
              </Section>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => navigate(`/academic/report-cards?year=${encodeURIComponent(year)}`)}>
                Open Report Cards for {year}
              </Button>
            </div>
          </div>
        )}

        {/* Per-student history modal */}
        {historyId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => { setHistoryId(''); }}>
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {history?.student?.name || 'Student History'}
                  {history?.student?.admission_no && <span className="text-sm font-normal text-gray-500"> · {history.student.admission_no}</span>}
                </h3>
                <button onClick={() => setHistoryId('')} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-5">
                {historyLoading ? (
                  <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
                ) : !history?.student ? (
                  <p className="text-sm text-gray-500">No student found for “{historyId}”.</p>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">Class placements by year</h4>
                      {history.enrollments.length ? (
                        <ul className="divide-y divide-gray-50">
                          {history.enrollments.map((e: any, i: number) => (
                            <li key={i} className="py-2 flex items-center justify-between text-sm">
                              <span className="text-gray-800">{e.class_name || '—'}{e.level ? ` · ${e.level}` : ''}</span>
                              <span className="text-gray-500">{e.academic_year || '—'} · <span className="capitalize">{e.status || ''}</span></span>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-sm text-gray-500">No enrolment history.</p>}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">Results by year</h4>
                      {history.results.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 border-b border-gray-100">
                                <th className="py-2 pr-3 font-semibold">Year</th>
                                <th className="py-2 pr-3 font-semibold">Term</th>
                                <th className="py-2 pr-3 font-semibold">Subject</th>
                                <th className="py-2 font-semibold text-right">Mean</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.results.slice(0, 200).map((r: any, i: number) => (
                                <tr key={i} className="border-b border-gray-50">
                                  <td className="py-1.5 pr-3 text-gray-600">{r.academic_year}</td>
                                  <td className="py-1.5 pr-3 text-gray-600">{TERM_LABEL[r.term] || r.term}</td>
                                  <td className="py-1.5 pr-3 text-gray-800">{r.subject_name || '—'}</td>
                                  <td className="py-1.5 text-right font-semibold text-gray-900">{r.mean ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="text-sm text-gray-500">No results recorded.</p>}
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
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tint}`}>{icon}</div>
    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
      <span className="text-gray-400">{icon}</span> {title}
    </h3>
    {children}
  </div>
);

const MiniStat: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
  <div className="rounded-lg border border-gray-100 p-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`text-lg font-bold ${valueClass || 'text-gray-900'}`}>{value}</p>
  </div>
);

export default AcademicArchivePage;
