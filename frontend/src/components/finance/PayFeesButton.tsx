/**
 * PayFeesButton — one-tap online fee payment via Monime (in-app mobile money).
 *
 * The whole payment stays INSIDE our app using Monime "Payment Codes": we create
 * a payment code and show the payer a USSD string (e.g. *715*1*…#) inside our
 * own modal. They dial it on their phone (Orange Money / Afrimoney — the same
 * code works for both) and we poll the session until Monime confirms.
 *
 * Multi-step wizard:
 *   1. scope   — WHAT to pay for (full outstanding, a term, charges only …)
 *   2. amount  — HOW MUCH (full / percentage / custom), enforcing the school's
 *                minimum-percent policy
 *   3. ussd    — dial the code; polls for completion
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Loader2, CheckCircle2, XCircle, Smartphone, Copy, Check, Timer, ChevronRight, Info, Layers, Phone } from 'lucide-react';
import { paymentService } from '@services/paymentService';
import { financeLedgerService, PaymentPolicy } from '@services/financeLedgerService';
import { showToast } from '@utils/toast';

/** A selectable charge item within a "charges only" scope. */
export interface PayChargeItem {
  id: string;
  label: string;
  amount: number;      // outstanding for this charge
  required: boolean;
}

/** A payable option offered in the first wizard step. */
export interface PayScope {
  id: string;
  label: string;      // e.g. "Full Year", "First Term", "Charges only"
  amount: number;     // outstanding for this scope
  sublabel?: string;  // e.g. "2026/2027"
  /** When present (charges-only scope), the payer can pick which items to pay. */
  chargeItems?: PayChargeItem[];
}

interface PayFeesButtonProps {
  invoiceId?: string;
  studentId?: string;
  amount?: number;       // outstanding balance (single-scope quick pay)
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  children?: React.ReactNode;
  showHint?: boolean;
  autoStart?: boolean;
  onAutoStarted?: () => void;
  allowPartial?: boolean;
  /** Optional list of payable scopes (term/year/charges). When 2+ are provided,
   *  the wizard opens a "what to pay for" step first. */
  scopes?: PayScope[];
}

type FlowStatus = 'idle' | 'scope' | 'charges' | 'amount' | 'starting' | 'ussd' | 'completed' | 'failed' | 'cancelled';

const LEDGER_KEYS = [
  'student-ledger', 'my-ledger', 'child-ledger',
  'student-dashboard', 'parent-dashboard', 'parent-child-detail',
  'fees', 'invoices', 'finance-overview',
];

