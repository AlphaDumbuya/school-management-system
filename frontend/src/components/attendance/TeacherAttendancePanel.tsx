import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { teacherAttendanceService, TeacherAttendanceRow } from '@services/teacherAttendanceService';
import type { AttendanceStatus } from '@services/attendanceService';
import { YearFilter } from '@components/common/YearFilter';
import { KPICard } from '@components/dashboard/KPICard';
import { useAcademicYears } from '@hooks/useAcademicYears';

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  late: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  absent: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  excused: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

const STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
// Local calendar date (not UTC), so "today" matches the school's clock.
const dateToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const label = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);
const time = (value?: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export const TeacherAttendancePanel: React.FC<{ role: string }> = ({ role }) => {
  const queryClient = useQueryClient();
  const isPrincipal = role === 'principal' || role === 'super_admin';
  const [date, setDate] = useState(dateToday);
  const [drafts, setDrafts] = useState<Record<string, { status: AttendanceStatus | ''; remarks: string }>>({});
  const [checkInComment, setCheckInComment] = useState('');
  const [signOutComment, setSignOutComment] = useState('');

  // Teacher history follows one academic year. '' = the CURRENT year, so the
  // view follows a rollover; a past year is read-only history.
  const { activeYear } = useAcademicYears();
  const [pickedYear, setPickedYear] = useState('');
  const year = pickedYear || activeYear;
  const viewingPast = !!year && !!activeYear && year !== activeYear;
  const changeYear = (y: string) => setPickedYear(!y || y === activeYear ? '' : y);

  const roster = useQuery({
    queryKey: ['teacher-attendance', 'roster', date],
    queryFn: () => teacherAttendanceService.getRoster(date),
    enabled: isPrincipal,
    staleTime: 0,
  });
  const mine = useQuery({
    queryKey: ['teacher-attendance', 'my', year],
    queryFn: () => teacherAttendanceService.getMyAttendance(year),
    enabled: !isPrincipal && !!year,
    staleTime: 0,
  });

  useEffect(() => {
    if (!roster.data) return;
    const next: typeof drafts = {};
    roster.data.teachers.forEach((teacher) => {
      next[teacher.id] = {
        status: teacher.attendance?.status ?? '',
        remarks: teacher.attendance?.remarks ?? '',
      };
    });
    setDrafts(next);
  }, [roster.data]);

  const saveMark = useMutation({
    mutationFn: ({ teacherId, status, remarks }: { teacherId: string; status: AttendanceStatus; remarks: string }) =>
      teacherAttendanceService.saveMark(teacherId, date, status, remarks),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-attendance', 'roster', date] });
      showToast.success('Teacher attendance saved');
    },
    onError: (error: Error) => showToast.error(error.message),
  });
  const checkIn = useMutation({
    mutationFn: teacherAttendanceService.checkIn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-attendance', 'my'] });
      setCheckInComment('');
      showToast.success('Signed in for today');
    },
    onError: (error: Error) => showToast.error(error.message),
  });
  const signOut = useMutation({
    mutationFn: teacherAttendanceService.signOut,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teacher-attendance', 'my'] });
      setSignOutComment('');
      showToast.success('Signed out for today');
    },
    onError: (error: Error) => showToast.error(error.message),
  });

  if (!isPrincipal) {
    const todayRecord = mine.data?.records.find((record) => record.date.slice(0, 10) === mine.data?.today);
    const stats = mine.data?.stats;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {viewingPast ? `Your ${year} attendance (history).` : `Your ${year || 'current year'} attendance.`}
          </p>
          <YearFilter value={year} onChange={changeYear} noAutoSelect />
        </div>

        {viewingPast && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <span>Showing your <strong>{year}</strong> attendance as history. Sign in for today in {activeYear}.</span>
            <button type="button" onClick={() => changeYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          </div>
        )}

        {/* Year summary (server-computed over the whole year). */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KPICard title="Attendance Rate" value={`${stats.rate}%`} icon={<CheckCircle size={20} />} color={stats.total === 0 ? 'blue' : stats.rate >= 85 ? 'green' : stats.rate >= 75 ? 'amber' : 'red'} subtitle={year} />
            <KPICard title="Present" value={stats.present} icon={<CheckCircle size={20} />} color="green" />
            <KPICard title="Late" value={stats.late} icon={<Clock size={20} />} color="amber" />
            <KPICard title="Absent / Excused" value={stats.absent + stats.excused} icon={<Clock size={20} />} color="red" />
          </div>
        )}

        {/* Today's sign-in is a "right now" action: current year only. */}
        {!viewingPast && <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">My attendance</h2>
          <p className="mt-1 text-sm text-gray-500">Sign in when you arrive at school and sign out when you leave. Your principal can review or correct the record.</p>
          {mine.isLoading || !year ? <Loader2 className="mt-5 animate-spin text-blue-600" /> : mine.isError ? (
            <p role="alert" className="mt-4 text-sm text-red-600">{(mine.error as Error).message}</p>
          ) : (
            <div className="mt-5 space-y-4">
              {todayRecord ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${STATUS_BADGE[todayRecord.status] ?? STATUS_BADGE.present}`}>
                      <CheckCircle size={17} /> Today: {label(todayRecord.status)}
                    </span>
                    {todayRecord.signed_in_at ? (
                      <span className="text-sm text-gray-600 dark:text-gray-300">Signed in: {time(todayRecord.signed_in_at)} · Signed out: {time(todayRecord.signed_out_at)}</span>
                    ) : (
                      <span className="text-xs text-gray-500">Recorded by your principal.</span>
                    )}
                  </div>
                  {/* Principal marked today before arrival: the teacher can still sign in. */}
                  {!todayRecord.signed_in_at && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="teacher-late-sign-in-comment">Arrived? Sign in (optional comment)</label>
                      <input id="teacher-late-sign-in-comment" value={checkInComment} maxLength={500} onChange={(event) => setCheckInComment(event.target.value)}
                        placeholder="Anything the principal should know?" className="w-full max-w-xl rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                      <div className="flex flex-wrap gap-3">
                        <Button disabled={checkIn.isPending} onClick={() => checkIn.mutate({ status: 'present', comment: checkInComment })}>Sign in as present</Button>
                        <Button variant="outline" disabled={checkIn.isPending} onClick={() => checkIn.mutate({ status: 'late', comment: checkInComment })}>
                          <Clock size={15} className="mr-1.5" /> Sign in as late
                        </Button>
                      </div>
                    </div>
                  )}
                  {todayRecord.signed_in_at && !todayRecord.signed_out_at && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="teacher-sign-out-comment">Sign-out comment (optional)</label>
                      <input id="teacher-sign-out-comment" value={signOutComment} maxLength={500} onChange={(event) => setSignOutComment(event.target.value)}
                        placeholder="Anything the principal should know?" className="w-full max-w-xl rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                      <Button disabled={signOut.isPending} onClick={() => signOut.mutate(signOutComment)}>Sign out for today</Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="teacher-sign-in-comment">Sign-in comment (optional)</label>
                  <input id="teacher-sign-in-comment" value={checkInComment} maxLength={500} onChange={(event) => setCheckInComment(event.target.value)}
                    placeholder="Anything the principal should know?" className="w-full max-w-xl rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                  <div className="flex flex-wrap gap-3">
                    <Button disabled={checkIn.isPending} onClick={() => checkIn.mutate({ status: 'present', comment: checkInComment })}>Sign in as present</Button>
                    <Button variant="outline" disabled={checkIn.isPending} onClick={() => checkIn.mutate({ status: 'late', comment: checkInComment })}>
                      <Clock size={15} className="mr-1.5" /> Sign in as late
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>}
        {viewingPast && mine.isError && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{(mine.error as Error).message}</p>
        )}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="border-b border-gray-100 px-5 py-4 text-sm font-bold dark:border-gray-700">My records in {year}</h3>
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-700"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Sign in</th><th className="px-5 py-3">Sign out</th><th className="px-5 py-3">Comments / remarks</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {mine.data?.records.map((record) => <tr key={record.id}>
                <td className="px-5 py-3">{record.date.slice(0, 10)}</td>
                <td className="px-5 py-3 font-semibold">{label(record.status)}</td>
                <td className="px-5 py-3">{time(record.signed_in_at)}</td>
                <td className="px-5 py-3">{time(record.signed_out_at)}</td>
                <td className="px-5 py-3">{[record.sign_in_comment, record.sign_out_comment, record.remarks].filter(Boolean).join(' · ') || '—'}</td>
              </tr>)}
            </tbody>
          </table>
          {mine.isLoading && <div className="p-6 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" /></div>}
          {mine.data?.records.length === 0 && (
            <p className="px-5 py-6 text-sm text-gray-500">
              {viewingPast ? `You have no attendance records in ${year}.` : `No attendance records in ${year} yet. Sign in above when you arrive.`}
            </p>
          )}
        </div>
      </div>
    );
  }

  const teachers = roster.data?.teachers ?? [];
  const marked = teachers.filter((teacher) => teacher.attendance).length;
  // The server flags dates that fall in a past academic year (read-only).
  const readOnly = !!roster.data?.read_only;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Teacher register</h2>
          <p className="mt-1 text-sm text-gray-500">{marked} of {teachers.length} active teachers marked for this date. Arrival and departure times come from each teacher's sign-in and sign-out.</p>
        </div>
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Attendance date
          <input type="date" value={date} max={dateToday()} onChange={(event) => setDate(event.target.value)}
            className="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        </label>
      </div>
      {readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
          <span><strong>{date}</strong> is in a past academic year. Its teacher register is read-only history.</span>
          <button type="button" onClick={() => setDate(dateToday())} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">Back to today</button>
        </div>
      )}
      {roster.isLoading ? <div className="p-10 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" /></div> : roster.isError ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{(roster.error as Error).message}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-700"><tr><th className="px-5 py-3">Teacher</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Sign in</th><th className="px-5 py-3">Sign out</th><th className="px-5 py-3">Teacher comments</th><th className="px-5 py-3">Principal remarks</th><th className="px-5 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {teachers.map((teacher: TeacherAttendanceRow) => {
                const draft = drafts[teacher.id] ?? { status: '', remarks: '' };
                const busy = saveMark.isPending && saveMark.variables?.teacherId === teacher.id;
                const unchanged = draft.status === (teacher.attendance?.status ?? '') && draft.remarks === (teacher.attendance?.remarks ?? '');
                return <tr key={teacher.id}>
                  <td className="px-5 py-3"><span className="font-semibold text-gray-900 dark:text-white">{teacher.first_name} {teacher.last_name}</span><span className="block text-xs text-gray-500">{teacher.staff_code} · {teacher.designation || 'Teacher'}{teacher.is_active === false ? ' · no longer active' : ''}</span></td>
                  <td className="px-5 py-3"><select aria-label={`Status for ${teacher.first_name} ${teacher.last_name}`} value={draft.status} disabled={readOnly}
                    onChange={(event) => setDrafts((previous) => ({ ...previous, [teacher.id]: { ...draft, status: event.target.value as AttendanceStatus } }))}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="">Unmarked</option>{STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                  </select></td>
                  <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-300">{time(teacher.attendance?.signed_in_at)}</td>
                  <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-300">{time(teacher.attendance?.signed_out_at)}</td>
                  <td className="max-w-[230px] px-5 py-3 text-xs text-gray-600 dark:text-gray-300">{[teacher.attendance?.sign_in_comment, teacher.attendance?.sign_out_comment].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-5 py-3"><input aria-label={`Remarks for ${teacher.first_name} ${teacher.last_name}`} value={draft.remarks} maxLength={500} disabled={readOnly}
                    onChange={(event) => setDrafts((previous) => ({ ...previous, [teacher.id]: { ...draft, remarks: event.target.value } }))}
                    placeholder="Optional" className="w-full min-w-[150px] rounded-lg border border-gray-300 bg-white px-2 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></td>
                  <td className="px-5 py-3"><Button size="sm" disabled={readOnly || !draft.status || unchanged || saveMark.isPending} onClick={() => saveMark.mutate({ teacherId: teacher.id, status: draft.status as AttendanceStatus, remarks: draft.remarks })}>{busy ? 'Saving…' : 'Save'}</Button></td>
                </tr>;
              })}
            </tbody>
          </table>
          {teachers.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">No active teachers found for this school.</p>}
        </div>
      )}
    </div>
  );
};
