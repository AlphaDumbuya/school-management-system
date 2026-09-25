/**
 * TeacherDetailModal — Detailed profile view of a teacher with assignments
 */

import React, { useEffect, useState } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { Button } from '@components/ui/button';
import { teachersService, TeacherRecord } from '@services/teachersService';
import { studentsService } from '@services/studentsService';
import { showToast } from '@utils/toast';
import { User, Mail, Phone, Calendar, KeyRound, ShieldAlert, Loader2, MapPin, Award, GraduationCap, ShieldCheck, Building, Briefcase, BookOpen, RotateCcw } from 'lucide-react';

interface TeacherDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: TeacherRecord | null;
  onEdit?: (teacher: TeacherRecord) => void;
  onStatusChange?: (teacher: TeacherRecord, newStatus: 'active' | 'suspended' | 'dismissed' | 'inactive') => void;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStatusSince(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `since ${month} ${year}`;
}

function formatDesignation(val: string | undefined): string {
  if (!val) return 'Subject Teacher';
  const mappings: Record<string, string> = {
    subject_teacher: 'Subject Teacher',
    class_teacher: 'Class Master',
    form_teacher: 'Form Master',
    hod: 'Head of Department (HOD)',
    senior_teacher: 'Senior Teacher',
    head_teacher: 'Head Teacher',
    vice_head_teacher: 'Deputy Head Teacher',
    vice_principal: 'Vice Principal',
    principal: 'Principal',
    bursar: 'Bursar',
    administrator: 'Administrator',
  };
  return mappings[val] || val;
}

function formatDepartment(val: string | undefined): string {
  if (!val || val === 'none') return 'None';
  const mappings: Record<string, string> = {
    mathematics_sciences: 'Mathematics & Sciences',
    languages: 'Languages & Linguistics',
    social_sciences_humanities: 'Humanities & Social Sciences',
    commercial_technical: 'Commercial & Technical Studies',
  };
  return mappings[val] || val;
}

function formatEmploymentType(val: string | undefined): string {
  if (!val) return 'Full-Time';
  const mappings: Record<string, string> = {
    full_time: 'Full-Time',
    part_time: 'Part-Time',
    volunteer: 'Community / Volunteer Teacher',
    contract: 'Contract',
  };
  return mappings[val] || val;
}

