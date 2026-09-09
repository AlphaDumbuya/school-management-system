import crypto from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Monime payment provider integration (https://monime.io).
 *
 * Monime offers a single hosted checkout that accepts mobile money, card, bank,
 * and digital wallet payments in Sierra Leone. We create a checkout session and
 * redirect the payer to `redirectUrl`; payment status is reconciled via webhook
 * (authoritative) and/or by fetching the session on the success redirect.
 *
 * Docs: POST https://api.monime.io/v1/checkout-sessions
 *  Headers: Authorization: Bearer <token>, Monime-Space-Id, Idempotency-Key
 *  Body: { name, successUrl, cancelUrl, lineItems[], metadata, callbackState }
 *  lineItems: { type:'custom', name, price:{ currency:'SLE', value:<minor units> }, quantity }
 */

const MONIME_BASE_URL = process.env.MONIME_BASE_URL || 'https://api.monime.io';

export interface CreateCheckoutInput {
  name: string;                 // human label, e.g. "School Fees — Invoice #123"
  amount: number;               // amount in MAJOR SLE units (e.g. 250.00)
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  callbackState?: string;       // echoed back for correlation (we use the session id)
}

export interface CreateCheckoutResult {
  sessionId: string | null;
  redirectUrl: string | null;
  raw?: any;
}

export class MonimeService {
  private token = process.env.MONIME_ACCESS_TOKEN || '';
  private spaceId = process.env.MONIME_SPACE_ID || '';
  private webhookSecret = process.env.MONIME_WEBHOOK_SECRET || '';

  isConfigured(): boolean {
    return !!(this.token && this.spaceId);
  }

  private toMinorUnits(amountMajor: number): number {
    return Math.round(Number(amountMajor) * 100);
  }

  /**
   * Create a hosted checkout session. Returns the redirect URL to send the
   * payer to Monime's checkout page.
   */
  async createCheckoutSession(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!this.isConfigured()) {
      throw new Error('Monime is not configured (missing MONIME_ACCESS_TOKEN / MONIME_SPACE_ID)');
    }

    const body = {
      name: input.name,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      lineItems: [
        {
          type: 'custom',
          name: input.name,
          price: { currency: 'SLE', value: this.toMinorUnits(input.amount) },
          quantity: 1,
        },
      ],
      metadata: input.metadata || {},
      callbackState: input.callbackState,
    };

    const res = await fetch(`${MONIME_BASE_URL}/v1/checkout-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Monime-Space-Id': this.spaceId,
        'Idempotency-Key': crypto.randomUUID(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('Monime createCheckoutSession failed', { status: res.status, text });
      throw new Error(`Monime checkout failed (${res.status})`);
    }

    const data: any = await res.json().catch(() => ({}));
    return {
      sessionId: data?.result?.id ?? null,
      redirectUrl: data?.result?.redirectUrl ?? null,
      raw: data,
    };
  }

  /**
   * Fetch a checkout session to read its authoritative status.
   * Returns e.g. { status: 'completed' | 'pending' | ... }.
   */
  async getCheckoutSession(sessionId: string): Promise<any> {
    if (!this.isConfigured()) throw new Error('Monime is not configured');
    const res = await fetch(`${MONIME_BASE_URL}/v1/checkout-sessions/${encodeURIComponent(sessionId)}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Monime-Space-Id': this.spaceId,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('Monime getCheckoutSession failed', { status: res.status, text });
      throw new Error(`Monime session fetch failed (${res.status})`);
    }
    const data: any = await res.json().catch(() => ({}));
    return data?.result ?? data;
  }

  /**
   * Verify a webhook signature (HMAC-SHA256 of the raw body with the webhook
   * secret). Returns true when no secret is configured (dev) OR the signature
   * matches. Header name may vary; we accept the common ones.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!this.webhookSecret) {
      // FAIL CLOSED in production: without a secret we cannot verify authenticity,
      // and accepting unsigned webhooks would let anyone forge a "payment
      // completed" event. Only allow the unsigned path outside production.
      if (process.env.NODE_ENV === 'production') {
        logger.error('MONIME_WEBHOOK_SECRET not set in production — rejecting unverifiable webhook');
        return false;
      }
      logger.warn('MONIME_WEBHOOK_SECRET not set — skipping webhook signature verification (non-production only)');
      return true;
    }
    if (!signatureHeader) return false;
    const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
    // The provider may send "sha256=<hex>" or just "<hex>".
    const provided = signatureHeader.replace(/^sha256=/i, '').trim();
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }

  /** Normalise a Monime status string to our internal payment-session status. */
  normaliseStatus(monimeStatus?: string): 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired' {
    const s = (monimeStatus || '').toLowerCase();
    if (['completed', 'success', 'successful', 'paid'].includes(s)) return 'completed';
    if (['failed', 'error', 'declined'].includes(s)) return 'failed';
    if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
    if (['expired'].includes(s)) return 'expired';
    return 'pending';
  }
}

export const monimeService = new MonimeService();
