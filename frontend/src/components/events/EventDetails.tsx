/**
 * EventDetails Component
 * Full event information display with registration interface
 * Task 5.4
 */

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { RSVPButton } from './RSVPButton';
import { EventDetailsProps, Event } from '@appTypes/events';
import { eventsService } from '@services/eventsService';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
    Calendar,
    MapPin,
    Users,
    Clock,
    Share2,
    Edit,
    Trash2,
    ExternalLink,
    Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '@hooks/useAuth';

export const EventDetails: React.FC<EventDetailsProps> = ({ eventId, onUpdate }) => {
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        fetchEventDetails();
    }, [eventId]);

    const fetchEventDetails = async () => {
        setLoading(true);
        try {
            const response = await eventsService.getEvent(eventId);
            if (response.success && response.data) {
                setEvent(response.data);
            } else {
                toast.error('Failed to load event details');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to load event details');
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        const url = `${window.location.origin}/events/${eventId}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: event?.title,
                    text: event?.description,
                    url,
                });
            } catch (error) {
                // User cancelled share or share failed
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(url);
            toast.success('Link copied to clipboard');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this event?')) {
            return;
        }

        try {
            await eventsService.deleteEvent(eventId);
            toast.success('Event deleted successfully');
            onUpdate?.();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete event');
        }
    };

    const canEdit = user && event && (
        user.id === event.organizer_id ||
        user.role === 'principal' ||
        user.role === 'super_admin'
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Event not found</p>
            </div>
        );
    }

    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    const isMultiDay = format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            {event.image_url && (
                <div className="h-64 md:h-96 overflow-hidden rounded-xl">
                    <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            <Card>
                <CardContent className="p-6 space-y-6">
                    {/* Header */}
                    <div>
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex-1">
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{event.title}</h1>
                                {event.organizer && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Organized by {event.organizer.firstName} {event.organizer.lastName}
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleShare}>
                                    <Share2 className="w-4 h-4" />
                                </Button>
                                {canEdit && (
                                    <>
                                        <Button variant="outline" size="sm">
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={handleDelete}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                            <span
                                className={`
                  inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border
                  ${event.status === 'published' ? 'border-green-500 dark:border-green-600 text-green-700 dark:text-green-400' : ''}
                  ${event.status === 'draft' ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300' : ''}
                  ${event.status === 'cancelled' ? 'border-red-400 dark:border-red-600 text-red-700 dark:text-red-400' : ''}
                  ${event.status === 'completed' ? 'border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-400' : ''}
                `}
                            >
                                {event.status}
                            </span>

                            {event.categories?.map((category) => (
                                <span
                                    key={category.category_id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white"
                                    style={{ backgroundColor: category.color || '#3B82F6' }}
                                >
                                    {category.icon && <span>{category.icon}</span>}
                                    {category.name}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    {event.description && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">About</h3>
                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{event.description}</p>
                        </div>
                    )}

                    {/* Event Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Date & Time */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5" />
                                Date & Time
                            </h3>
                            <div className="space-y-2 text-gray-700 dark:text-gray-300">
                                <p className="font-medium">
                                    {event.all_day ? (
                                        <>
                                            {format(startDate, 'EEEE, MMMM d, yyyy')}
                                            {isMultiDay && (
                                                <>
                                                    <br />
                                                    to {format(endDate, 'EEEE, MMMM d, yyyy')}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {format(startDate, 'EEEE, MMMM d, yyyy')}
                                            <br />
                                            {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                                        </>
                                    )}
                                </p>
                                {event.all_day && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">All day event</p>
                                )}
                            </div>
                        </div>

                        {/* Location */}
                        {event.location && (
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <MapPin className="w-5 h-5" />
                                    Location
                                </h3>
                                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                                    <p className="font-medium">{event.location}</p>
                                    {event.location_type && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                                            {event.location_type.replace('_', ' ')}
                                        </p>
                                    )}
                                    {event.venue_details && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{event.venue_details}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Capacity & Registration */}
                        {event.registration_required && (
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    Registration
                                </h3>
                                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                                    {event.capacity && (
                                        <p>
                                            <span className="font-medium">Capacity:</span>{' '}
                                            {event.registrations_count || 0} / {event.capacity}
                                        </p>
                                    )}
                                    {event.registration_deadline && (
                                        <p className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-400" />
                                            <span>
                                                Register by{' '}
                                                {format(new Date(event.registration_deadline), 'MMM d, yyyy h:mm a')}
                                            </span>
                                        </p>
                                    )}
                                    {event.approval_required && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-md">
                                            ℹ️ Registration requires approval
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* External Link */}
                    {event.external_link && (
                        <div>
                            <a
                                href={event.external_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                            >
                                <ExternalLink className="w-4 h-4" />
                                More Information
                            </a>
                        </div>
                    )}

                    {/* RSVP Section */}
                    {event.status === 'published' && (
                        <div className="pt-6 border-t border-gray-200">
                            <RSVPButton event={event} onUpdate={fetchEventDetails} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Attendees Section (if registered) */}
            {event.is_registered && event.registrations_count! > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Attendees</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-600 dark:text-gray-400">
                            {event.registrations_count} {event.registrations_count === 1 ? 'person is' : 'people are'} attending
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default EventDetails;
