/**
 * AttendanceMarker Component
 * Mark attendance for event registrations
 * Task 5.8
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/card';
import { AttendanceMarkerProps, AttendanceStatus, BulkAttendanceDTO } from '@types/events';
import { eventsService } from '@services/eventsService';
import { toast } from 'react-toastify';
import { Search, CheckCircle, XCircle, Clock, QrCode, Download } from 'lucide-react';

export const AttendanceMarker: React.FC<AttendanceMarkerProps> = ({
    eventId,
    registrations,
    onUpdate,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatuses, setSelectedStatuses] = useState<
        Record<string, AttendanceStatus>
    >({});
    const [loading, setLoading] = useState(false);
    const [showQRCode, setShowQRCode] = useState(false);
    const [qrCodeUrl, setQRCodeUrl] = useState('');

    const filteredRegistrations = registrations.filter((reg) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            reg.user?.firstName.toLowerCase().includes(searchLower) ||
            reg.user?.lastName.toLowerCase().includes(searchLower) ||
            reg.user?.email.toLowerCase().includes(searchLower)
        );
    });

    const handleStatusChange = (registrationId: string, status: AttendanceStatus) => {
        setSelectedStatuses({
            ...selectedStatuses,
            [registrationId]: status,
        });
    };

    const handleMarkAttendance = async (userId: string, status: AttendanceStatus) => {
        try {
            const response = await eventsService.markAttendance(eventId, {
                user_id: userId,
                status,
            });

            if (response.success) {
                toast.success('Attendance marked successfully');
                onUpdate?.();
            } else {
                toast.error(response.error || 'Failed to mark attendance');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to mark attendance');
        }
    };

    const handleBulkMark = async () => {
        if (Object.keys(selectedStatuses).length === 0) {
            toast.warning('No attendance statuses selected');
            return;
        }

        setLoading(true);

        try {
            const attendances: BulkAttendanceDTO[] = Object.entries(selectedStatuses).map(
                ([regId, status]) => {
                    const reg = registrations.find((r) => r.registration_id === regId);
                    return {
                        user_id: reg!.user_id,
                        status,
                    };
                }
            );

            const response = await eventsService.bulkMarkAttendance(eventId, attendances);

            if (response.success) {
                toast.success(`Marked attendance for ${attendances.length} attendees`);
                setSelectedStatuses({});
                onUpdate?.();
            } else {
                toast.error(response.error || 'Failed to mark attendance');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to mark attendance');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAllPresent = () => {
        const allPresent: Record<string, AttendanceStatus> = {};
        filteredRegistrations.forEach((reg) => {
            allPresent[reg.registration_id] = 'present';
        });
        setSelectedStatuses(allPresent);
    };

    const handleGenerateQRCode = async () => {
        try {
            const response = await eventsService.generateAttendanceQRCode(eventId);
            if (response.success && response.data) {
                setQRCodeUrl(response.data);
                setShowQRCode(true);
            } else {
                toast.error('Failed to generate QR code');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to generate QR code');
        }
    };

    const handleDownloadReport = async () => {
        try {
            const response = await eventsService.getAttendanceReport(eventId);
            if (response.success && response.data) {
                // Convert to CSV and download
                const report = response.data;
                const csvContent = [
                    ['Name', 'Email', 'Status', 'Check-in Time'].join(','),
                    ...report.attendees.map((a) =>
                        [
                            `${a.user?.firstName} ${a.user?.lastName}`,
                            a.user?.email,
                            a.status,
                            a.check_in_time || 'N/A',
                        ].join(',')
                    ),
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `attendance-report-${eventId}.csv`;
                link.click();
                window.URL.revokeObjectURL(url);

                toast.success('Attendance report downloaded');
            } else {
                toast.error('Failed to download report');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to download report');
        }
    };

    const statusColors: Record<AttendanceStatus, string> = {
        present: 'border-green-500 dark:border-green-500 text-green-700 dark:text-green-400',
        absent: 'border-red-500 dark:border-red-500 text-red-700 dark:text-red-400',
        late: 'border-yellow-500 dark:border-yellow-500 text-yellow-700 dark:text-yellow-400',
        excused: 'border-blue-500 dark:border-blue-500 text-blue-700 dark:text-blue-400',
    };

    const stats = {
        total: registrations.length,
        present: registrations.filter((r) => r.attendance_status === 'present').length,
        absent: registrations.filter((r) => r.attendance_status === 'absent').length,
        late: registrations.filter((r) => r.attendance_status === 'late').length,
        excused: registrations.filter((r) => r.attendance_status === 'excused').length,
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Attendance Tracking</CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleGenerateQRCode}>
                                <QrCode className="w-4 h-4 mr-2" />
                                QR Code
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Present</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.present}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Absent</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.absent}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Late</p>
                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.late}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Excused</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.excused}</p>
                        </div>
                    </div>

                    {/* Search and Actions */}
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                            />
                        </div>
                        <Button variant="outline" onClick={handleMarkAllPresent}>
                            Mark All Present
                        </Button>
                        <Button
                            onClick={handleBulkMark}
                            disabled={loading || Object.keys(selectedStatuses).length === 0}
                        >
                            Save Changes
                        </Button>
                    </div>

                    {/* Attendee List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredRegistrations.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No registrations found</p>
                        ) : (
                            filteredRegistrations.map((registration) => {
                                const currentStatus =
                                    selectedStatuses[registration.registration_id] ||
                                    registration.attendance_status ||
                                    'absent';

                                return (
                                    <div
                                        key={registration.registration_id}
                                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">
                                                {registration.user?.firstName} {registration.user?.lastName}
                                            </p>
                                            <p className="text-sm text-gray-500">{registration.user?.email}</p>
                                            {registration.guests_count > 0 && (
                                                <p className="text-xs text-gray-400 mt-1">
                                                    +{registration.guests_count} guest(s)
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Status Buttons */}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleStatusChange(registration.registration_id, 'present')
                                                }
                                                className={`
                          p-2 rounded-lg border-2 transition-colors
                          ${currentStatus === 'present'
                                                        ? statusColors.present
                                                        : 'border-gray-200 hover:border-green-300'
                                                    }
                        `}
                                                title="Present"
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleStatusChange(registration.registration_id, 'late')
                                                }
                                                className={`
                          p-2 rounded-lg border-2 transition-colors
                          ${currentStatus === 'late'
                                                        ? statusColors.late
                                                        : 'border-gray-200 hover:border-yellow-300'
                                                    }
                        `}
                                                title="Late"
                                            >
                                                <Clock className="w-5 h-5" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleStatusChange(registration.registration_id, 'absent')
                                                }
                                                className={`
                          p-2 rounded-lg border-2 transition-colors
                          ${currentStatus === 'absent'
                                                        ? statusColors.absent
                                                        : 'border-gray-200 hover:border-red-300'
                                                    }
                        `}
                                                title="Absent"
                                            >
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* QR Code Modal */}
            {showQRCode && qrCodeUrl && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    onClick={() => setShowQRCode(false)}
                >
                    <Card className="max-w-md" onClick={(e) => e.stopPropagation()}>
                        <CardHeader>
                            <CardTitle>Attendance QR Code</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-center">
                                <img src={qrCodeUrl} alt="Attendance QR Code" className="w-64 h-64" />
                            </div>
                            <p className="text-sm text-gray-600 text-center">
                                Attendees can scan this QR code to check in
                            </p>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setShowQRCode(false)}
                            >
                                Close
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default AttendanceMarker;
