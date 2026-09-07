/**
 * UnsubscribePage — public, no auth. Reads ?token= and unsubscribes the visitor
 * from the WiSkul newsletter via the public API.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import apiClient from '../lib/apiClient';

const UnsubscribePage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    if (!token) { setState('error'); return; }
    (async () => {
      try {
        // The public endpoint responds 200 for valid tokens.
        await apiClient.get(`/api/newsletter/unsubscribe`, { params: { token } } as any);
        setState('ok');
      } catch {
        setState('error');
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/70 p-8 text-center">
        {state === 'loading' && (
          <>
            <Loader2 className="animate-spin mx-auto text-blue-500 mb-4" size={32} />
            <p className="text-gray-600">Processing your request…</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={40} />
            <h1 className="text-xl font-bold text-gray-900 mb-1">You're unsubscribed</h1>
            <p className="text-gray-600 text-sm">You will no longer receive marketing emails from WiSkul. You may still receive important account and transactional messages.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="mx-auto text-red-500 mb-4" size={40} />
            <h1 className="text-xl font-bold text-gray-900 mb-1">Invalid link</h1>
            <p className="text-gray-600 text-sm">This unsubscribe link is not valid or has already been used.</p>
          </>
        )}
        <a href="https://www.wiskulsl.com" className="inline-block mt-6 text-sm font-semibold text-blue-600 hover:underline">Back to WiSkul</a>
      </div>
    </div>
  );
};

export default UnsubscribePage;
