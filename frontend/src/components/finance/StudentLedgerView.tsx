/**
 * StudentLedgerView — per-student financial ledger (financial-management spec §2).
 * Used in the student & parent portals. Read-only; reflects the same figures
 * staff see. Shows a summary, a combined terms card, and a charges card, with a
 * single "Pay" button that opens a multi-step wizard (scope → amount → USSD).
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle, Receipt, TrendingUp, CreditCard, CalendarDays, Layers } from 'lucide-react';
import { financeLedgerService, StudentLedger, LedgerTerm } from '@services/financeLedgerService';
import { PayFeesButton, PayScope } from '@components/finance/PayFeesButton';

const TERM_LABEL: Record<LedgerTerm, string> = {
  first_term: 'First Term',
  second_term: 'Second Term',
  third_term: 'Third Term',
};

const fmtLe = (v: number | null | undefined) =>
  `Le ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (paid: number, billed: number) => {
  if (!billed || billed <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((paid / billed) * 100)));
};

// Charge types that are "tuition"; everything else is treated as a charge.
const isTuition = (type?: string | null) => (type || '').toLowerCase().includes('tuition');

interface Props {
  studentId?: string;
  /**
   * Limit the ledger to ONE academic year (dashboards follow their year
   * picker). Other years' unpaid balance is shown as a single "from earlier
   * years" line instead of their full breakdown. Omit for every year.
   */
  academicYear?: string;
  canPay?: boolean;
  /** When true, the Pay button navigates to /finance/my-fees instead of paying
   *  inline (used on dashboards to centralise payment). */
  redirectToPay?: boolean;
  /** Open the Pay wizard as soon as the ledger is shown (arriving from a dashboard Pay click). */
  autoStartPay?: boolean;
  /** Called once the wizard has been opened, so it is not opened again. */
  onAutoStartPay?: () => void;
}

