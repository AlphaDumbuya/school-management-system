/**
 * Arrears & Aging (bursar Phase A, R3): who owes what, and for how long.
 * Buckets by days past the due date; filters; export; reminders to one
 * student, a bucket, or everyone listed; run the overdue / late-fee job.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Loader2, Timer } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { SearchBar } from '@components/admin/table/SearchBar';
import { ExportButton } from '@components/admin/common/ExportButton';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { showToast } from '@utils/toast';
import { financeService } from '@services/financeService';
import { bursarService, BUCKET_LABEL, type Bucket } from '@services/bursarService';
import { StudentAccountModal, le, Pill } from '@components/finance/StudentAccount';
import { usePaged, TablePager } from '@components/admin/table/TablePager';

const BUCKETS: Bucket[] = ['not_due', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'];
const TONE: Record<Bucket, string> = {
  not_due: 'text-gray-600 border-gray-200', d1_30: 'text-amber-700 border-amber-200', d31_60: 'text-orange-700 border-orange-200',
  d61_90: 'text-red-600 border-red-200', d90_plus: 'text-red-800 border-red-300',
};

export const AgingPage: React.FC = () => {
  const qc = useQueryClient();
  const { activeYear } = useAcademicYears();
  const [picked, setPicked] = useState<string | null>(null); // null = current, '' = all years
  const year = picked ?? activeYear;
  const ready = picked !== null || !!activeYear;
  const [bucket, setBucket] = useState<Bucket | ''>('');
  const [section, setSection] = useState('');
  const [min, setMin] = useState('');
  const [search, setSearch] = useState('');
  const [account, setAccount] = useState<{ id: string; name: string; admissionNo?: string } | null>(null);
  const [remind, setRemind] = useState<{ ids: string[]; label: string } | null>(null);
  const [running, setRunning] = useState(false);

  const params: Record<string, string | undefined> = {
    academic_year: year || undefined, section: section || undefined, min: Number(min) > 0 ? String(Number(min)) : undefined, bucket: bucket || undefined,
  };
  const q = useQuery({
    queryKey: ['finance-aging', params],
    queryFn: async () => { const r: any = await bursarService.aging(params); if (r?.success === false) throw new Error(r.error || 'Could not load the aging report.'); return r.data; },
    enabled: ready,
  });
  const data = q.data;
  const rows = useMemo(() => (data?.students || []).filter((s: any) => !search || `${s.student_name} ${s.admission_no} ${s.class_name}`.toLowerCase().includes(search.toLowerCase())), [data, search]);

  const pg = usePaged<any>(rows, [year, search, section, min, bucket]);

  const sendReminders = async () => {
    let sent = 0, skipped = 0;
    for (const id of remind!.ids) {
      const r: any = await financeService.sendBalanceReminders({ scope: 'student', studentId: id });
      if (r?.success === false) skipped++; else { sent += Number(r?.data?.sent || 0); skipped += Number(r?.data?.skippedNoEmail || 0); }
    }
    showToast.success(`Reminders sent: ${sent}${skipped ? ` · ${skipped} without an email on file` : ''}`);
  };

  return (
    <MainLayout>
      <PageShell title="Arrears & Aging" subtitle={`Who owes what, and for how long${data ? ` · as of ${data.as_of}` : ''}`} onRefresh={() => q.refetch()} isRefreshing={q.isFetching}
        actions={<div className="flex items-center gap-2">
          <YearFilter value={year} onChange={(y) => setPicked(y === activeYear ? null : y)} includeAllOption />
          <ExportButton endpoint="/api/v1/finance/aging/export" filename="arrears-aging" params={params} />
        </div>}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          {BUCKETS.map((b) => (
            <button key={b} type="button" aria-pressed={bucket === b} onClick={() => setBucket(bucket === b ? '' : b)}
              className={`text-left rounded-2xl border bg-white dark:bg-gray-800 p-3 ${TONE[b]} ${bucket === b ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="text-lg font-black">{data ? le(data.totals[b]) : '—'}</div>
              <div className="text-[11px] font-semibold">{BUCKET_LABEL[b]}</div>
            </button>
          ))}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-900 text-white p-3">
            <div className="text-lg font-black">{data ? le(data.totals.total) : '—'}</div>
            <div className="text-[11px] font-semibold text-white/70">{data ? `${data.totals.students} students owe` : 'Total owed'}</div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-2 mb-3 lg:items-center">
          <SearchBar placeholder="Search student or class…" onSearch={setSearch} className="w-full lg:max-w-sm" />
          <select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
            <option value="">All sections</option><option value="nursery">Nursery</option><option value="primary">Primary</option><option value="jss">JSS</option><option value="sss">SSS</option>
          </select>
          <input aria-label="Minimum owed (Le)" type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} placeholder="Owes at least Le…" className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm w-full lg:w-44" />
          <div className="flex gap-2 lg:ml-auto">
            <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => setRemind({ ids: rows.map((r: any) => r.student_id), label: `${rows.length} student${rows.length === 1 ? '' : 's'} listed` })}><Bell size={14} className="mr-1" /> Remind all listed</Button>
            <Button size="sm" variant="outline" disabled={running} onClick={async () => {
              setRunning(true);
              try {
                const r: any = await bursarService.runLateFees();
                if (r?.success === false) return showToast.error(r.error || 'Failed');
                showToast.success(`${r.data.markedOverdue} fee${r.data.markedOverdue === 1 ? '' : 's'} marked overdue · ${r.data.lateFeesCharged} late fee${r.data.lateFeesCharged === 1 ? '' : 's'} (${le(r.data.lateFeeAmount)})`);
                qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('finance-') || String(x.queryKey[0]).startsWith('fin-') });
              } finally { setRunning(false); }
            }}>{running ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Timer size={14} className="mr-1" />} Run overdue check</Button>
          </div>
        </div>

        {q.error ? <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
          : q.isLoading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : rows.length === 0 ? <EmptyState message="Nobody owes anything here" description={bucket ? `No balances ${BUCKET_LABEL[bucket].toLowerCase()} past due.` : 'All fees in this view are paid.'} />
          : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500">
                  <tr><th className="px-3 py-3 text-left">Student</th><th className="px-3 py-3 text-left">Class</th>{BUCKETS.map((b) => <th key={b} className="px-3 py-3 text-right whitespace-nowrap">{BUCKET_LABEL[b]}</th>)}<th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-left">Last paid</th><th className="px-3 py-3" /></tr>
                </thead>
                <tbody>
                  {pg.pageRows.map((s: any) => (
                    <tr key={s.student_id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2.5"><button type="button" onClick={() => setAccount({ id: s.student_id, name: s.student_name, admissionNo: s.admission_no })} className="font-medium text-blue-700 hover:underline dark:text-blue-300">{s.student_name}</button>
                        <div className="text-[11px] text-gray-400">{s.admission_no}{s.on_plan ? ' · ' : ''}{s.on_plan && <Pill s="approved" label="On plan" />}</div></td>
                      <td className="px-3 py-2.5 text-xs">{s.class_name || '—'}</td>
                      {BUCKETS.map((b) => <td key={b} className={`px-3 py-2.5 text-right whitespace-nowrap ${s.buckets[b] > 0 ? TONE[b].split(' ')[0] + ' font-semibold' : 'text-gray-300'}`}>{s.buckets[b] > 0 ? le(s.buckets[b]) : '—'}</td>)}
                      <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">{le(s.total)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{s.last_payment ? String(s.last_payment).slice(0, 10) : 'Never'}</td>
                      <td className="px-3 py-2.5 text-right"><button type="button" aria-label={`Remind ${s.student_name}`} onClick={() => setRemind({ ids: [s.student_id], label: s.student_name })} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50"><Bell size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePager {...pg.pager} label="students" />
            </div>
          )}

        <ConfirmationDialog isOpen={!!remind} onClose={() => setRemind(null)} isDestructive={false} title="Send fee reminders" confirmLabel="Send"
          message={remind ? `Email and notify the parents of ${remind.label} about what they owe, with a Pay button.` : ''} onConfirm={sendReminders} />
        <StudentAccountModal student={account} onClose={() => setAccount(null)} />
      </PageShell>
    </MainLayout>
  );
};

export default AgingPage;