const fmtLe = (n: number) => `Le ${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PayFeesButton: React.FC<PayFeesButtonProps> = ({
  invoiceId, studentId, amount, label, disabled, size = 'md', className = '', children, showHint = false,
  autoStart = false, onAutoStarted, allowPartial = true, scopes,
}) => {
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<FlowStatus>('idle');
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [expireTime, setExpireTime] = useState<string | null>(null);
  const [scope, setScope] = useState<PayScope | null>(null);
  // For charges-only scopes: the effective (possibly reduced) scope after the
  // payer picks which optional charges to include.
  const [effectiveScope, setEffectiveScope] = useState<PayScope | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: statusResp } = useQuery({
    queryKey: ['monime-online-status'],
    queryFn: () => paymentService.getOnlineStatus(),
    staleTime: 5 * 60_000,
  });
  const onlineEnabled = ((statusResp as any)?.data?.data ?? (statusResp as any)?.data)?.online_payments_enabled;

  // Payment policy (min %, installments) for the student — drives amount rules.
  const { data: policyResp } = useQuery({
    queryKey: ['payment-policy', studentId],
    queryFn: () => financeLedgerService.getPaymentPolicy(studentId as string),
    enabled: !!studentId && flow !== 'idle',
    staleTime: 5 * 60_000,
  });
  const policy: PaymentPolicy | undefined = (policyResp as any)?.data?.data ?? (policyResp as any)?.data;

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
    setScope(null);
    setEffectiveScope(null);
  }, [stopPolling]);

  const startPolling = useCallback((sid: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res: any = await paymentService.getSessionStatus(sid);
        const s = (res?.data?.data?.status ?? res?.data?.status ?? res?.status) as string;
        if (s === 'completed') {
          stopPolling(); setFlow('completed'); invalidateLedgers();
          showToast.success('Payment received. Your balance has been updated.');
        } else if (s === 'failed' || s === 'expired') {
          stopPolling(); setFlow('failed');
        } else if (s === 'cancelled') {
          stopPolling(); setFlow('cancelled');
        }
      } catch { /* keep polling */ }
    }, 2500);
  }, [invalidateLedgers, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Start the USSD payment for a chosen amount ──────────────────────────────
  const startUssd = async (payNow: number) => {
    if (flow === 'starting') return;
    setFlow('starting');
    try {
      const res: any = await paymentService.startUssdPayment({ invoiceId, studentId, amount: payNow, label: scope?.label || label });
      const body = res?.data ?? res;
      if (body?.success === false) {
        showToast.error(body?.error || 'Online payment is not available right now. Please pay at the school office.');
        setFlow('amount');
        return;
      }
      const code = body?.data?.ussdCode ?? body?.ussdCode;
      const sid = body?.data?.sessionId ?? body?.sessionId;
      const amt = body?.data?.amount ?? body?.amount ?? payNow;
      const exp = body?.data?.expireTime ?? body?.expireTime ?? null;
      if (!sid) { showToast.error('Could not start payment. Please try again.'); setFlow('amount'); return; }
      setUssdCode(code || null);
      setPayAmount(amt);
      setExpireTime(exp);
      setFlow('ussd');
      startPolling(sid);
    } catch (err: any) {
      // Surface backend policy errors (e.g. below minimum) clearly.
      const msg = err?.response?.data?.error || err?.message;
      showToast.error(msg || 'Online payment is not available right now. Please pay at the school office.');
      setFlow('amount');
    }
  };

  // The scopes to offer: explicit prop, else a single "full outstanding" scope.
  const effectiveScopes: PayScope[] = (scopes && scopes.length > 0)
    ? scopes.filter((s) => s.amount > 0)
    : (amount && amount > 0 ? [{ id: 'all', label: label || 'Outstanding balance', amount }] : []);

  const openPay = () => {
    if (effectiveScopes.length === 0) { showToast.error('Nothing to pay — balance is clear.'); return; }
    if (effectiveScopes.length === 1) { setScope(effectiveScopes[0]); setFlow('amount'); }
    else { setScope(null); setFlow('scope'); }
  };

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
      <div className={showHint ? 'flex flex-col items-stretch sm:items-end gap-1 w-full sm:w-auto' : 'contents'}>
        <button
          onClick={openPay}
          disabled={disabled || busy}
          className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:shadow-md hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap ${sizeClsBase} ${showHint ? 'w-full sm:w-auto' : ''} ${className}`}
        >
          {busy ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : <Smartphone size={size === 'sm' ? 14 : 16} />}
          {children ?? (busy ? 'Starting…' : 'Pay with Mobile Money')}
        </button>
        {showHint && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1 justify-center sm:justify-end text-center sm:text-right">
            <Smartphone size={11} className="shrink-0" /> Mobile money only — Orange Money &amp; Afrimoney
          </span>
        )}
      </div>

      {flow !== 'idle' && (
        <PayModal
          flow={flow}
          scopes={effectiveScopes}
          scope={scope}
          effectiveScope={effectiveScope}
          policy={policy}
          ussdCode={ussdCode}
          payAmount={payAmount}
          expireTime={expireTime}
          onPickScope={(s) => {
            setScope(s);
            if (s.chargeItems && s.chargeItems.length > 0) { setFlow('charges'); }
            else { setEffectiveScope(s); setFlow('amount'); }
          }}
          onChargesChosen={(sel) => {
            // Build a reduced scope from the selected charge items.
            const total = Math.round(sel.reduce((a, c) => a + c.amount, 0) * 100) / 100;
            setEffectiveScope({ ...(scope as PayScope), amount: total, chargeItems: sel });
            setFlow('amount');
          }}
          onConfirmAmount={(amt) => startUssd(amt)}
          onBackToScope={() => { if (effectiveScopes.length > 1) { setScope(null); setEffectiveScope(null); setFlow('scope'); } }}
          onBackToCharges={() => { if (scope?.chargeItems?.length) setFlow('charges'); }}
          onClose={closeAll}
        />
      )}
    </>
  );
};

