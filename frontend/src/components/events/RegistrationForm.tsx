/**
 * RegistrationForm Component
 * Custom registration form with dynamic fields
 * Task 5.7
 */

import React, { useState } from 'react';
import { Button } from '@components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/card';
import { RegistrationFormProps, RegisterForEventDTO } from '@types/events';
import { eventsService } from '@services/eventsService';
import { toast } from 'react-toastify';
import { Users, Check } from 'lucide-react';

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
    event,
    onSubmit,
    onCancel,
}) => {
    const [formData, setFormData] = useState<RegisterForEventDTO>({
        rsvp_status: 'going',
        guests_count: 0,
        registration_data: {},
    });
    const [loading, setLoading] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!acceptedTerms) {
            toast.error('Please accept the terms and conditions');
            return;
        }

        if (event.allow_guests && formData.guests_count! > event.max_guests_per_registration) {
            toast.error(`Maximum ${event.max_guests_per_registration} guests allowed`);
            return;
        }

        setLoading(true);

        try {
            const response = await eventsService.registerForEvent(event.event_id, formData);
            if (response.success && response.data) {
                toast.success(
                    event.approval_required
                        ? 'Registration submitted for approval'
                        : 'Successfully registered for event'
                );
                onSubmit?.(response.data);
            } else {
                toast.error(response.error || 'Failed to register');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to register');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        if (field === 'guests_count' || field === 'rsvp_status') {
            setFormData({ ...formData, [field]: value });
        } else {
            setFormData({
                ...formData,
                registration_data: {
                    ...formData.registration_data,
                    [field]: value,
                },
            });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Register for {event.title}</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* RSVP Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Will you attend? *
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => handleChange('rsvp_status', 'going')}
                                className={`
                  flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${formData.rsvp_status === 'going'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-green-600'
                                    }
                `}
                            >
                                <Check className="w-5 h-5 mx-auto mb-1" />
                                Yes, I'm Going
                            </button>
                            <button
                                type="button"
                                onClick={() => handleChange('rsvp_status', 'maybe')}
                                className={`
                  flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${formData.rsvp_status === 'maybe'
                                        ? 'bg-yellow-600 text-white'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-yellow-600'
                                    }
                `}
                            >
                                Maybe
                            </button>
                        </div>
                    </div>

                    {/* Guests */}
                    {event.allow_guests && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Number of Guests
                            </label>
                            <p className="text-sm text-gray-500 mb-3">
                                Maximum {event.max_guests_per_registration} guest(s) allowed
                            </p>
                            <input
                                type="number"
                                min="0"
                                max={event.max_guests_per_registration}
                                value={formData.guests_count}
                                onChange={(e) =>
                                    handleChange(
                                        'guests_count',
                                        Math.min(
                                            parseInt(e.target.value) || 0,
                                            event.max_guests_per_registration
                                        )
                                    )
                                }
                                className="w-32 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Additional Information Fields */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">Additional Information</h3>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address *
                            </label>
                            <input
                                type="email"
                                required
                                value={formData.registration_data?.email || ''}
                                onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="your.email@example.com"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={formData.registration_data?.phone || ''}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>

                        {/* Special Requirements */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Special Requirements or Notes
                            </label>
                            <textarea
                                value={formData.registration_data?.notes || ''}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Dietary restrictions, accessibility needs, etc."
                            />
                        </div>
                    </div>

                    {/* Approval Notice */}
                    {event.approval_required && (
                        <div className="border border-yellow-400 dark:border-yellow-600 rounded-lg p-4">
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                ⚠️ <strong>Approval Required:</strong> Your registration will be reviewed by the
                                event organizer. You'll receive an email notification once approved.
                            </p>
                        </div>
                    )}

                    {/* Terms and Conditions */}
                    <div>
                        <label className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                                className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                            />
                            <span className="text-sm text-gray-700">
                                I agree to the event terms and conditions, and consent to receiving event-related
                                communications. I understand that my registration may be cancelled if I fail to
                                attend without prior notice.
                            </span>
                        </label>
                    </div>

                    {/* Form Actions */}
                    <div className="flex gap-3 pt-4">
                        {onCancel && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                                disabled={loading}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                        )}
                        <Button type="submit" disabled={loading || !acceptedTerms} className="flex-1">
                            {loading ? 'Submitting...' : 'Complete Registration'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};

export default RegistrationForm;
