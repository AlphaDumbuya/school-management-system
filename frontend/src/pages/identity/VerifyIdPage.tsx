/**
 * VerifyIdPage — /verify-id
 *
 * PUBLIC (no login) landing page reached by scanning the QR code on an ID card.
 * The QR encodes `/verify-id?d=<base64url payload>`. This page reads the `d`
 * param, calls the public verification endpoint, and shows a clear
 * valid / invalid result. Falls back to a manual paste box if no payload.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Loader2, Search } from 'lucide-react';
import { idCardService } from '@services/idCardService';

type Result = {
  isValid: boolean;
  userName?: string;
  role?: string;
  expirationDate?: string;
  failureReason?: string;
};

const REASON_LABEL: Record<string, string> = {
  expired: 'This ID card has expired.',
  revoked: 'This ID card has been revoked.',
  invalid_hash: 'This ID could not be authenticated (tampered or invalid).',
  invalid_format: 'Unrecognised code. This is not a valid ID QR code.',
  rate_limit_exceeded: 'Too many attempts. Please wait a minute and try again.',
  device_blocked: 'Verification temporarily blocked due to repeated failures.',
};

export default function VerifyIdPage() {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState('');

  const runVerify = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res: any = await idCardService.verifyPublicId(value.trim());
      setResult((res?.verification ?? res) as Result);
    } catch {
      setResult({ isValid: false, failureReason: 'invalid_format' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const c = params.get('c'); // short form: qr id
    const d = params.get('d'); // legacy: base64 payload
    if (c) {
      runVerify(c);
    } else if (d) {
      runVerify(`${window.location.origin}/verify-id?d=${d}`);
    }
  }, [params, runVerify]);

  const valid = result?.isValid === true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg mb-3">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">ID Verification</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Scan or verify an identity card</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          {loading && (
            <div className="flex flex-col items-center py-8 text-gray-500">
              <Loader2 size={32} className="animate-spin mb-3" />
              <span className="text-sm font-medium">Verifying…</span>
            </div>
          )}

          {!loading && result && (
            <div className="text-center py-2">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${valid ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                {valid ? <ShieldCheck size={34} /> : <ShieldAlert size={34} />}
              </div>
              <h2 className={`text-xl font-black ${valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {valid ? 'Valid ID' : 'Not Valid'}
              </h2>

              {valid ? (
                <div className="mt-4 space-y-2 text-left bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4">
                  {result?.userName && (
                    <Row label="Name" value={result.userName} />
                  )}
                  {result?.role && (
                    <Row label="Role" value={String(result.role).toUpperCase()} />
                  )}
                  {result?.expirationDate && (
                    <Row label="Expires" value={new Date(result.expirationDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} />
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  {REASON_LABEL[result?.failureReason || ''] || 'This ID could not be verified.'}
                  {result?.userName && valid === false && result?.failureReason === 'expired' && (
                    <span className="block mt-1 text-xs">Holder: {result.userName}</span>
                  )}
                </p>
              )}

              <button
                onClick={() => { setResult(null); setManual(''); }}
                className="mt-5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Verify another
              </button>
            </div>
          )}

          {!loading && !result && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Paste a scanned code or verification link to check an ID.
              </p>
              <textarea
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                rows={3}
                placeholder="Paste QR content or link…"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={() => runVerify(manual)}
                disabled={!manual.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                <Search size={16} /> Verify
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Secured with tamper-evident verification</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
