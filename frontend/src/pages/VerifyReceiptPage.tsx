/**
 * VerifyReceiptPage: /verify-receipt/:code (and /verify-receipt to type a code).
 *
 * PUBLIC (no login). Reached by scanning the QR code on a payment receipt, or by
 * typing the code printed on it. It shows the receipt exactly as the school
 * recorded it, so the reader can compare amount, date and pupil with the
 * document in hand: a receipt that was edited, copied from someone else's, or
 * made up does not match. A refunded receipt says so.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Lock, Search, ShieldAlert, ShieldCheck, ShieldQuestion, Undo2 } from 'lucide-react';
import { verifyReceipt, type VerifiedReceipt, type VerifyReceiptResult } from '@services/receiptVerifyService';

const money = (n: number, currency = 'Le') =>
  `${currency} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-100 print:bg-white">
    <div className="mx-auto w-full max-w-xl px-3 py-5 sm:px-6 sm:py-8">
      <p className="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 print:hidden">
        <Lock size={12} aria-hidden="true" /> Official receipt verification
      </p>
      {children}
      <p className="mt-6 text-center text-[11px] text-slate-400 print:hidden">Powered by WiSkul · Secure receipt verification</p>
    </div>
  </div>
);

const CodeForm: React.FC<{ initial?: string; busy?: boolean; onSubmit: (code: string) => void }> = ({ initial = '', busy, onSubmit }) => {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <label htmlFor="receipt-code" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Verification code</label>
      <p className="mt-0.5 text-xs text-slate-500">Printed at the bottom of the receipt, under the QR code.</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="receipt-code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-h-[44px] w-full flex-1 rounded-lg border border-slate-300 px-3 font-mono text-sm uppercase tracking-wider focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1d4ed8] px-4 text-sm font-semibold text-white hover:bg-[#1e40af] disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
          Check receipt
        </button>
      </div>
    </form>
  );
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="min-w-0 break-words text-right text-sm font-medium text-slate-900">{value || '—'}</dd>
  </div>
);

const Verdict: React.FC<{ r: VerifiedReceipt }> = ({ r }) => {
  const refunded = r.status === 'refunded';
  const part = r.status === 'part_refunded';
  const tone = refunded ? 'bg-rose-700' : part ? 'bg-amber-600' : 'bg-emerald-700';
  const Icon = refunded || part ? Undo2 : ShieldCheck;
  const title = refunded ? 'Genuine, but REFUNDED' : part ? 'Genuine, partly refunded' : 'Genuine receipt';
  const sub = refunded
    ? 'This payment was refunded. The receipt no longer counts as proof of payment.'
    : part
      ? 'Part of this payment was refunded. Check the amount below.'
      : 'The school issued this receipt. Compare the details below with your copy.';
  return (
    <div role="status" className={`flex items-center gap-4 px-5 py-5 ${tone}`}>
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
        <Icon className="text-white" size={26} aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-lg font-extrabold leading-tight text-white">{title}</h1>
        <p className="mt-0.5 text-sm text-white/85">{sub}</p>
      </div>
    </div>
  );
};

const Result: React.FC<{ r: VerifiedReceipt }> = ({ r }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <Verdict r={r} />
    <div className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        {r.issued_by.logo_url ? (
          <img src={r.issued_by.logo_url} alt="" className="h-12 w-12 rounded-lg border border-slate-200 object-contain bg-white p-1" />
        ) : null}
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Issued by</p>
          <p className="truncate text-base font-bold text-slate-900">{r.issued_by.name}</p>
          {[r.issued_by.phone, r.issued_by.email].filter(Boolean).length > 0 && (
            <p className="truncate text-xs text-slate-500">{[r.issued_by.phone, r.issued_by.email].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{r.status === 'refunded' ? 'Amount refunded' : 'Amount paid'}</p>
        <p className={`text-3xl font-extrabold ${r.status === 'refunded' ? 'text-rose-700' : 'text-emerald-700'}`}>{money(r.amount, r.currency)}</p>
      </div>

      <dl className="divide-y divide-slate-100">
        <Row label="Receipt no." value={<span className="font-mono">{r.receipt_number}</span>} />
        <Row label="Payment date" value={fmtDate(r.date)} />
        <Row label="Pupil" value={r.student} />
        <Row label="Class" value={r.class_name} />
        <Row label="Academic year" value={r.academic_year} />
        <Row label="Payment method" value={r.method} />
      </dl>

      {r.items.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">What this payment is for</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {r.items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold text-slate-900">{it.label}</span>
                  {it.detail && <span className="block break-words text-xs text-slate-500">{it.detail}</span>}
                </span>
                <span className="whitespace-nowrap text-sm font-semibold text-slate-900">{money(it.amount, r.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-bold">Check your copy</p>
        <p className="mt-0.5">
          If the amount, date, pupil or receipt number on the document in your hand differ from what is shown here, do not accept it, and tell the school.
        </p>
      </div>
      <p className="text-center text-[11px] text-slate-400">Checked {fmtDateTime(r.checked_at)}</p>
    </div>
  </div>
);

const Problem: React.FC<{ result: Extract<VerifyReceiptResult, { ok: false }> }> = ({ result }) => {
  const network = result.reason !== 'not_found';
  const Icon = network ? ShieldQuestion : ShieldAlert;
  return (
    <div role="alert" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-center gap-4 px-5 py-5 ${network ? 'bg-slate-700' : 'bg-rose-700'}`}>
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
          <Icon className="text-white" size={26} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-lg font-extrabold leading-tight text-white">{network ? 'Could not complete the check' : 'This receipt could not be verified'}</h1>
          <p className="mt-0.5 text-sm text-white/85">{network ? 'Nothing has been checked yet.' : 'We cannot confirm that this receipt is genuine.'}</p>
        </div>
      </div>
      <div className="space-y-3 p-5 text-sm text-slate-700">
        <p>{result.message}</p>
        {!network && (
          <ul className="list-inside list-disc space-y-1 text-slate-600">
            <li>Check the code was typed exactly as printed, or scan the QR code again.</li>
            <li>If it still fails, treat the receipt as unverified and contact the school that issued it.</li>
          </ul>
        )}
      </div>
    </div>
  );
};

export const VerifyReceiptPage: React.FC = () => {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!!code);
  const [result, setResult] = useState<VerifyReceiptResult | null>(null);

  const run = useCallback(async (c: string) => {
    setLoading(true);
    setResult(null);
    setResult(await verifyReceipt(c));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (code) void run(code);
    else { setResult(null); setLoading(false); }
  }, [code, run]);

  return (
    <Shell>
      <div className="space-y-4">
        {loading && (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 rounded-2xl bg-white p-10 text-sm font-medium text-slate-600 shadow-sm">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Checking this receipt against the school's records…
          </div>
        )}
        {!loading && result?.ok && <Result r={result.data} />}
        {!loading && result && !result.ok && <Problem result={result} />}
        {!loading && (!code || (result && !result.ok)) && (
          <CodeForm initial={code || ''} busy={loading} onSubmit={(c) => navigate(`/verify-receipt/${encodeURIComponent(c)}`)} />
        )}
      </div>
    </Shell>
  );
};

export default VerifyReceiptPage;
