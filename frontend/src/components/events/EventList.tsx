/**
 * EventList Component
 * List view with filtering and search
 * Task 5.2
 */

import React, { useState, useEffect } from 'react';
import { EventListProps, Event, EventFilters, EventStatus } from '@appTypes/events';
import { eventsService } from '@services/eventsService';
import { EventCard } from './EventCard';
import { Button } from '@components/ui/button';
import { toast } from 'react-toastify';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export const EventList: React.FC<EventListProps> = ({
    filters: initialFilters,
    showFilters = true,
    onEventClick,
}) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<EventFilters>(initialFilters || {
        page: 1,
        limit: 12,
        sort_by: 'start_date',
        sort_order: 'asc',
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 0,
    });
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    useEffect(() => {
        fetchEvents();
    }, [filters]);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const response = await eventsService.listEvents(filters);
            if (response.success && response.data) {
                setEvents(response.data);
                if (response.pagination) {
                    setPagination(response.pagination);
                }
            } else {
                toast.error('Failed to load events');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to load events');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key: keyof EventFilters, value: any) => {
        setFilters({
            ...filters,
            [key]: value,
            page: 1, // Reset to first page on filter change
        });
    };

    const handleSearch = (searchTerm: string) => {
        setFilters({
            ...filters,
            search: searchTerm,
            page: 1,
        });
    };

    const handlePageChange = (newPage: number) => {
        setFilters({
            ...filters,
            page: newPage,
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearFilters = () => {
        setFilters({
            page: 1,
            limit: 12,
            sort_by: 'start_date',
            sort_order: 'asc',
        });
    };

    const statuses: EventStatus[] = ['published', 'draft', 'cancelled', 'completed'];

    return (
        <div className="space-y-6">
            {/* Search and Filter Header */}
            {showFilters && (
                <div className="space-y-4">
                    {/* Search Bar */}
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search events..."
                                value={filters.search || ''}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            className="flex items-center gap-2"
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                        </Button>
                    </div>

                    {/* Filter Panel */}
                    {showFilterPanel && (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Status Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Status
                                    </label>
                                    <select
                                        value={filters.status || ''}
                                        onChange={(e) =>
                                            handleFilterChange(
                                                'status',
                                                e.target.value || undefined
                                            )
                                        }
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">All Statuses</option>
                                        {statuses.map((status) => (
                                            <option key={status} value={status}>
                                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Start Date Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        From Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.start_date || ''}
                                        onChange={(e) =>
                                            handleFilterChange('start_date', e.target.value || undefined)
                                        }
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* End Date Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        To Date
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.end_date || ''}
                                        onChange={(e) =>
                                            handleFilterChange('end_date', e.target.value || undefined)
                                        }
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Sort By */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Sort By
                                    </label>
                                    <select
                                        value={filters.sort_by || 'start_date'}
                                        onChange={(e) => handleFilterChange('sort_by', e.target.value)}
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="start_date">Start Date</option>
                                        <option value="created_at">Created Date</option>
                                        <option value="title">Title</option>
                                    </select>
                                </div>

                                {/* Sort Order */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Order
                                    </label>
                                    <select
                                        value={filters.sort_order || 'asc'}
                                        onChange={(e) =>
                                            handleFilterChange('sort_order', e.target.value as 'asc' | 'desc')
                                        }
                                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="asc">Ascending</option>
                                        <option value="desc">Descending</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={clearFilters}>
                                    Clear Filters
                                </Button>
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => setShowFilterPanel(false)}
                                >
                                    Apply
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Results Count */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {loading ? 'Loading...' : `${pagination.total} event(s) found`}
                </p>
            </div>

            {/* Events Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                </div>
            ) : events.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No events found</p>
                    <p className="text-gray-400 text-sm mt-2">
                        Try adjusting your filters or search query
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((event) => (
                        <EventCard
                            key={event.event_id}
                            event={event}
                            onClick={() => onEventClick?.(event)}
                        />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {!loading && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                    </Button>

                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                            const pageNumber = i + 1;
                            return (
                                <button
                                    key={pageNumber}
                                    onClick={() => handlePageChange(pageNumber)}
                                    className={`
                    px-3 py-1 rounded-md text-sm font-medium transition-colors
                    ${pagination.page === pageNumber
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                                        }
                  `}
                                >
                                    {pageNumber}
                                </button>
                            );
                        })}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                    >
                        Next
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default EventList;
