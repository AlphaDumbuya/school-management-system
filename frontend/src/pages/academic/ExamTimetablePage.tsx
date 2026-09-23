/**
 * ExamTimetablePage — /academic/exam-timetable
 * Exam timetable grid builder, styled like the normal weekly timetable.
 *  - Select Class + Term + Academic Year
 *  - Grid: rows = exam dates, columns = sessions (Morning / Afternoon)
 *  - Click a cell to schedule/edit a subject exam (ExamSlotModal)
 *  - Add exam-day rows on the fly
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, BookOpen, FileText, Plus, Trash2, ChevronDown, CalendarPlus } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { classesService, ClassRecord } from '@services/classesService';
import {
  examinationsService, ExaminationRecord, ExamTerm,
  EXAM_TERMS, EXAM_SESSIONS, EXAM_TYPES, buildExamGrid,
} from '@services/examinationsService';
import { ExamSlotModal } from './components/ExamSlotModal';
import { AddExamDayModal } from './components/AddExamDayModal';
import { useAuth } from '@hooks/useAuth';
import { studentDashboardService } from '@services/studentDashboardService';
import { parentDashboardService } from '@services/parentDashboardService';

const TYPE_LABELS: Record<string, string> = Object.fromEntries(EXAM_TYPES.map((t) => [t.value, t.label]));

function formatDateLabel(dateStr: string): { weekday: string; date: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return { weekday: '', date: dateStr };
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  };
}

export const ExamTimetablePage: React.FC = () => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent' || user?.role === 'guardian';
  const isViewerOnly = isStudent || isParent;

  const [selectedClassId, setSelectedClassId] = useState('');
  const [term, setTerm] = useState<ExamTerm>('first_term');
  const [academicYear, setAcademicYear] = useState(`${currentYear}/${currentYear + 1}`);

  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExaminationRecord | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillSession, setPrefillSession] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ExaminationRecord | null>(null);
  const [extraDates, setExtraDates] = useState<string[]>([]); // manually-added empty date rows
  const [addDayOpen, setAddDayOpen] = useState(false);

  const yearOptions = useMemo(() => {
    const arr = [];
    for (let y = currentYear + 1; y >= currentYear - 2; y--) arr.push(`${y}/${y + 1}`);
    return arr;
  }, [currentYear]);

  // Classes (staff only — students/parents auto-resolve their own class).
  const { data: classesData } = useQuery({
    queryKey: ['classes-selector'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    enabled: !isViewerOnly,
    staleTime: 60_000,
  });
  const classes: ClassRecord[] = (classesData as any)?.data ?? [];
  const selectedClass = classes.find((c) => String(c.id) === selectedClassId);

  // Student: resolve own class. Parent: resolve a child's class.
  const { data: studentDash } = useQuery({
    queryKey: ['exam-student-self'],
    queryFn: () => studentDashboardService.getDashboard(),
    enabled: isStudent,
    staleTime: 60_000,
  });
  const { data: parentDash } = useQuery({
    queryKey: ['exam-parent-children'],
    queryFn: () => parentDashboardService.getDashboard(),
    enabled: isParent,
    staleTime: 60_000,
  });
  const parentChildren = ((parentDash as any)?.data ?? (parentDash as any))?.children ?? [];
  const [selectedChildId, setSelectedChildId] = useState('');
  const activeChildId = selectedChildId || parentChildren[0]?.id || '';

  // Auto-select the class.
  useEffect(() => {
    if (isStudent) {
      const profile = ((studentDash as any)?.data ?? (studentDash as any))?.profile;
      if (profile?.class_id) setSelectedClassId(String(profile.class_id));
      return;
    }
    if (isParent) {
      const child = parentChildren.find((c: any) => String(c.id) === String(activeChildId)) || parentChildren[0];
      if (child?.class_id) setSelectedClassId(String(child.class_id));
      return;
    }
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(String(classes[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, selectedClassId, isStudent, isParent, studentDash, parentChildren, activeChildId]);

  // Exams for this class + term + year
  const canLoad = !!(selectedClassId && term && academicYear);
  const { data: examsData, isLoading } = useQuery({
    queryKey: ['exam-timetable', selectedClassId, term, academicYear],
    queryFn: () => examinationsService.listExaminations({
      class_id: selectedClassId, term, academic_year: academicYear, limit: 200,
    }),
    enabled: canLoad,
    staleTime: 15_000,
  });

  const exams: ExaminationRecord[] = (examsData as any)?.data ?? [];
  const { dates: examDates, grid } = useMemo(() => buildExamGrid(exams), [exams]);

  // Combine real exam dates with manually-added empty rows, sorted & unique
  const allDates = useMemo(() => {
    const set = new Set<string>([...examDates, ...extraDates]);
    return Array.from(set).sort();
  }, [examDates, extraDates]);

  const stats = useMemo(() => {
    const total = exams.length;
    const subjects = new Set(exams.map((e) => e.subject_id).filter(Boolean)).size;
    const days = examDates.length;
    const completed = exams.filter((e) => e.status === 'completed').length;
    return { total, subjects, days, completed };
  }, [exams, examDates]);

  const openAdd = (date?: string, session?: string) => {
    setEditingExam(null);
    setPrefillDate(date);
    setPrefillSession(session);
    setSlotModalOpen(true);
  };

  const openEdit = (exam: ExaminationRecord) => {
    setEditingExam(exam);
    setPrefillDate(undefined);
    setPrefillSession(undefined);
    setSlotModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await examinationsService.deleteExamination(deleteTarget.id);
    if ((res as any).success !== false) {
      showToast.deleted('Exam');
      queryClient.invalidateQueries({ queryKey: ['exam-timetable'] });
    } else {
      showToast.apiError((res as any).error);
    }
    setDeleteTarget(null);
  };

  const handleAddDay = (d: string) => {
    setExtraDates((prev) => Array.from(new Set([...prev, d])));
  };

  // ── Render a grid cell ──
  const renderCell = (date: string, sessionKey: string) => {
    const exam = grid[date]?.[sessionKey];

    if (exam) {
      return (
        <td className="p-1.5 border border-gray-100 dark:border-gray-700/50 align-top">
          <div
            onClick={isViewerOnly ? undefined : () => openEdit(exam)}
            className={`group relative rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-2 transition-all min-w-[120px] ${isViewerOnly ? '' : 'cursor-pointer hover:ring-2 hover:ring-blue-400/50'}`}
          >
            <p className="text-xs font-bold text-gray-900 dark:text-white truncate leading-tight">
              {exam.subject_name || exam.subject_code || exam.title}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              {exam.start_date?.substring(11, 16)}–{exam.end_date?.substring(11, 16) || ''}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {TYPE_LABELS[exam.type]?.split(' ')[0] || exam.type}
              </span>
              {exam.venue && <span className="text-[9px] text-gray-400 truncate ml-1">{exam.venue}</span>}
            </div>
            <RoleGuard roles={['principal', 'super_admin']}>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(exam); }}
                className="absolute top-1 right-1 p-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <Trash2 size={10} />
              </button>
            </RoleGuard>
          </div>
        </td>
      );
    }

    // Empty cell — add button
    return (
      <td className="p-1.5 border border-gray-100 dark:border-gray-700/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/10 transition-colors">
        <RoleGuard roles={['principal', 'super_admin']}>
          <button
            onClick={() => openAdd(date, sessionKey)}
            className="w-full min-h-[54px] flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            title="Schedule exam"
          >
            <Plus size={16} />
          </button>
        </RoleGuard>
      </td>
    );
  };

  return (
    <MainLayout>
      <PageShell
        title="Exam Timetable"
        subtitle={isViewerOnly ? 'Your class examination schedule' : 'Build the examination schedule by date and session'}
        breadcrumbs={[{ label: 'Exam Timetable' }]}
        actions={
          <RoleGuard roles={['principal', 'super_admin']}>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddDayOpen(true)} disabled={!selectedClassId} className="whitespace-nowrap gap-1.5">
                <CalendarPlus size={14} /> Add Exam Day
              </Button>
              <Button variant="default" size="sm" onClick={() => openAdd()} disabled={!selectedClassId} className="whitespace-nowrap shadow-sm">
                + Schedule Exam
              </Button>
            </div>
          </RoleGuard>
        }
      >
        {/* Parent multi-child switcher */}
        {isParent && parentChildren.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {parentChildren.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedChildId(c.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition ${
                  activeChildId === c.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                }`}
              >
                <span className="font-medium">{c.name}</span>
                {c.class_name && <span className="text-xs text-gray-400">· {c.class_name}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Selectors */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
          {/* Class picker — staff only. Students/parents are auto-scoped. */}
          {!isViewerOnly && (
            <div className="flex-1 sm:max-w-xs">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">Class</label>
              <div className="relative">
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Select a class...</option>
                  {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>
          )}
          <div className="sm:w-40">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">Term</label>
            <select value={term} onChange={(e) => setTerm(e.target.value as ExamTerm)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {EXAM_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="sm:w-40">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">Academic Year</label>
            <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Empty state */}
        {!selectedClassId && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={56} className="text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {isViewerOnly ? 'No exam timetable available yet' : 'Select a class to build its exam timetable'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isViewerOnly ? 'Your exam schedule will appear here once your class is enrolled and exams are scheduled.' : 'Choose a class, term and year above.'}
            </p>
          </div>
        )}

        {selectedClassId && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
              {isLoading ? (
                <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
              ) : (
                <>
                  <KPICard title="Exams Scheduled" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><FileText size={20} /></div>} color="blue" />
                  <KPICard title="Exam Days" value={stats.days} icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><Calendar size={20} /></div>} color="amber" />
                  <KPICard title="Subjects" value={stats.subjects} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><BookOpen size={20} /></div>} color="purple" />
                  <KPICard title="Completed" value={stats.completed} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>} color="green" />
                </>
              )}
            </div>

            {/* Grid */}
            {!isLoading && (
              allDates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                  <Calendar size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No exams scheduled yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">Add an exam day or schedule the first exam.</p>
                  <RoleGuard roles={['principal', 'super_admin']}>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setAddDayOpen(true)}><CalendarPlus size={14} className="mr-1.5" /> Add Exam Day</Button>
                      <Button variant="default" size="sm" onClick={() => openAdd()}>+ Schedule Exam</Button>
                    </div>
                  </RoleGuard>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700 w-[120px]">
                          Date
                        </th>
                        {EXAM_SESSIONS.map((s) => (
                          <th key={s.key} className="px-3 py-2.5 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700">
                            {s.label}
                            <span className="block text-[10px] font-normal text-gray-400 normal-case">{s.start}–{s.end}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allDates.map((date) => {
                        const { weekday, date: dLabel } = formatDateLabel(date);
                        return (
                          <tr key={date}>
                            <td className="px-3 py-2 border border-gray-100 dark:border-gray-700/50 whitespace-nowrap">
                              <div className="text-xs font-bold text-gray-700 dark:text-gray-300">{weekday}</div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">{dLabel}</div>
                            </td>
                            {EXAM_SESSIONS.map((s) => (
                              <React.Fragment key={`${date}-${s.key}`}>
                                {renderCell(date, s.key)}
                              </React.Fragment>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        )}
      </PageShell>

      {selectedClassId && (
        <ExamSlotModal
          isOpen={slotModalOpen}
          onClose={() => { setSlotModalOpen(false); setEditingExam(null); }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['exam-timetable'] })}
          classId={selectedClassId}
          className={selectedClass?.name}
          term={term}
          academicYear={academicYear}
          prefillDate={prefillDate}
          prefillSession={prefillSession}
          editingExam={editingExam}
        />
      )}

      <AddExamDayModal
        isOpen={addDayOpen}
        onClose={() => setAddDayOpen(false)}
        onAdd={handleAddDay}
        existingDates={allDates}
      />

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Exam"
        message={`Remove ${deleteTarget?.subject_name ?? deleteTarget?.title ?? 'this exam'} from the timetable?`}
        confirmLabel="Remove"
      />
    </MainLayout>
  );
};

export default ExamTimetablePage;
