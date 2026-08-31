/**
 * Payment service — online fee payments via Monime (mobile money, card, bank,
 * digital wallet). Initiates a hosted-checkout session and returns the redirect
 * URL to send the payer to Monime's checkout page.
 */

import { apiClient } from '@lib/apiClient';

export interface CheckoutResponse {
  success: boolean;
  data?: { sessionId: string; redirectUrl: string | null };
  error?: string;
}

export const paymentService = {
  /** Start a checkout for an invoice (preferred) or an ad-hoc amount. */
  startCheckout: (payload: { invoiceId?: string; studentId?: string; amount?: number; label?: string }) =>
    apiClient.post<CheckoutResponse>('/api/v1/payments/monime/checkout', payload),

  /** Poll a payment session's status after returning from checkout. */
  getSessionStatus: (sessionId: string) =>
    apiClient.get<{ success: boolean; data: { status: string } }>(`/api/v1/payments/monime/session/${sessionId}`),
};

export default paymentService;
