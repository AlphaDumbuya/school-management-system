/**
 * ClassFormModal — Add / Edit class
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { FormSection } from '@components/admin/forms/FormSection';
import { showToast } from '@utils/toast';
import { classesService, ClassRecord, ClassFormData } from '@services/classesService';

// ── Validation schema ─────────────────────────────────────────────────────────

const LEVELS = [
  'NURSERY1', 'NURSERY2', 'NURSERY3',
  'CLASS1', 'CLASS2', 'CLASS3', 'CLASS4', 'CLASS5', 'CLASS6',
  'JSS1', 'JSS2', 'JSS3',
  'SSS1', 'SSS2', 'SSS3'
] as const;

const schema = z.object({
  name:       z.string().min(1, 'Class name is required').max(50, 'Max 50 characters'),
  level:      z.enum(LEVELS, { required_error: 'Level is required' }),
  section:    z.string().optional(),
  capacity:   z.coerce.number().min(5, 'Minimum capacity is 5').max(100, 'Maximum capacity is 100'),
  room_number: z.string().optional(),
  floor:      z.string().optional(),
  building:   z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ClassFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingClass?: ClassRecord | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ClassFormModal: React.FC<ClassFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingClass,
}) => {
  const isEditing = !!editingClass;
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:        '',
      level:       undefined,
      section:     '',
      capacity:    30,
      room_number: '',
      floor:       '',
      building:    '',
    },
  });

  // Pre-populate form when editing
  useEffect(() => {
    if (isOpen && editingClass) {
      reset({
        name:        editingClass.name,
        level:       editingClass.level as any,
        section:     editingClass.section ?? '',
        capacity:    editingClass.capacity,
        room_number: editingClass.room_number ?? '',
        floor:       editingClass.floor ?? '',
        building:    editingClass.building ?? '',
      });
    } else if (isOpen && !editingClass) {
      reset({ name: '', level: undefined, section: '', capacity: 30, room_number: '', floor: '', building: '' });
    }
    setServerError(null);
  }, [isOpen, editingClass, reset]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: ClassFormData = {
        name:        values.name,
        level:       values.level,
        section:     values.section || undefined,
        capacity:    values.capacity,
        room_number: values.room_number || undefined,
        floor:       values.floor || undefined,
        building:    values.building || undefined,
      };

      if (isEditing && editingClass) {
        const res = await classesService.updateClass(editingClass.id, payload);
        if (!res.success) throw new Error(res.error ?? 'Update failed');
        showToast.saved('Class');
      } else {
        const res = await classesService.createClass(payload);
        if (!res.success) throw new Error(res.error ?? 'Create failed');
        showToast.saved('Class');
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

  const LEVEL_NAMES: Record<string, string> = {
    NURSERY1: 'Nursery 1',
    NURSERY2: 'Nursery 2',
    NURSERY3: 'Nursery 3',
    CLASS1: 'Class 1',
    CLASS2: 'Class 2',
    CLASS3: 'Class 3',
    CLASS4: 'Class 4',
    CLASS5: 'Class 5',
    CLASS6: 'Class 6',
    JSS1: 'JSS 1',
    JSS2: 'JSS 2',
    JSS3: 'JSS 3',
    SSS1: 'SSS 1',
    SSS2: 'SSS 2',
    SSS3: 'SSS 3',
  };

  const levelOptions = LEVELS.map((l) => ({ label: LEVEL_NAMES[l] || l, value: l }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Class' : 'Add Class'}
      size="md"
      footer={
        <>
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Class'}
          </Button>
        </>
      }
    >
      {serverError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormSection title="Class Details">
          <FormField
            name="name"
            label="Class Name"
            placeholder="e.g. JSS 1A"
            required
            error={errors.name?.message}
            {...register('name')}
          />
          <FormField
            name="level"
            label="Level"
            type="select"
            required
            options={levelOptions}
            error={errors.level?.message}
            {...register('level')}
          />
          <FormField
            name="section"
            label="Stream / Section"
            placeholder="e.g. A, Science, Arts"
            error={errors.section?.message}
            {...register('section')}
          />
          <FormField
            name="capacity"
            label="Capacity"
            type="number"
            placeholder="30"
            required
            error={errors.capacity?.message}
            {...register('capacity')}
          />
        </FormSection>

        <FormSection title="Location (Optional)">
          <FormField
            name="room_number"
            label="Room Number"
            placeholder="e.g. R101"
            error={errors.room_number?.message}
            {...register('room_number')}
          />
          <FormField
            name="floor"
            label="Floor"
            placeholder="e.g. Ground Floor"
            error={errors.floor?.message}
            {...register('floor')}
          />
          <FormField
            name="building"
            label="Building"
            placeholder="e.g. Main Block"
            error={errors.building?.message}
            {...register('building')}
          />
        </FormSection>
      </form>
    </Modal>
  );
};

export default ClassFormModal;
