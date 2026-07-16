/**
 * TimetablesPage — /academic/timetables
 * Weekly timetable grid for managing class schedules.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Users, BookOpen, Plus, Trash2, Edit, ChevronDown } from 'lucide-react';
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
  timetableService,
  TimetableSlot,
  DAYS_OF_WEEK,
  PERIOD_STRUCTURES,
  PeriodDefinition,
  getSchoolLevel,
  SchoolLevel,
} from '@services/timetableService';
import { TimetableSlotModal } from './components/TimetableSlotModal';

// ── Subject category colors ───────────────────────────────────────────────────

const CATEGORY_BG: Record<string, string> = {
  core: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  science: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  arts: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
  commercial: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  technical: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const TimetablesPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Class selector
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Mobile day tab
  const [mobileDay, setMobileDay] = useState<string>('Monday');

  // Modal state
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [prefillDay, setPrefillDay] = useState<string | undefined>();
  const [prefillPeriod, setPrefillPeriod] = useState<number | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<TimetableSlot | null>(null);

  // Fetch classes for selector
  const { data: classesData } = useQuery({
    queryKey: ['classes-selector'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
  });
  const classes: ClassRecord[] = (classesData as any)?.data ?? [];

  // Fetch weekly timetable for selected class
  const { data: weeklyData, isLoading } = useQuery({
    queryKey: ['timetable-weekly', selectedClassId],
    queryFn: () => timetableService.getWeeklySchedule(selectedClassId),
    enabled: !!selectedClassId,
    staleTime: 15_000,
  });

  const weekly = (weeklyData as any)?.weekly ?? {};
  const totalSlots = Number((weeklyData as any)?.total_slots ?? 0);

  // Determine period structure based on class level
  const selectedClass = classes.find((c) => String(c.id) === selectedClassId);
  const schoolLevel: SchoolLevel = selectedClass ? getSchoolLevel(selectedClass.level) : 'sss';
  const periods: PeriodDefinition[] = PERIOD_STRUCTURES[schoolLevel];
  const teachablePeriods = periods.filter((p) => !p.isBreak).length;

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
      (slot: TimetableSlot) => slot.start_time === periodStart && slot.end_time === periodEnd
    );
  };

  // Handlers
  const handleAddSlot = (day: string, periodIndex: number) => {
    setEditingSlot(null);
    setPrefillDay(day);
    setPrefillPeriod(periodIndex);
    setSlotModalOpen(true);
  };

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

    if (slot) {
      return (
        <td
          key={`${day}-${periodIndex}`}
          className={`px-1.5 sm:px-2 py-1.5 sm:py-2 border border-gray-100 dark:border-gray-700/50 ${catBg} group cursor-pointer transition-colors hover:ring-2 hover:ring-blue-400/50 rounded-sm`}
          onClick={() => handleEditSlot(slot)}
        >
          <div className="min-w-[80px] sm:min-w-[100px]">
            <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">
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
          <RoleGuard roles={['principal', 'super_admin']}>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(slot); }}
              className="absolute top-1 right-1 p-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove"
            >
              <Trash2 size={10} />
            </button>
          </RoleGuard>
        </td>
      );
    }

    // Empty slot — show add button
    return (
      <td
        key={`${day}-${periodIndex}`}
        className="px-1.5 sm:px-2 py-1.5 sm:py-2 border border-gray-100 dark:border-gray-700/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/10 transition-colors"
      >
        <RoleGuard roles={['principal', 'super_admin']}>
          <button
            onClick={() => handleAddSlot(day, periodIndex)}
            className="w-full h-full min-h-[40px] sm:min-h-[50px] flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            title="Add period"
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
        title="Timetables"
        subtitle="Manage weekly class schedules"
        breadcrumbs={[{ label: 'Timetables' }]}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Class Selector */}
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[160px] sm:min-w-[200px]"
              >
                <option value="">Select a class...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ChevronDown size={14} />
              </div>
            </div>

            <RoleGuard roles={['principal', 'super_admin']}>
              <Button
                variant="default"
                size="sm"
                disabled={!selectedClassId}
                onClick={() => { setEditingSlot(null); setPrefillDay(undefined); setPrefillPeriod(undefined); setSlotModalOpen(true); }}
                className="whitespace-nowrap shadow-sm"
              >
                + Add Period
              </Button>
            </RoleGuard>
          </div>
        }
      >
        {/* No class selected state */}
        {!selectedClassId && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Calendar size={56} className="text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Select a class to view its timetable</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose a class from the dropdown above to manage its weekly schedule.</p>
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
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border border-gray-200 dark:border-gray-700 w-[100px]">
                    Time
                  </th>
                  {DAYS_OF_WEEK.map((day) => (
                    <th
                      key={day}
                      className="px-3 py-2.5 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border border-gray-200 dark:border-gray-700"
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
                    <td className="px-2 py-1.5 border border-gray-100 dark:border-gray-700/50 whitespace-nowrap">
                      <div className="text-[10px] font-bold text-gray-600 dark:text-gray-400">
                        {period.label}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500">
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

                return (
                  <div
                    key={periodIndex}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      slot
                        ? `${catBg} border-gray-200 dark:border-gray-700`
                        : 'border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30'
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
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
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
                    <RoleGuard roles={['principal', 'super_admin']}>
                      {slot ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditSlot(slot)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(slot)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddSlot(mobileDay, periodIndex)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </RoleGuard>
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
    </MainLayout>
  );
};

export default TimetablesPage;
