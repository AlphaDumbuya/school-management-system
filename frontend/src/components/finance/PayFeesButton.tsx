/**
 * PayFeesButton — one-tap online fee payment via Monime.
 * Starts a hosted-checkout session for an invoice (or an outstanding amount)
 * and redirects the payer to Monime (mobile money, card, bank, digital wallet).
 */

import React, { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
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
}

export const PayFeesButton: React.FC<PayFeesButtonProps> = ({
  invoiceId, studentId, amount, label, disabled, size = 'md', className = '', children,
}) => {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res: any = await paymentService.startCheckout({ invoiceId, studentId, amount, label });
      const body = res?.data ?? res;
      const redirectUrl = body?.data?.redirectUrl ?? body?.redirectUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl; // go to Monime hosted checkout
        return;
      }
      showToast.error(body?.error || 'Could not start payment. Please try again.');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Payment could not be started';
      showToast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const sizeCls = size === 'sm'
    ? 'px-3 py-1.5 text-xs'
    : 'px-4 py-2.5 text-sm';

  return (
    <button
      onClick={handlePay}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:shadow-md hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${sizeCls} ${className}`}
    >
      {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : <CreditCard size={size === 'sm' ? 14 : 16} />}
      {children ?? (loading ? 'Starting…' : 'Pay Fees')}
    </button>
  );
};

export default PayFeesButton;
