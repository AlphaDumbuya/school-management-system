/**
 * TimetablesPage — /academic/timetables
 * Weekly timetable grid for managing class schedules.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Users, BookOpen, Plus, Trash2, Edit, ChevronDown } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { cardTint } from '@lib/cardTint';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { classesService, ClassRecord } from '@services/classesService';
import {
  timetableService,
  TimetableSlot,
  DAYS_OF_WEEK,
  PERIOD_STRUCTURES,
  PeriodDefinition,
  getSchoolLevel,
  SchoolLevel,
  getCustomPeriodsAsync,
} from '@services/timetableService';
import { TimetableSlotModal } from './components/TimetableSlotModal';
import { PeriodSettingsModal } from './components/PeriodSettingsModal';
import { Settings } from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { studentDashboardService } from '@services/studentDashboardService';
import { parentDashboardService } from '@services/parentDashboardService';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';

// ── Subject category colors ───────────────────────────────────────────────────

const CATEGORY_BG: Record<string, string> = {
  core: 'bg-blue-100 dark:bg-blue-950/40 border-l-4 border-blue-500 dark:border-blue-500',
  science: 'bg-emerald-100 dark:bg-emerald-950/40 border-l-4 border-emerald-500 dark:border-emerald-500',
  arts: 'bg-purple-100 dark:bg-purple-950/40 border-l-4 border-purple-500 dark:border-purple-500',
  commercial: 'bg-amber-100 dark:bg-amber-950/40 border-l-4 border-amber-500 dark:border-amber-500',
  technical: 'bg-orange-100 dark:bg-orange-950/40 border-l-4 border-orange-500 dark:border-orange-500',
};

// Text accent per category to make subject names pop with the cell colour.
const CATEGORY_TEXT: Record<string, string> = {
  core: 'text-blue-800 dark:text-blue-300',
  science: 'text-emerald-800 dark:text-emerald-300',
  arts: 'text-purple-800 dark:text-purple-300',
  commercial: 'text-amber-800 dark:text-amber-300',
  technical: 'text-orange-800 dark:text-orange-300',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const TimetablesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, canAccess } = useAuth();
  const isStudent = user?.role === 'student';
  // 'guardian' is a legacy alias for parent (not in UserRole, but the column is free text).
  const isParent = user?.role === 'parent' || (user?.role as string | undefined) === 'guardian';
  const isViewerOnly = isStudent || isParent;
  const canManage = canAccess(['principal', 'super_admin']);

  // Class selector + academic-year scope (staff). Students/parents auto-resolve.
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [pickedYear, setYear] = useState('');
  const { activeYear } = useAcademicYears();
  // One year at a time: the picked one, else the school's active year.
  const year = pickedYear || activeYear;
  // Students also pick a year (their class that year); past = history.
  const viewingPast = !!year && !!activeYear && year !== activeYear;
  // Only managers edit, and only the current year (teachers view their classes).
  const canEdit = canManage && !viewingPast;
  // The current year is stored as '' so the page follows a rollover by itself.
  const changeYear = (y: string) => { setYear(y === activeYear ? '' : y); setSelectedClassId(''); };

  // Mobile day tab
  const [mobileDay, setMobileDay] = useState<string>('Monday');

  // Modal states
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [periodSettingsOpen, setPeriodSettingsOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [prefillDay, setPrefillDay] = useState<string | undefined>();
  const [prefillPeriod, setPrefillPeriod] = useState<number | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<TimetableSlot | null>(null);

  // Fetch classes for selector (staff only — students/parents auto-resolve
  // their own class from the dashboard, never a class picker).
  const { data: classesData } = useQuery({
    queryKey: ['classes-selector', year],
    queryFn: () => classesService.listClasses({ limit: 100, academic_year: year } as any),
    enabled: !isViewerOnly && !!year,
    staleTime: 60_000,
  });
  const classes: ClassRecord[] = (classesData as any)?.data ?? [];

  // Student: resolve their class FOR THE SELECTED YEAR from the dashboard (the
  // class that year that has a timetable — a year can hold more than one).
  const { data: studentDash, isLoading: studentDashLoading } = useQuery({
    queryKey: ['timetable-student-self', year],
    queryFn: () => studentDashboardService.getDashboard(year),
    enabled: isStudent && !!year,
    staleTime: 60_000,
  });
  const studentDashData = ((studentDash as any)?.data ?? (studentDash as any)) as any;
  // Parent: resolve their (first) child's class.
  const { data: parentDash } = useQuery({
    queryKey: ['timetable-parent-children'],
    queryFn: () => parentDashboardService.getDashboard(),
    enabled: isParent,
    staleTime: 60_000,
  });
  const parentChildren = ((parentDash as any)?.data ?? (parentDash as any))?.children ?? [];
  const [selectedChildId, setSelectedChildId] = useState('');
  const activeChildId = selectedChildId || parentChildren[0]?.id || '';
  // Parent: the SELECTED child's year view (same payload as the student
  // portal), so each child's class that year is used, including a child
  // promoted mid-year (the class that has a timetable) or one moving up.
  const { data: parentChildResp, isLoading: parentChildLoading } = useQuery({
    queryKey: ['timetable-parent-child', activeChildId, year],
    queryFn: () => parentDashboardService.getChildDetail(activeChildId, year),
    enabled: isParent && !!activeChildId && !!year,
    staleTime: 60_000,
  });
  const parentChildData = ((parentChildResp as any)?.data ?? (parentChildResp as any)) as any;
  // The viewer's year data: the student's own, or the selected child's.
  const viewerDash: any = isStudent ? studentDashData : isParent ? parentChildData : null;
  const viewerDashLoading = isStudent ? studentDashLoading : isParent ? parentChildLoading : false;
  const childFirst = isParent ? (String(parentChildren.find((c: any) => c.id === activeChildId)?.name || 'Your child').split(' ')[0]) : '';

  // Auto-select the class.
  useEffect(() => {
    if (isViewerOnly) {
      if (!viewerDash) return;
      const cid = viewerDash.timetable_class?.id ?? viewerDash.profile?.class_id ?? '';
      if (String(cid) !== selectedClassId) setSelectedClassId(cid ? String(cid) : '');
      return;
    }
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
  }, [classes, selectedClassId, isViewerOnly, viewerDash]);

  // Fetch weekly timetable for selected class
  const { data: weeklyData, isLoading } = useQuery({
    queryKey: ['timetable-weekly', selectedClassId],
    queryFn: () => timetableService.getWeeklySchedule(selectedClassId),
    enabled: !!selectedClassId,
    staleTime: 15_000,
  });

  const weekly = (weeklyData as any)?.weekly ?? {};
  const totalSlots = Number((weeklyData as any)?.total_slots ?? 0);

  // Determine period structure dynamically based on class level & custom settings
  const selectedClass = classes.find((c) => String(c.id) === selectedClassId);
  // Students/parents have no class list: take the level from the timetable
  // response, so e.g. a Class 6 pupil gets primary periods, not SSS ones.
  const classLevel: string | undefined = selectedClass?.level ?? (weeklyData as any)?.class_level ?? undefined;
  const schoolLevel: SchoolLevel = classLevel ? getSchoolLevel(classLevel) : 'sss';
  const viewerClassName: string | null = (weeklyData as any)?.class_name ?? viewerDash?.timetable_class?.name ?? null;
  // apiClient never throws: a denied/failed load comes back as success:false.
  const weeklyError: string | null = (weeklyData as any)?.success === false ? ((weeklyData as any)?.error || 'Could not load the timetable') : null;

  // Fetch custom periods from API (tenant-scoped) with localStorage fallback
  const [configPeriods, setPeriods] = useState<PeriodDefinition[]>(PERIOD_STRUCTURES.sss);
  useEffect(() => {
    getCustomPeriodsAsync(schoolLevel).then(setPeriods);
  }, [schoolLevel]);

  // Period times are school-wide, not per year. If they were changed after a
  // past year, that year's slots no longer line up with today's periods — so
  // for history, add a row for every slot time that isn't a current period
  // (nothing from the past year is hidden).
  const periods = useMemo(() => {
    if (!viewingPast) return configPeriods;
    const known = new Set(configPeriods.map((p) => `${p.start}-${p.end}`));
    const extra = new Map<string, PeriodDefinition>();
    DAYS_OF_WEEK.forEach((day) => {
      (weekly[day] || []).forEach((slot: TimetableSlot) => {
        const start = (slot.start_time || '').substring(0, 5);
        const end = (slot.end_time || '').substring(0, 5);
        const key = `${start}-${end}`;
        if (start && end && !known.has(key) && !extra.has(key)) extra.set(key, { label: `${start}–${end}`, start, end });
      });
    });
    if (extra.size === 0) return configPeriods;
    return [...configPeriods, ...extra.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [configPeriods, viewingPast, weekly]);

  const teachablePeriods = configPeriods.filter((p) => !p.isBreak).length;

  // KPI calculations
  const stats = useMemo(() => {
    const maxSlots = teachablePeriods * 5; // periods × 5 days
    const scheduled = totalSlots;
    const unscheduled = Math.max(0, maxSlots - scheduled);
    const teachers = new Set<string>();
    const subjects = new Set<string>();

    DAYS_OF_WEEK.forEach((day) => {
      (weekly[day] || []).forEach((slot: TimetableSlot) => {
        if (slot.teacher_id) teachers.add(slot.teacher_id);
        if (slot.subject_id) subjects.add(slot.subject_id);
      });
    });

    return { scheduled, unscheduled, teachers: teachers.size, subjects: subjects.size };
  }, [weekly, totalSlots, teachablePeriods]);

  // Find slot for a given day + period
  const getSlot = (day: string, periodStart: string, periodEnd: string): TimetableSlot | undefined => {
    return (weekly[day] || []).find(
      (slot: TimetableSlot) => {
        // Handle PostgreSQL time format (HH:MM:SS vs HH:MM)
        const slotStart = (slot.start_time || '').substring(0, 5);
        const slotEnd = (slot.end_time || '').substring(0, 5);
        return slotStart === periodStart && slotEnd === periodEnd;
      }
    );
  };

  // Handlers
  const handleAddSlot = (day: string, periodIndex: number) => {
    setEditingSlot(null);
    setPrefillDay(day);
    setPrefillPeriod(periodIndex);
    setSlotModalOpen(true);
  };

  // Editing controls: principal/super-admin, and only for the CURRENT year —
  // a past year's timetable is read-only history.
  const EditGuard: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    viewingPast ? null : <RoleGuard roles={['principal', 'super_admin']}>{children}</RoleGuard>;

  const handleEditSlot = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setPrefillDay(undefined);
    setPrefillPeriod(undefined);
    setSlotModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await timetableService.deleteSlot(deleteTarget.id);
    if (res.success !== false) {
      showToast.deleted('Period');
      queryClient.invalidateQueries({ queryKey: ['timetable-weekly'] });
    } else {
      showToast.apiError(res.error);
    }
    setDeleteTarget(null);
  };

  // ── Render a single timetable cell ──
  const renderCell = (day: string, period: PeriodDefinition, periodIndex: number) => {
    if (period.isBreak) {
      return (
        <td
          key={`${day}-${periodIndex}`}
          className="px-2 py-2 text-center bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50"
        >
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            {period.label}
          </span>
        </td>
      );
    }

    const slot = getSlot(day, period.start, period.end);
    const catBg = slot?.subject_category ? CATEGORY_BG[slot.subject_category] || '' : '';
    const catText = slot?.subject_category ? CATEGORY_TEXT[slot.subject_category] || 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white';

    if (slot) {
      return (
        <td
          key={`${day}-${periodIndex}`}
          className={`relative px-1.5 sm:px-2 py-1.5 sm:py-2 border border-gray-100 dark:border-gray-700/50 ${catBg} group transition-all rounded-sm ${canEdit ? 'cursor-pointer hover:ring-2 hover:ring-blue-400/60 hover:shadow-md' : ''}`}
          onClick={() => { if (canEdit) handleEditSlot(slot); }}
        >
          <div className="min-w-[80px] sm:min-w-[100px]">
            <p className={`text-xs sm:text-sm font-bold truncate leading-tight ${catText}`}>
              {slot.subject_code || slot.subject_name}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {slot.teacher_name}
            </p>
            {slot.room_number && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                {slot.room_number}
              </p>
            )}
          </div>
          {/* Delete button on hover */}
          <EditGuard>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(slot); }}
              className="absolute top-1 right-1 p-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-500 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
              aria-label="Remove"
              title="Remove"
            >
              <Trash2 size={10} />
            </button>
          </EditGuard>
        </td>
      );
    }

    // Empty slot — show add button
    return (
      <td
        key={`${day}-${periodIndex}`}
        className="px-1.5 sm:px-2 py-1.5 sm:py-2 border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
      >
        <EditGuard>
          <button
            onClick={() => handleAddSlot(day, periodIndex)}
            className="w-full h-full min-h-[40px] sm:min-h-[50px] flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            title="Add period"
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
        title={isViewerOnly ? 'Class Timetable' : 'Timetables'}
        subtitle={isViewerOnly
          ? (viewerClassName ? `${isParent ? `${childFirst} · ` : ''}${viewerClassName} · weekly schedule · ${year}` : isParent ? "Your child's weekly class schedule" : 'Your weekly class schedule')
          : 'Manage weekly class schedules'}
        breadcrumbs={[{ label: 'Timetables' }]}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <YearFilter value={year} onChange={changeYear} noAutoSelect />
            <EditGuard>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeriodSettingsOpen(true)}
                className="whitespace-nowrap shadow-sm gap-1.5"
                title="Customize daily periods, times, and break schedule"
              >
                <Settings size={14} /> Period Settings
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!selectedClassId}
                onClick={() => { setEditingSlot(null); setPrefillDay(undefined); setPrefillPeriod(undefined); setSlotModalOpen(true); }}
                className="whitespace-nowrap shadow-sm"
              >
                + Add Period
              </Button>
            </EditGuard>
          </div>
        }
      >
        {viewingPast && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <span>
              Showing the <strong>{year}</strong>{isViewerOnly && viewerClassName ? <> {viewerClassName}</> : null} timetable as history
              {isViewerOnly ? '' : ' (read-only)'}. The current year is {activeYear}.
            </span>
            <button type="button" onClick={() => changeYear('')} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          </div>
        )}
        {/* Class selector — STAFF pick any class; PARENTS switch between their
            children; STUDENTS see their own class (no picker). */}
        {!isViewerOnly ? (
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Class:</label>
            <div className="relative w-full max-w-xs">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Select a class...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
        ) : isParent && parentChildren.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
            {parentChildren.map((c: any) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={activeChildId === c.id}
                onClick={() => { setSelectedChildId(c.id); setSelectedClassId(''); }}
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
        ) : null}
        {/* Rollover not finished: still last year's class. */}
        {isViewerOnly && !viewingPast && viewerDash?.pending_transition && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>{activeYear} is being set up.</strong> {isParent ? `${childFirst}'s` : 'Your'} new class timetable will appear once the school moves {isParent ? 'them' : 'you'} into {activeYear}.
          </div>
        )}
        {weeklyError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{weeklyError}</div>
        )}
        {/* No class resolved state */}
        {!selectedClassId && !(isViewerOnly && viewerDashLoading) && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Calendar size={56} className="text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {isViewerOnly
                ? (viewerDash?.enrolled_in_year === false && !viewerDash?.pending_transition
                    ? (viewerDash?.graduated && !viewingPast
                        ? `🎓 ${isParent ? `${childFirst} graduated` : 'You graduated'} from ${viewerDash.graduated.className}`
                        : `${isParent ? `${childFirst} wasn’t` : 'You weren’t'} in a class in ${year}`)
                    : `No class timetable for ${year} yet`)
                : classesData && classes.length === 0
                  ? (viewingPast ? `No classes in ${year}` : 'No classes yet')
                  : 'Select a class to view its timetable'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isViewerOnly
                ? (viewingPast
                    ? `No timetable was set for ${isParent ? `${childFirst}'s` : 'your'} class in ${year}.`
                    : `The timetable will appear here once the school publishes a schedule for ${isParent ? `${childFirst}'s` : 'your'} class.`)
                : classesData && classes.length === 0
                  ? (canManage
                      ? (viewingPast ? `There were no classes in ${year}.` : 'Create classes first, then build their weekly schedule.')
                      : user?.role === 'admissions_officer'
                        ? (viewingPast ? `There were no classes in ${year}.` : `There are no classes in ${activeYear} yet.`)
                        : (viewingPast ? `You didn't teach any classes in ${year}.` : `You have no classes assigned for ${activeYear} yet.`))
                  : canManage
                    ? 'Choose a class from the selector above to manage its weekly schedule.'
                    : user?.role === 'admissions_officer'
                      ? 'Choose a class from the selector above to see its weekly schedule.'
                      : 'Choose one of your classes from the selector above to see its weekly schedule.'}
            </p>
          </div>
        )}

        {/* KPI Row — only when class selected */}
        {selectedClassId && (
          <>
            {/* Level info badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Schedule:
              </span>
              <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full">
                {schoolLevel === 'nursery' && '🏒 Nursery · 30 min activities · 8:00–12:30'}
                {schoolLevel === 'primary' && '📚 Primary · 35 min periods · 8:00–14:00'}
                {schoolLevel === 'jss' && '📖 JSS · 40 min periods · 8:00–14:20'}
                {schoolLevel === 'sss' && '🎓 SSS · 45 min periods · 8:00–15:00'}
              </span>
            </div>

            {/* Subject category color legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
              {[
                { key: 'core', label: 'Core', dot: 'bg-blue-500' },
                { key: 'science', label: 'Science', dot: 'bg-emerald-500' },
                { key: 'arts', label: 'Arts', dot: 'bg-purple-500' },
                { key: 'commercial', label: 'Commercial', dot: 'bg-amber-500' },
                { key: 'technical', label: 'Technical', dot: 'bg-orange-500' },
              ].map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                  {c.label}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
            {isLoading ? (
              <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
            ) : (
              <>
                <KPICard title="Periods Scheduled" value={stats.scheduled} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>} color="blue" />
                <KPICard title="Unscheduled" value={stats.unscheduled} icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><Calendar size={20} /></div>} color="amber" />
                <KPICard title="Teachers" value={stats.teachers} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><Users size={20} /></div>} color="purple" />
                <KPICard title="Subjects" value={stats.subjects} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><BookOpen size={20} /></div>} color="green" />
              </>
            )}
          </div>
          </>
        )}

        {/* ── DESKTOP: Weekly Grid Table ── */}
        {selectedClassId && !isLoading && (
          <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <table className="w-full border-collapse text-sm bg-white dark:bg-gray-900">
              <thead>
                <tr className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6]">
                  <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border border-blue-700/40 w-[100px]">
                    Time
                  </th>
                  {DAYS_OF_WEEK.map((day) => (
                    <th
                      key={day}
                      className="px-3 py-3 text-center text-xs font-bold text-white uppercase tracking-wider border border-blue-700/40"
                    >
                      {day.substring(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period, periodIndex) => (
                  <tr
                    key={periodIndex}
                    className={period.isBreak ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}
                  >
                    {/* Time label */}
                    <td className="px-2 py-1.5 border border-gray-100 dark:border-gray-700/50 whitespace-nowrap bg-slate-50 dark:bg-gray-800">
                      <div className="text-[10px] font-bold text-slate-700 dark:text-gray-200">
                        {period.label}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-gray-400">
                        {period.start}–{period.end}
                      </div>
                    </td>
                    {/* Day cells */}
                    {DAYS_OF_WEEK.map((day) => (
                      <React.Fragment key={`${day}-${periodIndex}`}>
                        {renderCell(day, period, periodIndex)}
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── MOBILE: Day tabs + vertical list ── */}
        {selectedClassId && !isLoading && (
          <div className="md:hidden">
            {/* Day tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  onClick={() => setMobileDay(day)}
                  className={`flex-shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                    mobileDay === day
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {day.substring(0, 3)}
                </button>
              ))}
            </div>

            {/* Period list for selected day */}
            <div className="space-y-2">
              {periods.map((period, periodIndex) => {
                if (period.isBreak) {
                  return (
                    <div key={periodIndex} className="py-2 text-center">
                      <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                        {period.label} · {period.start}–{period.end}
                      </span>
                    </div>
                  );
                }

                const slot = getSlot(mobileDay, period.start, period.end);
                const catBg = slot?.subject_category ? CATEGORY_BG[slot.subject_category] || '' : '';
                const catText = slot?.subject_category ? CATEGORY_TEXT[slot.subject_category] || 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white';

                return (
                  <div
                    key={periodIndex}
                    className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm ${
                      slot
                        ? catBg
                        : `border-dashed ${cardTint(periodIndex)}`
                    }`}
                  >
                    {/* Time */}
                    <div className="flex-shrink-0 text-center w-[50px]">
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{period.label}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{period.start}</p>
                    </div>

                    {/* Content */}
                    {slot ? (
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${catText}`}>
                          {slot.subject_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {slot.teacher_name}{slot.room_number ? ` · ${slot.room_number}` : ''}
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 dark:text-gray-500">No subject assigned</p>
                      </div>
                    )}

                    {/* Actions */}
                    <EditGuard>
                      {slot ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditSlot(slot)}
                            aria-label="Edit period"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(slot)}
                            aria-label="Remove period"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddSlot(mobileDay, periodIndex)}
                          aria-label="Add period"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </EditGuard>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PageShell>

      {/* Slot Form Modal */}
      {selectedClassId && (
        <TimetableSlotModal
          isOpen={slotModalOpen}
          onClose={() => { setSlotModalOpen(false); setEditingSlot(null); }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['timetable-weekly'] })}
          classId={selectedClassId}
          classLevel={selectedClass?.level}
          editingSlot={editingSlot}
          prefillDay={prefillDay}
          prefillPeriodIndex={prefillPeriod}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Period"
        message={`Remove ${deleteTarget?.subject_name ?? 'this period'} from ${deleteTarget?.day_of_week ?? 'the timetable'}?`}
        confirmLabel="Remove"
      />

      {/* Period Settings Modal */}
      <PeriodSettingsModal
        isOpen={periodSettingsOpen}
        onClose={() => setPeriodSettingsOpen(false)}
        currentLevel={schoolLevel}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['timetable-weekly'] })}
      />
    </MainLayout>
  );
};

export default TimetablesPage;
