import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { teacherAttendanceService, TeacherAttendanceRow } from '@services/teacherAttendanceService';
import type { AttendanceStatus } from '@services/attendanceService';

const STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];
const dateToday = () => new Date().toISOString().slice(0, 10);
const label = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);
const time = (value?: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export const TeacherAttendancePanel: React.FC<{ role: string }> = ({ role }) => {
  const queryClient = useQueryClient();
  const isPrincipal = role === 'principal' || role === 'super_admin';
  const [date, setDate] = useState(dateToday);
  const [drafts, setDrafts] = useState<Record<string, { status: AttendanceStatus | ''; remarks: string }>>({});
  const [checkInComment, setCheckInComment] = useState('');
  const [signOutComment, setSignOutComment] = useState('');

  const roster = useQuery({
    queryKey: ['teacher-attendance', 'roster', date],
    queryFn: () => teacherAttendanceService.getRoster(date),
    enabled: isPrincipal,
    staleTime: 0,
  });
  const mine = useQuery({
    queryKey: ['teacher-attendance', 'my'],
    queryFn: teacherAttendanceService.getMyAttendance,
    enabled: !isPrincipal,
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
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">My attendance</h2>
          <p className="mt-1 text-sm text-gray-500">Sign in when you arrive at school and sign out when you leave. Your principal can review or correct the record.</p>
          {mine.isLoading ? <Loader2 className="mt-5 animate-spin text-blue-600" /> : mine.isError ? (
            <p role="alert" className="mt-4 text-sm text-red-600">{(mine.error as Error).message}</p>
          ) : (
            <div className="mt-5 space-y-4">
              {todayRecord ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                      <CheckCircle size={17} /> Today: {label(todayRecord.status)}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Signed in: {time(todayRecord.signed_in_at)} · Signed out: {time(todayRecord.signed_out_at)}</span>
                  </div>
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
        </div>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h3 className="border-b border-gray-100 px-5 py-4 text-sm font-bold dark:border-gray-700">My recent records</h3>
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
          {mine.data?.records.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">No attendance records yet.</p>}
        </div>
      </div>
    );
  }

  const teachers = roster.data?.teachers ?? [];
  const marked = teachers.filter((teacher) => teacher.attendance).length;
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
                  <td className="px-5 py-3"><span className="font-semibold text-gray-900 dark:text-white">{teacher.first_name} {teacher.last_name}</span><span className="block text-xs text-gray-500">{teacher.staff_code} · {teacher.designation || 'Teacher'}</span></td>
                  <td className="px-5 py-3"><select aria-label={`Status for ${teacher.first_name} ${teacher.last_name}`} value={draft.status}
                    onChange={(event) => setDrafts((previous) => ({ ...previous, [teacher.id]: { ...draft, status: event.target.value as AttendanceStatus } }))}
                    className="rounded-lg border border-gray-300 bg-white px-2 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <option value="">Unmarked</option>{STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                  </select></td>
                  <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-300">{time(teacher.attendance?.signed_in_at)}</td>
                  <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-300">{time(teacher.attendance?.signed_out_at)}</td>
                  <td className="max-w-[230px] px-5 py-3 text-xs text-gray-600 dark:text-gray-300">{[teacher.attendance?.sign_in_comment, teacher.attendance?.sign_out_comment].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-5 py-3"><input aria-label={`Remarks for ${teacher.first_name} ${teacher.last_name}`} value={draft.remarks} maxLength={500}
                    onChange={(event) => setDrafts((previous) => ({ ...previous, [teacher.id]: { ...draft, remarks: event.target.value } }))}
                    placeholder="Optional" className="w-full min-w-[150px] rounded-lg border border-gray-300 bg-white px-2 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" /></td>
                  <td className="px-5 py-3"><Button size="sm" disabled={!draft.status || unchanged || saveMark.isPending} onClick={() => saveMark.mutate({ teacherId: teacher.id, status: draft.status as AttendanceStatus, remarks: draft.remarks })}>{busy ? 'Saving…' : 'Save'}</Button></td>
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
