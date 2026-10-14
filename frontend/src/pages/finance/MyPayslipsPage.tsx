/** My Payslips: a staff member's own payslips (approved and paid months). */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { showToast } from '@utils/toast';
import { bursarB } from '@services/bursarService';
import { le, Pill } from '@components/finance/StudentAccount';
import { usePaged, TablePager } from '@components/admin/table/TablePager';

export const MyPayslipsPage: React.FC = () => {
  const q = useQuery({ queryKey: ['fin-my-slips'], queryFn: async () => { const r: any = await bursarB.mySlips(); if (r?.success === false) throw new Error(r.error || 'Could not load payslips.'); return r.data as any[]; } });
  const [busy, setBusy] = useState<string | null>(null);
  const pg = usePaged<any>(q.data || [], [], 10);
  return (
    <MainLayout>
      <PageShell title="My Payslips" subtitle="Your monthly payslips: pay, PAYE, NASSIT and deductions"
        onRefresh={() => q.refetch()} isRefreshing={q.isFetching} mobileLabels>
        {q.error ? <p role="alert" className="text-sm text-red-600">{(q.error as Error).message} <button type="button" className="font-bold underline" onClick={() => q.refetch()}>Retry</button></p>
          : q.isLoading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
          : (q.data || []).length === 0 ? <EmptyState message="No payslips yet" description="Your payslip appears here once the school approves the month's payroll." />
          : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500"><tr><th className="px-4 py-3 text-left">Month</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">PAYE</th><th className="px-4 py-3 text-right">NASSIT</th><th className="px-4 py-3 text-right">Net pay</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3" /></tr></thead>
                <tbody>
                  {pg.pageRows.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{new Date(`${s.period}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">{le(s.gross)}</td><td className="px-4 py-3 text-right whitespace-nowrap">{le(s.paye)}</td><td className="px-4 py-3 text-right whitespace-nowrap">{le(s.nassit_employee)}</td>
                      <td className="px-4 py-3 text-right font-bold whitespace-nowrap">{le(s.net)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><Pill s={s.status === 'paid' ? 'approved' : 'part_paid'} label={s.status === 'paid' ? `Paid ${String(s.payment_date || '').slice(0, 10)}` : 'Approved'} /></td>
                      <td className="px-4 py-3 text-right"><button type="button" aria-label={`Download payslip for ${s.period}`} disabled={busy === s.id}
                        onClick={async () => { setBusy(s.id); try { await bursarB.downloadSlip(s.id, s.period); } catch (e: any) { showToast.error(e.message); } finally { setBusy(null); } }}
                        className="inline-flex items-center gap-1 min-h-[40px] sm:min-h-0 px-2 -mx-2 whitespace-nowrap text-xs font-semibold text-blue-600 hover:underline disabled:opacity-60">{busy === s.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PDF</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePager {...pg.pager} label="payslips" />
            </div>
          )}
      </PageShell>
    </MainLayout>
  );
};

export default MyPayslipsPage;
