/**
 * Parent / student extras under the fee ledger (bursar Phase A): payment
 * history with PDF receipts, the instalment schedule, account credit and the
 * statement of account. Read-only; the server only returns the viewer's own
 * (or their linked child's) records.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Receipt, CalendarClock, FileText, Percent } from 'lucide-react';
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
    queryFn: async () => { const r: any = await bursarService.credit(studentId); if (r?.success === false) throw new Error(r.error); return r.data as { balance: number; entries: any[] }; },
    enabled: !!studentId,
  });
  const discounts = useQuery({
    queryKey: ['fin-family-discounts', studentId, y],
    queryFn: async () => { const r: any = await bursarService.studentDiscounts(studentId, y); if (r?.success === false) throw new Error(r.error); return r.data as any[]; },
    enabled: !!studentId && !!y,
  });
  const CREDIT_KIND: Record<string, string> = { overpayment: 'Overpayment kept as credit', credit_note: 'Credit from the school', applied: 'Used for fees', refunded: 'Refunded to you' };
  const active = (plans.data || []).filter((p) => p.status === 'active');
  return (
    <div className="space-y-4">
      {(credit.data?.balance || 0) > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          {le(credit.data!.balance)} is held as credit on this account. The school applies it to the next fees.
        </div>
      )}
      {(discounts.data || []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Percent size={16} /> Discounts &amp; scholarships · {y}</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {discounts.data!.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><span className="font-medium">{g.label}</span> <span className="text-xs text-gray-500">{g.basis === 'percent' ? `${g.value}%` : le(g.value)} on {g.applies_to === 'all' ? 'all charges' : 'tuition'} · {g.term || 'whole year'}</span></span>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{g.applied_amount > 0 ? `${le(g.applied_amount)} off` : 'Applies when fees are billed'}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {(credit.data?.entries || []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Receipt size={16} /> Account credit</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {credit.data!.entries.map((e: any) => (
                <li key={e.id} className="flex justify-between py-1.5">
                  <span>{CREDIT_KIND[e.kind] || e.kind} <span className="text-gray-400">{String(e.created_at).slice(0, 10)}</span></span>
                  <span className={Number(e.amount) >= 0 ? 'text-emerald-700' : 'text-gray-600'}>{Number(e.amount) >= 0 ? '+' : '−'}{le(Math.abs(Number(e.amount)))}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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
