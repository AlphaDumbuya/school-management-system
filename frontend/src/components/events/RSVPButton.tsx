/**
 * RSVPButton Component
 * RSVP action button with status updates
 * Task 5.6
 */

import React, { useState } from 'react';
import { Button } from '@components/ui/button';
import { RSVPButtonProps, RSVPStatus } from '@appTypes/events';
import { eventsService } from '@services/eventsService';
import { toast } from 'react-toastify';
import { Check, X, HelpCircle, Users } from 'lucide-react';

export const RSVPButton: React.FC<RSVPButtonProps> = ({ event, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [showGuestInput, setShowGuestInput] = useState(false);
    const [guestsCount, setGuestsCount] = useState(0);

    const currentRSVP = event.user_registration?.rsvp_status;
    const isRegistered = event.is_registered;

    const handleRSVP = async (status: RSVPStatus) => {
        if (!event.registration_required) {
            toast.info('This event does not require registration');
            return;
        }

        // If allowing guests and going, show guest input
        if (status === 'going' && event.allow_guests && !showGuestInput) {
            setShowGuestInput(true);
            return;
        }

        setLoading(true);

        try {
            if (isRegistered) {
                // Update existing registration
                if (event.user_registration) {
                    await eventsService.updateRegistration(
                        event.event_id,
                        event.user_registration.registration_id,
                        {
                            rsvp_status: status,
                            guests_count: guestsCount,
                        }
                    );
                    toast.success(`RSVP updated to "${status}"`);
                }
            } else {
                // New registration
                await eventsService.registerForEvent(event.event_id, {
                    rsvp_status: status,
                    guests_count: guestsCount,
                });
                toast.success(
                    event.approval_required
                        ? 'Registration submitted for approval'
                        : 'Successfully registered for event'
                );
            }

            setShowGuestInput(false);
            setGuestsCount(0);
            onUpdate?.();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update RSVP');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelRegistration = async () => {
        if (!window.confirm('Are you sure you want to cancel your registration?')) {
            return;
        }

        setLoading(true);

        try {
            await eventsService.cancelRegistration(event.event_id);
            toast.success('Registration cancelled');
            onUpdate?.();
        } catch (error: any) {
            toast.error(error.message || 'Failed to cancel registration');
        } finally {
            setLoading(false);
        }
    };

    // Check if event is full
    const isFull =
        event.capacity && event.registrations_count
            ? event.registrations_count >= event.capacity
            : false;

    // Check if registration deadline passed
    const registrationDeadlinePassed = event.registration_deadline
        ? new Date(event.registration_deadline) < new Date()
        : false;

    // Check if event has already ended
    const eventEnded = new Date(event.end_date) < new Date();

    if (eventEnded) {
        return (
            <div className="text-sm text-gray-500 py-2">
                This event has ended
            </div>
        );
    }

    if (registrationDeadlinePassed) {
        return (
            <div className="text-sm text-red-600 py-2">
                Registration deadline has passed
            </div>
        );
    }

    if (!event.registration_required) {
        return (
            <div className="text-sm text-gray-600 py-2">
                No registration required
            </div>
        );
    }

    if (showGuestInput) {
        return (
            <div className="space-y-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        How many guests? (Max: {event.max_guests_per_registration})
                    </label>
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-400" />
                        <input
                            type="number"
                            min="0"
                            max={event.max_guests_per_registration}
                            value={guestsCount}
                            onChange={(e) =>
                                setGuestsCount(
                                    Math.min(
                                        parseInt(e.target.value) || 0,
                                        event.max_guests_per_registration
                                    )
                                )
                            }
                            className="w-24 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => handleRSVP('going')}
                        disabled={loading}
                        className="flex-1"
                    >
                        Confirm
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setShowGuestInput(false);
                            setGuestsCount(0);
                        }}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        );
    }

    if (isRegistered && currentRSVP) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">Your RSVP:</span>
                    <span
                        className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
              ${currentRSVP === 'going' ? 'border-green-500 dark:border-green-600 text-green-700 dark:text-green-400' : ''}
              ${currentRSVP === 'maybe' ? 'border-yellow-500 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400' : ''}
              ${currentRSVP === 'not_going' ? 'border-red-400 dark:border-red-600 text-red-700 dark:text-red-400' : ''}
            `}
                    >
                        {currentRSVP === 'going' && <Check className="w-3 h-3" />}
                        {currentRSVP === 'maybe' && <HelpCircle className="w-3 h-3" />}
                        {currentRSVP === 'not_going' && <X className="w-3 h-3" />}
                        {currentRSVP}
                    </span>
                    {event.user_registration?.guests_count! > 0 && (
                        <span className="text-gray-600">
                            + {event.user_registration?.guests_count} guest(s)
                        </span>
                    )}
                </div>

                {event.approval_required && event.user_registration?.approval_status === 'pending' && (
                    <div className="text-sm text-yellow-700 dark:text-yellow-400 border border-yellow-400 dark:border-yellow-600 px-3 py-2 rounded-md">
                        ⏳ Waiting for organizer approval
                    </div>
                )}

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRSVP('going')}
                        disabled={loading || currentRSVP === 'going'}
                    >
                        <Check className="w-4 h-4 mr-1" />
                        Going
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRSVP('maybe')}
                        disabled={loading || currentRSVP === 'maybe'}
                    >
                        <HelpCircle className="w-4 h-4 mr-1" />
                        Maybe
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRSVP('not_going')}
                        disabled={loading || currentRSVP === 'not_going'}
                    >
                        <X className="w-4 h-4 mr-1" />
                        Not Going
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleCancelRegistration}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {isFull && (
                <div className="text-sm text-yellow-700 dark:text-yellow-400 border border-yellow-400 dark:border-yellow-600 px-3 py-2 rounded-md">
                    ⚠️ Event is full. You'll be added to the waitlist.
                </div>
            )}

            <div className="flex gap-2">
                <Button
                    onClick={() => handleRSVP('going')}
                    disabled={loading}
                    className="flex-1"
                >
                    <Check className="w-4 h-4 mr-2" />
                    I'm Going
                </Button>
                <Button
                    variant="outline"
                    onClick={() => handleRSVP('maybe')}
                    disabled={loading}
                >
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Maybe
                </Button>
            </div>
        </div>
    );
};

export default RSVPButton;
