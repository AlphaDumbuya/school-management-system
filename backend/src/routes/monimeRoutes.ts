import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/authMiddleware.js';
import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { monimeService } from '../services/monimeService.js';

/**
 * Monime online-payment routes.
 *
 * POST /api/v1/payments/monime/checkout   (authenticated)
 *   Initiate a hosted-checkout session for an invoice (or ad-hoc amount) and
 *   return the Monime redirect URL. Students/parents/staff can pay fees.
 *
 * GET  /api/v1/payments/monime/session/:id (authenticated)
 *   Poll a payment session's status (used by the return page).
 *
 * POST /api/v1/payments/monime/webhook     (PUBLIC — mounted before auth)
 *   Monime calls this to notify payment completion. We verify the signature,
 *   reconcile the session, record the payment, and update invoice/fee balances.
 */

const router = Router();

// Resolve the public app origin for building success/cancel URLs.
function appOrigin(req: Request): string {
  const envBase = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL;
  if (envBase && !/localhost|127\.0\.0\.1/.test(envBase)) return envBase.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host');
  if (host && !/localhost|127\.0\.0\.1/.test(host)) return `${proto}://${host}`;
  return (envBase || '').replace(/\/+$/, '') || `${proto}://${host}`;
}

// ── Initiate a checkout ───────────────────────────────────────────────────────
router.post('/monime/checkout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!monimeService.isConfigured()) {
      return res.status(503).json({ success: false, error: 'Online payments are not configured yet.' });
    }
    const tenantId = (req as any).user?.tenant_id;
    const userId = (req as any).user?.id;
    const { invoiceId, studentId: bodyStudentId, amount: bodyAmount, label } = req.body || {};

    if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant context required' });

    // Resolve the invoice (preferred) or an ad-hoc amount.
    let studentId = bodyStudentId as string | undefined;
    let amount = Number(bodyAmount) || 0;
    let name = label || 'School Fees';

    if (invoiceId) {
      const invoice = await db('invoices').where({ id: invoiceId }).first();
      if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
      // Tenant check via the invoice's student.
      const student = await db('students').where({ id: invoice.student_id }).first();
      if (!student || (student.tenant_id && student.tenant_id !== tenantId)) {
        return res.status(403).json({ success: false, error: 'Invoice not in your school' });
      }
      studentId = invoice.student_id;
      amount = Number(invoice.balance ?? invoice.total_amount) || 0;
      name = `School Fees — ${invoice.invoice_number}`;
    }

    if (!studentId) return res.status(400).json({ success: false, error: 'studentId or invoiceId is required' });
    if (!(amount > 0)) return res.status(400).json({ success: false, error: 'Nothing to pay — balance is zero' });

    // Create our session row first so we can correlate the webhook.
    const [session] = await db('payment_sessions')
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        invoice_id: invoiceId || null,
        amount,
        currency: 'SLE',
        provider: 'monime',
        status: 'pending',
        initiated_by: userId || null,
        metadata: JSON.stringify({ invoiceId: invoiceId || null }),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const origin = appOrigin(req);
    const successUrl = `${origin}/finance/pay/return?session=${session.id}&status=success`;
    const cancelUrl = `${origin}/finance/pay/return?session=${session.id}&status=cancelled`;

    const checkout = await monimeService.createCheckoutSession({
      name,
      amount,
      successUrl,
      cancelUrl,
      metadata: { sessionId: session.id, tenantId, studentId, invoiceId: invoiceId || '' },
      callbackState: session.id,
    });

    await db('payment_sessions')
      .where({ id: session.id })
      .update({
        provider_session_id: checkout.sessionId,
        redirect_url: checkout.redirectUrl,
        updated_at: new Date(),
      });

    return res.json({
      success: true,
      data: { sessionId: session.id, redirectUrl: checkout.redirectUrl },
    });
  } catch (error) {
    logger.error('Monime checkout error', { error: (error as Error).message });
    next(error);
  }
});

// ── Poll a session status ─────────────────────────────────────────────────────
router.get('/monime/session/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const session = await db('payment_sessions').where({ id: req.params.id }).first();
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    if (session.tenant_id !== tenantId) return res.status(403).json({ success: false, error: 'Forbidden' });

    // If still pending and we have a provider session id, refresh from Monime.
    if (session.status === 'pending' && session.provider_session_id && monimeService.isConfigured()) {
      try {
        const remote = await monimeService.getCheckoutSession(session.provider_session_id);
        const status = monimeService.normaliseStatus(remote?.status);
        if (status !== 'pending') {
          await reconcileSession(session.id, status);
          const refreshed = await db('payment_sessions').where({ id: session.id }).first();
          return res.json({ success: true, data: { status: refreshed.status } });
        }
      } catch { /* ignore — return stored status */ }
    }

    return res.json({ success: true, data: { status: session.status } });
  } catch (error) {
    next(error);
  }
});

