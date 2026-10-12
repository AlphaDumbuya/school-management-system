/**
 * AssignmentsPage — /academic/assignments
 * CRUD for class assignments with submission tracking.
 * Features Searchable Filter Popovers with embedded search bars inside filters.
 */

import { initialQuery, useQuerySearch } from '@hooks/useQuerySearch';
import { isTeachingUser } from '@lib/staffJobs';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronDown,
  SlidersHorizontal,
  Search,
  Check,
  Info,
} from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { useAuth } from '@hooks/useAuth';
import {
  assignmentsService,
  AssignmentRecord,
  ASSIGNMENT_TYPES,
} from '@services/assignmentsService';
import { parentDashboardService } from '@services/parentDashboardService';
import { AssignmentFormModal } from './components/AssignmentFormModal';
import { AssignmentDetailModal } from './components/AssignmentDetailModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A DATE column arrives as "YYYY-MM-DD" or a midnight ISO string: read the calendar day, never shift it by timezone. */
function dayOf(dateStr: string): Date {
  const ymd = String(dateStr).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T00:00:00`) : new Date(dateStr);
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = dayOf(dateStr);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate: string): boolean {
  const due = dayOf(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

/** The student's own submission, from the list row. */
function handedIn(a: AssignmentRecord): boolean {
  return !!a.my_submitted_at || ['submitted', 'graded', 'late'].includes(String(a.my_submission_status || ''));
}

/** Own-submission status chip: Graded (marks) / Handed in / Late / Not handed in. */
const SubmissionPill: React.FC<{ a: AssignmentRecord }> = ({ a }) => {
  const status = String(a.my_submission_status || '');
  const graded = status === 'graded' || !!a.my_graded_at || (a.my_marks !== null && a.my_marks !== undefined);
  const [label, cls] = graded
    ? [`Graded${a.my_marks !== null && a.my_marks !== undefined ? ` · ${a.my_marks}/${a.max_marks}` : ''}`, 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50']
    : status === 'late'
      ? ['Handed in late', 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50']
      : handedIn(a)
        ? ['Handed in', 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50']
        : ['Not handed in', 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'];
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
};

const TYPE_LABELS: Record<string, string> = {
  homework: 'Homework',
  classwork: 'Classwork',
  essay: 'Essay',
  practical: 'Practical',
  project: 'Project',
  quiz: 'Quiz',
  test: 'Test',
  presentation: 'Presentation',
  group_work: 'Group Work',
  revision: 'Revision',
  reading: 'Reading',
  exercise: 'Exercise',
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', icon: '🟢' },
  { value: 'closed', label: 'Closed', icon: '🔴' },
  { value: 'draft', label: 'Draft', icon: '🟡' },
];

const TYPE_OPTIONS = ASSIGNMENT_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
  icon: '📝',
}));

// ── SEARCHABLE FILTER POPOVER COMPONENT ────────────────────────────────────────

interface SearchableFilterPopoverProps {
  title: string;
  placeholder?: string;
  options: { value: string; label: string; icon?: string }[];
  value: string;
  onChange: (val: string) => void;
  allLabel?: string;
}

const SearchableFilterPopover: React.FC<SearchableFilterPopoverProps> = ({
  title,
  placeholder = 'Search options...',
  options,
  value,
  onChange,
  allLabel = 'All Options',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!filterSearch) return options;
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(filterSearch.toLowerCase())
    );
  }, [options, filterSearch]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setFilterSearch('');
  };

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : allLabel;

  return (
    <div ref={popoverRef} className="relative flex-1 sm:flex-initial">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto flex items-center justify-between gap-2 pl-3 pr-2.5 py-2.5 sm:py-2 border rounded-lg text-sm font-medium transition-all cursor-pointer min-w-[140px] sm:min-w-[160px] ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-gray-800'
            : value
              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 font-semibold'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1.5 z-50 w-[260px] sm:w-[280px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {title}
            </span>
            {value && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="text-[11px] font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Shared SearchBar inside Filter Popover */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30">
            <SearchBar
              placeholder={placeholder}
              onSearch={(val) => setFilterSearch(val)}
              defaultValue={filterSearch}
              debounceMs={0}
              className="w-full"
            />
          </div>

          {/* Options list */}
          <div className="p-1.5 max-h-[220px] overflow-y-auto space-y-1">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all text-left font-medium ${
                !value
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
              }`}
            >
              <span>{allLabel}</span>
              {!value && <Check size={14} className="text-blue-500 flex-shrink-0" />}
            </button>

            {filteredOptions.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all text-left ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {opt.icon && <span>{opt.icon}</span>}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check size={14} className="text-blue-500 flex-shrink-0" />}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <p className="text-[11px] text-center text-gray-400 py-3 font-medium">
                No matching options found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export const AssignmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { canAccess, user } = useAuth();
  // Students (and other non-staff) get a read-only view of their class assignments.
  const canManage = canAccess(['principal', 'super_admin', 'teacher']);
  const isTeacherRole = isTeachingUser(user as any);
  const isStudentRole = user?.role === 'student';
  // 'guardian' is a legacy alias for parent (not in UserRole, but the column is free text).
  const isParentRole = user?.role === 'parent' || (user?.role as string | undefined) === 'guardian';

  // Filter state
  const [search, setSearch] = useState(initialQuery());
  useQuerySearch(setSearch);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const isViewerOnly = !canManage && (isStudentRole || isParentRole);

  // Parent multi-child switcher (the server verifies the child is linked).
  const { data: parentDash, isFetched: parentDashFetched } = useQuery({
    queryKey: ['assignments-parent-children'],
    queryFn: () => parentDashboardService.getDashboard(),
    enabled: isParentRole,
    staleTime: 60_000,
  });
  const parentChildren: any[] = ((parentDash as any)?.data ?? (parentDash as any))?.children ?? [];
  const [selectedChildId, setSelectedChildId] = useState('');
  const activeChildId = selectedChildId || parentChildren[0]?.id || '';

  // One academic year at a time for everyone (assignments belong to
  // session-scoped classes). Students/parents get the classes they were in
  // that year, resolved server-side.
  const [pickedYear, setYear] = useState('');
  const { activeYear } = useAcademicYears();
  const year = pickedYear || activeYear;
  const viewingPast = !!year && !!activeYear && year !== activeYear;
  // Create / edit / delete: staff only, and only in the current year.
  const canEditHere = canManage && !viewingPast;
  // The current year is stored as '' so the page follows a rollover by itself.
  const changeYear = (y: string) => { setYear(!y || y === activeYear ? '' : y); setPage(1); };
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRecord | null>(null);
  const [viewingAssignment, setViewingAssignment] = useState<AssignmentRecord | null>(null);

  // Fetch assignments
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['assignments', { search, statusFilter, typeFilter, year, page, pageSize, child: isParentRole ? activeChildId : '' }],
    queryFn: () => assignmentsService.listAssignments({
      page,
      limit: pageSize,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      search: search || undefined,
      academic_year: year || undefined,
      child_id: isParentRole ? (activeChildId || undefined) : undefined,
    }),
    enabled: !!year && (!isParentRole || parentDashFetched),
    staleTime: 30_000,
  });

  const assignments: AssignmentRecord[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };
  // apiClient never throws: a failed load comes back as success:false and
  // must not read as "no assignments".
  const loadError: string | null = error
    ? String(error)
    : (data as any)?.success === false ? ((data as any)?.error || 'Could not load assignments') : null;
  // Student/parent: the classes behind this year's list (newest first).
  const viewerMeta = isViewerOnly ? (data as any)?.meta : null;
  const viewerClasses: string[] = Array.from(new Set<string>((viewerMeta?.classes ?? []).map((c: any) => c.name)));
  // Whose submission column to show: a student, or a parent's single selected child.
  const showOwnSubmission = isViewerOnly && assignments.some((a) => 'my_submission_status' in a);
  const childName = isParentRole ? (parentChildren.find((c: any) => c.id === activeChildId)?.name || 'your child') : '';
  const who = isParentRole ? childName : 'you';

  // KPIs: the server's whole-set totals; computed from the page only as a fallback.
  const serverStats = (data as any)?.stats;
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        total: Number(serverStats.total ?? 0),
        active: Number(serverStats.active ?? 0),
        overdue: Number(serverStats.overdue ?? 0),
        totalSubmissions: Number(serverStats.submissions ?? 0),
      };
    }
    const total = Number(pagination.total ?? assignments.length);
    const active = assignments.filter((a) => a.status === 'active').length;
    const overdue = assignments.filter((a) => a.status === 'active' && isOverdue(a.due_date)).length;
    const totalSubmissions = assignments.reduce((s, a) => s + Number(a.total_submissions ?? 0), 0);
    return { total, active, overdue, totalSubmissions };
  }, [assignments, pagination, serverStats]);

  const filtered = !!(search || statusFilter || typeFilter);
  const emptyText = filtered
    ? 'No assignments match your filters.'
    : isViewerOnly
      ? (viewerMeta && viewerClasses.length === 0
          ? (viewerMeta.graduated && !viewingPast
              ? `🎓 ${isParentRole ? childName : 'You'} graduated from ${viewerMeta.graduated.className}${viewerMeta.graduated.year ? ` in ${viewerMeta.graduated.year}` : ''}. Pick a past year to see old assignments.`
              : `${isParentRole ? `${childName} wasn’t` : 'You weren’t'} in a class at this school in ${year}.`)
          : viewingPast
            ? `No assignments were set for ${viewerClasses.join(' & ') || (isParentRole ? 'their class' : 'your class')} in ${year}.`
            : `No assignments for ${viewerClasses.join(' & ') || (isParentRole ? 'their class' : 'your class')} yet this year.`)
      : viewingPast ? `No assignments in ${year}.` : 'No assignments found';

  // Overdue = still open and past due. For a student/parent, work already
  // handed in isn't overdue, and a past year is closed history.
  const rowOverdue = (a: AssignmentRecord) =>
    a.status === 'active' && isOverdue(a.due_date) && !(isViewerOnly && (viewingPast || handedIn(a)));

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res: any = await assignmentsService.deleteAssignment(deleteTarget.id);
    if (res.success !== false) {
      // The API closes (rather than deletes) an assignment that has submissions.
      if (/closed/i.test(res?.message || res?.data?.message || '')) showToast.success('Assignment closed — it already has submissions');
      else showToast.deleted('Assignment');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } else {
      showToast.apiError(res.error);
    }
    setDeleteTarget(null);
  };

  // Columns
  const columns: ColumnDef<AssignmentRecord, any>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="min-w-[150px]">
          <p className="font-medium text-gray-900 dark:text-white truncate">{row.original.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.original.subject_name}</p>
        </div>
      ),
    },
    {
      id: 'class',
      accessorKey: 'class_name',
      header: 'Class',
      cell: ({ row }) => (
        <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
          {row.original.class_name}
        </span>
      ),
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">
          {TYPE_LABELS[row.original.type] || row.original.type}
        </span>
      ),
    },
    {
      id: 'due_date',
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: ({ row }) => {
        const overdue = rowOverdue(row.original);
        return (
          <span className={`text-xs font-semibold ${overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {formatDate(row.original.due_date)}
            {overdue && <span className="ml-1 text-[10px]" aria-label="Overdue">⚠️</span>}
          </span>
        );
      },
    },
    {
      id: 'teacher',
      accessorKey: 'teacher_name',
      header: 'Teacher',
      cell: ({ row }) => <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{row.original.teacher_name}</span>,
    },
    // Staff: class-wide progress. Student (or a parent's child): their own work.
    ...(isViewerOnly
      ? (showOwnSubmission ? [{
          id: 'my_submission',
          header: isParentRole ? 'Submission' : 'My Submission',
          cell: ({ row }: any) => <SubmissionPill a={row.original} />,
        } as ColumnDef<AssignmentRecord, any>] : [])
      : [{
          id: 'submissions',
          header: 'Submissions',
          cell: ({ row }: any) => (
            <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
              {Number(row.original.total_submissions ?? 0)} / {Number(row.original.graded_count ?? 0)} graded
            </span>
          ),
        } as ColumnDef<AssignmentRecord, any>]),
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} showDot />,
    },
  ];

  return (
    <MainLayout>
      <PageShell
        title="Assignments"
        subtitle={canManage
          ? 'Create and manage student assignments'
          : isViewerOnly && viewerClasses.length
            ? `${viewerClasses.join(' & ')} · ${year}`
            : isParentRole ? "Your child's class assignments" : 'Your class assignments'}
        breadcrumbs={[{ label: 'Assignments' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <YearFilter value={year} onChange={changeYear} noAutoSelect />
            {!viewingPast && (
              <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
                <Button variant="default" size="sm" onClick={() => { setEditingAssignment(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm">
                  + Create Assignment
                </Button>
              </RoleGuard>
            )}
          </div>
        }
      >
        {/* Parent multi-child switcher */}
        {isParentRole && parentChildren.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4" role="group" aria-label="Choose a child">
            {parentChildren.map((c: any) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={activeChildId === c.id}
                onClick={() => { setSelectedChildId(c.id); setPage(1); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition ${
                  activeChildId === c.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                }`}
              >
                <span className="font-medium">{c.name}</span>
                {c.class_name && <span className="text-xs text-gray-400">· {c.class_name}</span>}
              </button>
            ))}
          </div>
        )}
        {viewingPast && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            {isViewerOnly ? (
              <span>
                Showing the assignments {who} had in <strong>{year}</strong>
                {viewerClasses.length ? <> ({[...viewerClasses].reverse().join(' → ')})</> : null}. This is history; nothing here is due any more.
              </span>
            ) : (
              <span>Showing <strong>{year}</strong> assignments as history. New assignments go into {activeYear}.</span>
            )}
            <button type="button" onClick={() => changeYear('')} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          </div>
        )}
        {isViewerOnly && !viewingPast && viewerMeta?.pending_transition && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>{activeYear} is being set up.</strong> These are the assignments for {viewerMeta.pending_transition.className} ({viewerMeta.pending_transition.fromYear});
            they'll update once the school moves {who} into this year's class.
          </div>
        )}

        {/* Scope info banner — explains what this role can do here */}
        <div className={`mb-6 rounded-2xl border p-4 flex items-start gap-3 ${
          isTeacherRole
            ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40'
            : isStudentRole
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
              : isParentRole
                ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/40'
                : 'bg-slate-50 dark:bg-gray-800/40 border-slate-200 dark:border-gray-700'
        }`}>
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isTeacherRole ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
            : isStudentRole ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
            : isParentRole ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400'
            : 'bg-slate-200 text-slate-600 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            <Info size={18} />
          </span>
          <div className="text-sm">
            {isTeacherRole ? (
              <>
                <p className="font-bold text-blue-900 dark:text-blue-300">You're managing your own assignments</p>
                <p className="text-blue-800/80 dark:text-blue-300/70 mt-0.5">
                  You can create, edit and delete assignments only for the <strong>classes and subjects assigned to you</strong>. Assignments are automatically posted under your name and are visible to the students in those classes.
                </p>
              </>
            ) : isStudentRole ? (
              <>
                <p className="font-bold text-emerald-900 dark:text-emerald-300">Your class assignments</p>
                <p className="text-emerald-800/80 dark:text-emerald-300/70 mt-0.5">
                  These are the assignments your teachers set for your class in the year you pick (top right). Open one for the full instructions and due date. Hand your work in to your teacher; once they record it, its status and mark show here.
                </p>
              </>
            ) : isParentRole ? (
              <>
                <p className="font-bold text-violet-900 dark:text-violet-300">Your children's assignments</p>
                <p className="text-violet-800/80 dark:text-violet-300/70 mt-0.5">
                  These are the assignments set for your child's class in the year you pick, so you can follow their homework, due dates and marks. This view is read-only.
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-900 dark:text-white">School-wide assignments</p>
                <p className="text-slate-600 dark:text-gray-400 mt-0.5">
                  As an administrator you can view and manage assignments across all classes, teachers and subjects.
                </p>
              </>
            )}
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {isLoading && !data ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KPICard title="Total Assignments" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><ClipboardList size={20} /></div>} color="blue" />
              <KPICard title="Active" value={stats.active} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><CheckCircle size={20} /></div>} color="green" />
              <KPICard title="Overdue" value={stats.overdue} icon={<div className="p-2 rounded-xl bg-red-500 text-white shadow-sm flex items-center justify-center"><AlertTriangle size={20} /></div>} color="red" />
              <KPICard title={isViewerOnly ? 'Handed In' : 'Submissions'} value={stats.totalSubmissions} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>} color="purple" />
            </>
          )}
        </div>

        {/* Search & Searchable Filter Popovers */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Bar — shared component */}
            <SearchBar
              placeholder="Search assignment title or subject..."
              onSearch={setSearch}
              isLoading={isLoading}
              resultCount={search ? assignments.length : undefined}
              className="w-full lg:max-w-md"
            />

            {/* Searchable Filter Popovers */}
            <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
              {/* Type Filter with internal Search Bar */}
              <SearchableFilterPopover
                title="Filter by Type"
                placeholder="Search types (homework, quiz...)"
                options={TYPE_OPTIONS}
                value={typeFilter}
                onChange={setTypeFilter}
                allLabel="All Types"
              />

              {/* Status Filter with internal Search Bar */}
              <SearchableFilterPopover
                title="Filter by Status"
                placeholder="Search status..."
                options={isViewerOnly ? STATUS_OPTIONS.filter((o) => o.value !== 'draft') : STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
                allLabel="All Statuses"
              />
            </div>
          </div>

          {/* Active filter badges */}
          {(search || typeFilter || statusFilter) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1">
                <SlidersHorizontal size={10} /> Filters:
              </span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">
                  "{search}" <button onClick={() => setSearch('')}><X size={12} /></button>
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30">
                  Type: {TYPE_LABELS[typeFilter]} <button onClick={() => setTypeFilter('')}><X size={12} /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200/30">
                  Status: {statusFilter} <button onClick={() => setStatusFilter('')}><X size={12} /></button>
                </span>
              )}
              <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto">
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* DataTable */}
        <DataTable
          columns={columns}
          data={assignments}
          isLoading={isLoading}
          error={loadError}
          onRetry={refetch}
          paginationMode="server"
          pageIndex={page}
          pageSize={pageSize}
          totalRows={Number(pagination.total)}
          onPageChange={setPage}
          emptyMessage={emptyText}
          emptyAction={canEditHere ? { label: 'Create your first assignment', onClick: () => { setEditingAssignment(null); setFormOpen(true); } } : undefined}
          rowActions={(row) => (
            canEditHere
              ? [
                  { label: 'View', onClick: (r) => setViewingAssignment(r) },
                  { label: 'Edit', onClick: (r) => { setEditingAssignment(r); setFormOpen(true); } },
                  { label: 'Delete', variant: 'destructive', onClick: (r) => setDeleteTarget(r) },
                ]
              : [
                  { label: 'View', onClick: (r) => setViewingAssignment(r) },
                ]
          )}
        />
      </PageShell>

      {/* Detail Modal */}
      <AssignmentDetailModal
        isOpen={!!viewingAssignment}
        onClose={() => setViewingAssignment(null)}
        assignment={viewingAssignment}
        // Past years are history: no "Overdue" alarms for students/parents.
        historyMode={isViewerOnly && viewingPast}
        viewerLabel={isViewerOnly ? (isParentRole ? childName : 'you') : undefined}
        // Students / parents must never see Edit; staff only in the current year.
        onEdit={canEditHere ? (a) => { setEditingAssignment(a); setFormOpen(true); } : undefined}
      />

      {/* Form Modal */}
      <AssignmentFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingAssignment(null); }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['assignments'] })}
        editingAssignment={editingAssignment}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Assignment"
        message={`Delete "${deleteTarget?.title}"? If it has submissions, it will be closed instead of permanently deleted.`}
        confirmLabel="Delete"
      />
    </MainLayout>
  );
};

export default AssignmentsPage;
