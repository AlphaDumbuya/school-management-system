/**
 * StudentProfilesPage — /students/profiles
 * Searchable & filterable directory of student profile cards.
 * Clicking a student transitions to their full 360° tabbed profile view.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import {
  User, Mail, Phone, MapPin, Calendar, BookOpen, Heart, Shield, Hash, Globe,
  Briefcase, ChevronLeft, Search, SlidersHorizontal, Award, Clock,
  AlertTriangle, CreditCard, CheckCircle, XCircle, FileText, BarChart3,
  TrendingUp, Activity, DollarSign, Receipt, Eye, EyeOff,
  LayoutGrid, List,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { studentsService, StudentRecord } from '@services/studentsService';
import { classesService } from '@services/classesService';
import { reportCardService } from '@services/reportCardService';
import { disciplineService } from '@services/disciplineService';
import { showToast } from '@utils/toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function calculateAge(dob: string | null | undefined): string {
  if (!dob) return '—';
  try {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} years`;
  } catch {
    return '—';
  }
}

// Flag to toggle v2 profile tabs (Academics/Grades & Billing/Finance). Set to false for v1.0.0 release.
const ENABLE_V2_FEATURES = false;

export const StudentProfilesPage: React.FC = () => {
  const location = useLocation();
  const { canAccess } = useAuth();
  // Parent-account provisioning is an admin/admissions function, not teachers'.
  const canManage = canAccess(['principal', 'super_admin', 'admissions_officer']);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12); // Grid of cards looks best in multiples of 3 or 4
  const [activeTab, setActiveTab] = useState<'overview' | 'academics' | 'attendance' | 'conduct' | 'billing'>('overview');

  // Parent Account Modal State
  const [parentModalOpen, setParentModalOpen] = useState(false);

  useEffect(() => {
    if (location.state?.studentId) {
      setSelectedStudentId(location.state.studentId);
      if (location.state?.openParentModal) {
        setParentModalOpen(true);
      }
    }
  }, [location.state]);
  const [parentEmail, setParentEmail] = useState('');
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelationship, setParentRelationship] = useState('Parent');
  const [parentPassword, setParentPassword] = useState('');
  const [isCreatingParent, setIsCreatingParent] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; tempPass: string } | null>(null);

  // Toggle password visibility (hidden by default for security)
  const [showCredentials, setShowCredentials] = useState(false);
  const [showModalPassword, setShowModalPassword] = useState(false);

  const availableTabs = useMemo(() => {
    const tabs: Array<{ id: 'overview' | 'academics' | 'attendance' | 'conduct' | 'billing'; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'academics', label: 'Academics' },
      { id: 'attendance', label: 'Attendance' },
      { id: 'conduct', label: 'Conduct' },
    ];
    if (ENABLE_V2_FEATURES) {
      tabs.push({ id: 'billing', label: 'Billing' });
    }
    return tabs;
  }, []);

  // 1. Fetch Students list
  const { data: studentsData, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['students-profiles', { search, statusFilter, classFilter, page, pageSize }],
    queryFn: () => studentsService.listStudents({
      page,
      limit: pageSize,
      status: statusFilter || undefined,
      search: search || undefined,
    }),
    staleTime: 30_000,
  });

  const students: StudentRecord[] = (studentsData as any)?.data ?? [];
  const pagination = (studentsData as any)?.pagination ?? { total: 0, total_pages: 1 };

  // Fetch classes for dropdown filter
  const { data: classesData } = useQuery({
    queryKey: ['profiles-classes-filter'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
  });
  const classesList = (classesData as any)?.data ?? [];

  // Filter students by class locally if classFilter is set (in case class filtering isn't supported at server-level)
  const filteredStudents = useMemo(() => {
    if (!classFilter) return students;
    return students.filter((s: any) => String(s.class_id) === classFilter);
  }, [students, classFilter]);

  // 2. Fetch Selected Student Details
  const { data: studentDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['student-profile-details', selectedStudentId],
    queryFn: () => studentsService.getStudent(selectedStudentId!),
    enabled: !!selectedStudentId,
    staleTime: 30_000,
  });

  const student = useMemo(() => {
    if (!studentDetails) return null;
    const raw = studentDetails as any;
    if (raw.first_name || raw.student_id || raw.id) return raw;
    if (raw.data && (raw.data.first_name || raw.data.student_id || raw.data.id)) return raw.data;
    return raw;
  }, [studentDetails]);

  // 3. Fetch Selected Student Sub-resources
  // A. Academics (SL subject results — Test 1 / Test 2 / Mean, the correct source)
  const { data: gradesData, isLoading: isGradesLoading } = useQuery({
    queryKey: ['student-profile-results', selectedStudentId],
    queryFn: () => reportCardService.getStudentResultsSummary(selectedStudentId!),
    enabled: !!selectedStudentId && activeTab === 'academics',
    staleTime: 30_000,
  });
  const gradesPayload = (gradesData as any)?.data ?? {};
  const grades = gradesPayload.results ?? [];

  const academicStats = useMemo(() => {
    const s = gradesPayload.stats ?? { subjects: 0, avg_test1: 0, avg_test2: 0, avg_mean: 0 };
    return {
      avgTest1: s.avg_test1 ?? 0,
      avgTest2: s.avg_test2 ?? 0,
      avgMean: s.avg_mean ?? 0,
      count: s.subjects ?? grades.length,
    };
  }, [gradesPayload, grades.length]);

  // B. Attendance
  const { data: attendanceData, isLoading: isAttendanceLoading } = useQuery({
    queryKey: ['student-profile-attendance', selectedStudentId],
    queryFn: () => studentsService.getStudentAttendance(selectedStudentId!),
    enabled: !!selectedStudentId && activeTab === 'attendance',
    staleTime: 30_000,
  });
  const attendanceSummary = (attendanceData as any)?.summary ?? { total_days: 0, present_count: 0, late_count: 0, absent_count: 0, excused_count: 0, attendance_percentage: 0, at_risk: false };
  const attendanceRecords = (attendanceData as any)?.records ?? [];

  // C. Conduct/Discipline
  const { data: disciplineStatsData, isLoading: isDisciplineStatsLoading } = useQuery({
    queryKey: ['student-profile-discipline-stats', selectedStudentId],
    queryFn: () => disciplineService.getStudentStats(selectedStudentId!),
    enabled: !!selectedStudentId && activeTab === 'conduct',
    staleTime: 30_000,
  });
  const disciplineStats = disciplineStatsData as any;

  const { data: infractionsData } = useQuery({
    queryKey: ['student-profile-infractions', selectedStudentId],
    queryFn: () => disciplineService.getStudentInfractions(selectedStudentId!),
    enabled: !!selectedStudentId && activeTab === 'conduct',
    staleTime: 30_000,
  });
  const infractions = (infractionsData as any)?.data ?? [];

  const { data: actionsData } = useQuery({
    queryKey: ['student-profile-discipline-actions', selectedStudentId],
    queryFn: () => disciplineService.getStudentActions(selectedStudentId!),
    enabled: !!selectedStudentId && activeTab === 'conduct',
    staleTime: 30_000,
  });
  const actions = (actionsData as any)?.data ?? [];

  // D. Billing/Financials
  const { data: feesData, isLoading: isFeesLoading } = useQuery({
    queryKey: ['student-profile-fees', selectedStudentId],
    queryFn: () => studentsService.getStudentFees(selectedStudentId!),
    enabled: !!selectedStudentId && activeTab === 'billing',
    staleTime: 30_000,
  });
  const fees = (feesData as any)?.data ?? [];

  const { data: outstandingData } = useQuery({
    queryKey: ['student-profile-outstanding', selectedStudentId],
    queryFn: () => studentsService.getStudentOutstanding(selectedStudentId!),
    enabled: !!selectedStudentId && activeTab === 'billing',
    staleTime: 30_000,
  });
  const outstandingBalance = (outstandingData as any)?.data?.outstandingBalance ?? 0;

  const { data: invoicesData } = useQuery({
    queryKey: ['student-profile-invoices', selectedStudentId],
    queryFn: () => studentsService.getStudentInvoices(selectedStudentId!),
    enabled: !!selectedStudentId && activeTab === 'billing',
    staleTime: 30_000,
  });
  const invoices = (invoicesData as any)?.data ?? [];

  const { data: paymentsData } = useQuery({
    queryKey: ['student-profile-payments', selectedStudentId],
    queryFn: () => studentsService.getStudentPayments(selectedStudentId!),
    enabled: !!selectedStudentId && activeTab === 'billing',
    staleTime: 30_000,
  });
  const payments = (paymentsData as any)?.data ?? [];

  // Toggle view
  const handleSelectStudent = (id: string) => {
    setSelectedStudentId(id);
    setActiveTab('overview');
  };

  const handleBackToList = () => {
    setSelectedStudentId(null);
  };

  const handleOpenParentModal = () => {
    if (!student) return;
    const names = (student.guardian_name || '').trim().split(' ');
    setParentFirstName(names[0] || '');
    setParentLastName(names.slice(1).join(' ') || student.last_name || '');
    setParentEmail(student.email || '');
    setParentPhone(student.guardian_phone || student.phone || '');
    setParentRelationship(student.guardian_relationship || 'Parent');
    setParentPassword('');
    setCreatedCredentials(null);
    setParentModalOpen(true);
  };

  const handleCreateParentAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !parentEmail) {
      showToast.error('Please enter a valid parent email address.');
      return;
    }
    setIsCreatingParent(true);
    try {
      const res = await studentsService.createParentAccount(student.id, {
        email: parentEmail,
        first_name: parentFirstName,
        last_name: parentLastName,
        phone: parentPhone,
        relationship: parentRelationship,
        password: parentPassword || undefined,
      });
      const responseData = (res as any).data || res;
      if (responseData.success !== false) {
        setCreatedCredentials({
          email: parentEmail,
          tempPass: responseData.temporary_password || '(Existing Account Linked)',
        });
        showToast.success('Parent account created & linked successfully!');
      } else {
        showToast.error(responseData.message || 'Failed to create parent account.');
      }
    } catch (err: any) {
      showToast.error(err?.response?.data?.message || err?.message || 'Error creating parent account.');
    } finally {
      setIsCreatingParent(false);
    }
  };

  return (
    <MainLayout>
      <PageShell
        title="Student Profiles"
        subtitle={selectedStudentId ? "Comprehensive 360° student record" : "Search and inspect detailed student profiles"}
        breadcrumbs={
          selectedStudentId
            ? [{ label: 'Profiles' }, { label: student ? `${student.first_name} ${student.last_name}` : 'Details' }]
            : [{ label: 'Profiles' }]
        }
      >
        {/* ── SCREEN 1: DIRECTORY GRID ────────────────────────────────────────── */}
        {!selectedStudentId ? (
          <div className="space-y-6">
            {/* Filters panel */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-150 dark:border-gray-700/50">
              <SearchBar
                placeholder="Search student by name, ID or email..."
                onSearch={(val) => { setSearch(val); setPage(1); }}
                defaultValue={search}
                isLoading={isStudentsLoading}
                resultCount={search ? filteredStudents.length : undefined}
                className="w-full sm:max-w-md"
              />

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="appearance-none pl-3 pr-8 py-2 border border-gray-250 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[140px]"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>

                <div className="relative">
                  <select
                    value={classFilter}
                    onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
                    className="appearance-none pl-3 pr-8 py-2 border border-gray-250 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[150px]"
                  >
                    <option value="">All Classes</option>
                    {classesList.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-sm flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    title="Grid View"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    title="List View"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Profiles Grid / List */}
            {isStudentsLoading ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6' : 'flex flex-col gap-2'}>
                {[...Array(8)].map((_, idx) => <SkeletonCard key={idx} />)}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 shadow-sm">
                <User size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4 animate-bounce" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Student Profiles Found</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">We couldn't find any students matching your search criteria. Try modifying your filters.</p>
              </div>
            ) : (
              <>
                {/* ── GRID VIEW ── */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredStudents.map((s: any) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectStudent(s.id)}
                        className="group flex flex-col items-center p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-900/50 cursor-pointer transition-all duration-300 transform hover:-translate-y-1"
                      >
                        {/* Avatar */}
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-350">
                          {s.photo_url && s.photo_url.length > 10 ? (
                            <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl font-bold text-white uppercase">
                              {s.first_name?.[0]}{s.last_name?.[0]}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="text-center mt-4 w-full">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate px-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {s.first_name} {s.last_name}
                          </h3>
                          <p className="text-xs font-mono font-semibold text-gray-400 dark:text-gray-500 mt-1">
                            ID: {s.student_id}
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                              {s.class_name || 'Unassigned'}
                            </span>
                            <StatusBadge status={s.status} showDot />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── LIST VIEW ── */}
                {viewMode === 'list' && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden">
                    {/* List header */}
                    <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-700/50">
                      <span className="w-9" />
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Student</span>
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest w-28 text-center">Class</span>
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest w-24 text-center">Enrolled</span>
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest w-20 text-center">Status</span>
                    </div>

                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {filteredStudents.map((s: any) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectStudent(s.id)}
                          className="group flex sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-blue-50/40 dark:hover:bg-blue-950/10 cursor-pointer transition-colors"
                        >
                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${
                            s.gender?.toLowerCase() === 'female' ? 'from-pink-400 to-rose-500' :
                            s.gender?.toLowerCase() === 'male' ? 'from-blue-400 to-blue-600' : 'from-gray-400 to-gray-600'
                          }`}>
                            {s.photo_url && s.photo_url.length > 10 ? (
                              <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-white uppercase">{s.first_name?.[0]}{s.last_name?.[0]}</span>
                            )}
                          </div>

                          {/* Name + ID */}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {s.first_name} {s.last_name}
                            </p>
                            <p className="text-[11px] font-mono text-gray-400 dark:text-gray-500">{s.student_id}{s.email ? ` · ${s.email}` : ''}</p>
                          </div>

                          {/* Class */}
                          <div className="w-28 text-center hidden sm:block">
                            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                              {s.class_name || '—'}
                            </span>
                          </div>

                          {/* Enrolled */}
                          <div className="w-24 text-center hidden sm:block">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                            </span>
                          </div>

                          {/* Status */}
                          <div className="w-20 flex justify-center hidden sm:flex">
                            <StatusBadge status={s.status} showDot />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pagination */}
                {pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-150 dark:border-gray-700/50 pt-5 mt-4">
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      className="px-4 py-2 border border-gray-250 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Page {page} of {pagination.total_pages}
                    </span>
                    <button
                      type="button"
                      disabled={page === pagination.total_pages}
                      onClick={() => setPage(p => p + 1)}
                      className="px-4 py-2 border border-gray-250 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* ── SCREEN 2: 360° PROFILE VIEW ─────────────────────────────────────── */
          <div className="space-y-6">
            {/* Header / Actions bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm">
              <Button variant="ghost" size="sm" onClick={handleBackToList} className="group">
                <ChevronLeft size={16} className="mr-1 group-hover:-translate-x-0.5 transition-transform" />
                <span className="hidden xs:inline sm:inline">Back to Profiles</span>
                <span className="xs:hidden sm:hidden">Back</span>
              </Button>
              {canManage && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleOpenParentModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all"
                >
                  <User size={14} />
                  <span className="hidden sm:inline">Create Parent Account</span>
                  <span className="sm:hidden">Parent Account</span>
                </Button>
              )}
            </div>

            {isDetailsLoading || !student ? (
              <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700 animate-pulse space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gray-250 dark:bg-gray-700 rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <div className="h-6 bg-gray-250 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-4 bg-gray-250 dark:bg-gray-700 rounded w-1/4" />
                  </div>
                </div>
                <div className="h-48 bg-gray-250 dark:bg-gray-700 rounded-2xl" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* ── Banner Header ── */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 p-4 sm:p-6 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-indigo-500/5 dark:from-blue-500/5 dark:to-transparent rounded-2xl border border-blue-500/20 shadow-sm relative overflow-hidden backdrop-blur-sm">
                  {/* Decorative mesh */}
                  <div className="absolute right-0 top-0 -mt-6 -mr-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Avatar */}
                  <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-white dark:bg-gray-800 shadow-md overflow-hidden flex items-center justify-center flex-shrink-0 border-2 border-white dark:border-gray-700">
                    {student.photo_url && student.photo_url.length > 10 ? (
                      <img src={student.photo_url} alt={`${student.first_name} ${student.last_name}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 uppercase">
                        {student.first_name?.[0]}{student.last_name?.[0]}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <div>
                      <h2 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                        {student.first_name} {student.last_name}
                      </h2>
                      <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                        {student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'} · Born {formatDate(student.date_of_birth)} ({calculateAge(student.date_of_birth)})
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800/30">
                        <Hash size={11} /> {student.student_id}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800/30">
                        <BookOpen size={11} /> {student.class_name || 'Unassigned'}
                      </span>
                      <StatusBadge status={student.status} showDot />
                    </div>
                  </div>
                </div>

                {/* ── Tab Navigation ── */}
                <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide py-1">
                  {availableTabs.map((tabObj) => (
                    <button
                      key={tabObj.id}
                      onClick={() => setActiveTab(tabObj.id)}
                      className={`whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all duration-200 ${activeTab === tabObj.id
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-750 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                        }`}
                    >
                      {tabObj.label}
                    </button>
                  ))}
                </div>

                {/* ── TAB CONTENT ── */}
                <div className="space-y-6">

                  {/* A. OVERVIEW TAB */}
                  {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 space-y-6">
                        {/* Personal info */}
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-3 mb-4">Personal Details</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <InfoTile icon={<User />} label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : '—'} />
                            <InfoTile icon={<Calendar />} label="Date of Birth" value={formatDate(student.date_of_birth)} />
                            <InfoTile icon={<Calendar />} label="Enrollment Date" value={formatDate(student.enrollment_date)} />
                            <InfoTile icon={<BookOpen />} label="Religion" value={student.religion || '—'} />
                            <InfoTile icon={<Globe />} label="Nationality" value={student.nationality || '—'} />
                            <InfoTile icon={<MapPin />} label="Place of Birth" value={student.place_of_birth || '—'} />
                          </div>
                        </div>

                        {/* Contact info */}
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-3 mb-4">Contact & Address</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InfoTile icon={<Mail />} label="Email" value={student.email || '—'} />
                            <InfoTile icon={<Phone />} label="Phone" value={student.phone || '—'} />
                            <InfoTile icon={<MapPin />} label="Address" value={student.address || '—'} className="sm:col-span-2" />
                            <InfoTile icon={<MapPin />} label="City / Town" value={student.city || '—'} />
                            <InfoTile icon={<Globe />} label="Country" value={student.country || '—'} />
                          </div>
                        </div>
                      </div>

                      {/* Guardian & Additional info */}
                      <div className="space-y-6">
                        {/* Parent / Guardian & Multi-Guardian Tracking */}
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm space-y-4">
                          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Parents & Guardians</h3>
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/40">
                              Multi-Guardian Support
                            </span>
                          </div>

                          <div className="space-y-4">
                            <InfoTile icon={<User />} label="Primary Guardian" value={student.guardian_name || '—'} />
                            <InfoTile icon={<Phone />} label="Primary Contact Phone" value={student.guardian_phone || '—'} />
                            <InfoTile icon={<Heart />} label="Relationship" value={student.guardian_relationship || '—'} />
                            <InfoTile icon={<Shield />} label="Emergency Contact" value={student.emergency_contact || '—'} color="red" />
                          </div>

                          {/* Render Additional Guardians List if Present */}
                          {student.guardians_list && student.guardians_list.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Linked Guardians & Parent Accounts ({student.guardians_list.length})</p>
                              <div className="space-y-2">
                                {student.guardians_list.map((g: any) => (
                                  <div key={g.id} className="p-2.5 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-150 dark:border-gray-700/50 flex items-center justify-between text-xs">
                                    <div>
                                      <p className="font-bold text-gray-900 dark:text-white">{g.first_name} {g.last_name} <span className="text-[10px] font-normal text-gray-400">({g.relationship})</span></p>
                                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{g.email || g.phone_number}</p>
                                    </div>
                                    {g.is_primary_guardian && (
                                      <span className="text-[9px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">Primary</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <button
                              type="button"
                              onClick={handleOpenParentModal}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all shadow-sm"
                            >
                              <User size={14} /> + Add Another Parent / Guardian Account
                            </button>
                          </div>
                        </div>

                        {/* Portal Login Credentials Card */}
                        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl border border-indigo-900/50 shadow-lg space-y-4">
                          <div className="flex items-center justify-between border-b border-indigo-800/50 pb-3">
                            <h3 className="text-xs font-extrabold uppercase tracking-widest text-indigo-300 flex items-center gap-2">
                              <Shield size={16} className="text-indigo-400" /> Portal Login Credentials
                            </h3>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                              Auto-Generated
                            </span>
                          </div>

                          <div className="space-y-3 text-xs">
                            {/* Student Credentials */}
                            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-blue-400">Student Portal Login</span>
                                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">Role: student</span>
                              </div>
                              <p className="text-slate-400 font-mono text-[11px] truncate">
                                Email: <strong className="text-slate-100">{student.demo_login?.student_email || student.email || `${(student.student_id || 'student').toLowerCase()}@student.school.com`}</strong>
                              </p>
                              <p className="text-slate-400 font-mono text-[11px]">
                                Password: <strong className="text-emerald-400">{student.demo_login?.student_password || 'Uses their own password'}</strong>
                              </p>
                            </div>

                            {/* Parent Credentials */}
                            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-purple-400">Parent Portal Login</span>
                                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">Role: parent</span>
                              </div>
                              <p className="text-slate-400 font-mono text-[11px] truncate">
                                Email: <strong className="text-slate-100">{student.demo_login?.parent_email || (student.email || 'Not Created')}</strong>
                              </p>
                              <p className="text-slate-400 font-mono text-[11px]">
                                Password: <strong className="text-purple-300">{student.demo_login?.parent_password || 'Uses their own password'}</strong>
                              </p>
                            </div>
                          </div>

                          {canManage && (
                            <button
                              type="button"
                              onClick={handleOpenParentModal}
                              className="w-full py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center justify-center gap-2 shadow-md"
                            >
                              <User size={14} /> Provision / Link Parent Account
                            </button>
                          )}
                        </div>

                        {/* Medical Conditions */}
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 pb-3 mb-4">Additional Info</h3>
                          <div className="space-y-4">
                            <InfoTile icon={<BookOpen />} label="Previous School" value={student.previous_school || '—'} />
                            <InfoTile icon={<Heart />} label="Medical Conditions" value={student.medical_conditions || 'None Reported'} color={student.medical_conditions ? "red" : "blue"} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* B. ACADEMICS TAB */}
                  {activeTab === 'academics' && (
                    <div className="space-y-6">
                      {/* Academics KPI Overview */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <KPICard title="Subjects Recorded" value={isGradesLoading ? '...' : String(academicStats.count)} icon={<BookOpen size={20} />} color="blue" />
                        <KPICard title="Test 1 Avg" value={isGradesLoading ? '...' : `${academicStats.avgTest1} / 100`} icon={<Clock size={20} />} color="amber" />
                        <KPICard title="Test 2 Avg" value={isGradesLoading ? '...' : `${academicStats.avgTest2} / 100`} icon={<Award size={20} />} color="purple" />
                        <KPICard title="Overall Average (Mean)" value={isGradesLoading ? '...' : `${academicStats.avgMean}%`} icon={<BarChart3 size={20} />} color="green" />
                      </div>

                      {/* Grades Table */}
                      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-150 dark:border-gray-700">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Academic Transcript & Results</h3>
                        </div>
                        {isGradesLoading ? (
                          <div className="p-8 text-center text-gray-400"><Clock className="animate-spin mx-auto mb-2" /> Loading results...</div>
                        ) : grades.length === 0 ? (
                          <div className="p-12 text-center text-gray-400">
                            <Award size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                            No grade records found for this student.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-750 dark:text-gray-350 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                  <th className="p-4">Subject</th>
                                  <th className="p-4">Year</th>
                                  <th className="p-4">Term</th>
                                  <th className="p-4 text-center">Test 1 (100)</th>
                                  <th className="p-4 text-center">Test 2 (100)</th>
                                  <th className="p-4 text-center">Mean (100)</th>
                                  <th className="p-4 text-center">Grade</th>
                                  <th className="p-4">Remark</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                                {grades.map((g: any) => {
                                  const score = g.mean != null ? Number(g.mean) : 0;
                                  const isFail = score < 50;
                                  return (
                                    <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors">
                                      <td className="p-4">
                                        <p className="font-bold text-gray-900 dark:text-white">{g.subject_name}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{g.subject_code}</p>
                                      </td>
                                      <td className="p-4 text-xs font-semibold text-gray-600 dark:text-gray-400">{g.academic_year}</td>
                                      <td className="p-4 text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {g.term === 'first_term' ? 'First Term' : g.term === 'second_term' ? 'Second Term' : 'Third Term'}
                                      </td>
                                      <td className="p-4 text-center font-mono font-medium text-gray-700 dark:text-gray-300">{g.test1 ?? '—'}</td>
                                      <td className="p-4 text-center font-mono font-medium text-gray-700 dark:text-gray-300">{g.test2 ?? '—'}</td>
                                      <td className="p-4 text-center font-mono font-bold">
                                        <span className={`px-2 py-0.5 rounded ${isFail ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 font-bold' : 'text-gray-900 dark:text-white'}`}>
                                          {g.mean != null ? `${score}%` : '—'} {isFail && g.mean != null ? '(Fail)' : ''}
                                        </span>
                                      </td>
                                      <td className="p-4 text-center">
                                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${g.grade_letter === 'A' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
                                            g.grade_letter === 'B' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                                              g.grade_letter === 'C' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400' :
                                                g.grade_letter === 'D' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                                                  'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-300 font-extrabold'
                                          }`}>
                                          {g.grade_letter}
                                        </span>
                                      </td>
                                      <td className="p-4 text-xs font-semibold">
                                        <span className={
                                          g.remark === 'Excellent' ? 'text-green-600 font-bold' :
                                            g.remark === 'Very Good' ? 'text-blue-600 font-bold' :
                                              g.remark === 'Good' ? 'text-cyan-600 font-bold' :
                                                g.remark === 'Satisfying' ? 'text-amber-600 font-bold' : 'text-red-600 dark:text-red-400 font-bold'
                                        }>
                                          {g.remark}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* C. ATTENDANCE TAB */}
                  {activeTab === 'attendance' && (
                    <div className="space-y-6">
                      {/* Attendance KPIs */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <KPICard title="Attendance Rate" value={`${attendanceSummary.attendance_percentage}%`} icon={<Activity size={20} />} color={attendanceSummary.attendance_percentage >= 85 ? "green" : attendanceSummary.attendance_percentage >= 75 ? "amber" : "red"} />
                        <KPICard title="Days Present" value={attendanceSummary.present} icon={<CheckCircle size={20} />} color="green" />
                        <KPICard title="Days Late" value={attendanceSummary.late} icon={<Clock size={20} />} color="amber" />
                        <KPICard title="Days Absent" value={attendanceSummary.absent} icon={<XCircle size={20} />} color="red" />
                      </div>

                      {/* Attendance Logs */}
                      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-150 dark:border-gray-700 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Attendance Sheet</h3>
                          {attendanceSummary.at_risk && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40 rounded-lg text-xs font-bold animate-pulse">
                              <AlertTriangle size={12} /> At Risk of Chronic Absence
                            </span>
                          )}
                        </div>
                        {isAttendanceLoading ? (
                          <div className="p-8 text-center text-gray-400"><Clock className="animate-spin mx-auto mb-2" /> Loading records...</div>
                        ) : attendanceRecords.length === 0 ? (
                          <div className="p-12 text-center text-gray-400">
                            <Activity size={36} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                            No attendance logs found for this student.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-750 dark:text-gray-350 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                  <th className="p-4">Date</th>
                                  <th className="p-4">Status</th>
                                  <th className="p-4">Remarks</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                                {attendanceRecords.map((r: any) => (
                                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors">
                                    <td className="p-4 font-mono font-semibold text-gray-900 dark:text-white">
                                      {formatDate(r.date)}
                                    </td>
                                    <td className="p-4">
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${r.status === 'present' ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400' :
                                          r.status === 'late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' :
                                            r.status === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400' :
                                              'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'present' ? 'bg-green-600' :
                                            r.status === 'late' ? 'bg-amber-500' :
                                              r.status === 'absent' ? 'bg-red-600' : 'bg-blue-500'
                                          }`} />
                                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                                      </span>
                                    </td>
                                    <td className="p-4 text-xs font-medium text-gray-555 dark:text-gray-400">
                                      {r.remarks || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* D. CONDUCT TAB */}
                  {activeTab === 'conduct' && (
                    <div className="space-y-6">
                      {/* Discipline Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <KPICard title="Total Points" value={isDisciplineStatsLoading ? '...' : (disciplineStats?.total_points ?? 0)} icon={<Award size={20} />} color={(disciplineStats?.total_points ?? 0) >= 100 ? "green" : "blue"} />
                        <KPICard title="Active Actions" value={isDisciplineStatsLoading ? '...' : (disciplineStats?.active_actions ?? 0)} icon={<Clock size={20} />} color={(disciplineStats?.active_actions ?? 0) > 0 ? "red" : "green"} />
                        <KPICard title="Incidents" value={isDisciplineStatsLoading ? '...' : (disciplineStats?.total_infractions ?? 0)} icon={<AlertTriangle size={20} />} color={(disciplineStats?.total_infractions ?? 0) > 0 ? "red" : "green"} />
                        <KPICard title="Risk Level" value={isDisciplineStatsLoading ? '...' : (disciplineStats?.risk_level ? disciplineStats.risk_level.toUpperCase() : 'LOW')} icon={<Activity size={20} />} color={disciplineStats?.risk_level === 'critical' || disciplineStats?.risk_level === 'high' ? "red" : disciplineStats?.risk_level === 'medium' ? "amber" : "green"} />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Infractions Table */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm overflow-hidden">
                          <div className="p-5 border-b border-gray-150 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Behavior Incidents</h3>
                          </div>
                          {infractions.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                              <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                              No infractions or incidents logged.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-750 dark:text-gray-350 text-xs font-bold uppercase tracking-wider">
                                  <tr>
                                    <th className="p-4">Incident</th>
                                    <th className="p-4">Severity</th>
                                    <th className="p-4">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                                  {infractions.map((i: any) => (
                                    <tr key={i.infraction_id} className="hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors">
                                      <td className="p-4">
                                        <p className="font-bold text-gray-900 dark:text-white">{i.infraction_type_name}</p>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{i.incident_description}</p>
                                      </td>
                                      <td className="p-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${i.severity_level === 'critical' ? 'bg-red-200 text-red-900 border border-red-300' :
                                            i.severity_level === 'serious' ? 'bg-red-100 text-red-800 border border-red-250' :
                                              i.severity_level === 'moderate' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                                'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                          }`}>
                                          {i.severity_level.toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="p-4 text-xs font-semibold text-gray-600 dark:text-gray-400 font-mono">
                                        {formatDate(i.incident_date)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Disciplinary Actions Table */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm overflow-hidden">
                          <div className="p-5 border-b border-gray-150 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Corrective & Disciplinary Actions</h3>
                          </div>
                          {actions.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                              <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                              No active corrective actions assigned.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-750 dark:text-gray-350 text-xs font-bold uppercase tracking-wider">
                                  <tr>
                                    <th className="p-4">Action</th>
                                    <th className="p-4">Assigned On</th>
                                    <th className="p-4">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                                  {actions.map((a: any) => (
                                    <tr key={a.action_id} className="hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors">
                                      <td className="p-4">
                                        <p className="font-bold text-gray-900 dark:text-white">{a.action_type.toUpperCase()}</p>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{a.action_description}</p>
                                      </td>
                                      <td className="p-4 text-xs font-semibold text-gray-600 dark:text-gray-400 font-mono">
                                        {formatDate(a.action_date)}
                                      </td>
                                      <td className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${a.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400' :
                                            a.status === 'active' ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400' :
                                              'bg-gray-100 text-gray-800 dark:bg-gray-950/30 dark:text-gray-400'
                                          }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'completed' ? 'bg-green-600' :
                                              a.status === 'active' ? 'bg-red-600' : 'bg-gray-500'
                                            }`} />
                                          {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* E. BILLING TAB */}
                  {activeTab === 'billing' && (
                    <div className="space-y-6">
                      {/* Financial KPI stats */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <KPICard title="Outstanding Balance" value={`SLE ${outstandingBalance}`} icon={<DollarSign size={20} />} color={outstandingBalance > 0 ? "red" : "green"} />
                        <KPICard title="Paid Fees" value={isFeesLoading ? '...' : (fees.filter((f: any) => f.status === 'paid').length)} icon={<CheckCircle size={20} />} color="green" />
                        <KPICard title="Unpaid Invoices" value={isFeesLoading ? '...' : (invoices.filter((i: any) => i.status === 'unpaid' || i.status === 'partially_paid').length)} icon={<Receipt size={20} />} color={invoices.some((i: any) => i.status === 'unpaid') ? "amber" : "blue"} />
                      </div>

                      {/* Invoices */}
                      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-150 dark:border-gray-700">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Invoices</h3>
                        </div>
                        {invoices.length === 0 ? (
                          <div className="p-8 text-center text-gray-400">
                            <Receipt size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                            No invoices logged for this student.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-750 dark:text-gray-350 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                  <th className="p-4">Invoice #</th>
                                  <th className="p-4">Due Date</th>
                                  <th className="p-4 text-right">Invoice Amount</th>
                                  <th className="p-4 text-right">Paid Amount</th>
                                  <th className="p-4 text-right">Remaining Balance</th>
                                  <th className="p-4">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                                {invoices.map((inv: any) => (
                                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors">
                                    <td className="p-4 font-mono font-bold text-gray-900 dark:text-white">{inv.invoice_number}</td>
                                    <td className="p-4 font-semibold text-gray-650 dark:text-gray-400 text-xs font-mono">{formatDate(inv.due_date)}</td>
                                    <td className="p-4 text-right font-mono text-gray-700 dark:text-gray-300 font-bold">SLE {Number(inv.amount).toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono text-green-600 dark:text-green-400">SLE {Number(inv.paid_amount).toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono font-bold text-gray-900 dark:text-white">SLE {Number(inv.amount - inv.paid_amount).toFixed(2)}</td>
                                    <td className="p-4">
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${inv.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400' :
                                          inv.status === 'partially_paid' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400' :
                                            'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${inv.status === 'paid' ? 'bg-green-600' :
                                            inv.status === 'partially_paid' ? 'bg-amber-500' : 'bg-red-600'
                                          }`} />
                                        {inv.status === 'paid' ? 'Paid' : inv.status === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Payment History */}
                      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700/50 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-150 dark:border-gray-700">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">Payment Receipts & History</h3>
                        </div>
                        {payments.length === 0 ? (
                          <div className="p-8 text-center text-gray-400">
                            <Receipt size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                            No payments processed.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-750 dark:text-gray-350 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                  <th className="p-4">Date</th>
                                  <th className="p-4">Payment Method</th>
                                  <th className="p-4">Reference</th>
                                  <th className="p-4 text-right">Amount Paid</th>
                                  <th className="p-4">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-150 dark:divide-gray-700">
                                {payments.map((p: any) => (
                                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors">
                                    <td className="p-4 font-mono font-semibold text-gray-650 dark:text-gray-400 text-xs">{formatDate(p.payment_date)}</td>
                                    <td className="p-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">{p.method}</td>
                                    <td className="p-4 font-mono text-xs text-gray-600 dark:text-gray-400">{p.reference || '—'}</td>
                                    <td className="p-4 text-right font-mono font-bold text-green-600 dark:text-green-400">SLE {Number(p.amount).toFixed(2)}</td>
                                    <td className="p-4 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{p.notes || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CREATE PARENT ACCOUNT MODAL ── */}
        {parentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-150 dark:border-gray-750 relative space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-750 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create Parent Portal Account</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Link parent credentials to {student?.first_name} {student?.last_name}</p>
                </div>
                <button
                  onClick={() => setParentModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {createdCredentials ? (
                <div className="space-y-4 py-2">
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-sm">
                      <CheckCircle size={18} /> Account Ready!
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Parent can now log in using the following details:
                    </p>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 font-mono text-xs space-y-2">
                      <p><span className="text-gray-400">Email:</span> <strong className="text-gray-900 dark:text-white">{createdCredentials.email}</strong></p>
                      <div className="flex items-center justify-between">
                        <p><span className="text-gray-400">Temporary Password:</span> <strong className="text-blue-600 dark:text-blue-400 font-bold ml-1">{showModalPassword ? createdCredentials.tempPass : '••••••••'}</strong></p>
                        <button
                          type="button"
                          onClick={() => setShowModalPassword(!showModalPassword)}
                          className="text-[11px] text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 font-sans"
                        >
                          {showModalPassword ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Show</>}
                        </button>
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => setParentModalOpen(false)} className="w-full">
                    Done
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleCreateParentAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Parent Email *</label>
                    <input
                      type="email"
                      required
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      placeholder="parent@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">First Name</label>
                      <input
                        type="text"
                        value={parentFirstName}
                        onChange={(e) => setParentFirstName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Last Name</label>
                      <input
                        type="text"
                        value={parentLastName}
                        onChange={(e) => setParentLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={parentPhone}
                        onChange={(e) => setParentPhone(e.target.value)}
                        placeholder="+232..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Relationship</label>
                      <input
                        type="text"
                        value={parentRelationship}
                        onChange={(e) => setParentRelationship(e.target.value)}
                        placeholder="Father, Mother..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">Custom Password (Optional)</label>
                    <input
                      type="password"
                      value={parentPassword}
                      onChange={(e) => setParentPassword(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-gray-750">
                    <Button type="button" variant="outline" onClick={() => setParentModalOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreatingParent} className="flex-1">
                      {isCreatingParent ? 'Creating...' : 'Create Account'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

// ── Overview Tab Info Tile component ──
const InfoTile: React.FC<{ icon: React.ReactNode; label: string; value: string; color?: 'blue' | 'red'; className?: string }> = ({
  icon, label, value, color = 'blue', className = '',
}) => {
  const iconBg = color === 'red'
    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';

  return (
    <div className={`flex items-start gap-3.5 p-3.5 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-150 dark:border-gray-700/50 ${className}`}>
      <div className={`p-2 rounded-lg flex-shrink-0 ${iconBg}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 16 })}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-extrabold">{label}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1 break-words leading-snug">{value}</p>
      </div>
    </div>
  );
};

export default StudentProfilesPage;
