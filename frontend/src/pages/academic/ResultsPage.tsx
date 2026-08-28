/**
 * ResultsPage — /academic/results
 * Sierra Leone booklet grade-entry hub.
 *  - Cognitive tab: booklet-style Test 1 / Test 2 entry per class+subject+term
 *  - Ratings tab: per-student affective + psychomotor + conduct entry
 * Report cards are generated on the Report Cards page.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Star, BookOpen } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { Button } from '@components/ui/button';
import { classesService } from '@services/classesService';
import { ScoreEntryGrid } from './components/ScoreEntryGrid';
import { DomainRatingsModal } from './components/DomainRatingsModal';
import { SL_TERMS, SLTerm, SL_GRADING_METHOD, CONDUCT_CODES } from '@services/reportCardService';

export const ResultsPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [academicYear, setAcademicYear] = useState(`${currentYear}/${currentYear + 1}`);
  const [tab, setTab] = useState<'cognitive' | 'ratings'>('cognitive');

  // Ratings tab state
  const [ratingsClassId, setRatingsClassId] = useState('');
  const [ratingsTerm, setRatingsTerm] = useState<SLTerm>('first_term');
  const [ratingsStudentId, setRatingsStudentId] = useState('');
  const [ratingsModalOpen, setRatingsModalOpen] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ['classes-dropdown'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  const classOptions = useMemo(() => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })), [classes]);

  const { data: studentsData } = useQuery({
    queryKey: ['class-students-ratings', ratingsClassId],
    queryFn: () => classesService.getClassStudents(ratingsClassId),
    enabled: !!ratingsClassId,
    staleTime: 30_000,
  });
  const students = (studentsData as any)?.data?.students ?? (studentsData as any)?.students ?? [];
  const studentOptions = useMemo(
    () => students.map((s: any) => ({ value: String(s.id), label: `${s.first_name} ${s.last_name}`, sublabel: s.roll_number || s.student_id })),
    [students],
  );
  const selectedStudent = students.find((s: any) => String(s.id) === String(ratingsStudentId));

  const yearOptions = useMemo(() => {
    const arr = [];
    for (let y = currentYear + 1; y >= currentYear - 3; y--) {
      arr.push({ value: `${y}/${y + 1}`, label: `${y}/${y + 1}` });
    }
    return arr;
  }, [currentYear]);

  return (
    <MainLayout>
      <PageShell
        title="Results & Grade Entry"
        subtitle="Sierra Leone terminal booklet — Test 1 + Test 2 → Mean, per subject, per term"
        breadcrumbs={[{ label: 'Results & Grades' }]}
        actions={
          <div className="w-44">
            <SearchableSelect options={yearOptions} value={academicYear} onChange={setAcademicYear} placeholder="Academic year" />
          </div>
        }
      >
        {/* Grading method reference */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <div>
            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Method of Grading (Cognitive — Below 50% is a Fail, shown in RED)</p>
            <div className="flex flex-wrap gap-2">
              {SL_GRADING_METHOD.map((g) => (
                <span key={g.letter} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  g.isFail
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                }`}>
                  {g.letter}: {g.min}–{g.max} ({g.remark})
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Conduct Legend</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              {CONDUCT_CODES.map((c) => (
                <span key={c.code} className={`px-2 py-0.5 rounded font-bold border ${c.isAlert ? 'bg-red-100 text-red-800 border-red-300' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                  {c.code} = {c.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setTab('cognitive')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === 'cognitive'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <ClipboardList size={15} className="inline mr-1.5" /> Cognitive Scores
          </button>
          <button
            onClick={() => setTab('ratings')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === 'ratings'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Star size={15} className="inline mr-1.5" /> Affective & Psychomotor
          </button>
        </div>

        {/* Cognitive tab */}
        {tab === 'cognitive' && (
          <RoleGuard roles={['principal', 'super_admin', 'teacher']} fallback={<p className="text-sm text-gray-500">You do not have permission to enter scores.</p>}>
            <ScoreEntryGrid academicYear={academicYear} />
          </RoleGuard>
        )}

        {/* Ratings tab */}
        {tab === 'ratings' && (
          <RoleGuard roles={['principal', 'super_admin', 'teacher']} fallback={<p className="text-sm text-gray-500">You do not have permission to enter ratings.</p>}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <SearchableSelect label="Class" options={classOptions} value={ratingsClassId} onChange={(v) => { setRatingsClassId(v); setRatingsStudentId(''); }} placeholder="Select class..." />
                <SearchableSelect label="Student" options={studentOptions} value={ratingsStudentId} onChange={setRatingsStudentId} placeholder="Select student..." />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
                  <select value={ratingsTerm} onChange={(e) => setRatingsTerm(e.target.value as SLTerm)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                    {SL_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {ratingsStudentId ? (
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : ''}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enter 12 affective + 12 psychomotor ratings, attendance & conduct for {ratingsTerm.replace('_', ' ')}.</p>
                  </div>
                  <Button variant="default" size="sm" onClick={() => setRatingsModalOpen(true)}>
                    <Star size={15} className="mr-1.5" /> Enter Ratings
                  </Button>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                  <BookOpen size={28} className="mx-auto mb-2 text-gray-400" />
                  Select a class and student to enter affective / psychomotor ratings.
                </div>
              )}
            </div>
          </RoleGuard>
        )}
      </PageShell>

      {selectedStudent && (
        <DomainRatingsModal
          isOpen={ratingsModalOpen}
          onClose={() => setRatingsModalOpen(false)}
          onSuccess={() => {}}
          studentId={ratingsStudentId}
          studentName={`${selectedStudent.first_name} ${selectedStudent.last_name}`}
          classId={ratingsClassId}
          academicYear={academicYear}
          term={ratingsTerm}
        />
      )}
    </MainLayout>
  );
};

export default ResultsPage;
