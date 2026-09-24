/**
 * PayFeesButton — one-tap online fee payment via Monime (in-app mobile money).
 *
 * The whole payment stays INSIDE our app using Monime "Payment Codes": we create
 * a payment code and show the payer a USSD string (e.g. *715*1*…#) inside our
 * own modal. They dial it on their phone (Orange Money / Afrimoney — the same
 * code works for both) and we poll the session until Monime confirms — no popup,
 * no iframe, no redirect. The balance then refreshes automatically.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Loader2, CheckCircle2, XCircle, Smartphone, Copy, Check, Timer } from 'lucide-react';
import { paymentService } from '@services/paymentService';
import { showToast } from '@utils/toast';

interface PayFeesButtonProps {
  invoiceId?: string;
  studentId?: string;
  amount?: number;       // used when paying an ad-hoc outstanding balance
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children?: React.ReactNode;
  /** Show a small "Mobile money only" hint under the button. */
  showHint?: boolean;
  /** Auto-start the payment once on mount (used after redirect with intent). */
  autoStart?: boolean;
  /** Fired after an auto-started payment has been kicked off (to clear intent). */
  onAutoStarted?: () => void;
  /** Allow paying a partial amount (installment). When true, the payer can enter
   *  an amount up to the outstanding before continuing. Defaults to true. */
  allowPartial?: boolean;
}

type FlowStatus = 'idle' | 'amount' | 'starting' | 'ussd' | 'completed' | 'failed' | 'cancelled';

// Query keys to refresh once a payment settles so balances update everywhere.
const LEDGER_KEYS = [
  'student-ledger', 'my-ledger', 'child-ledger',
  'student-dashboard', 'parent-dashboard', 'parent-child-detail',
  'fees', 'invoices', 'finance-overview',
];

export const PayFeesButton: React.FC<PayFeesButtonProps> = ({
  invoiceId, studentId, amount, label, disabled, size = 'md', className = '', children, showHint = false,
  autoStart = false, onAutoStarted, allowPartial = true,
}) => {
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<FlowStatus>('idle');
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [expireTime, setExpireTime] = useState<string | null>(null);
  // The amount the payer chose to pay (defaults to the full outstanding).
  const [chosenAmount, setChosenAmount] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: statusResp } = useQuery({
    queryKey: ['monime-online-status'],
    queryFn: () => paymentService.getOnlineStatus(),
    staleTime: 5 * 60_000,
  });
  const onlineEnabled = ((statusResp as any)?.data?.data ?? (statusResp as any)?.data)?.online_payments_enabled;

  const sizeClsBase = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm';

  const invalidateLedgers = useCallback(() => {
    LEDGER_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  }, [queryClient]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const closeAll = useCallback(() => {
    stopPolling();
    setFlow('idle');
    setUssdCode(null);
    setPayAmount(null);
    setExpireTime(null);
    setChosenAmount(null);
  }, [stopPolling]);

  const startPolling = useCallback((sid: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res: any = await paymentService.getSessionStatus(sid);
        const s = (res?.data?.data?.status ?? res?.data?.status ?? res?.status) as string;
        if (s === 'completed') {
          stopPolling();
          setFlow('completed');
          invalidateLedgers();
          showToast.success('Payment received. Your balance has been updated.');
        } else if (s === 'failed' || s === 'expired') {
          stopPolling();
          setFlow('failed');
        } else if (s === 'cancelled') {
          stopPolling();
          setFlow('cancelled');
        }
      } catch { /* keep polling */ }
    }, 2500);
  }, [invalidateLedgers, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── In-app USSD (mobile money) ──────────────────────────────────────────────
  const startUssd = async (overrideAmount?: number) => {
    if (flow === 'starting') return;
    const payNow = overrideAmount ?? chosenAmount ?? amount;
    setFlow('starting');
    try {
      const res: any = await paymentService.startUssdPayment({ invoiceId, studentId, amount: payNow, label });
      const body = res?.data ?? res;
      if (body?.success === false) {
        showToast.error(body?.error || 'Online payment is not available right now. Please pay at the school office.');
        setFlow('idle');
        return;
      }
      const code = body?.data?.ussdCode ?? body?.ussdCode;
      const sid = body?.data?.sessionId ?? body?.sessionId;
      const amt = body?.data?.amount ?? body?.amount ?? amount ?? null;
      const exp = body?.data?.expireTime ?? body?.expireTime ?? null;
      if (!sid) {
        showToast.error('Could not start payment. Please try again.');
        setFlow('idle');
        return;
      }
      setUssdCode(code || null);
      setPayAmount(amt);
      setExpireTime(exp);
      setFlow('ussd');
      startPolling(sid);
    } catch {
      showToast.error('Online payment is not available right now. Please pay at the school office.');
      setFlow('idle');
    }
  };

  // Whether we can offer a partial-amount step (need a known full outstanding).
  const canChooseAmount = allowPartial && !!amount && amount > 0;

  // Opening the pay flow: show the amount step (partial) or start directly.
  const openPay = () => {
    if (canChooseAmount) { setChosenAmount(amount ?? null); setFlow('amount'); }
    else startUssd();
  };

  // Auto-start once when requested (e.g. arriving from a dashboard "Pay" click).
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoStart && !autoFiredRef.current && onlineEnabled !== false) {
      autoFiredRef.current = true;
      openPay();
      onAutoStarted?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, onlineEnabled]);

  // ── Not configured: keep visible but disabled ───────────────────────────────
  if (onlineEnabled === false) {
    return (
      <button
        type="button"
        disabled
        title="Online payment is not set up yet. Please pay at the school office or contact the school."
        className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed ${sizeClsBase} ${className}`}
      >
        <CreditCard size={size === 'sm' ? 14 : 16} />
        Online payment unavailable
      </button>
    );
  }

  const busy = flow === 'starting';

  return (
    <>
      <div className={showHint ? 'inline-flex flex-col items-end gap-1' : 'contents'}>
        <button
          onClick={openPay}
          disabled={disabled || busy}
          className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:shadow-md hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${sizeClsBase} ${className}`}
        >
          {busy ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : <Smartphone size={size === 'sm' ? 14 : 16} />}
          {children ?? (busy ? 'Starting…' : 'Pay with Mobile Money')}
        </button>
        {showHint && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <Smartphone size={11} /> Mobile money only — Orange Money &amp; Afrimoney
          </span>
        )}
      </div>

      {flow !== 'idle' && flow !== 'starting' && (
        <PayModal
          flow={flow}
          ussdCode={ussdCode}
          payAmount={payAmount}
          expireTime={expireTime}
          maxAmount={amount ?? null}
          chosenAmount={chosenAmount}
          onChangeAmount={setChosenAmount}
          onConfirmAmount={(amt) => startUssd(amt)}
          onClose={closeAll}
        />
      )}
    </>
  );
};

