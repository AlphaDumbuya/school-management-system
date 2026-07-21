/**
 * ClassStudentsModal — View students enrolled in a class
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SkeletonTableRow } from '@components/admin/feedback/Skeleton';
import { classesService } from '@services/classesService';

interface ClassStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: number | null;
  className?: string;
}

export const ClassStudentsModal: React.FC<ClassStudentsModalProps> = ({
  isOpen,
  onClose,
  classId,
  className,
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['class-students', classId],
    queryFn: () => classesService.getClassStudents(classId!),
    enabled: isOpen && classId !== null,
  });

  const students = (data as any)?.data?.students ?? (data as any)?.students ?? [];
  const total = (data as any)?.data?.total_students ?? (data as any)?.total_students ?? 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${className ?? 'Class'} — Students`}
      size="lg"
    >
      {!isLoading && (
        <p className="text-sm text-gray-500 mb-4">
          {total} student{total !== 1 ? 's' : ''} enrolled
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium text-gray-600">Roll No.</th>
              <th scope="col" className="px-4 py-3 font-medium text-gray-600">Full Name</th>
              <th scope="col" className="px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} columnCount={3} />
              ))
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <EmptyState message="No students enrolled in this class" />
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 font-mono">{student.roll_number}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {student.first_name} {student.last_name}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={student.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};

export default ClassStudentsModal;
