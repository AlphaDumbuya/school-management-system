/**
 * EventCard Component
 * Display event summary in card format
 * Task 5.3
 */

import React from 'react';
import { Card, CardContent } from '@components/ui/card';
import { EventCardProps, EventStatus } from '@types/events';
import { format } from 'date-fns';
import { Calendar, MapPin, Users, Clock } from 'lucide-react';

export const EventCard: React.FC<EventCardProps> = ({
    event,
    onClick,
    showActions = true,
    compact = false,
}) => {
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);
    const isMultiDay = format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');

    const statusColors: Record<EventStatus, string> = {
        draft: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300',
        published: 'border border-green-500 dark:border-green-600 text-green-700 dark:text-green-400',
        cancelled: 'border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400',
        completed: 'border border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-400',
    };

    const statusColor = statusColors[event.status];

    return (
        <Card
            className={`
        hover:shadow-lg transition-shadow duration-200 cursor-pointer
        ${compact ? 'p-3' : 'p-0'}
      `}
            onClick={onClick}
        >
            {event.image_url && !compact && (
                <div className="h-48 overflow-hidden rounded-t-xl">
                    <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            <CardContent className={compact ? 'p-0' : 'p-4'}>
                <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <h3
                                className={`font-semibold text-gray-900 truncate ${compact ? 'text-sm' : 'text-lg'
                                    }`}
                            >
                                {event.title}
                            </h3>
                            {event.organizer && (
                                <p className="text-xs text-gray-500 mt-1">
                                    by {event.organizer.firstName} {event.organizer.lastName}
                                </p>
                            )}
                        </div>
                        <span
                            className={`
                inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                ${statusColor}
              `}
                        >
                            {event.status}
                        </span>
                    </div>

                    {/* Categories */}
                    {event.categories && event.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {event.categories.slice(0, compact ? 2 : 3).map((category) => (
                                <span
                                    key={category.category_id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                    style={{ backgroundColor: category.color || '#3B82F6' }}
                                >
                                    {category.icon && <span className="text-xs">{category.icon}</span>}
                                    {category.name}
                                </span>
                            ))}
                            {event.categories.length > (compact ? 2 : 3) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                                    +{event.categories.length - (compact ? 2 : 3)}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Description */}
                    {!compact && event.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
                    )}

                    {/* Event Details */}
                    <div className="space-y-2">
                        {/* Date & Time */}
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>
                                {event.all_day ? (
                                    <>
                                        {format(startDate, 'MMM d, yyyy')}
                                        {isMultiDay && ` - ${format(endDate, 'MMM d, yyyy')}`}
                                    </>
                                ) : (
                                    <>
                                        {format(startDate, 'MMM d, yyyy h:mm a')}
                                        {isMultiDay && ` - ${format(endDate, 'MMM d, yyyy h:mm a')}`}
                                        {!isMultiDay && ` - ${format(endDate, 'h:mm a')}`}
                                    </>
                                )}
                            </span>
                        </div>

                        {/* Location */}
                        {event.location && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="truncate">{event.location}</span>
                            </div>
                        )}

                        {/* Capacity & Registration */}
                        {!compact && (
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                                {event.capacity && (
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-gray-400" />
                                        <span>
                                            {event.registrations_count || 0} / {event.capacity}
                                        </span>
                                    </div>
                                )}
                                {event.registration_required && event.registration_deadline && (
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <span>
                                            Register by{' '}
                                            {format(new Date(event.registration_deadline), 'MMM d')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RSVP Status */}
                    {event.is_registered && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                                    You're registered
                                </span>
                                {event.user_registration?.rsvp_status && (
                                    <span className="text-xs text-gray-600">
                                        ({event.user_registration.rsvp_status})
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default EventCard;
