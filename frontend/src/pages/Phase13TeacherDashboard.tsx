/**
 * Teacher Dashboard — /teacher/dashboard
 * Real, tenant + teacher-scoped hub. Shows only the teacher's assigned classes,
 * today's schedule, KPIs, and recent activity. Actions route to the existing
 * scoped tools (SL grade entry, attendance, report cards).
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, BookOpen, BarChart3, Calendar, ClipboardList, ClipboardCheck,
  Star, FileText, Loader2, MapPin, Clock, GraduationCap,
} from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { Button } from '@components/ui/button';
import useAuthStore from '@store/authStore';
import { teacherDashboardService, TeacherDashboardData } from '@services/teacherDashboardService';

function fmtTime(t?: string): string {
  if (!t) return '';
  // t is HH:MM:SS — show HH:MM (12h)
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function timeAgo(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const Phase13TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: () => teacherDashboardService.getDashboard(),
    staleTime: 60_000,
  });

  const dash: TeacherDashboardData | undefined =
    (data as any)?.data ?? (data as any);

  const stats = dash?.stats ?? { total_classes: 0, total_students: 0, total_subjects: 0, classes_today: 0 };
  const classes = dash?.classes ?? [];
  const schedule = dash?.today_schedule ?? [];
  const activity = dash?.recent_activity ?? [];

  const quickActions = [
    { label: 'Enter Scores', icon: <ClipboardList size={18} />, route: '/academic/results' },
    { label: 'Mark Attendance', icon: <ClipboardCheck size={18} />, route: '/students/attendance' },
    { label: 'Ratings', icon: <Star size={18} />, route: '/academic/results' },
    { label: 'Report Cards', icon: <FileText size={18} />, route: '/academic/report-cards' },
  ];

  return (
    <MainLayout>
      <PageShell
        title="Teacher Dashboard"
        subtitle="Your classes and schedule"
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
      >
        <WelcomeHero
          firstName={user?.firstName ?? (user as any)?.first_name}
          role="teacher"
          roleLabel="Teacher"
          schoolName={user?.schoolName}
          subtitle="Here are your classes and today's schedule."
        />
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <EmptyState message="Failed to load dashboard" description="Please refresh and try again." />
        ) : dash?.teacher_profile_missing ? (
          <EmptyState
            message="No teacher profile found"
            description="Your account isn't linked to a teacher profile yet. Ask your principal to set up your teaching assignments."
          />
        ) : (
          <div className="space-y-8">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <KPICard title="My Classes" value={stats.total_classes} icon={<div className="p-2 rounded-xl bg-blue-500 text-white"><BookOpen size={20} /></div>} color="blue" />
              <KPICard title="Students Taught" value={stats.total_students} icon={<div className="p-2 rounded-xl bg-green-500 text-white"><Users size={20} /></div>} color="green" />
              <KPICard title="Subjects" value={stats.total_subjects} icon={<div className="p-2 rounded-xl bg-purple-500 text-white"><BarChart3 size={20} /></div>} color="purple" />
              <KPICard title="Classes Today" value={stats.classes_today} icon={<div className="p-2 rounded-xl bg-amber-500 text-white"><Calendar size={20} /></div>} color="amber" />
            </div>

            {/* Quick actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quickActions.map((a) => (
                  <Button key={a.label} variant="outline" className="flex flex-col items-center gap-2 h-auto py-4" onClick={() => navigate(a.route)}>
                    {a.icon}
                    <span className="text-xs font-medium">{a.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: today's schedule + announcements */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-blue-500" /> Today's Schedule
                  </h3>
                  {schedule.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">No classes scheduled for today.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {schedule.map((s) => (
                        <div key={s.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{s.subject_name || s.class_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.class_name}</p>
                            {s.room && <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><MapPin size={10} /> {s.room}</p>}
                          </div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap flex items-center gap-1">
                            <Clock size={11} /> {fmtTime(s.start_time)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Teacher-scoped announcements (tenant + role filtered by the API) */}
                <AnnouncementsWidget limit={4} />
              </div>

              {/* Assigned classes */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <BookOpen size={16} className="text-purple-500" /> My Classes
                </h3>
                {classes.length === 0 ? (
                  <EmptyState message="No classes assigned" description="Your principal hasn't assigned you to any classes or subjects yet." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {classes.map((c) => (
                      <div key={c.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{c.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{c.level}{c.section ? ` · ${c.section}` : ''}{c.room ? ` · Room ${c.room}` : ''}</p>
                          </div>
                          {c.is_class_teacher && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 whitespace-nowrap">
                              <GraduationCap size={11} /> Class Teacher
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
                          <span className="flex items-center gap-1"><Users size={12} /> {c.student_count} students</span>
                        </div>
                        {c.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {c.subjects.map((s, i) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{s}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => navigate('/academic/results')}>
                            <ClipboardList size={13} className="mr-1" /> Scores
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => navigate('/students/attendance')}>
                            <ClipboardCheck size={13} className="mr-1" /> Attendance
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
              {activity.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No recent activity yet. Entered scores and marked attendance will show here.</p>
              ) : (
                <div className="space-y-2">
                  {activity.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${a.type === 'attendance' ? 'bg-green-500' : 'bg-blue-500'}`} />
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{a.message}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(a.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default Phase13TeacherDashboard;
