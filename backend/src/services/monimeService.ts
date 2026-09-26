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

/**
 * Which Monime account a call settles into:
 *  - the PLATFORM account (env creds) for subscription/restore revenue, or
 *  - a specific tenant's own account for that school's fee collection.
 */
export interface MonimeCredentials {
  token: string;
  spaceId: string;
}

export class MonimeService {
  private token = process.env.MONIME_ACCESS_TOKEN || '';
  private spaceId = process.env.MONIME_SPACE_ID || '';
  private webhookSecret = process.env.MONIME_WEBHOOK_SECRET || '';

  /** The platform's own Monime credentials (subscription/restore revenue). */
  private platformCreds(): MonimeCredentials {
    return { token: this.token, spaceId: this.spaceId };
  }

  /** Resolve creds to use: an explicit set, or the platform default. */
  private creds(explicit?: MonimeCredentials): MonimeCredentials {
    if (explicit && explicit.token && explicit.spaceId) return explicit;
    return this.platformCreds();
  }

  /** True if the given creds (or the platform default) are usable. */
  isConfigured(creds?: MonimeCredentials): boolean {
    const c = this.creds(creds);
    return !!(c.token && c.spaceId);
  }

  /**
   * Load a tenant's OWN Monime credentials from the schools table. Returns null
   * when the school has not configured its own account (caller decides whether
   * to fall back to the platform account or refuse). The token is encrypted at
   * rest and decrypted here.
   */
  async resolveTenantCredentials(tenantId: string): Promise<MonimeCredentials | null> {
    try {
      const { db } = await import('../utils/database.js');
      const { decryptSecret } = await import('../utils/encryption.js');
      const school = await db('schools')
        .where({ tenant_id: tenantId })
        .select('monime_access_token', 'monime_space_id', 'monime_configured')
        .first();
      if (school?.monime_configured && school?.monime_access_token && school?.monime_space_id) {
        return { token: decryptSecret(school.monime_access_token), spaceId: school.monime_space_id };
      }
    } catch (err) {
      logger.warn(`Could not resolve tenant Monime creds for ${tenantId}: ${err instanceof Error ? err.message : err}`);
    }
    return null;
  }

  private toMinorUnits(amountMajor: number): number {
    return Math.round(Number(amountMajor) * 100);
  }

  /**
   * Create a hosted checkout session. Returns the redirect URL to send the
   * payer to Monime's checkout page.
   */
  async createCheckoutSession(input: CreateCheckoutInput, creds?: MonimeCredentials): Promise<CreateCheckoutResult> {
    const c = this.creds(creds);
    if (!this.isConfigured(c)) {
      throw new Error('Monime is not configured (missing access token / space id)');
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
        Authorization: `Bearer ${c.token}`,
        'Monime-Space-Id': c.spaceId,
        'Idempotency-Key': crypto.randomUUID(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('Monime createCheckoutSession failed', { status: res.status, response: text });
      throw new Error(`Monime checkout failed (${res.status}): ${text?.slice(0, 300)}`);
    }

    const data: any = await res.json().catch(() => ({}));
    return {
      sessionId: data?.result?.id ?? null,
      redirectUrl: data?.result?.redirectUrl ?? null,
      raw: data,
    };
  }

  /**
   * Create a Payment Code (direct mobile-money collection). Returns a USSD code
   * the payer dials on their phone — so the whole payment happens INSIDE our
   * app (no hosted-checkout page, no popup, no iframe). Completion is delivered
   * via `payment_code.completed` webhooks and confirmed by polling the code.
   *
   * Docs: POST https://api.monime.io/v1/payment-codes
   *  Body: { name, mode:'oneTime', amount:{currency,value}, isActive,
   *          financialTarget:{ expectedPaymentCount, expectedPaymentSum },
   *          metadata }
   */
  async createPaymentCode(input: {
    name: string;
    amount: number;               // MAJOR SLE units
    metadata?: Record<string, string>;
    duration?: string;            // e.g. '15m' — how long the code stays valid
  }, creds?: MonimeCredentials): Promise<{ id: string | null; ussdCode: string | null; status: string | null; expireTime: string | null; raw?: any }> {
    const c = this.creds(creds);
    if (!this.isConfigured(c)) {
      throw new Error('Monime is not configured (missing access token / space id)');
    }
    const value = this.toMinorUnits(input.amount);
    // Minimal valid shape for a fixed one-time collection: a named code with a
    // set amount. We intentionally omit financialTarget/customerTarget so the
    // code simply collects `amount` once (docs: amount is the per-payment sum).
    const body: any = {
      name: input.name.slice(0, 100),
      mode: 'one_time',                      // API validator requires snake_case
      amount: { currency: 'SLE', value },
      duration: input.duration || '15m',
      metadata: input.metadata || {},
    };

    const idempotencyKey = crypto.randomUUID();
    const doPost = (path: string) =>
      fetch(`${MONIME_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.token}`,
          'Monime-Space-Id': c.spaceId,
          'Idempotency-Key': idempotencyKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

    // The docs render the path without a version prefix. Try the versioned
    // path first (matches the checkout-sessions convention) and fall back to
    // the un-versioned one on a 404.
    let res = await doPost('/v1/payment-codes');
    if (res.status === 404) res = await doPost('/payment-codes');

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('Monime createPaymentCode failed', { status: res.status, body, response: text });
      throw new Error(`Monime payment code failed (${res.status}): ${text?.slice(0, 300)}`);
    }
    const data: any = await res.json().catch(() => ({}));
    const result = data?.result ?? data;
    return {
      id: result?.id ?? null,
      ussdCode: result?.ussdCode ?? null,
      status: result?.status ?? null,
      expireTime: result?.expireTime ?? null,
      raw: data,
    };
  }

  /** Fetch a payment code to read its authoritative status. */
  async getPaymentCode(paymentCodeId: string, creds?: MonimeCredentials): Promise<any> {
    const c = this.creds(creds);
    if (!this.isConfigured(c)) throw new Error('Monime is not configured');
    const headers = { Authorization: `Bearer ${c.token}`, 'Monime-Space-Id': c.spaceId };
    const id = encodeURIComponent(paymentCodeId);
    let res = await fetch(`${MONIME_BASE_URL}/v1/payment-codes/${id}`, { headers });
    if (res.status === 404) res = await fetch(`${MONIME_BASE_URL}/payment-codes/${id}`, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('Monime getPaymentCode failed', { status: res.status, text });
      throw new Error(`Monime payment code fetch failed (${res.status})`);
    }
    const data: any = await res.json().catch(() => ({}));
    return data?.result ?? data;
  }

  /**
   * Fetch a checkout session to read its authoritative status.
   * Returns e.g. { status: 'completed' | 'pending' | ... }.
   */
  async getCheckoutSession(sessionId: string, creds?: MonimeCredentials): Promise<any> {
    const c = this.creds(creds);
    if (!this.isConfigured(c)) throw new Error('Monime is not configured');
    const res = await fetch(`${MONIME_BASE_URL}/v1/checkout-sessions/${encodeURIComponent(sessionId)}`, {
      headers: {
        Authorization: `Bearer ${c.token}`,
        'Monime-Space-Id': c.spaceId,
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
