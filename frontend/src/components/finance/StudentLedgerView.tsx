/**
 * StudentLedgerView — per-student financial ledger grouped by academic year and
 * term (financial-management spec §2). Used in the student & parent portals.
 * Read-only; reflects the same figures staff see.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Loader2, CheckCircle2, AlertCircle,
  CalendarDays, Receipt, TrendingUp, CreditCard,
} from 'lucide-react';
import { financeLedgerService, StudentLedger, LedgerTerm } from '@services/financeLedgerService';
import { PayFeesButton } from '@components/finance/PayFeesButton';

const TERM_LABEL: Record<LedgerTerm, string> = {
  first_term: 'First Term',
  second_term: 'Second Term',
  third_term: 'Third Term',
};

// Per-term colour theme so each card is visually distinct.
interface TermTheme {
  card: string;      // card background gradient + border
  header: string;    // header strip background
  bar: string;       // progress bar fill
  dot: string;       // accent dot for the term title
  footer: string;    // footer background
}
const TERM_THEME: Record<LedgerTerm, TermTheme> = {
  first_term: {
    card: 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/20 border-sky-200 dark:border-sky-900/50',
    header: 'bg-sky-100/70 dark:bg-sky-900/30 border-sky-200/70 dark:border-sky-900/50',
    bar: 'bg-sky-500',
    dot: 'bg-sky-500',
    footer: 'bg-sky-100/50 dark:bg-sky-900/20 border-sky-200/70 dark:border-sky-900/50',
  },
  second_term: {
    card: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 border-violet-200 dark:border-violet-900/50',
    header: 'bg-violet-100/70 dark:bg-violet-900/30 border-violet-200/70 dark:border-violet-900/50',
    bar: 'bg-violet-500',
    dot: 'bg-violet-500',
    footer: 'bg-violet-100/50 dark:bg-violet-900/20 border-violet-200/70 dark:border-violet-900/50',
  },
  third_term: {
    card: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-200 dark:border-amber-900/50',
    header: 'bg-amber-100/70 dark:bg-amber-900/30 border-amber-200/70 dark:border-amber-900/50',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
    footer: 'bg-amber-100/50 dark:bg-amber-900/20 border-amber-200/70 dark:border-amber-900/50',
  },
};

const fmtLe = (v: number | null | undefined) =>
  `Le ${(Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (paid: number, billed: number) => {
  if (!billed || billed <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((paid / billed) * 100)));
};

interface Props {
  /** Provide a studentId to view that student (staff/parent), or omit for the
   *  calling student's own ledger. */
  studentId?: string;
  /** Show pay buttons (per-term and per-year). Defaults to true. */
  canPay?: boolean;
  /** When true, pay buttons navigate to /finance/my-fees instead of opening the
   *  in-app pay modal here (used on dashboards to centralise payment). */
  redirectToPay?: boolean;
}

