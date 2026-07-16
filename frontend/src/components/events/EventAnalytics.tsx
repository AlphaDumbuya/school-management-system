/**
 * EventAnalytics Component
 * Statistics dashboard with charts and metrics
 * Task 5.11
 */

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/card';
import { EventAnalyticsProps, OverallStats, CategoryStats } from '@types/events';
import { eventsService } from '@services/eventsService';
import { toast } from 'react-toastify';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Calendar, Users, TrendingUp, Award } from 'lucide-react';

export const EventAnalytics: React.FC<EventAnalyticsProps> = ({ filters }) => {
    const [stats, setStats] = useState<OverallStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, [filters]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const response = await eventsService.getOverallAnalytics(filters);
            if (response.success && response.data) {
                setStats(response.data);
            } else {
                toast.error('Failed to load analytics');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">No analytics data available</p>
            </div>
        );
    }

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    return (
        <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Events</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                    {stats.total_events}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-600/10 dark:bg-blue-600/20 rounded-lg flex items-center justify-center">
                                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Upcoming Events</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                    {stats.upcoming_events}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-600/10 dark:bg-green-600/20 rounded-lg flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Registrations</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                    {stats.total_registrations}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-purple-600/10 dark:bg-purple-600/20 rounded-lg flex items-center justify-center">
                                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Attendance</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                    {stats.average_attendance_rate.toFixed(1)}%
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-yellow-600/10 dark:bg-yellow-600/20 rounded-lg flex items-center justify-center">
                                <Award className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Events by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={stats.popular_categories}
                                    dataKey="total_events"
                                    nameKey="category_name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={(entry) => entry.category_name}
                                >
                                    {stats.popular_categories.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Category Performance */}
                <Card>
                    <CardHeader>
                        <CardTitle>Category Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.popular_categories}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="category_name" angle={-45} textAnchor="end" height={100} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="total_registrations" fill="#3B82F6" name="Registrations" />
                                <Bar dataKey="average_attendance_rate" fill="#10B981" name="Attendance %" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 gap-6">
                {/* Trends Over Time */}
                <Card>
                    <CardHeader>
                        <CardTitle>Event Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={stats.trends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="events_count"
                                    stroke="#3B82F6"
                                    strokeWidth={2}
                                    name="Events"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="registrations_count"
                                    stroke="#10B981"
                                    strokeWidth={2}
                                    name="Registrations"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="attendance_count"
                                    stroke="#F59E0B"
                                    strokeWidth={2}
                                    name="Attendance"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Top Categories Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Category Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Category
                                    </th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Total Events
                                    </th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Upcoming
                                    </th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Completed
                                    </th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Registrations
                                    </th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Attendance Rate
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.popular_categories.map((category, index) => (
                                    <tr
                                        key={category.category_id}
                                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                    >
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                                />
                                                <span className="font-medium text-gray-900">
                                                    {category.category_name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">
                                            {category.total_events}
                                        </td>
                                        <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">
                                            {category.upcoming_events}
                                        </td>
                                        <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">
                                            {category.completed_events}
                                        </td>
                                        <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">
                                            {category.total_registrations}
                                        </td>
                                        <td className="text-right py-3 px-4">
                                            <span
                                                className={`
                          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                          ${category.average_attendance_rate >= 80
                                                        ? 'border-green-500 dark:border-green-600 text-green-700 dark:text-green-400'
                                                        : category.average_attendance_rate >= 60
                                                            ? 'border-yellow-500 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400'
                                                            : 'border-red-400 dark:border-red-600 text-red-700 dark:text-red-400'
                                                    }
                        `}
                                            >
                                                {category.average_attendance_rate.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default EventAnalytics;
