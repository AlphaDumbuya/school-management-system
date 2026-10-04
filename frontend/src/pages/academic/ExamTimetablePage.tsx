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
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
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
  const { user, canAccess } = useAuth();
  const isStudent = user?.role === 'student';
  // 'guardian' is a legacy alias for parent (not in UserRole, but the column is free text).
  const isParent = user?.role === 'parent' || (user?.role as string | undefined) === 'guardian';
  const isViewerOnly = isStudent || isParent;
  const canManage = canAccess(['principal', 'super_admin']);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [term, setTerm] = useState<ExamTerm>('first_term');
  // Academic year is chosen from the tenant's REAL sessions via <YearFilter>
  // (auto-selects the active year on first load). No new Date() fabrication.
  const [pickedYear, setPickedYear] = useState('');
  const { activeYear } = useAcademicYears();
  // Everyone browses one year (picked, else active). Students/parents get the
  // class(es) they were in THAT year, resolved server-side.
  const academicYear = pickedYear || activeYear;
  const viewingPast = !!academicYear && !!activeYear && academicYear !== activeYear;
  // Only managers edit, and only the current year (teachers view their classes).
  const canEdit = canManage && !viewingPast;
  // The current year is stored as '' so the page follows a rollover by itself.
  const setAcademicYear = (y: string) => { setPickedYear(y === activeYear ? '' : y); setSelectedClassId(''); setExtraDates([]); };

  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExaminationRecord | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | undefined>();
  const [prefillSession, setPrefillSession] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ExaminationRecord | null>(null);
  const [extraDates, setExtraDates] = useState<string[]>([]); // manually-added empty date rows
  const [addDayOpen, setAddDayOpen] = useState(false);

  // Classes (staff only — students/parents auto-resolve their own class).
  // Classes of the SELECTED year — exams are keyed by that year's class rows.
  const { data: classesData } = useQuery({
    queryKey: ['classes-selector', academicYear],
    queryFn: () => classesService.listClasses({ limit: 100, academic_year: academicYear }),
    enabled: !isViewerOnly && !!academicYear,
    staleTime: 60_000,
  });
  const classes: ClassRecord[] = (classesData as any)?.data ?? [];
  const selectedClass = classes.find((c) => String(c.id) === selectedClassId);

  // Parent: which child (the server verifies the link). Students need nothing:
  // the server resolves their own class(es) for the selected year.
  const { data: parentDash, isFetched: parentDashFetched } = useQuery({
    queryKey: ['exam-parent-children'],
    queryFn: () => parentDashboardService.getDashboard(),
    enabled: isParent,
    staleTime: 60_000,
  });
  const parentChildren = ((parentDash as any)?.data ?? (parentDash as any))?.children ?? [];
  const [selectedChildId, setSelectedChildId] = useState('');
  const activeChildId = selectedChildId || parentChildren[0]?.id || '';
  const childName = isParent ? (parentChildren.find((c: any) => c.id === activeChildId)?.name || 'your child') : '';
  const who = isParent ? childName : 'you';

  // Auto-select the class (staff only).
  useEffect(() => {
    if (isViewerOnly) return;
    // Staff: default to the first class, and drop a selection that isn't in the
    // selected year's list (e.g. after a rollover or a year switch).
    if (!classesData) return;
    const inList = classes.some((c) => String(c.id) === selectedClassId);
    if ((!selectedClassId || !inList) && classes.length > 0) {
      setSelectedClassId(String(classes[0].id));
    } else if (selectedClassId && !inList) {
      setSelectedClassId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classesData, selectedClassId, isViewerOnly]);

  // Manually-added empty date rows belong to one class + term only.
  useEffect(() => { setExtraDates([]); }, [selectedClassId, term]);

  // Staff: one class. Students/parents: their own class(es) that year.
  const hasTarget = isViewerOnly ? (!isParent || parentDashFetched) : !!selectedClassId;
  const canLoad = !!(hasTarget && term && academicYear);
  const { data: examsData, isLoading, error: examsError, refetch } = useQuery({
    queryKey: ['exam-timetable', isViewerOnly ? `viewer:${isParent ? activeChildId : 'self'}` : selectedClassId, term, academicYear],
    queryFn: () => examinationsService.listExaminations(isViewerOnly
      ? { term, academic_year: academicYear, limit: 100, child_id: isParent ? (activeChildId || undefined) : undefined }
      : { class_id: selectedClassId, term, academic_year: academicYear, limit: 100 }),
    enabled: canLoad,
    staleTime: 15_000,
  });

  const exams: ExaminationRecord[] = (examsData as any)?.data ?? [];
  // apiClient never throws: a failed load must not read as "no exams".
  const loadError: string | null = examsError
    ? String(examsError)
    : (examsData as any)?.success === false ? ((examsData as any)?.error || 'Could not load the exam timetable') : null;
  const viewerMeta = isViewerOnly ? (examsData as any)?.meta : null;
  const viewerClasses: string[] = Array.from(new Set<string>((viewerMeta?.classes ?? []).map((c: any) => c.name)));
  // More than one class that year (promoted mid-year): label each exam's class.
  const multiClass = isViewerOnly && viewerClasses.length > 1;
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

  // Editing: principal/super-admin, current year only (past years are history).
  const EditGuard: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    viewingPast ? null : <RoleGuard roles={['principal', 'super_admin']}>{children}</RoleGuard>;

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
            onClick={canEdit ? () => openEdit(exam) : undefined}
            className={`group relative rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-2 transition-all min-w-[120px] ${canEdit ? 'cursor-pointer hover:ring-2 hover:ring-blue-400/50' : ''}`}
          >
            <p className={`text-xs font-bold text-gray-900 dark:text-white truncate leading-tight ${exam.status === 'cancelled' ? 'line-through opacity-60' : ''}`}>
              {exam.subject_name || exam.subject_code || exam.title}
            </p>
            {exam.status === 'cancelled' && (
              <p className="text-[10px] font-bold text-red-600 dark:text-red-400">Cancelled</p>
            )}
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              {exam.start_date?.substring(11, 16)}–{exam.end_date?.substring(11, 16) || ''}
            </p>
            {multiClass && exam.class_name && (
              <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 mt-0.5 truncate">{exam.class_name}</p>
            )}
            <div className="flex items-center justify-between mt-1">
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {TYPE_LABELS[exam.type]?.split(' ')[0] || exam.type}
              </span>
              {exam.venue && <span className="text-[9px] text-gray-400 truncate ml-1">{exam.venue}</span>}
            </div>
            <EditGuard>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(exam); }}
                className="absolute top-1 right-1 p-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-500 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label="Remove"
                title="Remove"
              >
                <Trash2 size={10} />
              </button>
            </EditGuard>
          </div>
        </td>
      );
    }

    // Empty cell — add button
    return (
      <td className="p-1.5 border border-gray-100 dark:border-gray-700/50 hover:bg-blue-50/40 dark:hover:bg-blue-950/10 transition-colors">
        <EditGuard>
          <button
            onClick={() => openAdd(date, sessionKey)}
            className="w-full min-h-[54px] flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            title="Schedule exam"
          >
            <Plus size={16} />
          </button>
        </EditGuard>
      </td>
    );
  };

  return (
    <MainLayout>
      <PageShell
        title="Exam Timetable"
        subtitle={isViewerOnly
          ? (viewerClasses.length ? `${viewerClasses.join(' & ')} · ${academicYear}` : isParent ? "Your child's examination schedule" : 'Your class examination schedule')
          : 'Build the examination schedule by date and session'}
        breadcrumbs={[{ label: 'Exam Timetable' }]}
        actions={
          <EditGuard>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddDayOpen(true)} disabled={!selectedClassId} className="whitespace-nowrap gap-1.5">
                <CalendarPlus size={14} /> Add Exam Day
              </Button>
              <Button variant="default" size="sm" onClick={() => openAdd()} disabled={!selectedClassId} className="whitespace-nowrap shadow-sm">
                + Schedule Exam
              </Button>
            </div>
          </EditGuard>
        }
      >
        {/* Parent multi-child switcher */}
        {isParent && parentChildren.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {parentChildren.map((c: any) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={activeChildId === c.id}
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
          <div className="sm:w-44">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 block mb-1">Academic Year</label>
            <YearFilter value={academicYear} onChange={setAcademicYear} noAutoSelect className="w-full [&_select]:w-full" />
          </div>
        </div>

        {viewingPast && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            {isViewerOnly ? (
              <span>
                Showing the exams {who} had in <strong>{academicYear}</strong>
                {viewerClasses.length ? <> ({[...viewerClasses].reverse().join(' → ')})</> : null}. This is history.
              </span>
            ) : (
              <span>Showing the <strong>{academicYear}</strong> exam timetable as history (read-only). The current year is {activeYear}.</span>
            )}
            <button type="button" onClick={() => setAcademicYear('')} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          </div>
        )}
        {isViewerOnly && !viewingPast && viewerMeta?.pending_transition && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>{activeYear} is being set up.</strong> {isParent ? `${childName} is` : "You're"} still listed in {viewerMeta.pending_transition.className} ({viewerMeta.pending_transition.fromYear}).
            This year's exams will show here once the school moves {who} into this year's class.
          </div>
        )}
        {loadError && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <span>{loadError}</span>
            <button type="button" onClick={() => refetch()} className="text-xs font-bold hover:underline">Try again</button>
          </div>
        )}

        {/* Empty state (staff: no class chosen) */}
        {!hasTarget && !isViewerOnly && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={56} className="text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {classesData && classes.length === 0
                  ? (viewingPast ? `No classes in ${academicYear}` : 'No classes yet')
                  : canManage ? 'Select a class to build its exam timetable' : 'Select a class to see its exam timetable'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {classesData && classes.length === 0
                  ? (canManage
                      ? (viewingPast ? `There were no classes in ${academicYear}.` : 'Create classes first, then schedule their exams.')
                      : (viewingPast ? `You didn't teach any classes in ${academicYear}.` : `You have no classes assigned for ${activeYear} yet.`))
                  : 'Choose a class, term and year above.'}
            </p>
          </div>
        )}

        {/* Student/parent not in any class that year */}
        {isViewerOnly && !isLoading && !loadError && viewerMeta && viewerClasses.length === 0 && !viewerMeta.pending_transition && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={56} className="text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {viewerMeta.graduated && !viewingPast
                ? `🎓 ${isParent ? childName : 'You'} graduated from ${viewerMeta.graduated.className}${viewerMeta.graduated.year ? ` in ${viewerMeta.graduated.year}` : ''}`
                : `${isParent ? `${childName} wasn’t` : 'You weren’t'} in a class at this school in ${academicYear}`}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pick another year above.</p>
          </div>
        )}

        {hasTarget && !loadError && !(isViewerOnly && viewerMeta && viewerClasses.length === 0) && (
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
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {viewingPast
                      ? `No exams were scheduled for ${isViewerOnly && viewerClasses.length ? viewerClasses.join(' & ') : 'this class'} this term in ${academicYear}`
                      : isViewerOnly && viewerClasses.length
                        ? `No exams scheduled for ${viewerClasses.join(' & ')} this term yet`
                        : 'No exams scheduled yet'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
                    {canEdit ? 'Add an exam day or schedule the first exam.' : viewingPast ? 'Try another term.' : 'The exam schedule will appear here once the school sets it.'}
                  </p>
                  <EditGuard>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setAddDayOpen(true)}><CalendarPlus size={14} className="mr-1.5" /> Add Exam Day</Button>
                      <Button variant="default" size="sm" onClick={() => openAdd()}>+ Schedule Exam</Button>
                    </div>
                  </EditGuard>
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
