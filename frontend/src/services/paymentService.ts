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
  /** Start a hosted-checkout (redirect/popup) for an invoice or ad-hoc amount. */
  startCheckout: (payload: { invoiceId?: string; studentId?: string; amount?: number; label?: string }) =>
    apiClient.post<CheckoutResponse>('/api/v1/payments/monime/checkout', payload),

  /**
   * Start an in-app USSD payment (Monime Payment Code). Returns a USSD code the
   * payer dials on their phone — the whole flow stays inside our app.
   */
  startUssdPayment: (payload: { invoiceId?: string; studentId?: string; amount?: number; label?: string }) =>
    apiClient.post<{ success: boolean; data?: { sessionId: string; ussdCode: string | null; amount: number; expireTime: string | null }; error?: string }>(
      '/api/v1/payments/monime/payment-code',
      payload,
    ),

  /** Poll a payment session's status after returning from checkout. */
  getSessionStatus: (sessionId: string) =>
    apiClient.get<{ success: boolean; data: { status: string } }>(`/api/v1/payments/monime/session/${sessionId}`),

  /** Whether online payments are configured for this tenant (to show/hide pay). */
  getOnlineStatus: () =>
    apiClient.get<{ success: boolean; data: { online_payments_enabled: boolean } }>(
      '/api/v1/payments/monime/status',
    ),
};

export default paymentService;
