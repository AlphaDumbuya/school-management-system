/**
 * EventFormModal — Create/Edit school events
 * Follows the admin page pattern with multi-step form layout.
 */

import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Modal } from '@components/admin/feedback/Modal';
import { RichTextarea } from '@components/admin/forms/RichTextarea';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { eventsService } from '@services/eventsService';
import { Calendar, Clock, MapPin, Users, Type, FileText } from 'lucide-react';
import type { Event, CreateEventDTO, EventType, EventVisibility, LocationType } from '@appTypes/events';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingEvent?: Event | null;
  prefillDate?: string | null; // YYYY-MM-DD to pre-fill start/end date for new events
}

interface FormValues {
  title: string;
  description: string;
  event_type: EventType;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string;
  end_time: string;
  location: string;
  location_type: LocationType;
  venue_details: string;
  capacity: string;
  visibility: EventVisibility;
  registration_required: boolean;
  registration_deadline: string;
  approval_required: boolean;
  allow_guests: boolean;
  max_guests_per_registration: string;
  external_link: string;
  reminder_enabled: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES: { value: EventType; label: string; desc: string }[] = [
  { value: 'single', label: 'Single Day', desc: 'One-time event on a single day' },
  { value: 'multi_day', label: 'Multi-Day', desc: 'Event spanning multiple days' },
  { value: 'recurring', label: 'Recurring', desc: 'Repeating event on schedule' },
];

const VISIBILITY_OPTIONS: { value: EventVisibility; label: string }[] = [
  { value: 'public', label: 'Public — visible to all' },
  { value: 'private', label: 'Private — invite only' },
  { value: 'role_specific', label: 'Role-specific — selected roles' },
];

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'on_campus', label: 'On Campus' },
  { value: 'off_campus', label: 'Off Campus' },
  { value: 'virtual', label: 'Virtual / Online' },
];

const fieldCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';
const labelCls = 'block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide';
const sectionCls = 'space-y-4 border-t border-gray-100 dark:border-gray-800 pt-5';

