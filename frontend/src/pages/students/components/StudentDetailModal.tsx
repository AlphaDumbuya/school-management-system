/**
 * StudentDetailModal — View full student profile
 */

import React from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { StudentRecord } from '@services/studentsService';
import { User, Mail, Phone, MapPin, Calendar, BookOpen, Heart, Shield } from 'lucide-react';

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentRecord | null;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  if (!student) return null;
  const s = student as any;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Student Profile" size="lg">
      <div className="space-y-6">
        {/* Header with photo */}
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center flex-shrink-0">
            {s.photo_url ? (
              <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-gray-400 dark:text-gray-600">
                {student.first_name?.[0]}{student.last_name?.[0]}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {student.first_name} {student.last_name}
            </h2>
            <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{student.student_id}</p>
            <div className="mt-2">
              <StatusBadge status={student.status} showDot />
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoItem icon={<Calendar size={16} />} label="Date of Birth" value={formatDate(student.date_of_birth)} />
          <InfoItem icon={<User size={16} />} label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'} />
          <InfoItem icon={<Mail size={16} />} label="Email" value={s.email || '—'} />
          <InfoItem icon={<Phone size={16} />} label="Phone" value={student.phone || '—'} />
          <InfoItem icon={<MapPin size={16} />} label="Address" value={[student.address, student.city, student.country].filter(Boolean).join(', ') || '—'} />
          <InfoItem icon={<Calendar size={16} />} label="Enrolled" value={formatDate(student.enrollment_date)} />
          <InfoItem icon={<BookOpen size={16} />} label="Religion" value={s.religion || '—'} />
          <InfoItem icon={<User size={16} />} label="Nationality" value={s.nationality || '—'} />
        </div>

        {/* Guardian */}
        {s.guardian_name && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">Parent / Guardian</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoItem icon={<User size={16} />} label="Name" value={s.guardian_name} />
              <InfoItem icon={<Phone size={16} />} label="Phone" value={s.guardian_phone || '—'} />
              <InfoItem icon={<Heart size={16} />} label="Relationship" value={s.guardian_relationship || '—'} />
              <InfoItem icon={<Shield size={16} />} label="Emergency" value={s.emergency_contact || '—'} />
            </div>
          </div>
        )}

        {/* Additional */}
        {(s.previous_school || s.medical_conditions) && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">Additional</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {s.previous_school && <InfoItem icon={<BookOpen size={16} />} label="Previous School" value={s.previous_school} />}
              {s.medical_conditions && <InfoItem icon={<Heart size={16} />} label="Medical" value={s.medical_conditions} />}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ── Helper component ──
const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{value}</p>
    </div>
  </div>
);

export default StudentDetailModal;
