/**
 * TimetableSlotModal — Add / Edit a timetable period slot
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { showToast } from '@utils/toast';
import {
  timetableService,
  TimetableSlot,
  SlotFormData,
  DAYS_OF_WEEK,
  PERIOD_STRUCTURES,
  PeriodDefinition,
  getSchoolLevel,
  getCustomPeriodsAsync,
} from '@services/timetableService';
import { subjectsService } from '@services/subjectsService';

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  subject_id: z.string().min(1, 'Subject is required'),
  teacher_id: z.string().min(1, 'Teacher is required'),
  day_of_week: z.string().min(1, 'Day is required'),
  period_index: z.string().min(1, 'Period is required'),
  room_number: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface TimetableSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classId: string;
  classLevel?: string;
  editingSlot?: TimetableSlot | null;
  prefillDay?: string;
  prefillPeriodIndex?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const TimetableSlotModal: React.FC<TimetableSlotModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  classId,
  classLevel,
  editingSlot,
  prefillDay,
  prefillPeriodIndex,
}) => {
  const isEditing = !!editingSlot;
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Get dynamic periods based on class level and custom settings (API-backed)
  const schoolLevel = classLevel ? getSchoolLevel(classLevel) : 'sss';
  const [periods, setPeriods] = React.useState<PeriodDefinition[]>(PERIOD_STRUCTURES[schoolLevel]);
  React.useEffect(() => {
    getCustomPeriodsAsync(schoolLevel).then(setPeriods);
  }, [schoolLevel]);

  // Fetch subjects
  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-list'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });
  const subjects = (subjectsData as any)?.data ?? [];

  // Fetch teachers
  const { data: teachersData } = useQuery({
    queryKey: ['teachers-list'],
    queryFn: () => timetableService.getTeachers(),
    staleTime: 60_000,
  });
  const teachers = (teachersData as any)?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject_id: '',
      teacher_id: '',
      day_of_week: prefillDay || '',
      period_index: prefillPeriodIndex !== undefined ? String(prefillPeriodIndex) : '',
      room_number: '',
    },
  });

  // Pre-populate form
  useEffect(() => {
    if (isOpen && editingSlot) {
      // Find matching period index
      const periodIdx = periods.findIndex(
        (p) => p.start === editingSlot.start_time.substring(0, 5) && p.end === editingSlot.end_time.substring(0, 5)
      );
      reset({
        subject_id: editingSlot.subject_id,
        teacher_id: editingSlot.teacher_id,
        day_of_week: editingSlot.day_of_week,
        period_index: periodIdx >= 0 ? String(periodIdx) : '',
        room_number: editingSlot.room_number ?? '',
      });
    } else if (isOpen && !editingSlot) {
      reset({
        subject_id: '',
        teacher_id: '',
        day_of_week: prefillDay || '',
        period_index: prefillPeriodIndex !== undefined ? String(prefillPeriodIndex) : '',
        room_number: '',
      });
    }
    setServerError(null);
  }, [isOpen, editingSlot, prefillDay, prefillPeriodIndex, reset]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const period = periods[Number(values.period_index)];
      if (!period || period.isBreak) {
        throw new Error('Invalid period selected');
      }

      const payload: SlotFormData = {
        class_id: classId,
        subject_id: values.subject_id,
        teacher_id: values.teacher_id,
        day_of_week: values.day_of_week,
        start_time: period.start,
        end_time: period.end,
        room_number: values.room_number || undefined,
      };

      if (isEditing && editingSlot) {
        const res = await timetableService.updateSlot(editingSlot.id, payload);
        if (res.success === false) throw new Error(res.error ?? 'Update failed');
        showToast.saved('Period');
      } else {
        const res = await timetableService.createSlot(payload);
        if (res.success === false) throw new Error(res.error ?? 'Create failed');
        showToast.success('Period added to timetable');
      }
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter out break periods
  const periodOptions = periods
    .map((p, i) => ({ ...p, index: i }))
    .filter((p) => !p.isBreak);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Period' : 'Add Period to Timetable'}
      size="md"
      footer={
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Period'}
          </Button>
        </div>
      }
    >
      {serverError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form className="flex flex-col gap-4">
        {/* Day + Period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Day <span className="text-red-500">*</span>
            </label>
            <select
              {...register('day_of_week')}
              className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select day...</option>
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {errors.day_of_week && <p className="text-xs text-red-600">{errors.day_of_week.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Period <span className="text-red-500">*</span>
            </label>
            <select
              {...register('period_index')}
              className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select period...</option>
              {periodOptions.map((p) => (
                <option key={p.index} value={p.index}>
                  {p.label} ({p.start} – {p.end})
                </option>
              ))}
            </select>
            {errors.period_index && <p className="text-xs text-red-600">{errors.period_index.message}</p>}
          </div>
        </div>

        {/* Subject */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Subject <span className="text-red-500">*</span>
          </label>
          <select
            {...register('subject_id')}
            className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select subject...</option>
            {subjects.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          {errors.subject_id && <p className="text-xs text-red-600">{errors.subject_id.message}</p>}
        </div>

        {/* Teacher */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Teacher <span className="text-red-500">*</span>
          </label>
          <select
            {...register('teacher_id')}
            className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select teacher...</option>
            {teachers.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.first_name} {t.last_name}{t.specialization ? ` (${t.specialization})` : ''}
              </option>
            ))}
          </select>
          {errors.teacher_id && <p className="text-xs text-red-600">{errors.teacher_id.message}</p>}
        </div>

        {/* Room */}
        <FormField
          label="Room Number"
          placeholder="e.g. R101"
          error={errors.room_number?.message}
          {...register('room_number')}
        />
      </form>
    </Modal>
  );
};

export default TimetableSlotModal;
