/**
 * PaymentReturnPage — /finance/pay/return
 * Landing page after returning from the Monime hosted checkout. Reads the
 * session id from the query, polls its status, and shows success/failure.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { paymentService } from '@services/paymentService';

type UiStatus = 'checking' | 'completed' | 'pending' | 'failed' | 'cancelled';

export const PaymentReturnPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session');
  const returnedStatus = params.get('status'); // 'success' | 'cancelled'
  const [status, setStatus] = useState<UiStatus>('checking');
  const [attempts, setAttempts] = useState(0);

  const poll = useCallback(async () => {
    if (!sessionId) { setStatus('failed'); return; }
    try {
      const res: any = await paymentService.getSessionStatus(sessionId);
      const s = (res?.data?.data?.status ?? res?.data?.status ?? res?.status) as string;
      if (s === 'completed') setStatus('completed');
      else if (s === 'failed') setStatus('failed');
      else if (s === 'cancelled') setStatus(returnedStatus === 'cancelled' ? 'cancelled' : 'pending');
      else setStatus('pending');
    } catch {
      setStatus('pending');
    }
  }, [sessionId, returnedStatus]);

  useEffect(() => { poll(); }, [poll]);

  // Keep polling a few times while the webhook reconciles (payments can settle
  // a moment after redirect).
  useEffect(() => {
    if (status !== 'pending' && status !== 'checking') return;
    if (attempts >= 6) return;
    const t = setTimeout(() => { setAttempts((a) => a + 1); poll(); }, 2500);
    return () => clearTimeout(t);
  }, [status, attempts, poll]);

  const view = {
    checking: { icon: <Loader2 size={44} className="animate-spin text-blue-500" />, title: 'Checking payment…', desc: 'Please wait while we confirm your payment.' },
    pending:  { icon: <Clock size={44} className="text-amber-500" />, title: 'Payment processing', desc: 'Your payment is being confirmed. This can take a moment — you can safely leave this page; your balance updates automatically once confirmed.' },
    completed:{ icon: <CheckCircle2 size={44} className="text-emerald-500" />, title: 'Payment successful', desc: 'Thank you! Your fee payment has been received and your balance has been updated.' },
    failed:   { icon: <XCircle size={44} className="text-rose-500" />, title: 'Payment failed', desc: 'We could not confirm your payment. If money was deducted, it will be reversed automatically.' },
    cancelled:{ icon: <XCircle size={44} className="text-gray-400" />, title: 'Payment cancelled', desc: 'You cancelled the payment. No charge was made.' },
  }[status];

  return (
    <MainLayout>
      <PageShell title="Fee Payment" subtitle="Payment status">
        <div className="max-w-md mx-auto mt-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">{view.icon}</div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">{view.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{view.desc}</p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
            {(status === 'pending') && (
              <Button size="sm" onClick={() => { setAttempts(0); setStatus('checking'); poll(); }}>Refresh</Button>
            )}
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
};

export default PaymentReturnPage;