export const StudentLedgerView: React.FC<Props> = ({ studentId, canPay = true, redirectToPay = false }) => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-ledger', studentId ?? 'me'],
    queryFn: () => (studentId ? financeLedgerService.getStudentLedger(studentId) : financeLedgerService.getMyLedger()),
    staleTime: 60_000,
  });

  const ledger: StudentLedger | undefined = (data as any)?.data?.data ?? (data as any)?.data;
  const [openYears, setOpenYears] = useState<Set<string>>(new Set());
  const toggle = (y: string) => setOpenYears((s) => { const n = new Set(s); n.has(y) ? n.delete(y) : n.add(y); return n; });

  if (isLoading) {
    return <div className="flex items-center justify-center py-10 text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading ledger…</div>;
  }
  if (error || !ledger) {
    return <p className="text-sm text-gray-500 py-6 text-center">Couldn't load the financial ledger.</p>;
  }
  if (ledger.years.length === 0) {
    return (
      <div className="py-10 text-center">
        <Receipt className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No charges on record yet.</p>
      </div>
    );
  }

  // Default: open the most recent year.
  const defaultOpen = openYears.size === 0 ? new Set([ledger.years[0]?.academic_year]) : openYears;
  const paidPct = pct(ledger.totals.paid, ledger.totals.billed);
  const settled = ledger.totals.outstanding <= 0;
  const sid = ledger.student_id;

  // Render a pay control: either navigates to My Fees (dashboards) or opens the
  // in-app pay modal here (My Fees page).
  const PayControl: React.FC<{ amount: number; label: string; size?: 'sm' | 'md'; children?: React.ReactNode }> = ({ amount, label, size = 'sm', children }) => {
    if (!canPay || amount <= 0) return null;
    if (redirectToPay) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Carry the payment intent so My Fees can auto-start it — no need to
            // hunt for the button again after the redirect.
            navigate('/finance/my-fees', { state: { autoPay: { studentId: sid, amount, label } } });
          }}
          className={`inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:shadow-md transition-all ${size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'}`}
        >
          <CreditCard size={size === 'sm' ? 13 : 16} />
          {children ?? 'Pay'}
        </button>
      );
    }
    return (
      <span onClick={(e) => e.stopPropagation()}>
        <PayFeesButton studentId={sid} amount={amount} label={label} size={size}>
          {children}
        </PayFeesButton>
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-900/60 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryStat
            icon={<Receipt className="w-4 h-4" />}
            iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
            label="Total Billed"
            value={fmtLe(ledger.totals.billed)}
          />
          <SummaryStat
            icon={<CheckCircle2 className="w-4 h-4" />}
            iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
            label="Total Paid"
            value={fmtLe(ledger.totals.paid)}
            valueClass="text-emerald-600 dark:text-emerald-400"
          />
          <SummaryStat
            icon={settled ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            iconBg={settled ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}
            label="Outstanding"
            value={fmtLe(ledger.totals.outstanding)}
            valueClass={settled ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
          />
        </div>

        {/* Payment progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Payment progress</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{paidPct}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${settled ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'}`}
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Years → terms */}
      <div className="space-y-3">
        {ledger.years.map((y) => {
          const open = defaultOpen.has(y.academic_year);
          const yearSettled = y.outstanding <= 0;
          return (
            <div key={y.academic_year} className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
              <button
                onClick={() => toggle(y.academic_year)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 text-left transition"
              >
                <span className="text-gray-400">{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                <span className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <CalendarDays size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 dark:text-white">{y.academic_year}</p>
                  <p className="text-xs text-gray-500">Academic Year</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Billed {fmtLe(y.billed)}</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${yearSettled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'}`}>
                    {yearSettled ? 'Settled' : `Due ${fmtLe(y.outstanding)}`}
                  </span>
                </div>
                {!yearSettled && (
                  <PayControl amount={y.outstanding} label={`School Fees — ${y.academic_year}`}>
                    Pay Year
                  </PayControl>
                )}
              </button>

              {open && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-900/40">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {y.terms.map((t) => (
                      <TermCard
                        key={t.term}
                        term={t}
                        theme={TERM_THEME[t.term as LedgerTerm]}
                        payControl={
                          t.outstanding > 0
                            ? <PayControl amount={t.outstanding} label={`${TERM_LABEL[t.term]} — ${y.academic_year}`} size="sm">Pay {TERM_LABEL[t.term].split(' ')[0]} Term</PayControl>
                            : null
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── One term as a self-contained card ───────────────────────────────────────
const TermCard: React.FC<{ term: any; theme: TermTheme; payControl?: React.ReactNode }> = ({ term: t, theme, payControl }) => {
  const termSettled = t.outstanding <= 0;
  const termPct = pct(t.paid, t.billed);
  const empty = !t.charges || t.charges.length === 0;

  return (
    <div className={`rounded-2xl border flex flex-col overflow-hidden shadow-sm ${theme.card}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b ${theme.header}`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <span className={`w-2.5 h-2.5 rounded-full ${theme.dot}`} />
            {TERM_LABEL[t.term as LedgerTerm]}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${termSettled ? 'bg-emerald-500/90 text-white' : 'bg-white/70 dark:bg-gray-900/50 text-gray-700 dark:text-gray-200'}`}>
            {termSettled ? 'Fully paid' : `${termPct}% paid`}
          </span>
        </div>
        {/* mini progress */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/60 dark:bg-gray-900/40 overflow-hidden">
          <div className={`h-full rounded-full ${termSettled ? 'bg-emerald-500' : theme.bar}`} style={{ width: `${termPct}%` }} />
        </div>
      </div>

      {/* Charges */}
      <div className="flex-1 p-3">
        {empty ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">No charges this term.</p>
        ) : (
          <ul className="space-y-1">
            {t.charges.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded-lg bg-white/60 dark:bg-gray-900/30">
                <span className="text-gray-700 dark:text-gray-200 capitalize truncate">{c.type || 'Charge'}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-gray-600 dark:text-gray-300 tabular-nums font-medium">{fmtLe(c.amount)}</span>
                  {c.outstanding > 0 ? (
                    <span className="w-2 h-2 rounded-full bg-rose-400" title={`Due ${fmtLe(c.outstanding)}`} />
                  ) : (
                    <CheckCircle2 size={13} className="text-emerald-500" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer totals */}
      <div className={`px-4 py-3 border-t space-y-1 ${theme.footer}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Billed</span>
          <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{fmtLe(t.billed)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Paid</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtLe(t.paid)}</span>
        </div>
        <div className="flex items-center justify-between text-sm pt-1 border-t border-black/5 dark:border-white/10">
          <span className="font-bold text-gray-900 dark:text-white">Outstanding</span>
          <span className={`font-black tabular-nums ${termSettled ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmtLe(t.outstanding)}</span>
        </div>
        {payControl && <div className="pt-2 [&_button]:w-full [&_span]:block">{payControl}</div>}
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
