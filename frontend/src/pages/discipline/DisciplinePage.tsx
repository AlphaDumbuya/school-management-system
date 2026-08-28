/**
 * DisciplinePage — /discipline
 * Phase 2.3 Discipline & Conduct Management
 * Tabbed interface: Dashboard | Infractions | Actions | Appeals | Notes
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ShieldAlert, Gavel, MessageSquare, BarChart2,
  X, ChevronDown, Plus, TrendingUp, TrendingDown, Minus,
  User, Calendar, CheckCircle2, Clock, XCircle, FileText,
} from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import {
  disciplineService,
  StudentInfraction, DisciplineAction, DisciplineAppeal, BehavioralNote, ConductReport,
  InfractionSeverity, RiskLevel, BehaviorTrend,
  SEVERITY_COLORS, ACTION_TYPE_LABELS, RISK_COLORS,
} from '@services/disciplineService';
import { InfractionFormModal } from './components/InfractionFormModal';
import { ActionFormModal } from './components/ActionFormModal';
import { AppealReviewModal } from './components/AppealReviewModal';
import { BehavioralNoteModal } from './components/BehavioralNoteModal';
import { ConductReportModal } from './components/ConductReportModal';
import { ConductReportViewModal } from './components/ConductReportViewModal';
import { ColumnDef } from '@tanstack/react-table';

// ── Types & helpers ───────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'infractions' | 'actions' | 'appeals' | 'notes' | 'reports';


const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <BarChart2 size={16} /> },
  { key: 'infractions', label: 'Infractions', icon: <AlertTriangle size={16} /> },
  { key: 'actions', label: 'Actions', icon: <Gavel size={16} /> },
  { key: 'appeals', label: 'Appeals', icon: <ShieldAlert size={16} /> },
  { key: 'notes', label: 'Behavioral Notes', icon: <MessageSquare size={16} /> },
  { key: 'reports', label: 'Conduct Reports', icon: <FileText size={16} /> },
];

function severityBadge(severity: InfractionSeverity | undefined) {
  if (!severity) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${SEVERITY_COLORS[severity] || ''}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

function riskBadge(level: RiskLevel) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${RISK_COLORS[level]}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function trendIcon(trend: BehaviorTrend) {
  if (trend === 'improving') return <TrendingUp size={14} className="text-green-500" />;
  if (trend === 'declining') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

function fmt(d?: string) {
  return d ? new Date(d).toLocaleDateString() : '—';
}

function statusIcon(status: string) {
  if (status === 'resolved' || status === 'completed' || status === 'attended' || status === 'approved')
    return <CheckCircle2 size={14} className="text-green-500" />;
  if (status === 'rejected' || status === 'cancelled' || status === 'absent')
    return <XCircle size={14} className="text-red-500" />;
  return <Clock size={14} className="text-amber-500" />;
}


// ── Main Component ────────────────────────────────────────────────────────────

export const DisciplinePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Search & filter state shared across tabs
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  // Modal state
  const [infractionModal, setInfractionModal] = useState(false);
  const [actionModal, setActionModal] = useState<{ open: boolean; studentId?: string; studentName?: string; infractionId?: string }>({ open: false });
  const [appealModal, setAppealModal] = useState<{ open: boolean; appeal: DisciplineAppeal | null }>({ open: false, appeal: null });
  const [noteModal, setNoteModal] = useState<{ open: boolean; studentId?: string; studentName?: string; editing?: BehavioralNote | null }>({ open: false });
  const [reportModal, setReportModal] = useState(false);
  const [reportViewModal, setReportViewModal] = useState<{ open: boolean; report: ConductReport | null }>({ open: false, report: null });

  // ── Data fetching ─────────────────────────────────────────────────────────

  const { data: dashData, isLoading: dashLoading } = useQuery({
    queryKey: ['discipline-dashboard'],
    queryFn: () => disciplineService.getDashboardSummary(),
    staleTime: 60_000,
    enabled: activeTab === 'dashboard',
  });

  const { data: highRiskData } = useQuery({
    queryKey: ['discipline-high-risk'],
    queryFn: () => disciplineService.getHighRiskStudents({ limit: 10 }),
    staleTime: 60_000,
    enabled: activeTab === 'dashboard',
  });

  const { data: pendingAppealsData } = useQuery({
    queryKey: ['discipline-pending-appeals'],
    queryFn: () => disciplineService.getPendingAppeals({ limit: 20 }),
    staleTime: 30_000,
    enabled: activeTab === 'dashboard' || activeTab === 'appeals',
  });

  const dashboard = (dashData?.data as any) ?? {};
  const highRiskStudents = (highRiskData?.data as any)?.high_risk_students ?? [];
  const pendingAppeals: DisciplineAppeal[] = (pendingAppealsData?.data as any)?.pending_appeals ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['discipline-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['discipline-high-risk'] });
    queryClient.invalidateQueries({ queryKey: ['discipline-pending-appeals'] });
    queryClient.invalidateQueries({ queryKey: ['discipline-infractions-list'] });
    queryClient.invalidateQueries({ queryKey: ['discipline-actions-list'] });
    queryClient.invalidateQueries({ queryKey: ['discipline-appeals-list'] });
    queryClient.invalidateQueries({ queryKey: ['discipline-notes-list'] });
    queryClient.invalidateQueries({ queryKey: ['discipline-reports-list'] });
  };


  // ── Column definitions ────────────────────────────────────────────────────

  const infractionColumns: ColumnDef<StudentInfraction, any>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.student_name || row.original.student_id}
          </span>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Infraction Type',
      cell: ({ row }) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {row.original.infraction_type_name || row.original.infraction_type_id}
        </span>
      ),
    },
    {
      id: 'severity',
      header: 'Severity',
      cell: ({ row }) => severityBadge(row.original.severity_level),
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm text-gray-500 flex items-center gap-1">
          <Calendar size={13} />
          {fmt(row.original.incident_date)}
        </span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          {statusIcon(row.original.status)}
          <StatusBadge status={row.original.status} />
        </div>
      ),
    },
    {
      id: 'location',
      accessorKey: 'incident_location',
      header: 'Location',
      cell: ({ row }) => (
        <span className="text-sm text-gray-500">{row.original.incident_location || '—'}</span>
      ),
    },
  ];

  const actionColumns: ColumnDef<DisciplineAction, any>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.student_name || row.original.student_id}
          </span>
        </div>
      ),
    },
    {
      id: 'action_type',
      header: 'Action',
      cell: ({ row }) => (
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
          {ACTION_TYPE_LABELS[row.original.action_type]}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm text-gray-500 flex items-center gap-1">
          <Calendar size={13} />
          {fmt(row.original.action_date)}
        </span>
      ),
    },
    {
      id: 'duration',
      header: 'Duration',
      cell: ({ row }) => (
        <span className="text-sm text-gray-500">
          {row.original.duration_days ? `${row.original.duration_days}d` : '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          {statusIcon(row.original.status)}
          <StatusBadge status={row.original.status} />
        </div>
      ),
    },
  ];

  const appealColumns: ColumnDef<DisciplineAppeal, any>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.student_name || row.original.student_id}
          </span>
        </div>
      ),
    },
    {
      id: 'action_type',
      header: 'Action Appealed',
      cell: ({ row }) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {row.original.action_type ? ACTION_TYPE_LABELS[row.original.action_type] : '—'}
        </span>
      ),
    },
    {
      id: 'submitted_by_type',
      header: 'Submitted By',
      cell: ({ row }) => (
        <span className="text-sm capitalize text-gray-600 dark:text-gray-400">
          {row.original.submitted_by_type}
        </span>
      ),
    },
    {
      id: 'submitted_date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm text-gray-500 flex items-center gap-1">
          <Calendar size={13} />
          {fmt(row.original.submitted_date)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          {statusIcon(row.original.status)}
          <StatusBadge status={row.original.status} />
        </div>
      ),
    },
  ];

  const noteColumns: ColumnDef<BehavioralNote, any>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.student_name || row.original.student_id}
          </span>
        </div>
      ),
    },
    {
      id: 'note_type',
      header: 'Type',
      cell: ({ row }) => {
        const typeColors: Record<string, string> = {
          positive: 'text-green-700 bg-green-50 border-green-200',
          commendation: 'text-blue-700 bg-blue-50 border-blue-200',
          concern: 'text-red-700 bg-red-50 border-red-200',
          observation: 'text-gray-700 bg-gray-50 border-gray-200',
        };
        const cls = typeColors[row.original.note_type] || 'text-gray-700 bg-gray-50 border-gray-200';
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${cls} capitalize`}>
            {row.original.note_type}
          </span>
        );
      },
    },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <span className="text-sm text-gray-500 capitalize">{row.original.category || '—'}</span>
      ),
    },
    {
      id: 'content',
      header: 'Note',
      cell: ({ row }) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 max-w-xs">
          {row.original.content || '—'}
        </span>
      ),
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {row.original.rating ? `${row.original.rating}/5` : '—'}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm text-gray-500 flex items-center gap-1">
          <Calendar size={13} />
          {fmt(row.original.note_date)}
        </span>
      ),
    },
  ];


  const reportColumns: ColumnDef<ConductReport, any>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white">
            {row.original.student_name || row.original.student_id}
          </span>
        </div>
      ),
    },
    {
      id: 'period',
      header: 'Period',
      cell: ({ row }) => {
        const labels: Record<string, string> = { term: 'Term', semester: 'Semester', year: 'Year', custom: 'Custom' };
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
            {labels[row.original.report_period] || row.original.report_period}
          </span>
        );
      },
    },
    {
      id: 'range',
      header: 'Date Range',
      cell: ({ row }) => (
        <span className="text-sm text-gray-500">
          {fmt(row.original.period_start_date)} – {fmt(row.original.period_end_date)}
        </span>
      ),
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: ({ row }) => {
        const r = row.original.behavioral_rating ?? 0;
        const c = r >= 8 ? 'text-green-600' : r >= 5 ? 'text-amber-600' : 'text-red-600';
        return <span className={`text-sm font-bold ${c}`}>{r}/10</span>;
      },
    },
    {
      id: 'infractions',
      header: 'Infractions',
      cell: ({ row }) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{row.original.total_infractions}</span>
      ),
    },
    {
      id: 'shared',
      header: 'Shared',
      cell: ({ row }) => (
        row.original.parent_shared ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
            <CheckCircle2 size={12} /> {row.original.parent_acknowledged ? 'Acknowledged' : 'Shared'}
          </span>
        ) : (
          <span className="text-xs text-gray-400">Not shared</span>
        )
      ),
    },
  ];


  // ── Render ────────────────────────────────────────────────────────────────

  const tabAction = () => {
    if (activeTab === 'infractions') return (
      <RoleGuard roles={['principal', 'teacher', 'super_admin']}>
        <Button size="sm" onClick={() => setInfractionModal(true)}>
          <Plus size={15} className="mr-1" /> Record Infraction
        </Button>
      </RoleGuard>
    );
    if (activeTab === 'actions') return (
      <RoleGuard roles={['principal', 'super_admin']}>
        <Button size="sm" onClick={() => setActionModal({ open: true })}>
          <Plus size={15} className="mr-1" /> Assign Action
        </Button>
      </RoleGuard>
    );
    if (activeTab === 'notes') return (
      <RoleGuard roles={['principal', 'teacher', 'super_admin']}>
        <Button size="sm" onClick={() => setNoteModal({ open: true })}>
          <Plus size={15} className="mr-1" /> Add Note
        </Button>
      </RoleGuard>
    );
    if (activeTab === 'reports') return (
      <RoleGuard roles={['principal', 'super_admin']}>
        <Button size="sm" onClick={() => setReportModal(true)}>
          <Plus size={15} className="mr-1" /> Generate Report
        </Button>
      </RoleGuard>
    );
    return null;
  };

  return (
    <MainLayout>
      <PageShell
        title="Discipline & Conduct"
        subtitle="Manage student infractions, actions, appeals, and behavioral observations"
        breadcrumbs={[{ label: 'Discipline & Conduct' }]}
        actions={tabAction()}
      >
        {/* ── Tab Navigation ─────────────────────────────────────────── */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearch('');
                setStatusFilter('');
                setSeverityFilter('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0
                ${activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300'
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'appeals' && pendingAppeals.length > 0 && (
                <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                  {pendingAppeals.length}
                </span>
              )}
            </button>
          ))}
        </div>


        {/* ── DASHBOARD TAB ─────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {dashLoading ? (
                <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
              ) : (
                <>
                  <KPICard
                    title="Total Infractions"
                    value={dashboard.total_infractions ?? 0}
                    icon={<div className="p-2 rounded-xl bg-red-500 text-white shadow-sm flex items-center justify-center"><AlertTriangle size={20} /></div>}
                    color="red"
                  />
                  <KPICard
                    title="Open Infractions"
                    value={dashboard.open_infractions ?? 0}
                    icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>}
                    color="amber"
                  />
                  <KPICard
                    title="Active Actions"
                    value={dashboard.active_actions ?? 0}
                    icon={<div className="p-2 rounded-xl bg-orange-500 text-white shadow-sm flex items-center justify-center"><Gavel size={20} /></div>}
                    color="amber"
                  />
                  <KPICard
                    title="Pending Appeals"
                    value={dashboard.pending_appeals ?? 0}
                    icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><ShieldAlert size={20} /></div>}
                    color="purple"
                  />
                </>
              )}
            </div>

            {/* Severity breakdown + high-risk students side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Severity breakdown */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Infractions by Severity</h3>
                {dashLoading ? (
                  <div className="space-y-3">
                    {[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
                  </div>
                ) : Object.keys(dashboard.infractions_by_severity ?? {}).length === 0 ? (
                  <EmptyState message="No infractions recorded yet" />
                ) : (
                  <div className="space-y-3">
                    {(['minor','moderate','serious','critical'] as InfractionSeverity[]).map(sev => {
                      const count = dashboard.infractions_by_severity?.[sev] ?? 0;
                      const max = Math.max(...Object.values(dashboard.infractions_by_severity ?? {}) as number[], 1);
                      const pct = Math.round((count / max) * 100);
                      const barColors: Record<string, string> = {
                        minor: 'bg-yellow-400',
                        moderate: 'bg-orange-400',
                        serious: 'bg-red-500',
                        critical: 'bg-red-700',
                      };
                      return (
                        <div key={sev}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{sev}</span>
                            <span className="font-bold text-gray-900 dark:text-white">{count}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColors[sev]}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* High-risk students */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                  High-Risk Students
                  {highRiskStudents.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-500">({highRiskStudents.length})</span>
                  )}
                </h3>
                {highRiskStudents.length === 0 ? (
                  <EmptyState message="No high-risk students" description="All students are within acceptable conduct parameters" />
                ) : (
                  <div className="space-y-2.5">
                    {highRiskStudents.slice(0, 8).map((s: any) => (
                      <div key={s.student_id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <User size={14} className="text-gray-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.student_name}</p>
                            <p className="text-xs text-gray-500">{s.class_name || 'No class'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {trendIcon(s.behavior_trend)}
                          {riskBadge(s.risk_level)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pending appeals summary */}
            {pendingAppeals.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <ShieldAlert size={18} />
                    Pending Appeals ({pendingAppeals.length})
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('appeals')}>
                    View All
                  </Button>
                </div>
                <div className="space-y-2">
                  {pendingAppeals.slice(0, 3).map(appeal => (
                    <div key={appeal.appeal_id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg px-4 py-2.5 border border-amber-100 dark:border-amber-800/50">
                      <div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{appeal.student_name || appeal.student_id}</span>
                        <span className="text-xs text-gray-500 ml-2">— {appeal.action_type ? ACTION_TYPE_LABELS[appeal.action_type] : 'Action'}</span>
                      </div>
                      <RoleGuard roles={['principal', 'super_admin']}>
                        <Button size="sm" variant="outline" onClick={() => setAppealModal({ open: true, appeal })}>Review</Button>
                      </RoleGuard>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}


        {/* ── SEARCH BAR (shared for data tabs) ─────────────────────── */}
        {activeTab !== 'dashboard' && (
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 mb-6">
            <SearchBar
              placeholder="Search by student name or ID…"
              onSearch={setSearch}
              isLoading={false}
              defaultValue={search}
              className="flex-1 max-w-md"
            />

            {/* Status filter */}
            <div className="relative w-full md:w-40">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {activeTab === 'infractions' && (
                  <>
                    <option value="recorded">Recorded</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                    <option value="appealed">Appealed</option>
                  </>
                )}
                {activeTab === 'actions' && (
                  <>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </>
                )}
                {activeTab === 'appeals' && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="under_review">Under Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </>
                )}
                {activeTab === 'notes' && (
                  <>
                    <option value="positive">Positive</option>
                    <option value="commendation">Commendation</option>
                    <option value="concern">Concern</option>
                    <option value="observation">Observation</option>
                  </>
                )}
                {activeTab === 'reports' && (
                  <>
                    <option value="term">Term</option>
                    <option value="semester">Semester</option>
                    <option value="year">Academic Year</option>
                    <option value="custom">Custom</option>
                  </>
                )}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ChevronDown size={14} />
              </div>
            </div>

            {/* Severity filter — infractions only */}
            {activeTab === 'infractions' && (
              <div className="relative w-full md:w-40">
                <select
                  value={severityFilter}
                  onChange={e => setSeverityFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Severities</option>
                  <option value="minor">Minor</option>
                  <option value="moderate">Moderate</option>
                  <option value="serious">Serious</option>
                  <option value="critical">Critical</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <ChevronDown size={14} />
                </div>
              </div>
            )}
          </div>
        )}


        {/* ── INFRACTIONS TAB ──────────────────────────────────────────── */}
        {activeTab === 'infractions' && (
          <InfractionsTab
            search={search}
            statusFilter={statusFilter}
            severityFilter={severityFilter}
            infractionColumns={infractionColumns}
            onAssignAction={(studentId, studentName, infractionId) =>
              setActionModal({ open: true, studentId, studentName, infractionId })}
            onRecordInfraction={() => setInfractionModal(true)}
          />
        )}

        {/* ── ACTIONS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'actions' && (
          <ActionsTab
            search={search}
            statusFilter={statusFilter}
            actionColumns={actionColumns}
          />
        )}

        {/* ── APPEALS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'appeals' && (
          <AppealsTab
            search={search}
            statusFilter={statusFilter}
            appealColumns={appealColumns}
            onReview={appeal => setAppealModal({ open: true, appeal })}
          />
        )}

        {/* ── NOTES TAB ───────────────────────────────────────────────── */}
        {activeTab === 'notes' && (
          <NotesTab
            search={search}
            statusFilter={statusFilter}
            noteColumns={noteColumns}
            onEdit={(note) => setNoteModal({ open: true, studentId: note.student_id, studentName: note.student_name, editing: note })}
            onDelete={async (noteId) => {
              await disciplineService.deleteNote(noteId);
              showToast.deleted('Note');
              queryClient.invalidateQueries({ queryKey: ['discipline-notes-list'] });
            }}
          />
        )}

        {/* ── CONDUCT REPORTS TAB ─────────────────────────────────────── */}
        {activeTab === 'reports' && (
          <ReportsTab
            search={search}
            periodFilter={statusFilter}
            reportColumns={reportColumns}
            onView={(report) => setReportViewModal({ open: true, report })}
          />
        )}
      </PageShell>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <InfractionFormModal
        isOpen={infractionModal}
        onClose={() => setInfractionModal(false)}
        onSuccess={invalidate}
      />

      <ActionFormModal
        isOpen={actionModal.open}
        onClose={() => setActionModal({ open: false })}
        onSuccess={invalidate}
        studentId={actionModal.studentId}
        studentName={actionModal.studentName}
        infractionId={actionModal.infractionId}
      />

      <AppealReviewModal
        isOpen={appealModal.open}
        onClose={() => setAppealModal({ open: false, appeal: null })}
        onSuccess={invalidate}
        appeal={appealModal.appeal}
      />

      <BehavioralNoteModal
        isOpen={noteModal.open}
        onClose={() => setNoteModal({ open: false })}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['discipline-notes-list'] })}
        studentId={noteModal.studentId}
        studentName={noteModal.studentName}
        editingNote={noteModal.editing}
      />

      <ConductReportModal
        isOpen={reportModal}
        onClose={() => setReportModal(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['discipline-reports-list'] })}
      />

      <ConductReportViewModal
        isOpen={reportViewModal.open}
        onClose={() => setReportViewModal({ open: false, report: null })}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['discipline-reports-list'] })}
        report={reportViewModal.report}
      />
    </MainLayout>
  );
};


// ── Sub-tab components ────────────────────────────────────────────────────────

interface InfractionsTabProps {
  search: string;
  statusFilter: string;
  severityFilter: string;
  infractionColumns: ColumnDef<StudentInfraction, any>[];
  onAssignAction: (studentId: string, studentName: string, infractionId: string) => void;
  onRecordInfraction: () => void;
}

const InfractionsTab: React.FC<InfractionsTabProps> = ({
  search, statusFilter, severityFilter, infractionColumns, onAssignAction,
}) => {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['discipline-infractions-list', { search, statusFilter, severityFilter, page }],
    queryFn: () => disciplineService.listAllInfractions({
      search: search || undefined,
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    staleTime: 30_000,
  });

  const res = (data as any) ?? {};
  const items: StudentInfraction[] = res?.data ?? [];
  const pagination = res?.pagination ?? { total: 0, total_pages: 1 };

  return (
    <DataTable
      columns={[
        ...infractionColumns,
        {
          id: '_actions',
          header: '',
          cell: ({ row }) => (
            <RoleGuard roles={['principal', 'super_admin']}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAssignAction(
                  row.original.student_id,
                  row.original.student_name || row.original.student_id,
                  row.original.infraction_id
                )}
              >
                Assign Action
              </Button>
            </RoleGuard>
          ),
        },
      ]}
      data={items}
      isLoading={isLoading}
      error={error ? String(error) : null}
      onRetry={refetch}
      paginationMode="server"
      page={page}
      totalPages={pagination.total_pages}
      totalCount={pagination.total}
      onPageChange={setPage}
      pageSize={PAGE_SIZE}
      emptyMessage="No infractions found"
    />
  );
};


// ── ActionsTab ────────────────────────────────────────────────────────────────

interface ActionsTabProps {
  search: string;
  statusFilter: string;
  actionColumns: ColumnDef<DisciplineAction, any>[];
}

const ActionsTab: React.FC<ActionsTabProps> = ({ search, statusFilter, actionColumns }) => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['discipline-actions-list', { search, statusFilter, page }],
    queryFn: () => disciplineService.listAllActions({
      search: search || undefined,
      status: statusFilter || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    staleTime: 30_000,
  });

  const res = (data as any) ?? {};
  const items: DisciplineAction[] = res?.data ?? [];
  const pagination = res?.pagination ?? { total: 0, total_pages: 1 };

  return (
    <DataTable
      columns={[
        ...actionColumns,
        {
          id: '_actions',
          header: '',
          cell: ({ row }) => (
            <RoleGuard roles={['principal', 'super_admin']}>
              {row.original.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await disciplineService.cancelAction(row.original.action_id, 'Cancelled by principal');
                    showToast.success('Action cancelled');
                    queryClient.invalidateQueries({ queryKey: ['discipline-actions-list'] });
                  }}
                >
                  Cancel
                </Button>
              )}
            </RoleGuard>
          ),
        },
      ]}
      data={items}
      isLoading={isLoading}
      error={error ? String(error) : null}
      onRetry={refetch}
      paginationMode="server"
      page={page}
      totalPages={pagination.total_pages}
      totalCount={pagination.total}
      onPageChange={setPage}
      pageSize={PAGE_SIZE}
      emptyMessage="No discipline actions found"
    />
  );
};


// ── AppealsTab ────────────────────────────────────────────────────────────────

interface AppealsTabProps {
  search: string;
  statusFilter: string;
  appealColumns: ColumnDef<DisciplineAppeal, any>[];
  onReview: (appeal: DisciplineAppeal) => void;
}

const AppealsTab: React.FC<AppealsTabProps> = ({
  search, statusFilter, appealColumns, onReview,
}) => {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['discipline-appeals-list', { search, statusFilter, page }],
    queryFn: () => disciplineService.listAllAppeals({
      search: search || undefined,
      status: statusFilter || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    staleTime: 30_000,
  });

  const res = (data as any) ?? {};
  const items: DisciplineAppeal[] = res?.data ?? [];
  const pagination = res?.pagination ?? { total: 0, total_pages: 1 };

  return (
    <DataTable
      columns={[
        ...appealColumns,
        {
          id: '_review',
          header: '',
          cell: ({ row }) => (
            row.original.status === 'pending' || row.original.status === 'under_review' ? (
              <RoleGuard roles={['principal', 'super_admin']}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onReview(row.original)}
                >
                  Review
                </Button>
              </RoleGuard>
            ) : null
          ),
        },
      ]}
      data={items}
      isLoading={isLoading}
      error={error ? String(error) : null}
      onRetry={refetch}
      paginationMode="server"
      page={page}
      totalPages={pagination.total_pages}
      totalCount={pagination.total}
      onPageChange={setPage}
      pageSize={PAGE_SIZE}
      emptyMessage="No appeals found"
    />
  );
};


// ── NotesTab ──────────────────────────────────────────────────────────────────

interface NotesTabProps {
  search: string;
  statusFilter: string;
  noteColumns: ColumnDef<BehavioralNote, any>[];
  onEdit: (note: BehavioralNote) => void;
  onDelete: (noteId: string) => void;
}

const NotesTab: React.FC<NotesTabProps> = ({
  search, statusFilter, noteColumns, onEdit, onDelete,
}) => {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['discipline-notes-list', { search, statusFilter, page }],
    queryFn: () => disciplineService.listAllNotes({
      search: search || undefined,
      note_type: statusFilter || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    staleTime: 30_000,
  });

  const res = (data as any) ?? {};
  const items: BehavioralNote[] = res?.data ?? [];
  const pagination = res?.pagination ?? { total: 0, total_pages: 1 };

  return (
    <DataTable
      columns={[
        ...noteColumns,
        {
          id: '_actions',
          header: '',
          cell: ({ row }) => (
            <RoleGuard roles={['principal', 'teacher', 'super_admin']}>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>Edit</Button>
                <RoleGuard roles={['principal', 'super_admin']}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDelete(row.original.note_id)}
                  >
                    Delete
                  </Button>
                </RoleGuard>
              </div>
            </RoleGuard>
          ),
        },
      ]}
      data={items}
      isLoading={isLoading}
      error={error ? String(error) : null}
      onRetry={refetch}
      paginationMode="server"
      page={page}
      totalPages={pagination.total_pages}
      totalCount={pagination.total}
      onPageChange={setPage}
      pageSize={PAGE_SIZE}
      emptyMessage="No behavioral notes found"
    />
  );
};


// ── ReportsTab ────────────────────────────────────────────────────────────────

interface ReportsTabProps {
  search: string;
  periodFilter: string;
  reportColumns: ColumnDef<ConductReport, any>[];
  onView: (report: ConductReport) => void;
}

const ReportsTab: React.FC<ReportsTabProps> = ({ search, periodFilter, reportColumns, onView }) => {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['discipline-reports-list', { search, periodFilter, page }],
    queryFn: () => disciplineService.listAllReports({
      search: search || undefined,
      report_period: periodFilter || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    staleTime: 30_000,
  });

  const res = (data as any) ?? {};
  const items: ConductReport[] = res?.data ?? [];
  const pagination = res?.pagination ?? { total: 0, total_pages: 1 };

  return (
    <DataTable
      columns={[
        ...reportColumns,
        {
          id: '_actions',
          header: '',
          cell: ({ row }) => (
            <Button variant="outline" size="sm" onClick={() => onView(row.original)}>
              View
            </Button>
          ),
        },
      ]}
      data={items}
      isLoading={isLoading}
      error={error ? String(error) : null}
      onRetry={refetch}
      paginationMode="server"
      page={page}
      totalPages={pagination.total_pages}
      totalCount={pagination.total}
      onPageChange={setPage}
      pageSize={PAGE_SIZE}
      emptyMessage="No conduct reports found"
    />
  );
};

export default DisciplinePage;
