/**
 * MyFeesPage — /finance/my-fees
 * Self-service fees for students and parents. Students see their own ledger;
 * parents pick a child and see that child's ledger. Both can pay outstanding
 * balances online (when configured). Read scope is enforced server-side.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { Loader2, UserCircle2, Wallet } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import useAuthStore from '@store/authStore';
import { StudentLedgerView } from '@components/finance/StudentLedgerView';
import { PayFeesButton } from '@components/finance/PayFeesButton';
import { parentDashboardService } from '@services/parentDashboardService';
import { financeLedgerService } from '@services/financeLedgerService';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';

const fmtLe = (v: number | null | undefined) =>
  `Le ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface AutoPayIntent { studentId?: string; amount?: number; label?: string; }

/** Student view: own ledger + pay own outstanding. */
const StudentFees: React.FC<{ autoPay?: AutoPayIntent | null; onAutoConsumed?: () => void; year?: string }> = ({ autoPay, onAutoConsumed, year }) => {
  const { data } = useQuery({
    queryKey: ['my-ledger'],
    queryFn: () => financeLedgerService.getMyLedger(),
    staleTime: 60_000,
  });
  const ledger = (data as any)?.data?.data ?? (data as any)?.data;
  const outstanding = Number(ledger?.totals?.outstanding) || 0;

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white"><Wallet className="w-4 h-4" /> My Fees</h2>
      </div>
      {/* Auto-pay trigger (only when arriving from a dashboard "Pay" click). The
          visible Pay button lives inside the ledger below. */}
      {autoPay && outstanding > 0 && ledger?.student_id && (
        <div className="hidden">
          <PayFeesButton
            studentId={ledger.student_id}
            amount={autoPay.amount || outstanding}
            label={autoPay.label || 'School Fees'}
            autoStart
            onAutoStarted={onAutoConsumed}
          />
        </div>
      )}
      <StudentLedgerView academicYear={year || undefined} />
    </div>
  );
};

/** Parent view: child switcher + selected child's ledger + pay. */
const ParentFees: React.FC<{ autoPay?: AutoPayIntent | null; onAutoConsumed?: () => void; year?: string }> = ({ autoPay, onAutoConsumed, year }) => {
  const { data: dashResp, isLoading } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: () => parentDashboardService.getDashboard(),
    staleTime: 60_000,
  });
  const dash = (dashResp as any)?.data ?? (dashResp as any);
  const children = dash?.children ?? [];
  // If arriving with a pay intent for a specific child, preselect that child.
  const [selectedId, setSelectedId] = useState(autoPay?.studentId || '');
  const currentId = selectedId || autoPay?.studentId || children[0]?.id || '';

  const { data: ledgerResp } = useQuery({
    queryKey: ['child-ledger', currentId],
    queryFn: () => financeLedgerService.getStudentLedger(currentId),
    enabled: !!currentId,
    staleTime: 60_000,
  });
  const ledger = (ledgerResp as any)?.data?.data ?? (ledgerResp as any)?.data;
  const outstanding = Number(ledger?.totals?.outstanding) || 0;

  // Everything still owed across children and ALL years (this year's fees
  // plus earlier years' unpaid balances), so the headline never hides arrears.
  const aggregate = useMemo(
    () => (children as any[]).reduce((s, c) => s + (Number(c.total_owed ?? c.outstanding_fees) || 0), 0),
    [children],
  );

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…</div>;
  }
  if (children.length === 0) {
    return <EmptyState message="No children linked" description="Your account isn't linked to any student yet. Please contact the school office." />;
  }

  return (
    <div className="space-y-5">
      {/* Aggregate outstanding across children */}
      <Card>
        <CardContent className="pt-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Total Outstanding (all children)</p>
            <p className={`text-2xl font-bold ${aggregate > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtLe(aggregate)}</p>
          </div>
          <Wallet className="w-8 h-8 text-gray-300" />
        </CardContent>
      </Card>

      {/* Child switcher */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {children.map((c: any) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition ${
              currentId === c.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
            }`}
          >
            {c.photo_url ? <img src={c.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" /> : <UserCircle2 className="w-6 h-6" />}
            <span className="font-medium">{c.name}</span>
            {c.class_name && <span className="text-xs text-gray-400">· {c.class_name}</span>}
          </button>
        ))}
      </div>

      <div className="px-1">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white"><Wallet className="w-4 h-4" /> Fees</h2>
      </div>
      {/* Auto-pay trigger for the selected child (from a dashboard "Pay" click). */}
      {autoPay && outstanding > 0 && currentId && (autoPay.studentId ? autoPay.studentId === currentId : true) && (
        <div className="hidden">
          <PayFeesButton
            studentId={currentId}
            amount={autoPay.amount || outstanding}
            label={autoPay.label || 'School Fees'}
            autoStart
            onAutoStarted={onAutoConsumed}
          />
        </div>
      )}
      {currentId && <StudentLedgerView studentId={currentId} academicYear={year || undefined} />}
    </div>
  );
};

export const MyFeesPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isParent = user?.role === 'parent' || (user?.role as string) === 'guardian';

  // Pick up a pay intent passed via navigation state (from a dashboard "Pay"
  // click), then clear it so a page refresh doesn't re-trigger the modal.
  const location = useLocation();
  const [autoPay, setAutoPay] = useState<AutoPayIntent | null>(
    (location.state as any)?.autoPay ?? null,
  );
  useEffect(() => {
    if ((location.state as any)?.autoPay) {
      window.history.replaceState({}, '');
    }
  }, [location.state]);
  const clearAuto = () => setAutoPay(null);
  // Opens on the CURRENT academic year ('' = current, follows a rollover).
  // "All years" is still available ('all'). Other years' unpaid balances keep
  // showing as "still payable" with a Pay button (StudentLedgerView).
  const { activeYear } = useAcademicYears();
  const [picked, setPicked] = useState('');
  const showAll = picked === 'all';
  const year = showAll ? '' : (picked || activeYear);
  // YearFilter's "All years" option is the empty value.
  const filterValue = showAll ? '' : year;
  const onYearChange = (v: string) => setPicked(!v ? 'all' : v === activeYear ? '' : v);

  return (
    <MainLayout>
      <PageShell
        title="Fees & Payments"
        subtitle={isParent ? "Your children's fees and online payment" : 'Your fees and online payment'}
        actions={<YearFilter value={filterValue} onChange={onYearChange} includeAllOption noAutoSelect />}
      >
        {/* Wait for the current year so the page never flashes "all years". */}
        {!showAll && !activeYear
          ? <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…</div>
          : isParent
            ? <ParentFees autoPay={autoPay} onAutoConsumed={clearAuto} year={year} />
            : <StudentFees autoPay={autoPay} onAutoConsumed={clearAuto} year={year} />}
      </PageShell>
    </MainLayout>
  );
};

export default MyFeesPage;
