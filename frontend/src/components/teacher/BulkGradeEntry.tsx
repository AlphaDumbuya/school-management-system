/**
 * Bulk Grade Entry Component
 * Allows teachers to enter grades for multiple students at once
 * Phase 13: Teacher Dashboard
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { AlertCircle, CheckCircle, Save } from 'lucide-react';

export interface StudentGrade {
  studentId: string;
  name: string;
  rollNumber: string;
  grade: number | '';
  maxMarks: number;
  passMark: number;
}

interface BulkGradeEntryProps {
  classId: string;
  className: string;
  subject: string;
  students: StudentGrade[];
  maxMarks: number;
  passMark: number;
  onSubmit: (grades: Array<{ studentId: string; grade: number }>) => Promise<void>;
  onSaveDraft?: (grades: Array<{ studentId: string; grade: number }>) => Promise<void>;
  isLoading?: boolean;
}

export const BulkGradeEntry: React.FC<BulkGradeEntryProps> = ({
  classId,
  className,
  subject,
  students: initialStudents,
  maxMarks,
  passMark,
  onSubmit,
  onSaveDraft,
  isLoading = false,
}) => {
  const [grades, setGrades] = useState<StudentGrade[]>(initialStudents);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [editedCount, setEditedCount] = useState(0);

  useEffect(() => {
    setGrades(initialStudents);
  }, [initialStudents]);

  // Handle grade change
  const updateGrade = (studentId: string, value: string) => {
    const numValue = value === '' ? '' : Math.min(Number(value), maxMarks);
    setGrades(prev =>
      prev.map(s =>
        s.studentId === studentId
          ? { ...s, grade: numValue }
          : s
      )
    );
    setEditedCount(prev => prev + 1);
  };

  // Validate grades
  const validateGrades = (): boolean => {
    const newErrors: string[] = [];

    grades.forEach((student, index) => {
      if (student.grade === '') {
        newErrors.push(`Row ${index + 1} (${student.name}): Grade is required`);
      } else if (typeof student.grade === 'number') {
        if (student.grade < 0) {
          newErrors.push(`Row ${index + 1} (${student.name}): Grade cannot be negative`);
        } else if (student.grade > maxMarks) {
          newErrors.push(`Row ${index + 1} (${student.name}): Grade cannot exceed ${maxMarks}`);
        }
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Submit grades
  const handleSubmit = async () => {
    if (!validateGrades()) {
      return;
    }

    try {
      setIsSubmitting(true);
      const gradesToSubmit = grades.map(s => ({
        studentId: s.studentId,
        grade: typeof s.grade === 'number' ? s.grade : 0,
      }));

      await onSubmit(gradesToSubmit);
      setSuccess(true);
      setEditedCount(0);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to submit grades']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save as draft
  const handleSaveDraft = async () => {
    try {
      setIsSavingDraft(true);
      const gradesToSave = grades.map(s => ({
        studentId: s.studentId,
        grade: typeof s.grade === 'number' ? s.grade : 0,
      }));

      if (onSaveDraft) {
        await onSaveDraft(gradesToSave);
        setSuccess(true);
        setEditedCount(0);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to save draft']);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Calculate statistics
  const filledCount = grades.filter(s => s.grade !== '').length;
  const passCount = grades.filter(s => typeof s.grade === 'number' && s.grade >= passMark).length;
  const failCount = grades.filter(s => typeof s.grade === 'number' && s.grade < passMark).length;
  const averageGrade = grades.filter(s => typeof s.grade === 'number').length > 0
    ? (grades.filter(s => typeof s.grade === 'number').reduce((sum, s) => sum + (typeof s.grade === 'number' ? s.grade : 0), 0) /
        grades.filter(s => typeof s.grade === 'number').length).toFixed(2)
    : '0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <h2>Grade Entry - {className}</h2>
            <p className="text-sm text-gray-600 font-normal mt-1">{subject} (Max: {maxMarks}, Pass: {passMark})</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold text-lg">{filledCount}/{grades.length}</div>
            <div className="text-gray-600">Filled</div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          <div className="bg-blue-50 p-2 rounded">
            <div className="font-semibold text-blue-700">{filledCount}</div>
            <div className="text-gray-600">Filled</div>
          </div>
          <div className="bg-green-50 p-2 rounded">
            <div className="font-semibold text-green-700">{passCount}</div>
            <div className="text-gray-600">Passed</div>
          </div>
          <div className="bg-red-50 p-2 rounded">
            <div className="font-semibold text-red-700">{failCount}</div>
            <div className="text-gray-600">Failed</div>
          </div>
          <div className="bg-purple-50 p-2 rounded">
            <div className="font-semibold text-purple-700">{averageGrade}</div>
            <div className="text-gray-600">Average</div>
          </div>
          <div className="bg-orange-50 p-2 rounded">
            <div className="font-semibold text-orange-700">{editedCount}</div>
            <div className="text-gray-600">Modified</div>
          </div>
        </div>

        {/* Grade Entry Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-2 font-semibold">Roll</th>
                <th className="text-left p-2 font-semibold">Name</th>
                <th className="text-center p-2 font-semibold">Grade ({maxMarks})</th>
                <th className="text-center p-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((student, index) => {
                const isPassed = typeof student.grade === 'number' && student.grade >= passMark;
                const isFailed = typeof student.grade === 'number' && student.grade < passMark;

                return (
                  <tr key={student.studentId} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-gray-600">{student.rollNumber}</td>
                    <td className="p-2 font-medium">{student.name}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        max={maxMarks}
                        value={student.grade}
                        onChange={(e) => updateGrade(student.studentId, e.target.value)}
                        placeholder="Enter grade"
                        className="w-24 px-2 py-1 border rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-2 text-center">
                      {student.grade === '' ? (
                        <span className="text-gray-400">-</span>
                      ) : isPassed ? (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                          <CheckCircle className="w-3 h-3" />
                          Pass
                        </span>
                      ) : isFailed ? (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">
                          <AlertCircle className="w-3 h-3" />
                          Fail
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Error Messages */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-lg space-y-1">
            {errors.map((error, idx) => (
              <div key={idx} className="text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            ))}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Grades saved successfully!
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          {onSaveDraft && (
            <Button
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isLoading || filledCount === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSavingDraft ? 'Saving...' : 'Save as Draft'}
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading || filledCount === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
          >
            {isSubmitting ? 'Submitting...' : `Submit Grades (${filledCount}/${grades.length})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BulkGradeEntry;
