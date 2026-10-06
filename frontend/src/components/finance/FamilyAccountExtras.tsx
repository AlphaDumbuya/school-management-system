/**
 * Parent / student extras under the fee ledger (bursar Phase A): payment
 * history with PDF receipts, the instalment schedule, account credit and the
 * statement of account. Read-only; the server only returns the viewer's own
 * (or their linked child's) records.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Receipt, CalendarClock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { bursarService, type PlanSchedule } from '@services/bursarService';
import { ReceiptsList, PlanView, le } from './StudentAccount';

export const FamilyAccountExtras: React.FC<{ studentId: string; label: string; year?: string }> = ({ studentId, label, year }) => {
  const { activeYear } = useAcademicYears();
  const y = year || activeYear;
  const [busy, setBusy] = useState(false);
  const plans = useQuery({
    queryKey: ['fin-plans', studentId],
    queryFn: async () => { const r: any = await bursarService.studentPlans(studentId); if (r?.success === false) throw new Error(r.error); return r.data as PlanSchedule[]; },
    enabled: !!studentId,
  });
  const credit = useQuery({
    queryKey: ['fin-credit', studentId],
    queryFn: async () => { const r: any = await bursarService.credit(studentId); if (r?.success === false) throw new Error(r.error); return r.data as { balance: number }; },
    enabled: !!studentId,
  });
  const active = (plans.data || []).filter((p) => p.status === 'active');
  return (
    <div className="space-y-4">
      {(credit.data?.balance || 0) > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          {le(credit.data!.balance)} is held as credit on this account. The school applies it to the next fees.
        </div>
      )}
      {active.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock size={16} /> Instalment plan</CardTitle></CardHeader>
          <CardContent className="space-y-2">{active.map((p) => <PlanView key={p.id} plan={p} />)}</CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><Receipt size={16} /> Payment history</CardTitle>
          <Button size="sm" variant="outline" disabled={busy || !y} onClick={async () => {
            setBusy(true);
            try { await bursarService.downloadStatement(studentId, y, label); } catch (e: any) { showToast.error(e.message); } finally { setBusy(false); }
          }}><FileText size={14} className="mr-1" /> Statement {y}</Button>
        </CardHeader>
        <CardContent>
          <ReceiptsList studentId={studentId} />
          <p className="mt-2 text-[11px] text-gray-500 flex items-center gap-1"><Download size={11} /> Download any receipt as a PDF. The statement lists every charge, discount and payment for the year.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FamilyAccountExtras;