export const StudentLedgerView: React.FC<Props> = ({ studentId, academicYear, canPay = true, redirectToPay = false, autoStartPay = false, onAutoStartPay }) => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-ledger', studentId ?? 'me'],
    queryFn: () => (studentId ? financeLedgerService.getStudentLedger(studentId) : financeLedgerService.getMyLedger()),
    staleTime: 60_000,
  });

  const fullLedger: StudentLedger | undefined = (data as any)?.data?.data ?? (data as any)?.data;

  // Year-limited view: keep only that year, and recompute the summary from it.
  // Balances from other years are still owed, so they're kept as one figure.
  const sameYear = (a?: string | null, b?: string | null) =>
    String(a ?? '').replace(/[^0-9]/g, '') === String(b ?? '').replace(/[^0-9]/g, '');
  const ledger: StudentLedger | undefined = React.useMemo(() => {
    if (!fullLedger || !academicYear) return fullLedger;
    const years = fullLedger.years.filter((y) => sameYear(y.academic_year, academicYear));
    const sum = (k: 'billed' | 'paid' | 'outstanding' | 'discounted' | 'credit_applied') =>
      Math.round(years.reduce((s, y: any) => s + Number(y[k] || 0), 0) * 100) / 100;
    return { ...fullLedger, years, totals: { ...fullLedger.totals, billed: sum('billed'), paid: sum('paid'), discounted: sum('discounted'), credit_applied: sum('credit_applied'), outstanding: sum('outstanding') } as any };
  }, [fullLedger, academicYear]);
  // Unpaid balances from OTHER years, per year (oldest first), so the student
  // is told exactly which year's fees are still owed.
  const arrears = React.useMemo(() => {
    if (!fullLedger || !academicYear) return [] as { year: string; amount: number }[];
    return fullLedger.years
      .filter((y) => !sameYear(y.academic_year, academicYear) && Number(y.outstanding || 0) > 0)
      .map((y: any) => ({ year: String(y.academic_year), amount: Math.round(Number(y.outstanding) * 100) / 100 }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [fullLedger, academicYear]);
  const otherYearsOutstanding = Math.round(arrears.reduce((s, a) => s + a.amount, 0) * 100) / 100;

  // Payment policy (drives the "charges compulsory in first term" note).
  const { data: policyResp } = useQuery({
    queryKey: ['payment-policy', ledger?.student_id],
    queryFn: () => financeLedgerService.getPaymentPolicy(ledger!.student_id),
    enabled: !!ledger?.student_id,
    staleTime: 5 * 60_000,
  });
  const chargesCompulsory = ((policyResp as any)?.data?.data ?? (policyResp as any)?.data)?.charges_compulsory_first_term === true;

  if (isLoading) {
    return <div className="flex items-center justify-center py-10 text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading ledger…</div>;
  }
  if (error || !ledger) {
    // apiClient never throws: show the server's reason (e.g. "not your child").
    return <p role="alert" className="text-sm text-gray-500 py-6 text-center">{(data as any)?.error || "Couldn't load the financial ledger."}</p>;
  }
  // "2026/2027" is LAST year when it's the year just before the one shown.
  const yearStart = (y: string) => Number(String(y).slice(0, 4)) || 0;
  const describe = (y: string) =>
    academicYear && yearStart(y) === yearStart(academicYear) - 1 ? `${y} (last year)` : y;

  const ArrearsNote = () => otherYearsOutstanding > 0 ? (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          {arrears.length === 1 ? (
            <p className="font-semibold">
              You still owe {fmtLe(arrears[0].amount)} in school fees from {describe(arrears[0].year)}.
            </p>
          ) : (
            <>
              <p className="font-semibold">You still owe {fmtLe(otherYearsOutstanding)} in school fees from earlier years:</p>
              <ul className="mt-1 space-y-0.5">
                {arrears.map((a) => (
                  <li key={a.year}>• {describe(a.year)}: <strong>{fmtLe(a.amount)}</strong></li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            This balance has not been cleared and must still be paid. Please pay it, or speak to the school office if you think it is wrong.
          </p>
        </div>
      </div>
      {canPay && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => navigate(studentId ? `/finance/my-fees?child=${studentId}` : '/finance/my-fees')}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            <CreditCard size={15} /> Pay {fmtLe(otherYearsOutstanding)} now
          </button>
        </div>
      )}
    </div>
  ) : null;

  if (ledger.years.length === 0) {
    return (
      <div className="space-y-3">
        <ArrearsNote />
        <div className="py-10 text-center">
          <Receipt className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{academicYear ? `No fees billed for ${academicYear} yet.` : 'No charges on record yet.'}</p>
        </div>
      </div>
    );
  }

  // Progress = how much of the bill is settled (paid, discounted or covered by credit).
  const paidPct = pct(ledger.totals.billed - ledger.totals.outstanding, ledger.totals.billed);
  const settled = ledger.totals.outstanding <= 0;
  const sid = ledger.student_id;

  // Build the payable scopes across all years: full outstanding, each term with
  // a balance, and charges-only (non-tuition) totals.
  const scopes: PayScope[] = [];
  if (ledger.totals.outstanding > 0) {
    scopes.push({ id: 'all', label: 'Full outstanding balance', amount: ledger.totals.outstanding });
  }
  ledger.years.forEach((y) => {
    if (y.outstanding > 0) {
      scopes.push({ id: `year:${y.academic_year}`, label: `Full Year`, sublabel: y.academic_year, amount: y.outstanding });
    }
    y.terms.forEach((t) => {
      if (t.outstanding > 0) {
        scopes.push({ id: `term:${y.academic_year}:${t.term}`, label: `${TERM_LABEL[t.term]} — Full`, sublabel: y.academic_year, amount: t.outstanding });
      }
      const chargeList = t.charges.filter((c) => !isTuition(c.type) && Number(c.outstanding || 0) > 0);
      const chargesOnly = chargeList.reduce((s, c) => s + Number(c.outstanding || 0), 0);
      if (chargesOnly > 0) {
        scopes.push({
          id: `charges:${y.academic_year}:${t.term}`,
          label: `${TERM_LABEL[t.term]} — Charges only`,
          sublabel: y.academic_year,
          amount: Math.round(chargesOnly * 100) / 100,
          chargeItems: chargeList.map((c) => ({
            id: c.id,
            label: c.type || 'Charge',
            amount: Math.round(Number(c.outstanding || 0) * 100) / 100,
            required: c.required !== false,
          })),
        });
      }
    });
  });

  // De-dupe scopes by id, keep order.
  const seen = new Set<string>();
  const uniqueScopes = scopes.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));

  // A plain function (not a component) so the Pay wizard keeps its state when this view re-renders.
  const renderPayAction = () => {
    if (!canPay || ledger.totals.outstanding <= 0) return null;
    if (redirectToPay) {
      return (
        <button
          // Go to the fees page and open the Pay wizard there: the click is not lost by the redirect.
          onClick={() => navigate(studentId ? `/finance/my-fees?child=${studentId}` : '/finance/my-fees', { state: { autoPay: { studentId: studentId || undefined } } })}
          className="inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:shadow-md transition-all px-4 py-2.5 text-sm w-full sm:w-auto"
        >
          <CreditCard size={16} /> Pay Fees
        </button>
      );
    }
    return (
      <PayFeesButton studentId={sid} amount={ledger.totals.outstanding} label="School Fees" scopes={uniqueScopes} showHint autoStart={autoStartPay} onAutoStarted={onAutoStartPay}>
        Pay Fees
      </PayFeesButton>
    );
  };

  return (
    <div className="space-y-4">
      <ArrearsNote />
      {/* Summary */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-900/60 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryStat icon={<Receipt className="w-4 h-4" />} iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" label="Total Billed" value={fmtLe(ledger.totals.billed)} />
          <SummaryStat icon={<CheckCircle2 className="w-4 h-4" />} iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" label="Total Paid" value={fmtLe(ledger.totals.paid)} valueClass="text-emerald-600 dark:text-emerald-400" />
          <SummaryStat icon={settled ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} iconBg={settled ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'} label="Outstanding" value={fmtLe(ledger.totals.outstanding)} valueClass={settled ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} />
        </div>
        {(Number((ledger.totals as any).discounted) > 0 || Number((ledger.totals as any).credit_applied) > 0) && (
          <p className="mt-3 text-xs text-indigo-700 dark:text-indigo-300">
            {Number((ledger.totals as any).discounted) > 0 && <>Discounts &amp; scholarships took {fmtLe((ledger.totals as any).discounted)} off the fees. </>}
            {Number((ledger.totals as any).credit_applied) > 0 && <>{fmtLe((ledger.totals as any).credit_applied)} was paid from account credit. </>}
            “Total Paid” is money actually paid.
          </p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Payment progress</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{paidPct}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${settled ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'}`} style={{ width: `${paidPct}%` }} />
          </div>
        </div>

        {/* Single Pay action */}
        <div className="mt-4 flex justify-end">
          {renderPayAction()}
        </div>
      </div>

      {/* Per academic year: combined terms card + charges card */}
      {ledger.years.map((y) => (
        <div key={y.academic_year} className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <CalendarDays size={15} className="text-blue-500" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">{y.academic_year}</span>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${y.outstanding <= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>
              {y.outstanding <= 0 ? 'Settled' : `Due ${fmtLe(y.outstanding)}`}
            </span>
          </div>

          <TermsCard year={y} />
          <ChargesCard year={y} chargesCompulsory={chargesCompulsory} />
        </div>
      ))}
    </div>
  );
};

// ── One card summarising all three terms (tuition + totals) ──────────────────
const TermsCard: React.FC<{ year: any }> = ({ year: y }) => (
  <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
    <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center gap-2">
      <Layers size={16} className="text-white" />
      <span className="text-sm font-bold text-white">Term Fees (Tuition)</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50/50 dark:bg-gray-800/20">
            <th className="text-left font-semibold px-4 py-2">Term</th>
            <th className="text-right font-semibold px-3 py-2">Billed</th>
            <th className="text-right font-semibold px-3 py-2">Paid</th>
            {Number(y.discounted) + Number(y.credit_applied || 0) > 0 && <th className="text-right font-semibold px-3 py-2">Discount / credit</th>}
            <th className="text-right font-semibold px-4 py-2">Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {y.terms.map((t: any) => {
            const done = t.outstanding <= 0;
            return (
              <tr key={t.term} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200">
                    <span className={`w-2 h-2 rounded-full ${done ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                    {TERM_LABEL[t.term as LedgerTerm]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{fmtLe(t.billed)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtLe(t.paid)}</td>
                {Number(y.discounted) + Number(y.credit_applied || 0) > 0 && <td className="px-3 py-2.5 text-right tabular-nums text-indigo-600 dark:text-indigo-400">{Number(t.discounted) + Number(t.credit_applied || 0) > 0 ? fmtLe(Number(t.discounted) + Number(t.credit_applied || 0)) : '—'}</td>}
                <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmtLe(t.outstanding)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-gray-800/40 font-bold text-gray-800 dark:text-gray-200">
            <td className="px-4 py-2.5">Total</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{fmtLe(y.billed)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtLe(y.paid)}</td>
            {Number(y.discounted) + Number(y.credit_applied || 0) > 0 && <td className="px-3 py-2.5 text-right tabular-nums text-indigo-600 dark:text-indigo-400">{fmtLe(Number(y.discounted) + Number(y.credit_applied || 0))}</td>}
            <td className={`px-4 py-2.5 text-right tabular-nums ${y.outstanding <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmtLe(y.outstanding)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
);

// ── One card listing all charges (chalk, book, food, etc.) across terms ──────
const ChargesCard: React.FC<{ year: any; chargesCompulsory?: boolean }> = ({ year: y, chargesCompulsory }) => {
  // Flatten all non-tuition charges across the year's terms.
  const charges: any[] = [];
  y.terms.forEach((t: any) => {
    t.charges.forEach((c: any) => {
      if (!isTuition(c.type)) charges.push({ ...c, term: t.term });
    });
  });
  if (charges.length === 0) return null;

  const total = charges.reduce((s, c) => s + Number(c.amount || 0), 0);
  const due = charges.reduce((s, c) => s + Number(c.outstanding || 0), 0);

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center gap-2">
        <Receipt size={16} className="text-white" />
        <span className="text-sm font-bold text-white">Charges &amp; Expenses</span>
        <span className="ml-auto text-xs font-semibold text-white/90 bg-white/20 rounded-full px-2 py-0.5">{charges.length} item{charges.length > 1 ? 's' : ''}</span>
      </div>
      {chargesCompulsory && (
        <p className="px-4 py-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40">
          Your school requires these charges to be paid in the First Term. Once paid, they won't appear again.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50/50 dark:bg-gray-800/20">
              <th className="text-left font-semibold px-4 py-2">Item</th>
              <th className="text-left font-semibold px-3 py-2 hidden sm:table-cell">Term</th>
              <th className="text-right font-semibold px-3 py-2">Amount</th>
              <th className="text-right font-semibold px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {charges.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                <td className="px-4 py-2.5 capitalize text-gray-800 dark:text-gray-200">{c.type || 'Charge'}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs hidden sm:table-cell">{TERM_LABEL[c.term as LedgerTerm]}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{fmtLe(c.amount)}</td>
                <td className="px-4 py-2.5 text-right">
                  {c.outstanding > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"><AlertCircle size={11} /> Due</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"><CheckCircle2 size={11} /> Paid</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-800/40 font-bold text-gray-800 dark:text-gray-200">
              <td className="px-4 py-2.5" colSpan={2}>Charges total</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fmtLe(total)}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums text-xs ${due > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{due > 0 ? `Due ${fmtLe(due)}` : 'Paid'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// ── Small summary stat card ─────────────────────────────────────────────────
const SummaryStat: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueClass?: string;
}> = ({ icon, iconBg, label, value, valueClass = 'text-gray-900 dark:text-white' }) => (
  <div className="flex items-center gap-3">
    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</span>
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-black tabular-nums truncate ${valueClass}`}>{value}</p>
    </div>
  </div>
);

export default StudentLedgerView;