export const TeacherDetailModal: React.FC<TeacherDetailModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onEdit,
  onStatusChange,
}) => {
  const [detailedTeacher, setDetailedTeacher] = useState<TeacherRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (isOpen && teacher) {
      setLoading(true);
      teachersService.getTeacher(teacher.id)
        .then((res: any) => {
          const details = (res && res.success && res.data) ? res.data : res;
          if (details && (details.first_name || details.email)) {
            setDetailedTeacher(details);
          } else {
            setDetailedTeacher(teacher);
          }
        })
        .catch(() => {
          setDetailedTeacher(teacher);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setDetailedTeacher(null);
    }
  }, [isOpen, teacher]);

  const handleResetPassword = async () => {
    const uid = (currentTeacher as any)?.user_id;
    if (!uid) { showToast.error('No login account found for this staff member.'); return; }
    setResetting(true);
    try {
      const res: any = await studentsService.resetUserPassword(uid);
      const pwd = (res?.data ?? res)?.temporary_password;
      // Reflect the new demo password immediately in the modal.
      setDetailedTeacher((prev) => prev ? { ...prev, temp_password: pwd, last_login: null } as TeacherRecord : prev);
      showToast.success(`Password reset. New demo password: ${pwd}`);
    } catch (err: any) {
      showToast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  if (!teacher) return null;
  const currentTeacher = detailedTeacher || teacher;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Teacher Profile"
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-between">
          {/* Status Actions */}
          {onStatusChange && (
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
              {currentTeacher.status === 'active' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { onStatusChange(currentTeacher, 'suspended'); onClose(); }}
                    className="border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-500 dark:hover:bg-amber-950/20 text-xs py-1 h-8 px-3"
                  >
                    Suspend Account
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { onStatusChange(currentTeacher, 'dismissed'); onClose(); }}
                    className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-500 dark:hover:bg-red-950/20 text-xs py-1 h-8 px-3"
                  >
                    Dismiss Teacher
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  onClick={() => { onStatusChange(currentTeacher, 'active'); onClose(); }}
                  className="bg-green-600 hover:bg-green-700 text-white border-none dark:bg-green-650 dark:hover:bg-green-700 text-xs py-1 h-8 px-3"
                >
                  Approve & Reactivate
                </Button>
              )}
            </div>
          )}

          {/* Profile Actions */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center sm:justify-end ml-auto">
            <Button variant="ghost" onClick={onClose} className="text-xs h-8 px-3">Close</Button>
            {onEdit && (
              <Button variant="default" onClick={() => { onEdit(currentTeacher); onClose(); }} className="text-xs h-8 px-3">
                Edit Details
              </Button>
            )}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 size={32} className="text-blue-500 animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Fetching comprehensive assignments...</span>
        </div>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
          {/* ── Profile Header ── */}
          <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <div className="w-16 h-16 rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-white dark:border-gray-700">
              {currentTeacher.photo_url && currentTeacher.photo_url.length > 10 ? (
                <img src={currentTeacher.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {currentTeacher.first_name?.[0]}{currentTeacher.last_name?.[0]}
                </span>
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {currentTeacher.first_name} {currentTeacher.last_name}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono font-semibold">Staff ID: {currentTeacher.teacher_id}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={currentTeacher.status} showDot />
                {['suspended', 'dismissed', 'inactive'].includes(currentTeacher.status) && (() => {
                  const label = formatStatusSince(currentTeacher.updated_at || currentTeacher.created_at);
                  if (!label) return null;
                  return (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      ({label})
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ── Teacher Details ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact & General Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <InfoCard icon={<Mail size={16} />} label="Email Address" value={currentTeacher.email} />
              <InfoCard icon={<Phone size={16} />} label="Phone Number" value={currentTeacher.phone || '—'} />
              <InfoCard icon={<Calendar size={16} />} label="Hire Date" value={formatDate(currentTeacher.hire_date)} />
              <InfoCard icon={<KeyRound size={16} />} label="Last Login" value={currentTeacher.last_login ? formatDate(currentTeacher.last_login) : 'Never logged in'} />
            </div>
          </div>

          {/* ── Portal Access & Credentials ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-semibold">Portal Access & Credentials</h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800/60 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Login Username (Email)</span>
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-1 select-all">{currentTeacher.email}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Credential Status</span>
                  <div className="mt-1">
                    {currentTeacher.temp_password ? (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Temporary Password Set
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                        Active (User set own password)
                      </span>
                    )}
                  </div>
                </div>
                {currentTeacher.temp_password && (
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Demo / Temporary Password</span>
                    <span className="text-xs font-mono font-bold text-gray-850 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded mt-1 inline-block select-all">
                      {currentTeacher.temp_password}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60">
                <Button
                  variant="outline"
                  onClick={handleResetPassword}
                  disabled={resetting || !(currentTeacher as any)?.user_id}
                  className="text-xs h-8 px-3 border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-500 dark:hover:bg-amber-950/20"
                >
                  {resetting ? <Loader2 size={13} className="mr-1.5 animate-spin" /> : <RotateCcw size={13} className="mr-1.5" />}
                  Reset password to demo
                </Button>
                <p className="mt-1.5 text-[10px] text-gray-400">Generates a new demo password the staff member can use to sign in again.</p>
              </div>
            </div>
          </div>

          {/* ── Professional profile ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Professional Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <InfoCard icon={<Award size={16} />} label="Specialization" value={currentTeacher.specialization || '—'} />
              <InfoCard icon={<Calendar size={16} />} label="Experience" value={currentTeacher.experience_years ? `${currentTeacher.experience_years} years` : '0 years'} />
              <InfoCard icon={<MapPin size={16} />} label="Office Location" value={currentTeacher.office_location || '—'} />
              <InfoCard icon={<ShieldCheck size={16} />} label="Designation / Role" value={formatDesignation(currentTeacher.designation)} />
              <InfoCard icon={<Building size={16} />} label="Department" value={formatDepartment(currentTeacher.department)} />
              <InfoCard icon={<Briefcase size={16} />} label="Employment Type" value={formatEmploymentType(currentTeacher.employment_type)} />
              {currentTeacher.form_class_name && (
                <InfoCard icon={<BookOpen size={16} />} label="Form Class Teacher" value={currentTeacher.form_class_name} />
              )}
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800/60 min-w-0">
              <div className="text-gray-400 dark:text-gray-500 flex-shrink-0 flex gap-2">
                <GraduationCap size={16} />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qualifications</span>
              </div>
              {currentTeacher.qualifications ? (
                <div
                  className="text-sm font-medium text-gray-800 dark:text-gray-100 mt-1 pl-6 prose dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                  dangerouslySetInnerHTML={{ __html: currentTeacher.qualifications }}
                />
              ) : (
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mt-1 whitespace-pre-line pl-6">—</p>
              )}
            </div>
          </div>

          {/* ── Assigned Classes & Subjects ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Class & Subject Assignments</h3>
            {currentTeacher.assignments && currentTeacher.assignments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentTeacher.assignments.map((a, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col p-3 bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/20 rounded-xl min-w-0"
                  >
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 truncate">
                      {a.class_name}
                    </span>
                    <span className="text-[10px] text-blue-500 dark:text-blue-500 font-mono truncate mt-0.5">
                      {a.subject_name} ({a.subject_code || '—'})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/20 border border-gray-150 dark:border-gray-800/40 rounded-xl text-center text-xs text-gray-400">
                No classes or subjects assigned to this teacher yet.
              </div>
            )}
          </div>

          {/* ── Role Guard Alert ── */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/15 border border-amber-100 dark:border-amber-900/20 rounded-xl flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">Teacher Permissions</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-500">
                Teachers have write access to grades, student directories, class rosters, attendance logs, and behavior records for their assigned classes.
              </p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

// ── InfoCard Helper ──
const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800/60 min-w-0">
    <div className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate block">{value}</span>
    </div>
  </div>
);

export default TeacherDetailModal;
