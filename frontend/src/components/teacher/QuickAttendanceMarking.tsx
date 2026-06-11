/**
 * Quick Attendance Marking Component
 * Allows teachers to quickly mark attendance for a class
 * Phase 13: Teacher Dashboard
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  email: string;
}

export interface AttendanceRecord {
  studentId: string;
  status: 'present' | 'absent' | 'late' | null;
}

interface QuickAttendanceMarkingProps {
  classId: string;
  className: string;
  date: Date;
  students: Student[];
  onSubmit: (records: AttendanceRecord[]) => Promise<void>;
  isLoading?: boolean;
}

export const QuickAttendanceMarking: React.FC<QuickAttendanceMarkingProps> = ({
  classId,
  className,
  date,
  students,
  onSubmit,
  isLoading = false,
}) => {
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late' | null>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Initialize attendance records
  useEffect(() => {
    const initial: Record<string, null> = {};
    students.forEach(student => {
      initial[student.id] = null;
    });
    setAttendance(initial);
  }, [students]);

  // Toggle attendance status
  const toggleStatus = (studentId: string) => {
    const statuses: Array<'present' | 'absent' | 'late' | null> = ['present', 'late', 'absent', null];
    const current = attendance[studentId];
    const currentIndex = statuses.indexOf(current);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    setAttendance(prev => ({
      ...prev,
      [studentId]: nextStatus,
    }));
  };

  // Bulk actions
  const markAllPresent = () => {
    const allPresent: Record<string, 'present'> = {};
    students.forEach(student => {
      allPresent[student.id] = 'present';
    });
    setAttendance(allPresent);
  };

  const markAllAbsent = () => {
    const allAbsent: Record<string, 'absent'> = {};
    students.forEach(student => {
      allAbsent[student.id] = 'absent';
    });
    setAttendance(allAbsent);
  };

  const clearAll = () => {
    const cleared: Record<string, null> = {};
    students.forEach(student => {
      cleared[student.id] = null;
    });
    setAttendance(cleared);
  };

  // Submit attendance
  const handleSubmit = async () => {
    try {
      setError('');
      setIsSubmitting(true);

      // Validate that all students have attendance marked
      const unmarked = students.filter(s => attendance[s.id] === null);
      if (unmarked.length > 0) {
        setError(`${unmarked.length} student(s) have no attendance marked`);
        return;
      }

      // Prepare records
      const records: AttendanceRecord[] = students.map(student => ({
        studentId: student.id,
        status: attendance[student.id] as 'present' | 'absent' | 'late',
      }));

      // Submit
      await onSubmit(records);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: 'present' | 'absent' | 'late' | null) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-700 hover:bg-green-200';
      case 'absent':
        return 'bg-red-100 text-red-700 hover:bg-red-200';
      case 'late':
        return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    }
  };

  const getStatusIcon = (status: 'present' | 'absent' | 'late' | null) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4" />;
      case 'absent':
        return <XCircle className="w-4 h-4" />;
      case 'late':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4 opacity-30" />;
    }
  };

  const markedCount = Object.values(attendance).filter(s => s !== null).length;
  const totalCount = students.length;
  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = Object.values(attendance).filter(s => s === 'absent').length;
  const lateCount = Object.values(attendance).filter(s => s === 'late').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <h2>Quick Attendance - {className}</h2>
            <p className="text-sm text-gray-600 font-normal mt-1">
              {date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold text-lg">{markedCount}/{totalCount}</div>
            <div className="text-gray-600">Marked</div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div className="bg-green-50 p-2 rounded">
            <div className="font-semibold text-green-700">{presentCount}</div>
            <div className="text-gray-600">Present</div>
          </div>
          <div className="bg-red-50 p-2 rounded">
            <div className="font-semibold text-red-700">{absentCount}</div>
            <div className="text-gray-600">Absent</div>
          </div>
          <div className="bg-yellow-50 p-2 rounded">
            <div className="font-semibold text-yellow-700">{lateCount}</div>
            <div className="text-gray-600">Late</div>
          </div>
          <div className="bg-gray-50 p-2 rounded">
            <div className="font-semibold text-gray-700">{totalCount - markedCount}</div>
            <div className="text-gray-600">Unmarked</div>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={markAllPresent}
            className="text-green-700"
          >
            Mark All Present
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={markAllAbsent}
            className="text-red-700"
          >
            Mark All Absent
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearAll}
            className="text-gray-700"
          >
            Clear All
          </Button>
        </div>

        {/* Student List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {students.map(student => (
            <div
              key={student.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
            >
              <div>
                <p className="font-medium">{student.name}</p>
                <p className="text-sm text-gray-600">Roll: {student.rollNumber}</p>
              </div>

              <button
                onClick={() => toggleStatus(student.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${getStatusColor(
                  attendance[student.id]
                )}`}
              >
                {getStatusIcon(attendance[student.id])}
                {attendance[student.id] ? attendance[student.id].charAt(0).toUpperCase() + attendance[student.id].slice(1) : 'Mark'}
              </button>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Attendance submitted successfully!
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading || markedCount === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
          >
            {isSubmitting ? 'Submitting...' : `Submit Attendance (${markedCount}/${totalCount})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickAttendanceMarking;