// ── Modal (multi-step wizard) ─────────────────────────────────────────────────
const PayModal: React.FC<{
  flow: FlowStatus;
  scopes: PayScope[];
  scope: PayScope | null;
  effectiveScope: PayScope | null;
  policy?: PaymentPolicy;
  ussdCode: string | null;
  payAmount: number | null;
  expireTime: string | null;
  onPickScope: (s: PayScope) => void;
  onChargesChosen: (selected: PayChargeItem[]) => void;
  onConfirmAmount: (v: number) => void;
  onBackToScope: () => void;
  onBackToCharges: () => void;
  onClose: () => void;
}> = ({ flow, scopes, scope, effectiveScope, policy, ussdCode, payAmount, expireTime, onPickScope, onChargesChosen, onConfirmAmount, onBackToScope, onBackToCharges, onClose }) => {
  const [copied, setCopied] = useState(false);

  // Countdown to the code's expiry.
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

  // Lock background scroll while open (modal is portalled + fixed to viewport).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const copy = async () => {
    if (!ussdCode) return;
    try { await navigator.clipboard.writeText(ussdCode); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  // On a phone we can open the dialer pre-filled with the USSD code. The '#'
  // must be percent-encoded in a tel: URI. Many dialers auto-run USSD on open.
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const telHref = ussdCode ? `tel:${encodeURIComponent(ussdCode)}` : undefined;

  const terminal = flow === 'completed' || flow === 'failed' || flow === 'cancelled';
  const result = {
    completed: { icon: <CheckCircle2 size={48} className="text-emerald-500" />, title: 'Payment successful', desc: 'Thank you! Your fee payment has been received and your balance updated.' },
    failed:    { icon: <XCircle size={48} className="text-rose-500" />, title: 'Payment failed', desc: 'We could not confirm your payment. If money was deducted, it will be reversed automatically.' },
    cancelled: { icon: <XCircle size={48} className="text-gray-400" />, title: 'Payment cancelled', desc: 'The payment was cancelled. No charge was made.' },
  }[flow as 'completed' | 'failed' | 'cancelled'] ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md my-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
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
          {/* Step 1: choose what to pay for (dropdown + guidance) */}
          {flow === 'scope' && (
            <ScopeStep scopes={scopes} onPick={onPickScope} />
          )}

          {/* Step 1b: pick which charges to pay (charges-only scope) */}
          {flow === 'charges' && scope?.chargeItems && (
            <ChargesPicker
              scope={scope}
              canGoBack={scopes.length > 1}
              onBack={onBackToScope}
              onContinue={onChargesChosen}
            />
          )}

          {/* Step 2: choose how much */}
          {(flow === 'amount' || flow === 'starting') && (effectiveScope || scope) && (
            <AmountStep
              scope={(effectiveScope || scope) as PayScope}
              policy={policy}
              busy={flow === 'starting'}
              canGoBack={scopes.length > 1 || !!scope?.chargeItems}
              onBack={scope?.chargeItems ? onBackToCharges : onBackToScope}
              onConfirm={onConfirmAmount}
            />
          )}

          {/* Step 3: USSD */}
          {flow === 'ussd' && (
            <div className="text-center">
              <div className="flex justify-center mb-3"><div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center"><Smartphone size={24} /></div></div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Dial to pay {payAmount != null && <span className="text-emerald-600">{fmtLe(payAmount)}</span>}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">On the phone with your mobile money (Orange Money or Afrimoney), dial this code and follow the prompts:</p>
              {ussdCode ? (
                <>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <code className="text-xl font-black tracking-wide text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 select-all">{ussdCode}</code>
                    <button onClick={copy} title="Copy code" className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition">
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                  {/* On mobile: one-tap dial straight into the phone dialer. */}
                  {isMobile && telHref && (
                    <a
                      href={telHref}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2.5 text-sm shadow-sm hover:shadow-md transition"
                    >
                      <Phone size={16} /> Dial now to pay
                    </a>
                  )}
                </>
              ) : (
                <p className="mt-4 text-sm text-amber-600">Check your phone for a mobile-money prompt to approve this payment.</p>
              )}
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
    </div>,
    document.body,
  );
};

// ── Charges picker (required locked-on, optional toggleable) ─────────────────
const ChargesPicker: React.FC<{
  scope: PayScope;
  canGoBack: boolean;
  onBack: () => void;
  onContinue: (selected: PayChargeItem[]) => void;
}> = ({ scope, canGoBack, onBack, onContinue }) => {
  const items = scope.chargeItems ?? [];
  // Required items are always selected; optional default to selected too.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(items.map((c) => c.id)));
  const toggle = (c: PayChargeItem) => {
    if (c.required) return; // can't unselect required
    setSelectedIds((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
  };
  const selected = items.filter((c) => selectedIds.has(c.id));
  const total = Math.round(selected.reduce((a, c) => a + c.amount, 0) * 100) / 100;

  return (
    <div>
      {canGoBack && <button onClick={onBack} className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2">← Back</button>}
      <h3 className="text-base font-black text-gray-900 dark:text-white">Select charges to pay</h3>
      <p className="text-xs text-gray-500 mt-0.5">Required charges are always included. Tick any optional ones you'd like to pay now.</p>

      <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
        {items.map((c) => {
          const checked = selectedIds.has(c.id);
          return (
            <label
              key={c.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${c.required ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40' : 'cursor-pointer border-gray-200 dark:border-gray-700 hover:border-emerald-400'}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={c.required}
                onChange={() => toggle(c)}
                className="rounded w-4 h-4 accent-emerald-600 disabled:opacity-70"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize truncate">{c.label}</div>
                {c.required
                  ? <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">REQUIRED</div>
                  : <div className="text-[10px] text-gray-400">Optional</div>}
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{fmtLe(c.amount)}</span>
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800/40 px-4 py-3">
        <span className="text-sm text-gray-500">Selected total</span>
        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtLe(total)}</span>
      </div>

      <button
        onClick={() => selected.length > 0 && onContinue(selected)}
        disabled={selected.length === 0}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2.5 text-sm shadow-sm hover:shadow-md disabled:opacity-50 transition"
      >
        Continue <ChevronRight size={16} />
      </button>
    </div>
  );
};

// ── Scope selection (dropdown + guidance) ───────────────────────────────────
const ScopeStep: React.FC<{ scopes: PayScope[]; onPick: (s: PayScope) => void }> = ({ scopes, onPick }) => {
  const [selectedId, setSelectedId] = useState(scopes[0]?.id ?? '');
  const selected = scopes.find((s) => s.id === selectedId) ?? scopes[0];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><Layers size={18} /></div>
        <div>
          <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">What are you paying for?</h3>
          <p className="text-xs text-gray-500">Choose a term, the full year, or charges only.</p>
        </div>
      </div>

      <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1">Payment for</label>
      <div className="relative">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 pr-10 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-400"
        >
          {scopes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} — {fmtLe(s.amount)}
            </option>
          ))}
        </select>
        <ChevronRight size={16} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 pointer-events-none" />
      </div>

      {/* Selected summary */}
      {selected && (
        <div className="mt-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900 dark:text-white text-sm">{selected.label}</div>
              {selected.sublabel && <div className="text-xs text-gray-500">{selected.sublabel}</div>}
            </div>
            <div className="text-right">
              <div className="text-[11px] text-gray-500">Amount due</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtLe(selected.amount)}</div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 text-[11px] text-gray-500">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>You'll choose how much to pay on the next step (you can pay in full or part, subject to your school's minimum).</span>
          </div>
        </div>
      )}

      <button
        onClick={() => selected && onPick(selected)}
        disabled={!selected}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2.5 text-sm shadow-sm hover:shadow-md disabled:opacity-50 transition"
      >
        Continue <ChevronRight size={16} />
      </button>
    </div>
  );
};

// ── Amount entry with policy enforcement ────────────────────────────────────
const AmountStep: React.FC<{
  scope: PayScope;
  policy?: PaymentPolicy;
  busy: boolean;
  canGoBack: boolean;
  onBack: () => void;
  onConfirm: (v: number) => void;
}> = ({ scope, policy, busy, canGoBack, onBack, onConfirm }) => {
  const max = Number(scope.amount) || 0;
  const minPct = policy?.allow_installments === false ? 100 : (policy?.min_percent || 0);
  const minAmount = minPct > 0 ? Math.round((minPct / 100) * max * 100) / 100 : 0;
  const installmentsOff = policy?.allow_installments === false;

  const [text, setText] = useState(String(max));
  const parsed = Number(text);
  const tooMuch = parsed > max + 0.001;
  const tooLittle = minAmount > 0 && parsed < minAmount - 0.001;
  const valid = !Number.isNaN(parsed) && parsed > 0 && !tooMuch && !tooLittle;

  // Percentage quick-picks, respecting the minimum.
  const pcts = [25, 50, 75, 100].filter((p) => p >= minPct || p === 100);

  return (
    <div>
      {canGoBack && (
        <button onClick={onBack} className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-2">← Change what to pay for</button>
      )}
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        Paying for <span className="font-semibold text-gray-700 dark:text-gray-300">{scope.label}</span>
      </p>
      <p className="text-center text-xs text-gray-400 mt-1">Outstanding: <span className="font-semibold text-gray-600 dark:text-gray-300">{fmtLe(max)}</span></p>

      {/* Policy banner */}
      {installmentsOff ? (
        <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>Part payments aren't allowed here — the full amount is required.</span>
        </div>
      ) : minPct > 0 ? (
        <div className="mt-3 flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            {policy?.is_new_student ? 'New students' : 'Continuing students'} must pay at least <b>{minPct}%</b> ({fmtLe(minAmount)}).
          </span>
        </div>
      ) : null}

      <div className="mt-4">
        <div className={`flex items-center rounded-xl border px-3 focus-within:ring-2 ${tooMuch || tooLittle ? 'border-rose-300 focus-within:ring-rose-300' : 'border-gray-200 dark:border-gray-700 focus-within:ring-emerald-400'} bg-white dark:bg-gray-800`}>
          <span className="text-sm font-bold text-gray-400 pr-1">Le</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={max}
            step="0.01"
            value={text}
            disabled={installmentsOff}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 bg-transparent py-3 text-lg font-black text-gray-900 dark:text-white outline-none disabled:opacity-60"
            placeholder="0.00"
            autoFocus
          />
        </div>
        {tooMuch && <p className="text-xs text-rose-600 mt-1.5">Amount can't exceed {fmtLe(max)}.</p>}
        {tooLittle && <p className="text-xs text-rose-600 mt-1.5">Minimum required is {fmtLe(minAmount)} ({minPct}%).</p>}
      </div>

      {!installmentsOff && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {pcts.map((p) => {
            const v = Math.round((p / 100) * max * 100) / 100;
            return (
              <button
                key={p}
                onClick={() => setText(String(v))}
                className="text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 py-2 hover:border-emerald-400 hover:text-emerald-600 transition"
              >
                {p === 100 ? 'Full' : `${p}%`}
              </button>
            );
          })}
        </div>
      )}

      <button
        onClick={() => valid && onConfirm(parsed)}
        disabled={!valid || busy}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2.5 text-sm shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
        {busy ? 'Starting…' : `Continue to pay ${valid ? fmtLe(parsed) : ''}`}
      </button>
      <p className="mt-2 text-[11px] text-gray-400 text-center">Pay by mobile money — Orange Money &amp; Afrimoney.</p>
    </div>
  );
};

export default PayFeesButton;