// ── Component ─────────────────────────────────────────────────────────────────

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingEvent,
  prefillDate,
}) => {
  const isEditing = !!editingEvent;

  const { register, handleSubmit, watch, setValue, reset, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      event_type: 'single',
      start_date: '',
      end_date: '',
      all_day: false,
      start_time: '',
      end_time: '',
      location: '',
      location_type: 'on_campus',
      venue_details: '',
      capacity: '',
      visibility: 'public',
      registration_required: false,
      registration_deadline: '',
      approval_required: false,
      allow_guests: false,
      max_guests_per_registration: '0',
      external_link: '',
      reminder_enabled: true,
    },
  });

  const allDay = watch('all_day');
  const registrationRequired = watch('registration_required');
  const allowGuests = watch('allow_guests');

  // Prefill on edit or prefillDate
  useEffect(() => {
    if (!isOpen) return;
    if (editingEvent) {
      reset({
        title: editingEvent.title || '',
        description: editingEvent.description || '',
        event_type: editingEvent.event_type || 'single',
        start_date: editingEvent.start_date ? editingEvent.start_date.slice(0, 10) : '',
        end_date: editingEvent.end_date ? editingEvent.end_date.slice(0, 10) : '',
        all_day: editingEvent.all_day || false,
        start_time: editingEvent.start_date && !editingEvent.all_day ? editingEvent.start_date.slice(11, 16) : '',
        end_time: editingEvent.end_date && !editingEvent.all_day ? editingEvent.end_date.slice(11, 16) : '',
        location: editingEvent.location || '',
        location_type: editingEvent.location_type || 'on_campus',
        venue_details: editingEvent.venue_details || '',
        capacity: editingEvent.capacity ? String(editingEvent.capacity) : '',
        visibility: editingEvent.visibility || 'public',
        registration_required: editingEvent.registration_required || false,
        registration_deadline: editingEvent.registration_deadline ? editingEvent.registration_deadline.slice(0, 10) : '',
        approval_required: editingEvent.approval_required || false,
        allow_guests: editingEvent.allow_guests || false,
        max_guests_per_registration: String(editingEvent.max_guests_per_registration || 0),
        external_link: editingEvent.external_link || '',
        reminder_enabled: editingEvent.reminder_enabled ?? true,
      });
    } else {
      reset({
        title: '',
        description: '',
        event_type: 'single',
        start_date: prefillDate || '',
        end_date: prefillDate || '',
        all_day: false,
        start_time: '',
        end_time: '',
        location: '',
        location_type: 'on_campus',
        venue_details: '',
        capacity: '',
        visibility: 'public',
        registration_required: false,
        registration_deadline: '',
        approval_required: false,
        allow_guests: false,
        max_guests_per_registration: '0',
        external_link: '',
        reminder_enabled: true,
      });
    }
  }, [isOpen, editingEvent, prefillDate, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      const startDate = values.all_day
        ? `${values.start_date}T00:00:00.000Z`
        : `${values.start_date}T${values.start_time || '00:00'}:00.000Z`;
      const endDate = values.all_day
        ? `${values.end_date}T23:59:59.000Z`
        : `${values.end_date}T${values.end_time || '23:59'}:00.000Z`;

      const payload: CreateEventDTO = {
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        event_type: values.event_type,
        start_date: startDate,
        end_date: endDate,
        all_day: values.all_day,
        location: values.location.trim() || undefined,
        location_type: values.location_type,
        venue_details: values.venue_details.trim() || undefined,
        capacity: values.capacity ? parseInt(values.capacity) : undefined,
        visibility: values.visibility,
        registration_required: values.registration_required,
        registration_deadline: values.registration_required && values.registration_deadline ? `${values.registration_deadline}T23:59:59.000Z` : undefined,
        approval_required: values.approval_required,
        allow_guests: values.allow_guests,
        max_guests_per_registration: values.allow_guests ? parseInt(values.max_guests_per_registration) || 0 : 0,
        external_link: values.external_link.trim() || undefined,
        reminder_enabled: values.reminder_enabled,
      };

      if (isEditing) {
        const res = await eventsService.updateEvent(editingEvent!.event_id, payload);
        if ((res as any).success === false) throw new Error((res as any).error ?? 'Update failed');
        showToast.saved('Event');
      } else {
        const res = await eventsService.createEvent(payload);
        if ((res as any).success === false) throw new Error((res as any).error ?? 'Create failed');
        showToast.success('Event created');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      showToast.error(err.message || 'Failed to save event');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Event' : 'Create New Event'}
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="default" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Event'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[65vh] overflow-y-auto px-1 -mx-1">
        {/* Section 1: Basic Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
            <FileText size={16} className="text-blue-500" />
            Basic Information
          </div>

          <div>
            <label className={labelCls}>Event Title *</label>
            <input
              {...register('title', { required: 'Title is required' })}
              placeholder="e.g. Annual Sports Day, Parent-Teacher Meeting..."
              className={fieldCls}
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <RichTextarea
                  label="Description"
                  placeholder="Describe the event — use bold, lists, headings to format..."
                  value={field.value}
                  onChange={field.onChange}
                  minHeight="120px"
                />
              )}
            />
          </div>

          <div>
            <label className={labelCls}>Event Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {EVENT_TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`relative flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                    watch('event_type') === t.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    value={t.value}
                    {...register('event_type', { required: true })}
                    className="sr-only"
                  />
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{t.label}</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Date & Time */}
        <div className={sectionCls}>
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
            <Calendar size={16} className="text-amber-500" />
            Date & Time
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('all_day')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">All-day event</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" {...register('start_date', { required: 'Start date is required' })} className={fieldCls} />
              {errors.start_date && <p className="text-xs text-red-500 mt-1">{errors.start_date.message}</p>}
            </div>
            <div>
              <label className={labelCls}>End Date *</label>
              <input type="date" {...register('end_date', { required: 'End date is required' })} className={fieldCls} />
              {errors.end_date && <p className="text-xs text-red-500 mt-1">{errors.end_date.message}</p>}
            </div>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start Time</label>
                <input type="time" {...register('start_time')} className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>End Time</label>
                <input type="time" {...register('end_time')} className={fieldCls} />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Location */}
        <div className={sectionCls}>
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
            <MapPin size={16} className="text-green-500" />
            Location
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Location Type</label>
              <select {...register('location_type')} className={fieldCls}>
                {LOCATION_TYPES.map((lt) => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Location / Venue</label>
              <input {...register('location')} placeholder="e.g. School Hall, Field, Zoom..." className={fieldCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Venue Details</label>
            <input {...register('venue_details')} placeholder="Additional directions or details..." className={fieldCls} />
          </div>
        </div>

        {/* Section 4: Capacity & Registration */}
        <div className={sectionCls}>
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
            <Users size={16} className="text-purple-500" />
            Capacity & Registration
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Max Capacity</label>
              <input type="number" {...register('capacity')} placeholder="Leave blank for unlimited" className={fieldCls} min={0} />
            </div>
            <div>
              <label className={labelCls}>Visibility</label>
              <select {...register('visibility')} className={fieldCls}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('registration_required')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Registration required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('approval_required')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Approval required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('reminder_enabled')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Send reminders</span>
            </label>
          </div>

          {registrationRequired && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Registration Deadline</label>
                <input type="date" {...register('registration_deadline')} className={fieldCls} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer mt-6">
                  <input type="checkbox" {...register('allow_guests')} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Allow guests</span>
                </label>
                {allowGuests && (
                  <div>
                    <label className={labelCls}>Max guests per registration</label>
                    <input type="number" {...register('max_guests_per_registration')} className={fieldCls} min={0} max={10} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Section 5: External Link */}
        <div className={sectionCls}>
          <div>
            <label className={labelCls}>External Link (optional)</label>
            <input {...register('external_link')} placeholder="https://..." className={fieldCls} />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EventFormModal;
