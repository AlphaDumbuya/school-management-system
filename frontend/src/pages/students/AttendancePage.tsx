/**
 * AttendancePage — /students/attendance
 * Fully functional attendance management with:
 *  • Attendance Logs tab  – filterable, searchable log table with edit
 *  • Class Register tab   – select class/date, mark all students in real-time
 *  • Analytics tab        – at-risk students, class summaries, presence rates
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  BookOpen,
  Edit3,
  Loader2,
  RefreshCw,
  AlertTriangle,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Users,
  TrendingDown,
  ClipboardList,
  X,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { attendanceService, AttendanceRecord, SessionType, AttendanceStatus } from '@services/attendanceService';
import { classesService } from '@services/classesService';
import { studentsService, StudentRecord } from '@services/studentsService';
import { SearchBar } from '@components/admin/table/SearchBar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'present':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'late':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'absent':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'excused':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getDotColor(status: string): string {
  switch (status) {
    case 'present':  return 'bg-emerald-500';
    case 'late':     return 'bg-amber-500';
    case 'absent':   return 'bg-red-500';
    case 'excused':  return 'bg-sky-500';
    default:         return 'bg-gray-400';
  }
}

type ActiveTab = 'logs' | 'register' | 'analytics';

// ── Session Options ───────────────────────────────────────────────────────────

const SESSION_OPTIONS: { value: SessionType; label: string; description: string; color: string }[] = [
  { value: 'morning', label: 'Morning Check-in', description: 'School start attendance', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'afternoon', label: 'Afternoon Check-out', description: 'End of day attendance', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'full_day', label: 'Full Day', description: 'Complete day attendance', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
];

// ── Status Toggle Button Group ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; short: string }[] = [
  { value: 'present', label: 'Present', short: 'P' },
  { value: 'late',    label: 'Late',    short: 'L' },
  { value: 'absent',  label: 'Absent',  short: 'A' },
  { value: 'excused', label: 'Excused', short: 'E' },
];

const STATUS_ACTIVE: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300',
  late:    'bg-amber-500  text-white shadow-md ring-2 ring-amber-300',
  absent:  'bg-red-600    text-white shadow-md ring-2 ring-red-300',
  excused: 'bg-sky-600    text-white shadow-md ring-2 ring-sky-300',
};

// ── Main Component ────────────────────────────────────────────────────────────

export const AttendancePage: React.FC = () => {
  const queryClient = useQueryClient();

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('logs');

  // ── Log tab state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // ── Edit modal state ──────────────────────────────────────────────────────
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editRemarks, setEditRemarks] = useState('');

  // ── Register tab state ────────────────────────────────────────────────────
  const [regClassId, setRegClassId] = useState('');
  const [regDate, setRegDate] = useState(new Date().toISOString().split('T')[0]);
  const [regSession, setRegSession] = useState<SessionType>('morning');
  const [markRecords, setMarkRecords] = useState<
    Record<string, { status: AttendanceStatus | undefined; remarks: string; check_in_time?: string; check_out_time?: string }>
  >({});
  const [loadedKey, setLoadedKey] = useState('');
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [isAllStudentsMode, setIsAllStudentsMode] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

  // 1. Attendance log
  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['att-logs', { search, classFilter, statusFilter, dateFilter, page }],
    queryFn: () =>
      attendanceService.listAttendance({
        page,
        limit: PAGE_SIZE,
        classId: classFilter || undefined,
        status: statusFilter || undefined,
        date: dateFilter || undefined,
        search: search || undefined,
      }),
    staleTime: 30_000,
  });

  const logs = (logsData as any)?.data ?? [];
  const pagination = (logsData as any)?.pagination ?? { total: 0, total_pages: 1 };

  // 2. Classes list
  const { data: classesData } = useQuery({
    queryKey: ['att-classes'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 120_000,
  });
  const classes = (classesData as any)?.data ?? [];

  // 3. Register: students in class OR all students
  const { data: classStudentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['reg-students', regClassId],
    queryFn: () => classesService.getClassStudents(regClassId),
    enabled: !!regClassId && activeTab === 'register' && !isAllStudentsMode,
    staleTime: 60_000,
  });
  const classStudents = (classStudentsData as any)?.students ?? [];

  // 3b. All enrolled students
  const { data: allStudentsData, isLoading: allStudentsLoading } = useQuery({
    queryKey: ['all-students'],
    queryFn: () => studentsService.listStudents({ limit: 1000, status: 'active' }),
    enabled: isAllStudentsMode && activeTab === 'register',
    staleTime: 60_000,
  });
  const allStudents = (allStudentsData as any)?.data ?? [];

  // 4. Register: existing attendance for selected class/date/session OR all students/date/session
  const { data: existingAttData, isLoading: existingLoading } = useQuery({
    queryKey: ['reg-existing', regClassId, regDate, regSession, isAllStudentsMode],
    queryFn: async () => {
      console.log('📡 Fetching existing attendance:', {
        isAllStudentsMode,
        regClassId,
        regDate,
        regSession,
      });
      
      let result;
      if (isAllStudentsMode) {
        // For all students, we need to fetch attendance records by date and session across all classes
        result = await attendanceService.listAttendance({
          date: regDate,
          session_type: regSession,
          limit: 1000,
        });
      } else {
        // For specific class
        result = await attendanceService.getClassAttendanceSummary(regClassId, regDate, regSession);
      }
      
      console.log('📥 Fetched attendance data:', result);
      return result;
    },
    enabled: ((!!regClassId && !isAllStudentsMode) || isAllStudentsMode) && !!regDate && activeTab === 'register',
    staleTime: 0, // Changed to 0 to always fetch fresh data
    refetchOnMount: 'always', // Always refetch when component mounts
  });
  
  const existingRecords: any[] = isAllStudentsMode 
    ? (existingAttData as any)?.data ?? []
    : (existingAttData as any)?.attendance_records ?? [];

  // 5. Analytics: all logs (no pagination for stats)
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['att-analytics', classFilter],
    queryFn: () =>
      attendanceService.listAttendance({
        limit: 1000,
        classId: classFilter || undefined,
      }),
    enabled: activeTab === 'analytics',
    staleTime: 60_000,
  });
  const analyticsLogs = (analyticsData as any)?.data ?? [];

  // ── Merge: initialize markRecords when class/date/session/students change ──
  React.useEffect(() => {
    const key = `${regClassId}:${regDate}:${regSession}:${isAllStudentsMode}`;
    const currentStudents = isAllStudentsMode ? allStudents : classStudents;
    const isLoadingStudents = isAllStudentsMode ? allStudentsLoading : studentsLoading;
    
    // Debug logging
    console.log('🔍 Attendance Load Debug:', {
      key,
      loadedKey,
      regClassId,
      regDate,
      regSession,
      isAllStudentsMode,
      studentsCount: currentStudents.length,
      existingRecordsCount: existingRecords.length,
      isLoadingStudents,
      existingLoading,
      existingRecords: existingRecords.slice(0, 3), // Show first 3 records
    });
    
    if (
      key !== loadedKey &&
      !isLoadingStudents &&
      !existingLoading &&
      currentStudents.length > 0
    ) {
      console.log('✅ Merging attendance data...');
      const merged: typeof markRecords = {};
      currentStudents.forEach((st: any) => {
        const existing = existingRecords.find(
          (r: any) => String(r.student_id) === String(st.id) && r.session_type === regSession
        );
        
        if (existing) {
          console.log(`  ✓ Found existing attendance for student ${st.id}:`, existing);
        }
        
        merged[st.id] = {
          status: existing?.status ?? undefined,
          remarks: existing?.remarks ?? '',
          check_in_time: existing?.check_in_time ?? undefined,
          check_out_time: existing?.check_out_time ?? undefined,
        };
      });
      console.log('📊 Merged records:', Object.keys(merged).length, 'students');
      console.log('📋 Sample merged data:', Object.entries(merged).slice(0, 2));
      setMarkRecords(merged);
      setLoadedKey(key);
    } else {
      console.log('⏭️  Skipping merge - conditions not met');
    }
  }, [classStudents, allStudents, existingRecords, studentsLoading, allStudentsLoading, existingLoading, regClassId, regDate, regSession, loadedKey, isAllStudentsMode]);

  // ── Stats (logs tab KPIs) ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!logs.length) return { rate: 0, present: 0, late: 0, absent: 0, excused: 0 };
    const p = logs.filter((l: any) => l.status === 'present').length;
    const la = logs.filter((l: any) => l.status === 'late').length;
    const ab = logs.filter((l: any) => l.status === 'absent').length;
    const ex = logs.filter((l: any) => l.status === 'excused').length;
    return {
      rate: Math.round(((p + la) / logs.length) * 100),
      present: p,
      late: la,
      absent: ab,
      excused: ex,
    };
  }, [logs]);

  // ── Analytics computations ────────────────────────────────────────────────
  const analyticsStats = useMemo(() => {
    if (!analyticsLogs.length) return null;
    const total = analyticsLogs.length;
    const present = analyticsLogs.filter((l: any) => l.status === 'present').length;
    const late = analyticsLogs.filter((l: any) => l.status === 'late').length;
    const absent = analyticsLogs.filter((l: any) => l.status === 'absent').length;
    const excused = analyticsLogs.filter((l: any) => l.status === 'excused').length;

    // Per-student rate
    const byStudent: Record<string, { name: string; p: number; total: number }> = {};
    analyticsLogs.forEach((l: any) => {
      const sid = l.student_id_code || l.student_id;
      if (!byStudent[sid]) byStudent[sid] = { name: l.student_name || sid, p: 0, total: 0 };
      byStudent[sid].total++;
      if (l.status === 'present' || l.status === 'late') byStudent[sid].p++;
    });

    const atRisk = Object.values(byStudent)
      .map((s) => ({ ...s, rate: Math.round((s.p / s.total) * 100) }))
      .filter((s) => s.rate < 75)
      .sort((a, b) => a.rate - b.rate);

    // Per-class rate
    const byClass: Record<string, { name: string; p: number; total: number }> = {};
    analyticsLogs.forEach((l: any) => {
      const cn = l.class_name || 'Unknown';
      if (!byClass[cn]) byClass[cn] = { name: cn, p: 0, total: 0 };
      byClass[cn].total++;
      if (l.status === 'present' || l.status === 'late') byClass[cn].p++;
    });

    const classRates = Object.values(byClass)
      .map((c) => ({ ...c, rate: Math.round((c.p / c.total) * 100) }))
      .sort((a, b) => b.rate - a.rate);

    return {
      total,
      present,
      late,
      absent,
      excused,
      rate: Math.round(((present + late) / total) * 100),
      atRisk,
      classRates,
    };
  }, [analyticsLogs]);

  // ── Register tab: mark single student immediately ─────────────────────────
  const saveSingleMutation = useMutation({
    mutationFn: ({ studentId, status, remarks, autoTime = true }: { 
      studentId: string; 
      status: AttendanceStatus; 
      remarks?: string;
      autoTime?: boolean;
    }) => {
      console.log('💾 Saving attendance for student:', studentId, 'Status:', status);
      setSavingIds((p) => ({ ...p, [studentId]: true }));
      
      // Auto-set current time based on session and status
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      
      let check_in_time: string | undefined = undefined;
      let check_out_time: string | undefined = undefined;
      
      if (autoTime && status === 'present') {
        if (regSession === 'morning') {
          check_in_time = currentTime;
        } else if (regSession === 'afternoon') {
          check_out_time = currentTime;
        } else if (regSession === 'full_day') {
          check_in_time = currentTime;
        }
      }
      
      const record = {
        student_id: studentId,
        status,
        session_type: regSession,
        check_in_time,
        check_out_time,
        remarks,
      };
      
      const payload = {
        class_id: isAllStudentsMode ? undefined : regClassId,
        date: regDate,
        session_type: regSession,
        records: [record],
      };
      
      console.log('📤 Sending bulk attendance payload:', payload);
      
      // For all students mode, we need to use general attendance API
      if (isAllStudentsMode) {
        return attendanceService.submitBulkAttendance({
          date: regDate,
          session_type: regSession,
          records: [record],
        });
      } else {
        // For specific class
        return attendanceService.submitBulkAttendance({
          class_id: regClassId,
          date: regDate,
          session_type: regSession,
          records: [record],
        });
      }
    },
    onSuccess: (_data, vars) => {
      console.log('✅ Save successful for student:', vars.studentId);
      queryClient.invalidateQueries({ queryKey: ['att-logs'] });
      queryClient.invalidateQueries({ queryKey: ['reg-existing', regClassId, regDate, regSession, isAllStudentsMode] });
      setSavingIds((p) => { const n = { ...p }; delete n[vars.studentId]; return n; });
    },
    onError: (error, vars) => {
      console.error('❌ Save failed for student:', vars.studentId, 'Error:', error);
      showToast.error('Failed to save attendance');
      setSavingIds((p) => { const n = { ...p }; delete n[vars.studentId]; return n; });
    },
  });

  const handleStatusToggle = useCallback(
    (studentId: string, status: AttendanceStatus) => {
      setMarkRecords((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
      const remarks = markRecords[studentId]?.remarks;
      saveSingleMutation.mutate({ studentId, status, remarks: remarks || undefined });
    },
    [markRecords, saveSingleMutation]
  );

  const handleRemarksBlur = useCallback(
    (studentId: string, remarks: string) => {
      const current = markRecords[studentId];
      if (!current) return;
      const status = current.status || 'present';
      if (!current.status) {
        setMarkRecords((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status: 'present' } }));
      }
      saveSingleMutation.mutate({ studentId, status, remarks, autoTime: !current.status });
    },
    [markRecords, saveSingleMutation]
  );

  // ── Register tab: mark all present ───────────────────────────────────────
  const markAllPresentMutation = useMutation({
    mutationFn: () => {
      const currentStudents = isAllStudentsMode ? allStudents : classStudents;
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      
      const records = currentStudents.map((st: any) => {
        let check_in_time: string | undefined = undefined;
        let check_out_time: string | undefined = undefined;
        
        if (regSession === 'morning') {
          check_in_time = currentTime;
        } else if (regSession === 'afternoon') {
          check_out_time = currentTime;
        } else if (regSession === 'full_day') {
          check_in_time = currentTime;
        }
        
        return {
          student_id: st.id,
          status: 'present' as AttendanceStatus,
          session_type: regSession,
          check_in_time,
          check_out_time,
          remarks: markRecords[st.id]?.remarks || undefined,
        };
      });

      if (isAllStudentsMode) {
        return attendanceService.submitBulkAttendance({
          date: regDate,
          session_type: regSession,
          records,
        });
      } else {
        return attendanceService.submitBulkAttendance({
          class_id: regClassId,
          date: regDate,
          session_type: regSession,
          records,
        });
      }
    },
    onSuccess: () => {
      const currentStudents = isAllStudentsMode ? allStudents : classStudents;
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      
      const updated: typeof markRecords = {};
      currentStudents.forEach((st: any) => {
        let check_in_time: string | undefined = undefined;
        let check_out_time: string | undefined = undefined;
        
        if (regSession === 'morning') {
          check_in_time = currentTime;
        } else if (regSession === 'afternoon') {
          check_out_time = currentTime;
        } else if (regSession === 'full_day') {
          check_in_time = currentTime;
        }
        
        updated[st.id] = { 
          status: 'present', 
          remarks: markRecords[st.id]?.remarks || '',
          check_in_time,
          check_out_time,
        };
      });
      setMarkRecords(updated);
      queryClient.invalidateQueries({ queryKey: ['att-logs'] });
      queryClient.invalidateQueries({ queryKey: ['reg-existing', regClassId, regDate, regSession, isAllStudentsMode] });
      showToast.success('All students marked present!');
    },
    onError: () => showToast.error('Failed to mark all present'),
  });

  // ── Edit mutation ─────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      attendanceService.updateAttendance(id, data),
    onSuccess: () => {
      showToast.success('Record updated');
      queryClient.invalidateQueries({ queryKey: ['att-logs'] });
      setEditRecord(null);
    },
    onError: () => showToast.error('Failed to update record'),
  });

  // ── Register progress bar ─────────────────────────────────────────────────
  const currentStudents = isAllStudentsMode ? allStudents : classStudents;
  const markedCount = useMemo(
    () => Object.values(markRecords).filter((r) => r.status !== undefined).length,
    [markRecords]
  );
  const regProgress = currentStudents.length > 0
    ? Math.round((markedCount / currentStudents.length) * 100)
    : 0;

  // ── Tab definitions ───────────────────────────────────────────────────────
  const TABS = [
    { id: 'logs',      label: 'Attendance Logs',  icon: <ClipboardList size={16} /> },
    { id: 'register',  label: 'Class Register',    icon: <UserCheck size={16} /> },
    { id: 'analytics', label: 'Analytics',         icon: <BarChart2 size={16} /> },
  ] as const;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageShell
        title="Student Attendance"
        subtitle="Track, record and analyse daily class attendance"
        breadcrumbs={[{ label: 'Students' }, { label: 'Attendance' }]}
      >
        <div className="space-y-6">

          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full overflow-x-auto scrollbar-none whitespace-nowrap sm:w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="inline sm:hidden">
                  {tab.id === 'logs' ? 'Logs' : tab.id === 'register' ? 'Register' : 'Analytics'}
                </span>
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: LOGS                                                   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'logs' && (
            <div className="space-y-5">

              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <KPICard
                  title="Attendance Rate"
                  value={logsLoading ? '…' : `${stats.rate}%`}
                  icon={<RefreshCw size={20} />}
                  color={stats.rate >= 85 ? 'green' : stats.rate >= 75 ? 'amber' : 'red'}
                  subtitle="(current filters)"
                />
                <KPICard
                  title="Present"
                  value={logsLoading ? '…' : stats.present}
                  icon={<CheckCircle size={20} />}
                  color="green"
                />
                <KPICard
                  title="Late"
                  value={logsLoading ? '…' : stats.late}
                  icon={<Clock size={20} />}
                  color="amber"
                />
                <KPICard
                  title="Absent"
                  value={logsLoading ? '…' : stats.absent}
                  icon={<XCircle size={20} />}
                  color="red"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm w-full">
                {/* Search */}
                <SearchBar
                  onSearch={(val) => { setSearch(val); setPage(1); }}
                  placeholder="Search student name or ID…"
                  defaultValue={search}
                  isLoading={logsLoading}
                  className="w-full sm:max-w-xs"
                />
                  {/* Date */}
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px] sm:min-w-[160px]"
                  />
                  {/* Class */}
                  <select
                    value={classFilter}
                    onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px] sm:min-w-[150px]"
                  >
                    <option value="">All Classes</option>
                    {classes.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {/* Status */}
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px] sm:min-w-[140px]"
                  >
                    <option value="">All Statuses</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>

                  {/* Clear */}
                  {(search || classFilter || statusFilter || dateFilter) && (
                    <button
                      onClick={() => { setSearch(''); setClassFilter(''); setStatusFilter(''); setDateFilter(''); setPage(1); }}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <X size={12} /> Clear
                    </button>
                  )}

                  <button
                    onClick={() => refetchLogs()}
                    className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={16} className={logsLoading ? 'animate-spin' : ''} />
                  </button>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {logsLoading ? (
                  <div className="p-20 text-center">
                    <Loader2 size={36} className="animate-spin mx-auto mb-3 text-blue-500" />
                    <p className="text-sm text-gray-400">Loading attendance logs…</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="p-20 text-center">
                    <Calendar size={52} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-1">No Records Found</h3>
                    <p className="text-sm text-gray-400 max-w-xs mx-auto">
                      No attendance records match your filters. Try adjusting the date, class or status, or switch to the Class Register tab to mark attendance.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Student</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Class</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Remarks</th>
                          <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-right">Edit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {logs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-gray-900 dark:text-white">{log.student_name || '—'}</p>
                              <p className="text-[11px] text-gray-400 font-mono mt-0.5">{log.student_id_code || '—'}</p>
                            </td>
                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300 font-medium">{log.class_name || '—'}</td>
                            <td className="px-5 py-3.5 text-[11px] font-mono text-gray-500 dark:text-gray-400">{fmt(log.date)}</td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(log.status)}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(log.status)}`} />
                                {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400 max-w-[180px] truncate">
                              {log.remarks || <span className="text-gray-300 dark:text-gray-600">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => {
                                  setEditRecord(log);
                                  setEditStatus(log.status);
                                  setEditRemarks(log.remarks || '');
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"
                                title="Edit record"
                              >
                                <Edit3 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {!logsLoading && pagination.total_pages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {pagination.total} records · Page {page} of {pagination.total_pages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <button
                      disabled={page === pagination.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 2: CLASS REGISTER                                         */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'register' && (
            <div className="space-y-5">

              {/* Controls */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Select Class, Date &amp; Session</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Class / Stream</label>
                    <select
                      value={isAllStudentsMode ? 'all-students' : regClassId}
                      onChange={(e) => { 
                        if (e.target.value === 'all-students') {
                          setIsAllStudentsMode(true);
                          setRegClassId('');
                        } else {
                          setIsAllStudentsMode(false);
                          setRegClassId(e.target.value);
                        }
                        setLoadedKey(''); 
                      }}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Select a class —</option>
                      <option value="all-students" className="font-semibold text-cyan-600">🌐 All Enrolled Students</option>
                      <optgroup label="Classes">
                        {classes.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Date</label>
                    <input
                      type="date"
                      value={regDate}
                      onChange={(e) => { setRegDate(e.target.value); setLoadedKey(''); }}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Session</label>
                    <select
                      value={regSession}
                      onChange={(e) => { setRegSession(e.target.value as SessionType); setLoadedKey(''); }}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {SESSION_OPTIONS.map((session) => (
                        <option key={session.value} value={session.value}>
                          {session.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Session Info */}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-bold ${SESSION_OPTIONS.find(s => s.value === regSession)?.color}`}>
                      {SESSION_OPTIONS.find(s => s.value === regSession)?.label}
                    </div>
                    {regSession === 'morning' && <span className="text-xs text-gray-500">📅 Auto-tracks arrival time</span>}
                    {regSession === 'afternoon' && <span className="text-xs text-gray-500">🏠 Auto-tracks departure time</span>}
                    {regSession === 'full_day' && <span className="text-xs text-gray-500">📋 Full day attendance</span>}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {SESSION_OPTIONS.find(s => s.value === regSession)?.description}
                  </p>
                </div>
                
                {isAllStudentsMode && (
                  <div className="mt-4 p-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                      <p className="text-sm font-semibold text-cyan-800 dark:text-cyan-300">All Students Mode</p>
                    </div>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                      Viewing all enrolled students across all classes. Attendance will be saved with session tracking.
                    </p>
                  </div>
                )}
              </div>

              {/* Roll call sheet */}
              {(regClassId || isAllStudentsMode) && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

                  {/* Sheet header */}
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {isAllStudentsMode ? (
                          <>
                            Roll Call Sheet
                            <span className="ml-2 text-cyan-600 dark:text-cyan-400">All Students ({currentStudents.length})</span>
                          </>
                        ) : (
                          <>
                            Roll Call Sheet
                            {(classStudentsData as any)?.class_name && (
                              <span className="ml-2 text-blue-600 dark:text-blue-400">{(classStudentsData as any).class_name}</span>
                            )}
                          </>
                        )}
                        <span className={`ml-3 px-2 py-1 rounded-full text-xs font-bold ${SESSION_OPTIONS.find(s => s.value === regSession)?.color}`}>
                          {SESSION_OPTIONS.find(s => s.value === regSession)?.label}
                        </span>
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Changes save automatically with timestamps · {markedCount}/{currentStudents.length} marked
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={markAllPresentMutation.isPending || currentStudents.length === 0}
                        onClick={() => markAllPresentMutation.mutate()}
                        className="text-xs font-bold h-8 px-3 flex items-center gap-1.5 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      >
                        {markAllPresentMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Mark All Present
                      </Button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {currentStudents.length > 0 && (
                    <div className="px-5 py-2 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${regProgress}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums">
                          {regProgress}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Student Grid - Modern Online Meeting Style */}
                  {(studentsLoading || allStudentsLoading) || existingLoading ? (
                    <div className="p-16 text-center">
                      <Loader2 size={32} className="animate-spin mx-auto mb-3 text-blue-500" />
                      <p className="text-sm text-gray-400">Loading {isAllStudentsMode ? 'all students' : 'class roster'}…</p>
                    </div>
                  ) : currentStudents.length === 0 ? (
                    <div className="p-16 text-center">
                      <Users size={44} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                      <h3 className="font-semibold text-gray-700 dark:text-white">
                        {isAllStudentsMode ? 'No enrolled students' : 'No students enrolled'}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {isAllStudentsMode 
                          ? 'There are no active students in the system.' 
                          : 'This class has no students assigned.'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {currentStudents.map((st: any, idx: number) => {
                          const rec = markRecords[st.id] || { status: undefined, remarks: '' };
                          const isSaving = !!savingIds[st.id];
                          
                          // Get status indicator styles
                          const getCardStyle = (status?: AttendanceStatus) => {
                            switch (status) {
                              case 'present':
                                return 'ring-2 ring-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700';
                              case 'late':
                                return 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
                              case 'absent':
                                return 'ring-2 ring-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';
                              case 'excused':
                                return 'ring-2 ring-sky-400 bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700';
                              default:
                                return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600';
                            }
                          };

                          const getAvatarStyle = (status?: AttendanceStatus) => {
                            switch (status) {
                              case 'present':
                                return 'bg-emerald-500 text-white';
                              case 'late':
                                return 'bg-amber-500 text-white';
                              case 'absent':
                                return 'bg-red-500 text-white';
                              case 'excused':
                                return 'bg-sky-500 text-white';
                              default:
                                return 'bg-gray-400 text-white';
                            }
                          };

                          // Helper to display student ID (show student_id from StudentRecord for all students mode)
                          const displayId = isAllStudentsMode 
                            ? st.student_id || st.id
                            : (st.roll_number ? `#${st.roll_number}` : st.student_id || st.id);

                          return (
                            <div
                              key={st.id}
                              className={`relative rounded-2xl border-2 p-4 transition-all duration-200 hover:shadow-lg ${getCardStyle(rec.status)}`}
                            >
                              {/* Status indicator dot */}
                              <div className="absolute -top-2 -right-2">
                                {isSaving ? (
                                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Loader2 size={12} className="animate-spin text-white" />
                                  </div>
                                ) : rec.status ? (
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getDotColor(rec.status)} shadow-lg`}>
                                    <CheckCircle size={12} className="text-white" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                                    <Clock size={12} className="text-gray-600 dark:text-gray-400" />
                                  </div>
                                )}
                              </div>

                              {/* Student avatar with profile photo or initials */}
                              <div className="flex flex-col items-center space-y-3">
                                <div className="relative w-16 h-16 rounded-full shadow-lg overflow-hidden">
                                  {st.photo_url && st.photo_url.trim() ? (
                                    <>
                                      <img 
                                        src={st.photo_url.trim()} 
                                        alt={`${st.first_name} ${st.last_name}`}
                                        className="w-full h-full object-cover transition-opacity duration-200"
                                        loading="lazy"
                                        onLoad={(e) => {
                                          // Image loaded successfully, make sure fallback is hidden
                                          const target = e.target as HTMLImageElement;
                                          const fallback = target.nextElementSibling as HTMLElement;
                                          if (fallback) {
                                            fallback.style.display = 'none';
                                          }
                                        }}
                                        onError={(e) => {
                                          // Hide the image and show fallback
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const fallback = target.nextElementSibling as HTMLElement;
                                          if (fallback) {
                                            fallback.style.display = 'flex';
                                          }
                                        }}
                                      />
                                      {/* Fallback initials div (hidden by default when image loads) */}
                                      <div 
                                        className={`absolute inset-0 w-full h-full rounded-full flex items-center justify-center text-lg font-bold ${getAvatarStyle(rec.status)}`}
                                        style={{ display: 'flex' }}
                                      >
                                        {`${st.first_name?.[0] || ''}${st.last_name?.[0] || ''}`.toUpperCase() || (idx + 1).toString()}
                                      </div>
                                      
                                      {/* Photo indicator - small camera icon when photo exists */}
                                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    </>
                                  ) : (
                                    /* No photo URL - show initials directly */
                                    <div className={`w-full h-full rounded-full flex items-center justify-center text-lg font-bold ${getAvatarStyle(rec.status)}`}>
                                      {`${st.first_name?.[0] || ''}${st.last_name?.[0] || ''}`.toUpperCase() || (idx + 1).toString()}
                                    </div>
                                  )}
                                </div>

                                {/* Student name */}
                                <div className="text-center">
                                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
                                    {st.first_name} {st.last_name}
                                  </h4>
                                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                                    {displayId}
                                  </p>
                                  {isAllStudentsMode && st.class_name && (
                                    <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium mt-0.5">
                                      {st.class_name}
                                    </p>
                                  )}
                                </div>

                                {/* Status buttons - Compact horizontal layout */}
                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                                  {STATUS_OPTIONS.map((opt) => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => handleStatusToggle(st.id, opt.value)}
                                      className={`w-7 h-7 text-xs font-bold rounded-md transition-all duration-100 flex items-center justify-center ${
                                        rec.status === opt.value
                                          ? STATUS_ACTIVE[opt.value]
                                          : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600 hover:text-gray-900 dark:hover:text-white'
                                      }`}
                                      title={opt.label}
                                    >
                                      {opt.short}
                                    </button>
                                  ))}
                                </div>

                                {/* Remarks input - Always visible but compact */}
                                <input
                                  type="text"
                                  placeholder="Note..."
                                  value={rec.remarks}
                                  onChange={(e) =>
                                    setMarkRecords((prev) => ({
                                      ...prev,
                                      [st.id]: { ...prev[st.id], remarks: e.target.value },
                                    }))
                                  }
                                  onBlur={(e) => handleRemarksBlur(st.id, e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-center placeholder:text-gray-400"
                                />

                                {/* Status badge with time info */}
                                <div className="mt-1 text-center">
                                  {rec.status ? (
                                    <>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(rec.status)}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(rec.status)}`} />
                                        {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                                      </span>
                                      
                                      {/* Time display */}
                                      {(rec.check_in_time || rec.check_out_time) && (
                                        <div className="mt-1 text-[9px] text-gray-500 dark:text-gray-400 font-mono">
                                          {rec.check_in_time && <div>In: {rec.check_in_time}</div>}
                                          {rec.check_out_time && <div>Out: {rec.check_out_time}</div>}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-gray-500 bg-gray-100 dark:bg-gray-700">
                                      <Clock size={8} />
                                      Unmarked
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sheet footer summary */}
                  {currentStudents.length > 0 && !(studentsLoading || allStudentsLoading) && (
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-750 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4 text-xs font-semibold">
                      {STATUS_OPTIONS.map((opt) => {
                        const cnt = Object.values(markRecords).filter((r) => r.status === opt.value).length;
                        return (
                          <div key={opt.value} className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${getDotColor(opt.value)}`} />
                            <span className="text-gray-500 dark:text-gray-400">{opt.label}:</span>
                            <span className="text-gray-900 dark:text-white">{cnt}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-gray-500 dark:text-gray-400">Unmarked:</span>
                        <span className="text-gray-900 dark:text-white">
                          {currentStudents.length - markedCount}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!regClassId && !isAllStudentsMode && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-20 text-center">
                  <BookOpen size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-1">Select a Class or View All Students</h3>
                  <p className="text-sm text-gray-400">Choose a class from the dropdown above to load the roll call sheet, or select "All Enrolled Students" to mark attendance across all classes.</p>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TAB 3: ANALYTICS                                              */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'analytics' && (
            <div className="space-y-5">

              {/* Filter by class */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-600 dark:text-gray-300">Filter by class:</label>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Classes</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {analyticsLoading ? (
                <div className="p-20 text-center">
                  <Loader2 size={36} className="animate-spin mx-auto mb-3 text-blue-500" />
                  <p className="text-sm text-gray-400">Computing analytics…</p>
                </div>
              ) : !analyticsStats ? (
                <div className="p-20 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <BarChart2 size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <h3 className="font-bold text-gray-700 dark:text-white mb-1">No Data Available</h3>
                  <p className="text-sm text-gray-400">Record some attendance first to see analytics here.</p>
                </div>
              ) : (
                <>
                  {/* Top KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <KPICard
                      title="Overall Rate"
                      value={`${analyticsStats.rate}%`}
                      icon={<BarChart2 size={20} />}
                      color={analyticsStats.rate >= 85 ? 'green' : analyticsStats.rate >= 75 ? 'amber' : 'red'}
                    />
                    <KPICard
                      title="Total Records"
                      value={analyticsStats.total}
                      icon={<ClipboardList size={20} />}
                      color="blue"
                    />
                    <KPICard
                      title="At-Risk Students"
                      value={analyticsStats.atRisk.length}
                      icon={<AlertTriangle size={20} />}
                      color={analyticsStats.atRisk.length > 0 ? 'red' : 'green'}
                      subtitle="< 75% attendance"
                    />
                    <KPICard
                      title="Absent / Excused"
                      value={`${analyticsStats.absent + analyticsStats.excused}`}
                      icon={<TrendingDown size={20} />}
                      color="amber"
                    />
                  </div>

                  {/* Status breakdown */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">Attendance Breakdown</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Present', count: analyticsStats.present, color: 'bg-emerald-500' },
                        { label: 'Late',    count: analyticsStats.late,    color: 'bg-amber-500' },
                        { label: 'Absent',  count: analyticsStats.absent,  color: 'bg-red-500' },
                        { label: 'Excused', count: analyticsStats.excused, color: 'bg-sky-500' },
                      ].map((row) => {
                        const pct = analyticsStats.total > 0
                          ? Math.round((row.count / analyticsStats.total) * 100)
                          : 0;
                        return (
                          <div key={row.label} className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 w-16">{row.label}</span>
                            <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${row.color} rounded-full transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums w-14 text-right">
                              {row.count} <span className="text-xs text-gray-400 font-normal">({pct}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* At-risk students */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800/40 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-red-100 dark:border-red-800/40 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-500" />
                        <h3 className="font-bold text-gray-900 dark:text-white">At-Risk Students</h3>
                        <span className="ml-auto text-xs text-red-500 font-semibold">Below 75% attendance</span>
                      </div>
                      {analyticsStats.atRisk.length === 0 ? (
                        <div className="p-12 text-center">
                          <CheckCircle size={36} className="mx-auto mb-3 text-emerald-400" />
                          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">All students above 75%!</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-80 overflow-y-auto">
                          {analyticsStats.atRisk.map((st, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3">
                              <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                              <p className="flex-1 text-sm font-semibold text-gray-800 dark:text-white truncate">{st.name}</p>
                              <div className="text-right">
                                <span className={`text-sm font-bold ${
                                  st.rate < 50 ? 'text-red-600' : 'text-amber-600'
                                }`}>
                                  {st.rate}%
                                </span>
                                <p className="text-[10px] text-gray-400">{st.p}/{st.total} days</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Class performance */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-500" />
                        <h3 className="font-bold text-gray-900 dark:text-white">Attendance by Class</h3>
                      </div>
                      {analyticsStats.classRates.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">No class data</div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-80 overflow-y-auto">
                          {analyticsStats.classRates.map((cl, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3">
                              <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                              <p className="flex-1 text-sm font-semibold text-gray-800 dark:text-white truncate">{cl.name}</p>
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      cl.rate >= 85 ? 'bg-emerald-500' : cl.rate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${cl.rate}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-bold tabular-nums ${
                                  cl.rate >= 85 ? 'text-emerald-600' : cl.rate >= 75 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                  {cl.rate}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* ── EDIT RECORD MODAL ──────────────────────────────────────────── */}
        {editRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-200">

              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Edit Attendance</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Update status or remarks for this record</p>
                </div>
                <button
                  onClick={() => setEditRecord(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  updateMutation.mutate({ id: editRecord.id, data: { status: editStatus, remarks: editRemarks } });
                }}
              >
                <div className="p-6 space-y-4">
                  {/* Student info */}
                  <div className="bg-gray-50 dark:bg-gray-750 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Student</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white mt-1">
                      {editRecord.student_name || '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {editRecord.class_name && <span>{editRecord.class_name} · </span>}
                      {fmt(editRecord.date)}
                    </p>
                  </div>

                  {/* Status selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Status</label>
                    <div className="flex items-center gap-2">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEditStatus(opt.value)}
                          className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                            editStatus === opt.value
                              ? STATUS_ACTIVE[opt.value]
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Remarks</label>
                    <textarea
                      rows={3}
                      placeholder="Optional remarks…"
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 rounded-b-2xl flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditRecord(null)}
                    className="text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5"
                  >
                    {updateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default AttendancePage;
