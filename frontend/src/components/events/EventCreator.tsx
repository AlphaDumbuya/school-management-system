/**
 * EventCreator Component
 * Event creation form with full configuration
 * Task 5.1
 */

import React, { useState } from 'react';
import { Button } from '@components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/card';
import { CategorySelector } from './CategorySelector';
import { RecurrenceEditor } from './RecurrenceEditor';
import {
    EventCreatorProps,
    CreateEventDTO,
    EventType,
    EventVisibility,
    LocationType,
    RecurrenceConfig,
} from '@appTypes/events';
import { eventsService } from '@services/eventsService';
import { toast } from 'react-toastify';
import { Calendar, MapPin, Users, Image, Link as LinkIcon, Bell } from 'lucide-react';

export const EventCreator: React.FC<EventCreatorProps> = ({
    onSuccess,
    onCancel,
    initialData,
}) => {
    const [formData, setFormData] = useState<CreateEventDTO>({
        title: initialData?.title || '',
        description: initialData?.description || '',
        event_type: initialData?.event_type || 'single',
        start_date: initialData?.start_date || '',
        end_date: initialData?.end_date || '',
        all_day: initialData?.all_day || false,
        location: initialData?.location || '',
        location_type: initialData?.location_type || 'on_campus',
        venue_details: initialData?.venue_details || '',
        capacity: initialData?.capacity,
        visibility: initialData?.visibility || 'public',
        registration_required: initialData?.registration_required || false,
        registration_deadline: initialData?.registration_deadline || '',
        approval_required: initialData?.approval_required || false,
        allow_guests: initialData?.allow_guests || false,
        max_guests_per_registration: initialData?.max_guests_per_registration || 0,
        image_url: initialData?.image_url || '',
        external_link: initialData?.external_link || '',
        reminder_enabled: initialData?.reminder_enabled !== false,
        reminder_intervals: initialData?.reminder_intervals || [24, 1],
        categories: initialData?.categories || [],
    });

    const [showRecurrence, setShowRecurrence] = useState(
        initialData?.event_type === 'recurring'
    );
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (field: keyof CreateEventDTO, value: any) => {
        setFormData({ ...formData, [field]: value });
        // Clear error for this field
        if (errors[field]) {
            setErrors({ ...errors, [field]: '' });
        }
    };

    const handleRecurrenceChange = (config: RecurrenceConfig) => {
        handleChange('recurrence', config);
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.title.trim()) {
            newErrors.title = 'Title is required';
        }

        if (!formData.start_date) {
            newErrors.start_date = 'Start date is required';
        }

        if (!formData.end_date) {
            newErrors.end_date = 'End date is required';
        }

        if (formData.start_date && formData.end_date) {
            if (new Date(formData.start_date) > new Date(formData.end_date)) {
                newErrors.end_date = 'End date must be after start date';
            }
        }

        if (formData.capacity && formData.capacity < 1) {
            newErrors.capacity = 'Capacity must be at least 1';
        }

        if (formData.registration_required && formData.registration_deadline) {
            if (new Date(formData.registration_deadline) > new Date(formData.start_date)) {
                newErrors.registration_deadline =
                    'Registration deadline must be before event start';
            }
        }

        if (formData.allow_guests && formData.max_guests_per_registration < 1) {
            newErrors.max_guests_per_registration =
                'Max guests must be at least 1 when guests are allowed';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            toast.error('Please fix the errors in the form');
            return;
        }

        setLoading(true);

        try {
            const response = await eventsService.createEvent(formData);
            if (response.success && response.data) {
                toast.success('Event created successfully');
                onSuccess?.(response.data);
            } else {
                toast.error(response.error || 'Failed to create event');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to create event');
        } finally {
            setLoading(false);
        }
    };

    const eventTypes: { value: EventType; label: string }[] = [
        { value: 'single', label: 'Single Day' },
        { value: 'multi_day', label: 'Multi-Day' },
        { value: 'recurring', label: 'Recurring' },
    ];

    const visibilityOptions: { value: EventVisibility; label: string }[] = [
        { value: 'public', label: 'Public' },
        { value: 'private', label: 'Private' },
        { value: 'role_specific', label: 'Role Specific' },
    ];

    const locationTypes: { value: LocationType; label: string }[] = [
        { value: 'on_campus', label: 'On Campus' },
        { value: 'off_campus', label: 'Off Campus' },
        { value: 'virtual', label: 'Virtual' },
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Create New Event</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Event Title *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                className={`
                  w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  ${errors.title ? 'border-red-500' : 'border-gray-300'}
                `}
                                placeholder="Enter event title"
                            />
                            {errors.title && (
                                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => handleChange('description', e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Describe your event"
                            />
                        </div>

                        {/* Event Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Event Type *
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {eventTypes.map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => {
                                            handleChange('event_type', type.value);
                                            setShowRecurrence(type.value === 'recurring');
                                        }}
                                        className={`
                      px-4 py-2 rounded-md text-sm font-medium transition-colors
                      ${formData.event_type === type.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }
                    `}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Date & Time
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Start Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Date & Time *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.start_date}
                                    onChange={(e) => handleChange('start_date', e.target.value)}
                                    className={`
                    w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.start_date ? 'border-red-500' : 'border-gray-300'}
                  `}
                                />
                                {errors.start_date && (
                                    <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>
                                )}
                            </div>

                            {/* End Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    End Date & Time *
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.end_date}
                                    onChange={(e) => handleChange('end_date', e.target.value)}
                                    className={`
                    w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    ${errors.end_date ? 'border-red-500' : 'border-gray-300'}
                  `}
                                />
                                {errors.end_date && (
                                    <p className="mt-1 text-sm text-red-600">{errors.end_date}</p>
                                )}
                            </div>
                        </div>

                        {/* All Day Event */}
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.all_day}
                                onChange={(e) => handleChange('all_day', e.target.checked)}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                            />
                            <span className="text-sm text-gray-700">All day event</span>
                        </label>
                    </div>

                    {/* Recurrence Configuration */}
                    {showRecurrence && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                Recurrence Pattern
                            </h3>
                            <RecurrenceEditor
                                value={formData.recurrence}
                                onChange={handleRecurrenceChange}
                            />
                        </div>
                    )}

                    {/* Location */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <MapPin className="w-5 h-5" />
                            Location
                        </h3>

                        {/* Location Type */}
                        <div className="grid grid-cols-3 gap-2">
                            {locationTypes.map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => handleChange('location_type', type.value)}
                                    className={`
                    px-4 py-2 rounded-md text-sm font-medium transition-colors
                    ${formData.location_type === type.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }
                  `}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>

                        {/* Location Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Location Name
                            </label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => handleChange('location', e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., Main Auditorium, Building A Room 101"
                            />
                        </div>

                        {/* Venue Details */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Venue Details
                            </label>
                            <textarea
                                value={formData.venue_details}
                                onChange={(e) => handleChange('venue_details', e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Additional location details, directions, parking info, etc."
                            />
                        </div>
                    </div>

                    {/* Registration Settings */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Registration
                        </h3>

                        {/* Registration Required */}
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.registration_required}
                                onChange={(e) => handleChange('registration_required', e.target.checked)}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                            />
                            <span className="text-sm text-gray-700">Require registration</span>
                        </label>

                        {formData.registration_required && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Capacity */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Capacity
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.capacity || ''}
                                            onChange={(e) =>
                                                handleChange('capacity', parseInt(e.target.value) || undefined)
                                            }
                                            className={`
                        w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        ${errors.capacity ? 'border-red-500' : 'border-gray-300'}
                      `}
                                            placeholder="Maximum attendees"
                                        />
                                        {errors.capacity && (
                                            <p className="mt-1 text-sm text-red-600">{errors.capacity}</p>
                                        )}
                                    </div>

                                    {/* Registration Deadline */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Registration Deadline
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={formData.registration_deadline}
                                            onChange={(e) =>
                                                handleChange('registration_deadline', e.target.value)
                                            }
                                            className={`
                        w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        ${errors.registration_deadline
                                                    ? 'border-red-500'
                                                    : 'border-gray-300'
                                                }
                      `}
                                        />
                                        {errors.registration_deadline && (
                                            <p className="mt-1 text-sm text-red-600">
                                                {errors.registration_deadline}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Approval Required */}
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.approval_required}
                                        onChange={(e) => handleChange('approval_required', e.target.checked)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                                    />
                                    <span className="text-sm text-gray-700">Require approval for registration</span>
                                </label>

                                {/* Allow Guests */}
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.allow_guests}
                                        onChange={(e) => handleChange('allow_guests', e.target.checked)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                                    />
                                    <span className="text-sm text-gray-700">Allow guests (+1)</span>
                                </label>

                                {formData.allow_guests && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Max Guests Per Registration
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={formData.max_guests_per_registration}
                                            onChange={(e) =>
                                                handleChange(
                                                    'max_guests_per_registration',
                                                    parseInt(e.target.value) || 0
                                                )
                                            }
                                            className={`
                        w-32 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        ${errors.max_guests_per_registration
                                                    ? 'border-red-500'
                                                    : 'border-gray-300'
                                                }
                      `}
                                        />
                                        {errors.max_guests_per_registration && (
                                            <p className="mt-1 text-sm text-red-600">
                                                {errors.max_guests_per_registration}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Categories */}
                    <div>
                        <CategorySelector
                            selected={formData.categories}
                            onChange={(categories) => handleChange('categories', categories)}
                            allowCreate={true}
                        />
                    </div>

                    {/* Additional Settings */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Additional Settings</h3>

                        {/* Visibility */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Visibility
                            </label>
                            <select
                                value={formData.visibility}
                                onChange={(e) =>
                                    handleChange('visibility', e.target.value as EventVisibility)
                                }
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {visibilityOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Image URL */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Image className="w-4 h-4" />
                                Event Image URL
                            </label>
                            <input
                                type="url"
                                value={formData.image_url}
                                onChange={(e) => handleChange('image_url', e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://example.com/event-image.jpg"
                            />
                        </div>

                        {/* External Link */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <LinkIcon className="w-4 h-4" />
                                External Link
                            </label>
                            <input
                                type="url"
                                value={formData.external_link}
                                onChange={(e) => handleChange('external_link', e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://example.com/more-info"
                            />
                        </div>

                        {/* Reminders */}
                        <div>
                            <label className="flex items-center gap-2 mb-3">
                                <input
                                    type="checkbox"
                                    checked={formData.reminder_enabled}
                                    onChange={(e) => handleChange('reminder_enabled', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <Bell className="w-4 h-4" />
                                    Send Reminders
                                </span>
                            </label>

                            {formData.reminder_enabled && (
                                <div className="pl-6 space-y-2">
                                    <p className="text-sm text-gray-600 mb-2">
                                        Reminders will be sent (hours before event):
                                    </p>
                                    <div className="flex gap-2">
                                        {[24, 12, 6, 3, 1].map((hours) => (
                                            <label key={hours} className="flex items-center gap-1">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.reminder_intervals?.includes(hours)}
                                                    onChange={(e) => {
                                                        const intervals = formData.reminder_intervals || [];
                                                        if (e.target.checked) {
                                                            handleChange('reminder_intervals', [
                                                                ...intervals,
                                                                hours,
                                                            ].sort((a, b) => b - a));
                                                        } else {
                                                            handleChange(
                                                                'reminder_intervals',
                                                                intervals.filter((h) => h !== hours)
                                                            );
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                                                />
                                                <span className="text-sm text-gray-700">{hours}h</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-3">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Event'}
                </Button>
            </div>
        </form>
    );
};

export default EventCreator;