// ── Amount entry (partial payment) ──────────────────────────────────────────
const AmountStep: React.FC<{
  maxAmount: number | null;
  value: number | null;
  onChange: (v: number | null) => void;
  onConfirm: (v: number) => void;
}> = ({ maxAmount, value, onChange, onConfirm }) => {
  const max = Number(maxAmount) || 0;
  const [text, setText] = useState(value != null ? String(value) : (max ? String(max) : ''));
  const fmt = (n: number) => `Le ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const parsed = Number(text);
  const valid = !Number.isNaN(parsed) && parsed > 0 && (!max || parsed <= max + 0.001);
  const tooMuch = !!max && parsed > max + 0.001;
  const quick = max ? [0.25, 0.5, 1].map((f) => Math.round(max * f * 100) / 100) : [];

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">How much would you like to pay?</p>
      {max > 0 && <p className="text-center text-xs text-gray-400 mt-1">Outstanding: <span className="font-semibold text-gray-600 dark:text-gray-300">{fmt(max)}</span></p>}

      <div className="mt-4">
        <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 focus-within:ring-2 focus-within:ring-emerald-400">
          <span className="text-sm font-bold text-gray-400 pr-1">Le</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={max || undefined}
            step="0.01"
            value={text}
            onChange={(e) => { setText(e.target.value); const n = Number(e.target.value); onChange(Number.isNaN(n) ? null : n); }}
            className="flex-1 bg-transparent py-3 text-lg font-black text-gray-900 dark:text-white outline-none"
            placeholder="0.00"
            autoFocus
          />
        </div>
        {tooMuch && <p className="text-xs text-rose-600 mt-1.5">Amount can't exceed the outstanding {fmt(max)}.</p>}
      </div>

      {quick.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {quick.map((q, i) => (
            <button
              key={i}
              onClick={() => { setText(String(q)); onChange(q); }}
              className="text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 py-2 hover:border-emerald-400 hover:text-emerald-600 transition"
            >
              {i === 2 ? 'Full' : `${[25, 50, 100][i]}%`} · {fmt(q)}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => valid && onConfirm(parsed)}
        disabled={!valid}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2.5 text-sm shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <Smartphone size={16} /> Continue to pay {valid ? fmt(parsed) : ''}
      </button>
      <p className="mt-2 text-[11px] text-gray-400 text-center">You can pay in part now and clear the rest later.</p>
    </div>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────
const PayModal: React.FC<{
  flow: FlowStatus;
  ussdCode: string | null;
  payAmount: number | null;
  expireTime: string | null;
  maxAmount: number | null;
  chosenAmount: number | null;
  onChangeAmount: (v: number | null) => void;
  onConfirmAmount: (v: number) => void;
  onClose: () => void;
}> = ({ flow, ussdCode, payAmount, expireTime, maxAmount, chosenAmount, onChangeAmount, onConfirmAmount, onClose }) => {
  const [copied, setCopied] = useState(false);
  const fmt = (n: number | null) => (n == null ? '' : `Le ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  // Countdown to the code's expiry (Monime codes are short-lived).
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!expireTime || flow !== 'ussd') { setRemaining(null); return; }
    const target = new Date(expireTime).getTime();
    if (Number.isNaN(target)) { setRemaining(null); return; }
    const tick = () => setRemaining(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expireTime, flow]);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const expired = remaining === 0;

  // Lock background scroll and scroll to top so the centered modal is fully in
  // view (especially on small screens where the trigger was far down the page).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return () => { document.body.style.overflow = prev; };
  }, []);

  const copy = async () => {
    if (!ussdCode) return;
    try { await navigator.clipboard.writeText(ussdCode); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  const terminal = flow === 'completed' || flow === 'failed' || flow === 'cancelled';
  const result = {
    completed: { icon: <CheckCircle2 size={48} className="text-emerald-500" />, title: 'Payment successful', desc: 'Thank you! Your fee payment has been received and your balance updated.' },
    failed:    { icon: <XCircle size={48} className="text-rose-500" />, title: 'Payment failed', desc: 'We could not confirm your payment. If money was deducted, it will be reversed automatically.' },
    cancelled: { icon: <XCircle size={48} className="text-gray-400" />, title: 'Payment cancelled', desc: 'The payment was cancelled. No charge was made.' },
  }[flow as 'completed' | 'failed' | 'cancelled'] ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600">
          <div className="flex items-center gap-2 text-white font-bold"><CreditCard size={18} /> Pay School Fees</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white hover:bg-gray-100 ring-1 ring-white/60 shadow-sm transition shrink-0 leading-none"
          >
            <span className="text-emerald-700 text-xl font-black leading-none -mt-0.5">&times;</span>
          </button>
        </div>

        <div className="p-6">
          {/* Amount step (partial payment) */}
          {flow === 'amount' && (
            <AmountStep
              maxAmount={maxAmount}
              value={chosenAmount}
              onChange={onChangeAmount}
              onConfirm={onConfirmAmount}
            />
          )}

          {/* In-app USSD instructions */}
          {flow === 'ussd' && (
            <div className="text-center">
              <div className="flex justify-center mb-3"><div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center"><Smartphone size={24} /></div></div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Dial to pay {payAmount != null && <span className="text-emerald-600">{fmt(payAmount)}</span>}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">On the phone with your mobile money (Orange Money or Afrimoney), dial this code and follow the prompts:</p>
              {ussdCode ? (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <code className="text-xl font-black tracking-wide text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 select-all">{ussdCode}</code>
                  <button onClick={copy} title="Copy code" className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition">
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-amber-600">Check your phone for a mobile-money prompt to approve this payment.</p>
              )}

              {/* Expiry countdown */}
              {remaining != null && (
                expired ? (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-full px-3 py-1">
                    <Timer size={13} /> Code expired — close and try again
                  </div>
                ) : (
                  <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 ${remaining <= 60 ? 'text-amber-700 bg-amber-50 dark:bg-amber-950/30' : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'}`}>
                    <Timer size={13} /> Expires in {mmss(remaining)}
                  </div>
                )
              )}

              {!expired && (
                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
                  <Loader2 size={12} className="animate-spin" /> Waiting for your payment…
                </div>
              )}
              <p className="mt-2 text-[11px] text-gray-400">Keep this window open. Your balance updates automatically once confirmed.</p>
              <button onClick={onClose} className="mt-4 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
            </div>
          )}

          {/* Terminal result */}
          {terminal && result && (
            <div className="text-center">
              <div className="flex justify-center mb-4">{result.icon}</div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">{result.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{result.desc}</p>
              <button onClick={onClose} className="mt-6 inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2.5 text-sm hover:opacity-90 transition">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayFeesButton;