// ── Webhook (PUBLIC) ──────────────────────────────────────────────────────────
// NOTE: index.ts mounts this with express.raw so we can verify the HMAC over the
// exact raw bytes. req.body is a Buffer here.
router.post('/monime/webhook', async (req: Request, res: Response) => {
  try {
    const raw: Buffer = (req as any).body instanceof Buffer ? (req as any).body : Buffer.from(JSON.stringify((req as any).body || {}));
    const sig = (req.headers['monime-signature'] || req.headers['x-monime-signature'] || req.headers['x-signature']) as string | undefined;

    if (!monimeService.verifyWebhookSignature(raw, sig)) {
      logger.warn('Monime webhook signature verification failed');
      return res.status(401).json({ received: false });
    }

    const event = JSON.parse(raw.toString('utf8'));
    // Correlate by our callbackState (session id) or provider session id.
    const providerSessionId = event?.data?.id || event?.result?.id || event?.data?.checkoutSessionId;
    const callbackState = event?.data?.callbackState || event?.result?.callbackState;
    const statusRaw = event?.data?.status || event?.result?.status || event?.type;
    const status = monimeService.normaliseStatus(statusRaw);

    let session = null as any;
    if (callbackState) session = await db('payment_sessions').where({ id: callbackState }).first();
    if (!session && providerSessionId) session = await db('payment_sessions').where({ provider_session_id: providerSessionId }).first();

    if (!session) {
      logger.warn('Monime webhook: no matching payment session', { providerSessionId, callbackState });
      return res.status(200).json({ received: true }); // ack so Monime stops retrying
    }

    await reconcileSession(session.id, status);
    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Monime webhook error', { error: (error as Error).message });
    // Still 200 so the provider doesn't hammer retries on our parsing bugs.
    return res.status(200).json({ received: true });
  }
});

/**
 * Reconcile a payment session: on completion, record a payment and reduce the
 * invoice balance. Idempotent — a session only records its payment once.
 */
async function reconcileSession(sessionId: string, status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired') {
  const session = await db('payment_sessions').where({ id: sessionId }).first();
  if (!session) return;
  if (session.status === 'completed') return; // already done

  if (status !== 'completed') {
    await db('payment_sessions').where({ id: sessionId }).update({ status, updated_at: new Date() });
    return;
  }

  await db.transaction(async (trx) => {
    // Record the payment (payments.id is a uuid PK).
    const paymentId = crypto.randomUUID();
    await trx('payments').insert({
      id: paymentId,
      tenant_id: session.tenant_id,
      student_id: session.student_id,
      invoice_id: session.invoice_id || null,
      amount: session.amount,
      payment_date: new Date(),
      method: 'monime',
      payment_method: 'monime',
      provider: 'monime',
      provider_reference: session.provider_session_id || null,
      transaction_reference: session.provider_session_id || null,
      reference_number: session.provider_session_id || null,
      status: 'completed',
      created_at: new Date(),
      updated_at: new Date(),
    });

    if (session.invoice_id) {
      // Reduce the invoice balance…
      const invoice = await trx('invoices').where({ id: session.invoice_id }).first();
      if (invoice) {
        const newPaid = Number(invoice.total_paid || 0) + Number(session.amount);
        const newBalance = Math.max(0, Number(invoice.total_amount) - newPaid);
        await trx('invoices').where({ id: invoice.id }).update({
          total_paid: newPaid,
          balance: newBalance,
          status: newBalance <= 0 ? 'paid' : 'partial',
          updated_at: new Date(),
        });
      }
      // …and settle the underlying fees linked to this invoice.
      const itemFeeIds = (await trx('invoice_items').where({ invoice_id: session.invoice_id }).select('fee_id')).map((r: any) => r.fee_id);
      if (itemFeeIds.length) {
        const linkedFees = await trx('fees').whereIn('id', itemFeeIds).orderBy('due_date', 'asc');
        await applyAmountToFees(trx, linkedFees, Number(session.amount));
      }
    } else {
      // Ad-hoc payment (no invoice) → apply to the student's oldest outstanding fees.
      const openFees = await trx('fees')
        .where({ student_id: session.student_id })
        .whereIn('status', ['pending', 'partial', 'overdue'])
        .orderBy('due_date', 'asc');
      await applyAmountToFees(trx, openFees, Number(session.amount));
    }

    await trx('payment_sessions').where({ id: sessionId }).update({
      status: 'completed',
      payment_id: paymentId,
      updated_at: new Date(),
    });
  });

  logger.info(`Monime payment reconciled for session ${sessionId}`);
}

/**
 * Apply a paid amount across a list of fees (oldest first), reducing each fee's
 * balance and updating its status. Used so online payments auto-settle the
 * student's fee ledger, not just the invoice.
 */
async function applyAmountToFees(trx: any, fees: any[], amount: number) {
  let remaining = amount;
  for (const fee of fees) {
    if (remaining <= 0) break;
    const bal = Number(fee.balance ?? fee.amount) || 0;
    if (bal <= 0) continue;
    const applied = Math.min(bal, remaining);
    const newBal = bal - applied;
    await trx('fees').where({ id: fee.id }).update({
      balance: newBal,
      status: newBal <= 0 ? 'paid' : 'partial',
      updated_at: new Date(),
    });
    remaining -= applied;
  }
}

export default router;
