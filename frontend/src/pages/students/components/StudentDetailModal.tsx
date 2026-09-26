/**
 * StudentDetailModal — Enhanced student profile view
 */

import React from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { Button } from '@components/ui/button';
import { StudentRecord } from '@services/studentsService';
import { User, Mail, Phone, MapPin, Calendar, BookOpen, Heart, Shield, Hash, Globe, Briefcase, Eye, EyeOff } from 'lucide-react';

interface StudentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentRecord | null;
  onEdit?: (student: StudentRecord) => void;
  onCreateParentAccount?: (student: StudentRecord) => void;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function calculateAge(dob: string | undefined): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} years`;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  isOpen,
  onClose,
  student,
  onEdit,
  onCreateParentAccount,
}) => {
  const [showCreds, setShowCreds] = React.useState(false);
  if (!student) return null;
  const s = student as any;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Profile"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <div className="flex items-center gap-3">
            {onCreateParentAccount && (
              <Button
                variant="outline"
                className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 font-bold"
                onClick={() => { onCreateParentAccount(student); onClose(); }}
              >
                <User size={14} className="mr-1.5" /> Create Parent Account
              </Button>
            )}
            {onEdit && (
              <Button variant="default" onClick={() => { onEdit(student); onClose(); }}>Edit Student</Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── Profile Header ── */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
          {/* Photo */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-gray-800 shadow-md overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-white dark:border-gray-700">
            {s.photo_url && s.photo_url.length > 10 ? (
              <img src={s.photo_url} alt={`${student.first_name} ${student.last_name}`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-gray-300 dark:text-gray-600">
                {student.first_name?.[0]}{student.last_name?.[0]}
              </span>
            )}
          </div>

          {/* Name & Basic Info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {student.first_name} {student.last_name}
            </h2>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 rounded-lg">
                <Hash size={12} /> {student.student_id}
              </span>
              <StatusBadge status={student.status} showDot />
            </div>
            {student.date_of_birth && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Born {formatDate(student.date_of_birth)} · {calculateAge(student.date_of_birth)}
              </p>
            )}
          </div>
        </div>

        {/* ── Personal Information ── */}
        <Section title="Personal Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCard icon={<User size={16} />} label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'} />
            <InfoCard icon={<Calendar size={16} />} label="Date of Birth" value={formatDate(student.date_of_birth)} />
            <InfoCard icon={<Calendar size={16} />} label="Enrollment Date" value={formatDate(student.enrollment_date)} />
            <InfoCard icon={<BookOpen size={16} />} label="Class" value={s.class_name || '—'} />
            <InfoCard icon={<BookOpen size={16} />} label="Religion" value={s.religion || '—'} />
            <InfoCard icon={<Globe size={16} />} label="Nationality" value={s.nationality || '—'} />
            <InfoCard icon={<MapPin size={16} />} label="Place of Birth" value={s.place_of_birth || '—'} />
          </div>
        </Section>

        {/* ── Contact Information ── */}
        <Section title="Contact Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoCard icon={<Mail size={16} />} label="Email" value={s.email || '—'} />
            <InfoCard icon={<Phone size={16} />} label="Phone" value={student.phone || '—'} />
            <InfoCard icon={<MapPin size={16} />} label="Address" value={student.address || '—'} className="sm:col-span-2" />
            <InfoCard icon={<MapPin size={16} />} label="City / Town" value={student.city || '—'} />
            <InfoCard icon={<Globe size={16} />} label="Country" value={student.country || '—'} />
          </div>
        </Section>

        {/* ── Parent / Guardian ── */}
        {(s.guardian_name || s.guardian_phone) && (
          <Section title="Parent / Guardian">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoCard icon={<User size={16} />} label="Guardian Name" value={s.guardian_name || '—'} />
              <InfoCard icon={<Phone size={16} />} label="Guardian Phone" value={s.guardian_phone || '—'} />
              <InfoCard icon={<Heart size={16} />} label="Relationship" value={s.guardian_relationship || '—'} />
              <InfoCard icon={<Briefcase size={16} />} label="Occupation" value={s.guardian_occupation || '—'} />
              <InfoCard icon={<Shield size={16} />} label="Emergency Contact" value={s.emergency_contact || '—'} color="red" />
            </div>
          </Section>
        )}

        {/* ── Additional Information ── */}
        {(s.previous_school || s.medical_conditions) && (
          <Section title="Additional Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {s.previous_school && <InfoCard icon={<BookOpen size={16} />} label="Previous School" value={s.previous_school} />}
              {s.medical_conditions && <InfoCard icon={<Heart size={16} />} label="Medical Conditions" value={s.medical_conditions} color="red" />}
            </div>
          </Section>
        )}

        {/* ── Portal Login Credentials (Hidden by Default) ── */}
        <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl border border-indigo-900/50 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-800/50 pb-2">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-indigo-300 flex items-center gap-2">
              <Shield size={15} className="text-indigo-400" /> Portal Login Credentials
            </h4>
            <button
              type="button"
              onClick={() => setShowCreds(!showCreds)}
              className="text-[11px] text-indigo-300 hover:text-white flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-700/60 transition-all font-semibold"
            >
              {showCreds ? (
                <>
                  <EyeOff size={13} /> Hide Passwords
                </>
              ) : (
                <>
                  <Eye size={13} /> Show Passwords
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <span className="font-bold text-blue-400 text-[11px]">Student Account</span>
              <p className="text-slate-400 font-mono text-[10px] truncate">Username: <strong className="text-slate-100">{s.demo_login?.student_username || s.student_id}</strong></p>
              <p className="text-slate-400 font-mono text-[10px]">Password: <strong className="text-emerald-400">{showCreds ? (s.demo_login?.student_password || 'Uses own password') : '••••••••'}</strong></p>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <span className="font-bold text-purple-400 text-[11px]">Parent Account</span>
              <p className="text-slate-400 font-mono text-[10px] truncate">Email: <strong className="text-slate-100">{s.demo_login?.parent_email || 'Not Created'}</strong></p>
              <p className="text-slate-400 font-mono text-[10px]">Password: <strong className="text-purple-300">{showCreds ? (s.demo_login?.parent_password || 'Uses own password') : '••••••••'}</strong></p>
            </div>
          </div>
        </div>

        {/* ── Metadata ── */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap gap-4 text-[11px] text-gray-400 dark:text-gray-500">
            <span>Created: {formatDate(student.created_at)}</span>
            {s.updated_at && <span>Updated: {formatDate(s.updated_at)}</span>}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── Section wrapper ──
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">{title}</h3>
    {children}
  </div>
);

// ── Info card ──
const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color?: 'blue' | 'red'; className?: string }> = ({
  icon, label, value, color = 'blue', className = '',
}) => {
  const iconBg = color === 'red'
    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';

  return (
    <div className={`flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 ${className}`}>
      <div className={`p-1.5 rounded-lg flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-bold">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
};

export default StudentDetailModal;
