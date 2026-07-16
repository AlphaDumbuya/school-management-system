/**
 * GradeEntryModal — Bulk grade entry for a class + subject
 * Spreadsheet-style: select class, subject, term → enter CA & Exam for all students.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { showToast } from '@utils/toast';
import { resultsService, TERMS, getGradeLetter } from '@services/resultsService';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentGradeRow {
  student_id: string;
  student_name: string;
  roll_number: string;
  ca_score: number;
  exam_score: number;
}

interface GradeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const GradeEntryModal: React.FC<GradeEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const currentYear = new Date().getFullYear();
  const defaultAcademicYear = `${currentYear}/${currentYear + 1}`;

  // Selection state
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState('');
  const [academicYear] = useState(defaultAcademicYear);

  // Grade entry state
  const [grades, setGrades] = useState<StudentGradeRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ['classes-dropdown'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  const classOptions = useMemo(() => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })), [classes]);

  // Fetch subjects
  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-dropdown'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });
  const subjects = (subjectsData as any)?.data ?? [];
  const subjectOptions = useMemo(() => subjects.map((s: any) => ({ value: String(s.id), label: s.name, sublabel: s.code })), [subjects]);

  // Fetch students for selected class
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['class-students-for-grades', classId],
    queryFn: () => classesService.getClassStudents(classId),
    enabled: !!classId,
    staleTime: 30_000,
  });

  // When class changes, populate student list
  useEffect(() => {
    const students = (studentsData as any)?.students ?? [];
    if (students.length > 0) {
      setGrades(students.map((s: any) => ({
        student_id: s.id,
        student_name: `${s.first_name} ${s.last_name}`,
        roll_number: s.roll_number || '—',
        ca_score: 0,
        exam_score: 0,
      })));
    } else {
      setGrades([]);
    }
  }, [studentsData]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setClassId('');
      setSubjectId('');
      setTerm('');
      setGrades([]);
      setServerError(null);
    }
  }, [isOpen]);

  // Update a student's score
  const updateScore = (index: number, field: 'ca_score' | 'exam_score', value: number) => {
    setGrades((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Submit all grades
  const handleSubmit = async () => {
    if (!classId || !subjectId || !term) {
      setServerError('Please select Class, Subject, and Term');
      return;
    }

    if (grades.length === 0) {
      setServerError('No students enrolled in this class');
      return;
    }

    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        class_id: classId,
        subject_id: subjectId,
        academic_year: academicYear,
        term,
        grades: grades.map((g) => ({
          student_id: g.student_id,
          ca_score: g.ca_score,
          exam_score: g.exam_score,
        })),
      };

      const res = await resultsService.bulkEnterGrades(payload);
      if (res.success === false) throw new Error(res.error ?? 'Failed to save grades');

      showToast.success(`${grades.length} grades saved successfully`);
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReady = classId && subjectId && term && grades.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enter Grades"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <div className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
            {grades.length > 0 ? `${grades.length} students · CA /30 + Exam /70 = Total /100` : 'Select class to load students'}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
            <Button variant="default" disabled={isSubmitting || !isReady} onClick={handleSubmit}>
              {isSubmitting ? 'Saving…' : `Save ${grades.length} Grades`}
            </Button>
          </div>
        </div>
      }
    >
      {serverError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      {/* Selection Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <SearchableSelect
          label="Class"
          required
          options={classOptions}
          value={classId}
          onChange={setClassId}
          placeholder="Select class..."
          searchPlaceholder="Search classes..."
        />
        <SearchableSelect
          label="Subject"
          required
          options={subjectOptions}
          value={subjectId}
          onChange={setSubjectId}
          placeholder="Select subject..."
          searchPlaceholder="Search subjects..."
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Term <span className="text-red-500">*</span></label>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select term...</option>
            {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Academic Year display */}
      <div className="flex items-center gap-2 mb-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-semibold">Academic Year:</span>
        <span className="font-mono">{academicYear}</span>
      </div>

      {/* Student loading state */}
      {classId && studentsLoading && (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading students...</div>
      )}

      {/* No students message */}
      {classId && !studentsLoading && grades.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No students enrolled in this class. Enroll students first.
        </div>
      )}

      {/* Grade Entry Table */}
      {grades.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-[40px]">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Student</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-[90px]">CA /30</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-[90px]">Exam /70</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-[70px]">Total</th>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase w-[60px]">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {grades.map((row, i) => {
                const total = row.ca_score + row.exam_score;
                const { letter } = getGradeLetter(total);
                const gradeColor = letter === 'A' ? 'text-green-600' : letter === 'B' ? 'text-blue-600' : letter === 'C' ? 'text-amber-600' : letter === 'D' ? 'text-orange-600' : 'text-red-600';

                return (
                  <tr key={row.student_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-xs text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{row.student_name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{row.roll_number}</p>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={row.ca_score || ''}
                        onChange={(e) => updateScore(i, 'ca_score', Math.min(30, Math.max(0, Number(e.target.value) || 0)))}
                        className="w-[70px] px-2 py-1 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={70}
                        value={row.exam_score || ''}
                        onChange={(e) => updateScore(i, 'exam_score', Math.min(70, Math.max(0, Number(e.target.value) || 0)))}
                        className="w-[70px] px-2 py-1 text-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-sm font-bold font-mono text-gray-900 dark:text-white">{total}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-sm font-bold ${gradeColor}`}>{letter}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};

export default GradeEntryModal;
