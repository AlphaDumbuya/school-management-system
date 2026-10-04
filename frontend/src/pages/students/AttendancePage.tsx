/**
 * AttendancePage — /students/attendance
 * Fully functional attendance management with:
 *  • Attendance Logs tab  – filterable, searchable log table with edit
 *  • Class Register tab   – select class/date, mark all students in real-time
 *  • Analytics tab        – at-risk students, class summaries, presence rates
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
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
  LogOut,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { attendanceService, AttendanceRecord, SessionType, AttendanceStatus } from '@services/attendanceService';
import { classesService } from '@services/classesService';
import { useAuth } from '@hooks/useAuth';
import { studentsService, StudentRecord } from '@services/studentsService';
import { parentDashboardService } from '@services/parentDashboardService';
import { SearchBar } from '@components/admin/table/SearchBar';
import { rosterRepo } from '../../offline/repositories/rosterRepo';
import { ExportButton } from '@components/admin/common/ExportButton';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { TeacherAttendancePanel } from '@components/attendance/TeacherAttendancePanel';
import { AttendanceTimeDetails, TimedAttendanceRecord } from '@components/attendance/AttendanceTimeDetails';

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

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

type ActiveTab = 'logs' | 'register' | 'analytics' | 'teachers';

/** apiClient never throws: turn a `{ success: false }` response into an error. */
function assertOk<T>(res: T): T {
  const r = res as any;
  if (r && r.success === false) throw new Error(r.error || 'Request failed');
  return res;
}

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
  const { canAccess, user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Only staff-admins can mark attendance across all students at once.
  const canMarkAllStudents = canAccess(['principal', 'super_admin']);
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent' || (user?.role as string | undefined) === 'guardian';

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    location.pathname === '/staff/attendance' || searchParams.get('tab') === 'teachers' ? 'teachers' : 'logs'
  );
  const requestedTab = searchParams.get('tab');
  React.useEffect(() => {
    setActiveTab(location.pathname === '/staff/attendance' || requestedTab === 'teachers' ? 'teachers' : 'logs');
  }, [location.pathname, requestedTab]);

  // Academic-year scope for every tab (logs, register, analytics, export, class
  // pickers). '' = the school's CURRENT year, so the page follows a rollover;
  // only a past year is stored explicitly.
  const [pickedYear, setPickedYear] = useState('');
  const { activeYear } = useAcademicYears();
  // One year at a time (picked, else the school's active year). Logs,
  // analytics, export and class pickers are all scoped to it.
  const year = pickedYear || activeYear;
  const viewingPast = !!year && !!activeYear && year !== activeYear;

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
  const [editCheckInTime, setEditCheckInTime] = useState('');
  const [editCheckOutTime, setEditCheckOutTime] = useState('');

  // ── Register tab state ────────────────────────────────────────────────────
  const [regClassId, setRegClassId] = useState('');
  const [regDate, setRegDate] = useState(localDateKey(new Date()));
  const [regSession, setRegSession] = useState<SessionType>('morning');
  const [markRecords, setMarkRecords] = useState<
    Record<string, { status: AttendanceStatus | undefined; remarks: string; check_in_time?: string; check_out_time?: string }>
  >({});
  const [loadedKey, setLoadedKey] = useState('');
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [isAllStudentsMode, setIsAllStudentsMode] = useState(false);

  // A year switch is like loading a different page: drop every selection.
  const changeYear = (y: string) => {
    setPickedYear(!y || y === activeYear ? '' : y);
    setClassFilter(''); setRegClassId(''); setIsAllStudentsMode(false);
    setLoadedKey(''); setPage(1); setEditRecord(null);
    // The register is for the current year only.
    if (y && y !== activeYear && activeTab === 'register') setActiveTab('logs');
  };

  // ── Queries ───────────────────────────────────────────────────────────────

  // 1. Attendance log
  const { data: logsData, isLoading: logsLoading, isFetching: logsFetching, refetch: refetchLogs } = useQuery({
    queryKey: ['att-logs', { search, classFilter, statusFilter, dateFilter, page, year }],
    queryFn: () =>
      attendanceService.listAttendance({
        page,
        limit: PAGE_SIZE,
        classId: classFilter || undefined,
        status: statusFilter || undefined,
        date: dateFilter || undefined,
        search: search || undefined,
        academic_year: year,
      }),
    enabled: !!year,
    staleTime: 30_000,
  });

  const logs = (logsData as any)?.data ?? [];
  const logsError: string | null = (logsData as any)?.success === false ? ((logsData as any)?.error || 'Could not load attendance') : null;
  const pagination = (logsData as any)?.pagination ?? { total: 0, total_pages: 1 };

  // 2. Classes list
  const { data: classesData } = useQuery({
    queryKey: ['att-classes', year],
    queryFn: () => classesService.listClasses({ limit: 100, academic_year: year }),
    enabled: !!year,
    staleTime: 120_000,
  });
  const classes = (classesData as any)?.data ?? [];
  // Year transition in progress (current year only): students still sit in
  // last year's classes, so this year's registers look short until moved.
  const pendingTransition = !viewingPast
    ? ((classesData as any)?.pending_transition ?? null) as { fromYear: string; students: number } | null
    : null;

  // 3. Register: students in class OR all students
  const { data: classStudentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['reg-students', regClassId],
    // classesService.getClassStudents falls back to the offline roster cache
    // when offline, so the register still lists students without a connection.
    queryFn: () => classesService.getClassStudents(regClassId),
    enabled: !!regClassId && activeTab === 'register' && !isAllStudentsMode,
    staleTime: 60_000,
  });
  const classStudents = (classStudentsData as any)?.data?.students ?? (classStudentsData as any)?.students ?? [];

  // 3b. All enrolled students
  const { data: allStudentsData, isLoading: allStudentsLoading } = useQuery({
    queryKey: ['all-students'],
    queryFn: async () => {
      try {
        const res: any = await studentsService.listStudents({ limit: 1000, status: 'active' });
        const list = res?.data ?? [];
        if (list.length > 0 || navigator.onLine) return res;
      } catch (_) {
        /* fall through to cache */
      }
      const uid = (user as any)?.id;
      if (uid) {
        const cached = await rosterRepo.list(uid, 'students').catch(() => []);
        return { data: cached };
      }
      return { data: [] };
    },
    enabled: isAllStudentsMode && activeTab === 'register',
    staleTime: 60_000,
  });
  const allStudents = (allStudentsData as any)?.data ?? [];

  // 4. Register: existing attendance for selected class/date/session OR all students/date/session
  const { data: existingAttData, isLoading: existingLoading, isFetching: existingFetching } = useQuery({
    queryKey: ['reg-existing', regClassId, regDate, regSession, isAllStudentsMode],
    queryFn: async () => {
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
      return result;
    },
    enabled: ((!!regClassId && !isAllStudentsMode) || isAllStudentsMode) && !!regDate && activeTab === 'register',
    staleTime: 0, // Changed to 0 to always fetch fresh data
    refetchOnMount: 'always', // Always refetch when component mounts
  });
  
  const existingRecords: any[] = isAllStudentsMode
    ? (existingAttData as any)?.data ?? []
    : (existingAttData as any)?.data?.attendance_records ?? (existingAttData as any)?.attendance_records ?? [];

  // 5. Analytics: server-computed (scales past the browser's row limits).
  const { data: analyticsData, isLoading: analyticsLoading, isFetching: analyticsFetching } = useQuery({
    queryKey: ['att-analytics', classFilter, year],
    queryFn: () => attendanceService.getAnalytics(classFilter || undefined, year),
    enabled: activeTab === 'analytics' && !!year,
    staleTime: 60_000,
  });

  // ── Merge: initialize markRecords when class/date/session/students change ──
  React.useEffect(() => {
    const key = `${regClassId}:${regDate}:${regSession}:${isAllStudentsMode}`;
    const currentStudents = isAllStudentsMode ? allStudents : classStudents;
    const isLoadingStudents = isAllStudentsMode ? allStudentsLoading : studentsLoading;

    if (
      key !== loadedKey &&
      !isLoadingStudents &&
      !existingLoading &&
      currentStudents.length > 0
    ) {
      const merged: typeof markRecords = {};
      currentStudents.forEach((st: any) => {
        const existing = existingRecords.find(
          (r: any) => String(r.student_id) === String(st.id) && r.session_type === regSession
        );
        merged[st.id] = {
          status: existing?.status ?? undefined,
          remarks: existing?.remarks ?? '',
          check_in_time: existing?.check_in_time ?? undefined,
          check_out_time: existing?.check_out_time ?? undefined,
        };
      });
      setMarkRecords(merged);
      setLoadedKey(key);
    }
  }, [classStudents, allStudents, existingRecords, studentsLoading, allStudentsLoading, existingLoading, regClassId, regDate, regSession, loadedKey, isAllStudentsMode]);

  // ── Stats (logs tab KPIs) ─────────────────────────────────────────────────
  // Server stats cover the WHOLE filtered set; the page fallback is only for
  // an older API that doesn't send them.
  const serverStats = (logsData as any)?.stats;
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        rate: Number(serverStats.rate) || 0,
        present: Number(serverStats.present) || 0,
        late: Number(serverStats.late) || 0,
        absent: Number(serverStats.absent) || 0,
        excused: Number(serverStats.excused) || 0,
      };
    }
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
  }, [logs, serverStats]);

  // ── Analytics (server-computed) ───────────────────────────────────────────
  const analyticsStats = useMemo(() => {
    const d = (analyticsData as any)?.data?.data ?? (analyticsData as any)?.data;
    if (!d || !d.total) return null;
    return d as {
      total: number; present: number; late: number; absent: number; excused: number; rate: number;
      atRisk: { name: string; admissionNo: string; rate: number; total: number; p: number }[];
      classRates: { name: string; rate: number; total: number }[];
    };
  }, [analyticsData]);

  // ── Register tab: mark single student immediately ─────────────────────────
  const saveSingleMutation = useMutation({
    mutationFn: ({ studentId, status, remarks, autoTime = true }: { 
      studentId: string; 
      status: AttendanceStatus; 
      remarks?: string;
      autoTime?: boolean;
    }) => {
      setSavingIds((p) => ({ ...p, [studentId]: true }));
      
      // Auto-set current time based on session and status
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS school-local time
      
      let check_in_time: string | undefined = undefined;
      let check_out_time: string | undefined = undefined;
      
      if (autoTime && (status === 'present' || status === 'late') && regDate === localDateKey(now)) {
        if (regSession === 'morning') {
          check_in_time = markRecords[studentId]?.check_in_time || currentTime;
        } else if (regSession === 'afternoon') {
          check_out_time = markRecords[studentId]?.check_out_time || currentTime;
        } else if (regSession === 'full_day') {
          check_in_time = markRecords[studentId]?.check_in_time || currentTime;
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
      
      // All-students mode has no class; otherwise mark within the class.
      return attendanceService.submitBulkAttendance({
        ...(isAllStudentsMode ? {} : { class_id: regClassId }),
        date: regDate,
        session_type: regSession,
        records: [record],
      }).then(assertOk);
    },
    onSuccess: async (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['att-logs'] });
      await queryClient.refetchQueries({ queryKey: ['reg-existing', regClassId, regDate, regSession, isAllStudentsMode], type: 'active' });
      setLoadedKey('');
      setSavingIds((p) => { const n = { ...p }; delete n[vars.studentId]; return n; });
    },
    onError: (error, vars) => {
      showToast.error((error as Error)?.message || 'Failed to save attendance');
      setSavingIds((p) => { const n = { ...p }; delete n[vars.studentId]; return n; });
      // Undo the optimistic mark: reload the sheet from what the server has.
      setLoadedKey('');
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
      const currentTime = now.toTimeString().slice(0, 8);
      const isToday = regDate === localDateKey(now);
      
      const records = currentStudents.map((st: any) => {
        let check_in_time: string | undefined = undefined;
        let check_out_time: string | undefined = undefined;
        
        if (isToday && (regSession === 'morning' || regSession === 'full_day')) {
          check_in_time = markRecords[st.id]?.check_in_time || currentTime;
        } else if (isToday && regSession === 'afternoon') {
          check_out_time = markRecords[st.id]?.check_out_time || currentTime;
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

      return attendanceService.submitBulkAttendance({
        ...(isAllStudentsMode ? {} : { class_id: regClassId }),
        date: regDate,
        session_type: regSession,
        records,
      }).then(assertOk);
    },
    onSuccess: async () => {
      const currentStudents = isAllStudentsMode ? allStudents : classStudents;
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8);
      const isToday = regDate === localDateKey(now);
      
      const updated: typeof markRecords = {};
      currentStudents.forEach((st: any) => {
        let check_in_time: string | undefined = undefined;
        let check_out_time: string | undefined = undefined;
        
        if (isToday && (regSession === 'morning' || regSession === 'full_day')) {
          check_in_time = markRecords[st.id]?.check_in_time || currentTime;
        } else if (isToday && regSession === 'afternoon') {
          check_out_time = markRecords[st.id]?.check_out_time || currentTime;
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
      await queryClient.refetchQueries({ queryKey: ['reg-existing', regClassId, regDate, regSession, isAllStudentsMode], type: 'active' });
      setLoadedKey('');
      showToast.success('All students marked present!');
    },
    onError: (error) => {
      showToast.error((error as Error)?.message || 'Failed to mark all present');
      setLoadedKey('');
    },
  });

  // ── Edit mutation ─────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      attendanceService.updateAttendance(id, data).then(assertOk),
    onSuccess: () => {
      showToast.success('Record updated');
      queryClient.invalidateQueries({ queryKey: ['att-logs'] });
      queryClient.invalidateQueries({ queryKey: ['att-analytics'] });
      setEditRecord(null);
    },
    onError: (error) => showToast.error((error as Error)?.message || 'Failed to update record'),
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
    ...(user?.role === 'principal' || user?.role === 'super_admin' || user?.role === 'teacher'
      ? [{ id: 'teachers', label: user.role === 'teacher' ? 'My Attendance' : 'Teacher Attendance', icon: <Users size={16} /> }]
      : []),
  ] as const;

  // ─────────────────────────────────────────────────────────────────────────
  // Students see a read-only view of ONLY their own attendance.
  if (isStudent) {
    return <StudentAttendanceView />;
  }
  // Parents see a read-only view of their children's attendance (with selector).
  if (isParent) {
    return <ParentAttendanceView />;
  }

  return (
    <MainLayout>
      <PageShell
        title={activeTab === 'teachers' ? 'Teacher Attendance' : 'Attendance'}
        subtitle={activeTab === 'teachers' ? 'Daily staff sign-in and sign-out' : 'Track student and teacher attendance'}
        breadcrumbs={[{ label: activeTab === 'teachers' ? 'Staff' : 'Students' }, { label: 'Attendance' }]}
        onRefresh={() => {
          if (activeTab === 'teachers') return queryClient.refetchQueries({ queryKey: ['teacher-attendance'], type: 'active' }, { throwOnError: true });
          if (activeTab === 'register') return Promise.all([
            queryClient.refetchQueries({ queryKey: ['reg-students'], type: 'active' }, { throwOnError: true }),
            queryClient.refetchQueries({ queryKey: ['all-students'], type: 'active' }, { throwOnError: true }),
            queryClient.refetchQueries({ queryKey: ['reg-existing'], type: 'active' }, { throwOnError: true }),
          ]).then(() => { setLoadedKey(''); });
          if (activeTab === 'analytics') return queryClient.refetchQueries({ queryKey: ['att-analytics'], type: 'active' }, { throwOnError: true });
          return refetchLogs();
        }}
        isRefreshing={activeTab === 'register' ? existingFetching : activeTab === 'analytics' ? analyticsFetching : logsFetching}
        actions={
          activeTab !== 'teachers' && (
            <div className="flex items-center gap-2 sm:gap-3">
              <YearFilter value={year} onChange={changeYear} noAutoSelect />
              <ExportButton
                endpoint="/api/v1/attendance/export"
                filename="attendance"
                params={{ date: dateFilter || undefined, classId: classFilter || undefined, academic_year: year || undefined }}
              />
            </div>
          )
        }
      >
        <div className="space-y-6">

          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-gray-800 p-1.5 rounded-2xl w-full overflow-x-auto scrollbar-none whitespace-nowrap sm:w-fit">
            {TABS.filter((tab) => !(viewingPast && tab.id === 'register')).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-md shadow-blue-500/30'
                    : 'text-gray-600 dark:text-gray-400 hover:text-blue-700 hover:bg-white/70 dark:hover:bg-gray-700/50'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="inline sm:hidden">
                  {tab.id === 'logs' ? 'Logs' : tab.id === 'register' ? 'Register' : tab.id === 'teachers' ? 'Teachers' : 'Analytics'}
                </span>
              </button>
            ))}
          </div>

          {viewingPast && activeTab !== 'teachers' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              <span>Showing <strong>{year}</strong> attendance as history. Take today's register in {activeYear}.</span>
              <button type="button" onClick={() => changeYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
                Back to {activeYear}
              </button>
            </div>
          )}

          {pendingTransition && activeTab !== 'teachers' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>{activeYear} is being set up.</strong>{' '}
              {pendingTransition.students} student{pendingTransition.students === 1 ? ' is' : 's are'} still in{' '}
              {pendingTransition.fromYear} classes and won't appear on {activeYear} registers yet.
              {canMarkAllStudents ? ' Finish the move from the Overview page.' : ' They will appear once the principal moves them into this year.'}
            </div>
          )}

          {activeTab === 'teachers' && user && <TeacherAttendancePanel role={user.role} />}

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
                  subtitle={`${year || 'All years'} · current filters`}
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
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm w-full">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Search</label>
                    <SearchBar
                      onSearch={(val) => { setSearch(val); setPage(1); }}
                      placeholder="Search student name or ID…"
                      defaultValue={search}
                      isLoading={logsLoading}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Date</label>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Class</label>
                    <select
                      value={classFilter}
                      onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Classes</option>
                      {classes.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {(search || classFilter || statusFilter || dateFilter) && (
                      <button
                        onClick={() => { setSearch(''); setClassFilter(''); setStatusFilter(''); setDateFilter(''); setPage(1); }}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <X size={12} /> Clear
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => refetchLogs()}
                    className="flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={16} className={logsLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                {logsLoading ? (
                  <div className="p-20 text-center">
                    <Loader2 size={36} className="animate-spin mx-auto mb-3 text-blue-500" />
                    <p className="text-sm text-gray-400">Loading attendance logs…</p>
                  </div>
                ) : logsError ? (
                  <div className="p-20 text-center" role="alert">
                    <AlertTriangle size={44} className="mx-auto mb-4 text-red-400" />
                    <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-1">Attendance unavailable</h3>
                    <p className="text-sm text-gray-400 max-w-xs mx-auto">{logsError}</p>
                    <button type="button" onClick={() => refetchLogs()} className="mt-4 text-sm font-semibold text-blue-600 hover:underline">Try again</button>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="p-20 text-center">
                    <Calendar size={52} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-1">
                      {viewingPast ? `No attendance in ${year}` : 'No Records Found'}
                    </h3>
                    <p className="text-sm text-gray-400 max-w-xs mx-auto">
                      {viewingPast
                        ? `No attendance records from ${year} match your filters.`
                        : classes.length === 0 && user?.role === 'teacher'
                          ? `You aren't assigned to any class in ${year} yet. Your classes' attendance will show here once the principal assigns you.`
                          : 'No attendance records match your filters. Try adjusting the date, class or status, or switch to the Class Register tab to mark attendance.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                        <tr>
                          <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white">Student</th>
                          <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white">Class</th>
                          <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white">Date</th>
                          <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white">Status</th>
                          <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white">Times</th>
                          <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white">Remarks</th>
                          {/* Past years are read-only history: no edit column. */}
                          {!viewingPast && <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white text-right">Edit</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {logs.map((log: any, rowIndex: number) => (
                          <tr key={log.id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-gray-700/30 group ${rowIndex % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/40' : 'bg-white dark:bg-transparent'}`}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                {/* Avatar */}
                                <div className="relative w-9 h-9 rounded-full shadow-sm overflow-hidden flex-shrink-0">
                                  {log.photo_url && log.photo_url.trim() ? (
                                    <>
                                      <img
                                        src={log.photo_url.trim()}
                                        alt={log.student_name || ''}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const fallback = target.nextElementSibling as HTMLElement;
                                          if (fallback) fallback.style.display = 'flex';
                                        }}
                                      />
                                      <div
                                        className="absolute inset-0 w-full h-full rounded-full flex items-center justify-center text-xs font-bold bg-blue-500 text-white"
                                        style={{ display: 'none' }}
                                      >
                                        {(log.student_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-full h-full rounded-full flex items-center justify-center text-xs font-bold bg-blue-500 text-white">
                                      {(log.student_name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                {/* Name + ID */}
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white leading-tight">{log.student_name || '—'}</p>
                                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">{log.student_id_code || '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300 font-medium">{log.class_name || '—'}</td>
                            <td className="px-5 py-3.5 text-[11px] font-mono text-gray-500 dark:text-gray-400">{fmt(log.date)}</td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(log.status)}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(log.status)}`} />
                                {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5"><AttendanceTimeDetails record={log} className="min-w-[230px]" /></td>
                            <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400 max-w-[180px] truncate">
                              {log.remarks || <span className="text-gray-300 dark:text-gray-600">—</span>}
                            </td>
                            {!viewingPast && <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                aria-label={`Edit attendance for ${log.student_name || 'student'}`}
                                onClick={() => {
                                  setEditRecord(log);
                                  setEditStatus(log.status);
                                  setEditRemarks(log.remarks || '');
                                  setEditCheckInTime(log.check_in_time || '');
                                  setEditCheckOutTime(log.check_out_time || '');
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                                title="Edit record"
                              >
                                <Edit3 size={14} />
                              </button>
                            </td>}
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
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-6">
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
                      {canMarkAllStudents && (
                        <option value="all-students" className="font-semibold text-cyan-600">🌐 All Enrolled Students</option>
                      )}
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
                      max={localDateKey(new Date())}
                      aria-label="Register date"
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
                            {((classStudentsData as any)?.data?.class_name || (classStudentsData as any)?.class_name) && (
                              <span className="ml-2 text-blue-600 dark:text-blue-400">{(classStudentsData as any)?.data?.class_name || (classStudentsData as any)?.class_name}</span>
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
                                      {/* Fallback initials div (hidden by default, shown only if image fails to load) */}
                                      <div 
                                        className={`absolute inset-0 w-full h-full rounded-full flex items-center justify-center text-lg font-bold ${getAvatarStyle(rec.status)}`}
                                        style={{ display: 'none' }}
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
                                      aria-label={`Mark ${st.first_name ?? ''} ${st.last_name ?? ''} ${opt.label}`.replace(/\s+/g, ' ')}
                                      aria-pressed={rec.status === opt.value}
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
                                  aria-label={`Note for ${st.first_name ?? ''} ${st.last_name ?? ''}`.replace(/\s+/g, ' ')}
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
                  <h3 className="text-lg font-bold text-gray-700 dark:text-white mb-1">
                    {classes.length === 0 && !canMarkAllStudents
                      ? `No classes in ${year}`
                      : canMarkAllStudents ? 'Select a Class or View All Students' : 'Select a Class'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {classes.length === 0 && !canMarkAllStudents
                      ? `You aren't assigned to any class in ${year} yet. Ask the principal to assign you, then take the register here.`
                      : canMarkAllStudents
                        ? 'Choose a class from the dropdown above to load the roll call sheet, or select "All Enrolled Students" to mark attendance across all classes.'
                        : 'Choose one of your classes above to load the roll call sheet.'}
                  </p>
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
                  <h3 className="font-bold text-gray-700 dark:text-white mb-1">
                    {viewingPast ? `No attendance in ${year}` : 'No Data Available'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {viewingPast
                      ? `No attendance was recorded in ${year}${classFilter ? ' for this class' : ''}.`
                      : 'Record some attendance first to see analytics here.'}
                  </p>
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
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-6">
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
                  <p className="text-xs text-gray-400 mt-0.5">Correct the status, arrival/departure times or remarks</p>
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
                  updateMutation.mutate({ id: editRecord.id, data: { status: editStatus, check_in_time: editCheckInTime || null, check_out_time: editCheckOutTime || null, remarks: editRemarks } });
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
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs font-bold text-gray-500">Arrival time
                      <input type="time" step="1" value={editCheckInTime} onChange={(e) => setEditCheckInTime(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
                    </label>
                    <label className="text-xs font-bold text-gray-500">Departure time
                      <input type="time" step="1" value={editCheckOutTime} onChange={(e) => setEditCheckOutTime(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600" />
                    </label>
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

// ── Student read-only "My Attendance" view ──────────────────────────────────

const StudentAttendanceView: React.FC = () => {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: () => attendanceService.getMyAttendance(),
    staleTime: 60_000,
  });

  const resp = (data as any)?.data ?? (data as any);
  const summary = resp?.summary ?? { total_days: 0, present: 0, late: 0, absent: 0, excused: 0, attendance_percentage: 0, at_risk: false };
  const records: Array<TimedAttendanceRecord & { id: string; date: string; status: string; remarks?: string }> = resp?.records ?? [];

  return (
    <MainLayout>
      <PageShell title="My Attendance" subtitle="Your daily attendance record" onRefresh={() => refetch()} isRefreshing={isFetching}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : error ? (
          <div className="py-16 text-center text-gray-500">Couldn't load your attendance. Please refresh.</div>
        ) : (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KPICard
                title="Attendance Rate"
                value={`${summary.attendance_percentage}%`}
                icon={<UserCheck className="w-5 h-5" />}
                color={summary.attendance_percentage >= 85 ? 'green' : summary.attendance_percentage >= 75 ? 'amber' : 'red'}
              />
              <KPICard title="Present" value={String(summary.present)} icon={<CheckCircle className="w-5 h-5" />} color="green" />
              <KPICard title="Late" value={String(summary.late)} icon={<Clock className="w-5 h-5" />} color="amber" />
              <KPICard title="Absent" value={String(summary.absent)} icon={<XCircle className="w-5 h-5" />} color="red" />
            </div>

            {summary.at_risk && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle size={16} /> Your attendance is below 75%. Please speak with your class teacher.
              </div>
            )}

            {/* Records */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-gray-900 dark:text-white">Attendance History</h3>
              </div>
              {records.length === 0 ? (
                <div className="p-12 text-center text-gray-400">No attendance records yet.</div>
              ) : (
                <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                      <tr className="text-white">
                        <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">Date</th>
                        <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">Details</th>
                        <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">Remarks</th>
                        <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {records.map((r, i) => (
                        <tr
                          key={r.id}
                          className={`transition-colors hover:bg-sky-100 dark:hover:bg-blue-950/20 ${
                            i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'
                          }`}
                        >
                          <td className="px-5 py-3.5 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{fmt(r.date)}</td>
                          <td className="px-5 py-3.5"><AttendanceTimeDetails record={r} /></td>
                          <td className="px-5 py-3.5 text-gray-500">
                            {r.remarks ? <span className="truncate inline-block max-w-[14rem] align-bottom">{r.remarks}</span> : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(r.status)}`} />
                              {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
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
        )}
      </PageShell>
    </MainLayout>
  );
};

// ── Today's live arrival/departure banner (parent portal) ───────────────────
const prettyClock = (t?: string | null): string => {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  let h = parseInt(m[1], 10); const min = m[2];
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
};

const TodayAttendanceBanner: React.FC<{
  records: Array<{ date: string; status: string; check_in_time?: string | null; check_out_time?: string | null }>;
  childName: string;
}> = ({ records, childName }) => {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todays = records.filter((r) => String(r.date).slice(0, 10) === todayKey);
  if (todays.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-5 py-4 flex items-center gap-3">
        <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
        <p className="text-sm text-gray-600 dark:text-gray-300">No attendance recorded for <strong>{childName}</strong> yet today.</p>
      </div>
    );
  }
  const checkIn = todays.map((r) => r.check_in_time).filter(Boolean)[0] as string | undefined;
  const checkOut = todays.map((r) => r.check_out_time).filter(Boolean).slice(-1)[0] as string | undefined;
  const anyAbsent = todays.some((r) => r.status === 'absent');
  const anyPresent = todays.some((r) => r.status === 'present' || r.status === 'late');

  return (
    <div className={`rounded-2xl border px-5 py-4 ${
      checkOut ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20'
      : anyPresent ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
      : anyAbsent ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40'
    }`}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">Today · {fmt(todayKey)}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className={`w-5 h-5 ${anyPresent ? 'text-emerald-600' : 'text-gray-300'}`} />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {anyPresent ? `${childName} arrived at school` : anyAbsent ? `${childName} is marked absent` : 'Not yet arrived'}
            </p>
            {checkIn && <p className="text-xs text-gray-500">Checked in at <strong>{prettyClock(checkIn)}</strong></p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LogOut className={`w-5 h-5 ${checkOut ? 'text-blue-600' : 'text-gray-300'}`} />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {checkOut ? `${childName} has left for home` : 'Still at school'}
            </p>
            {checkOut && <p className="text-xs text-gray-500">Checked out at <strong>{prettyClock(checkOut)}</strong></p>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Parent read-only "children's attendance" view ───────────────────────────

const ParentAttendanceView: React.FC = () => {
  const [childId, setChildId] = useState('');
  const queryClient = useQueryClient();

  const { data: dashResp } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: () => parentDashboardService.getDashboard(),
    staleTime: 60_000,
  });
  const children = ((dashResp as any)?.data ?? (dashResp as any))?.children ?? [];
  const currentId = childId || children[0]?.id || '';

  const { data: childResp, isLoading, isFetching } = useQuery({
    queryKey: ['parent-child-detail', currentId],
    queryFn: () => parentDashboardService.getChildDetail(currentId),
    enabled: !!currentId,
    // Keep the today banner reasonably live so a check-in/out reflects quickly.
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const detail = (childResp as any)?.data ?? (childResp as any);
  const summary = detail?.attendance ?? { total: 0, present: 0, late: 0, absent: 0, excused: 0, percentage: 0 };
  const records: Array<TimedAttendanceRecord & { id: string; date: string; status: string; remarks?: string }> = detail?.attendance?.records ?? [];

  return (
    <MainLayout>
      <PageShell title="Children's Attendance" subtitle="View your children's attendance records" onRefresh={() => Promise.all([
        queryClient.refetchQueries({ queryKey: ['parent-dashboard'], type: 'active' }, { throwOnError: true }),
        queryClient.refetchQueries({ queryKey: ['parent-child-detail', currentId], type: 'active' }, { throwOnError: true }),
      ])} isRefreshing={isFetching}>
        {children.length === 0 ? (
          <div className="py-16 text-center text-gray-500">No children linked to your account.</div>
        ) : (
          <div className="space-y-6">
            {/* Child selector */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {children.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setChildId(c.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition ${
                    currentId === c.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  {c.class_name && <span className="text-xs text-gray-400">· {c.class_name}</span>}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
            ) : (
              <>
                {/* Today's live status — arrival / departure at a glance */}
                <TodayAttendanceBanner
                  records={records}
                  childName={children.find((c: any) => String(c.id) === String(currentId))?.name || 'Your child'}
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KPICard title="Attendance Rate" value={`${summary.percentage}%`} icon={<UserCheck className="w-5 h-5" />} color={summary.percentage >= 85 ? 'green' : summary.percentage >= 75 ? 'amber' : 'red'} />
                  <KPICard title="Present" value={String(summary.present)} icon={<CheckCircle className="w-5 h-5" />} color="green" />
                  <KPICard title="Late" value={String(summary.late)} icon={<Clock className="w-5 h-5" />} color="amber" />
                  <KPICard title="Absent" value={String(summary.absent)} icon={<XCircle className="w-5 h-5" />} color="red" />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-bold text-gray-900 dark:text-white">Attendance History</h3>
                  </div>
                  {records.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">No attendance records yet.</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 z-10 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                          <tr className="text-white">
                            <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">Date</th>
                            <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">Details</th>
                            <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider">Remarks</th>
                            <th className="px-5 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {records.map((r, i) => (
                            <tr
                              key={r.id}
                              className={`transition-colors hover:bg-sky-100 dark:hover:bg-blue-950/20 ${
                                i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'
                              }`}
                            >
                              <td className="px-5 py-3.5 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{fmt(r.date)}</td>
                              <td className="px-5 py-3.5"><AttendanceTimeDetails record={r} /></td>
                              <td className="px-5 py-3.5 text-gray-500">
                                {r.remarks ? <span className="truncate inline-block max-w-[14rem] align-bottom">{r.remarks}</span> : '—'}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(r.status)}`} />
                                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default AttendancePage;
