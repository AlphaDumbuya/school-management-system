import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, attachUserContext } from '../middleware/authMiddleware.js';
import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { monimeService } from '../services/monimeService.js';
import { applyAmount } from '../services/paymentApplication.js';

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

/**
 * Minimum-payment policy enforcement now lives in
 * financeLedgerService.enforceMinimumPayment so every payment path (Monime
 * checkout, Monime USSD payment code, and manual staff-recorded payments)
 * applies identical rules from a single source of truth.
 */

// Resolve the public app origin for building success/cancel URLs.
function appOrigin(req: Request): string {
  const envBase = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL;
  if (envBase && !/localhost|127\.0\.0\.1/.test(envBase)) return envBase.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host');
  if (host && !/localhost|127\.0\.0\.1/.test(host)) return `${proto}://${host}`;
  return (envBase || '').replace(/\/+$/, '') || `${proto}://${host}`;
}

// ── Online-payment availability (so portals can hide the pay action) ──────────
// Fee payments settle into the SCHOOL's OWN Monime account, so availability is
// per-tenant: online fee payment is only enabled once the school has configured
// its own Monime credentials (Settings → Payments).
router.get('/monime/status', authenticate, attachUserContext, async (req: Request, res: Response) => {
  const tenantId = (req as any).user?.tenant_id;
  const tenantCreds = tenantId ? await monimeService.resolveTenantCredentials(tenantId) : null;
  return res.json({ success: true, data: { online_payments_enabled: !!tenantCreds } });
});

// ── Initiate a checkout ───────────────────────────────────────────────────────
router.post('/monime/checkout', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const userId = (req as any).user?.id;
    const { invoiceId, studentId: bodyStudentId, amount: bodyAmount, label } = req.body || {};

    if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant context required' });

    // Fee money MUST go to the SCHOOL's own Monime account — never the platform's.
    const feeCreds = await monimeService.resolveTenantCredentials(tenantId);
    if (!feeCreds) {
      return res.status(503).json({ success: false, error: 'Online payments are not set up for your school yet. Please contact your administrator.' });
    }

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

    // Scope the payer to their own records (financial-management Req 6.6):
    //  - parent/guardian → must be a verified link to the student
    //  - student → may only pay their own fees
    //  - staff → may pay for any student in the tenant
    const role = (req as any).user?.role as string | undefined;
    if (role === 'parent' || role === 'guardian') {
      const link = await db('guardians').where({ student_id: studentId, user_id: userId }).first().catch(() => null);
      if (!link) return res.status(403).json({ success: false, error: 'You are not linked to this student.' });
    } else if (role === 'student') {
      const own = await db('students').where({ user_id: userId, tenant_id: tenantId }).first().catch(() => null);
      if (!own || own.id !== studentId) return res.status(403).json({ success: false, error: 'You can only pay your own fees.' });
    } else {
      // Staff/other: confirm the student is at least in the tenant.
      const inTenant = await db('students').where({ id: studentId, tenant_id: tenantId }).first().catch(() => null);
      if (!inTenant) return res.status(403).json({ success: false, error: 'Student not in your school.' });
    }

    // Enforce the school's minimum-payment policy for partial payments —
    // on ALL payments (invoice or ad-hoc), via the shared ledger enforcer.
    {
      const { financeLedgerService } = await import('../services/financeLedgerService.js');
      const minErr = await financeLedgerService.enforceMinimumPayment(tenantId, studentId, amount);
      if (minErr) return res.status(422).json({ success: false, error: minErr });
    }

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
    }, feeCreds); // settle into the SCHOOL's own Monime account

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

// ── Initiate a payment code (in-app USSD mobile-money collection) ─────────────
// Creates a Monime Payment Code and returns the USSD code the payer dials on
// their phone — the whole payment happens INSIDE our app (no popup/iframe).
router.post('/monime/payment-code', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const userId = (req as any).user?.id;
    const { invoiceId, studentId: bodyStudentId, amount: bodyAmount, label } = req.body || {};
    if (!tenantId) return res.status(400).json({ success: false, error: 'Tenant context required' });

    // Fee money MUST go to the SCHOOL's own Monime account — never the platform's.
    const feeCreds = await monimeService.resolveTenantCredentials(tenantId);
    if (!feeCreds) {
      return res.status(503).json({ success: false, error: 'Online payments are not set up for your school yet. Please contact your administrator.' });
    }

    // Resolve invoice (preferred) or ad-hoc amount — identical rules to checkout.
    let studentId = bodyStudentId as string | undefined;
    let amount = Number(bodyAmount) || 0;
    let name = label || 'School Fees';

    if (invoiceId) {
      const invoice = await db('invoices').where({ id: invoiceId }).first();
      if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
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

    // Same payer-scoping as checkout (financial-management Req 6.6).
    const role = (req as any).user?.role as string | undefined;
    if (role === 'parent' || role === 'guardian') {
      const link = await db('guardians').where({ student_id: studentId, user_id: userId }).first().catch(() => null);
      if (!link) return res.status(403).json({ success: false, error: 'You are not linked to this student.' });
    } else if (role === 'student') {
      const own = await db('students').where({ user_id: userId, tenant_id: tenantId }).first().catch(() => null);
      if (!own || own.id !== studentId) return res.status(403).json({ success: false, error: 'You can only pay your own fees.' });
    } else {
      const inTenant = await db('students').where({ id: studentId, tenant_id: tenantId }).first().catch(() => null);
      if (!inTenant) return res.status(403).json({ success: false, error: 'Student not in your school.' });
    }

    // Enforce the school's minimum-payment policy for partial payments —
    // on ALL payments (invoice or ad-hoc), via the shared ledger enforcer.
    {
      const { financeLedgerService } = await import('../services/financeLedgerService.js');
      const minErr = await financeLedgerService.enforceMinimumPayment(tenantId, studentId, amount);
      if (minErr) return res.status(422).json({ success: false, error: minErr });
    }

    // Create our session row first so we can correlate the webhook.
    const [session] = await db('payment_sessions')
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        invoice_id: invoiceId || null,
        amount,
        currency: 'SLE',
        provider: 'monime_ussd',
        status: 'pending',
        initiated_by: userId || null,
        metadata: JSON.stringify({ invoiceId: invoiceId || null }),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const code = await monimeService.createPaymentCode({
      name,
      amount,
      metadata: { sessionId: session.id, tenantId, studentId, invoiceId: invoiceId || '' },
    }, feeCreds); // settle into the SCHOOL's own Monime account

    await db('payment_sessions')
      .where({ id: session.id })
      .update({
        provider_session_id: code.id,
        metadata: JSON.stringify({ invoiceId: invoiceId || null, ussdCode: code.ussdCode, expireTime: code.expireTime }),
        updated_at: new Date(),
      });

    return res.json({
      success: true,
      data: { sessionId: session.id, ussdCode: code.ussdCode, amount, expireTime: code.expireTime },
    });
  } catch (error) {
    logger.error('Monime payment-code error', { error: (error as Error).message });
    next(error);
  }
});

// ── Poll a session status ─────────────────────────────────────────────────────
router.get('/monime/session/:id', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const session = await db('payment_sessions').where({ id: req.params.id }).first();
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    if (session.tenant_id !== tenantId) return res.status(403).json({ success: false, error: 'Forbidden' });

    // If still pending and we have a provider id, refresh from Monime. Fee
    // sessions were created under the SCHOOL's own account, so status polling
    // MUST use the same tenant credentials (not the platform account).
    const feeCreds = session.tenant_id ? await monimeService.resolveTenantCredentials(session.tenant_id) : null;
    if (session.status === 'pending' && session.provider_session_id && feeCreds) {
      try {
        const isUssd = session.provider === 'monime_ussd';
        const remote = isUssd
          ? await monimeService.getPaymentCode(session.provider_session_id, feeCreds)
          : await monimeService.getCheckoutSession(session.provider_session_id, feeCreds);
        // Payment codes report completion via progress.isCompleted / status.
        const remoteStatus = isUssd
          ? (remote?.progress?.isCompleted ? 'completed' : remote?.status)
          : remote?.status;
        const status = monimeService.normaliseStatus(remoteStatus);
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

    let event: any;
    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch {
      // Malformed body will never parse on retry either — ack and log.
      logger.warn('Monime webhook: unparseable body');
      return res.status(200).json({ received: true });
    }
    // Correlate by our callbackState (session id) or provider session id.
    // Monime wraps resource events as { event:{name}, object:{id,type}, data:{...} }.
    const eventName: string = event?.event?.name || event?.type || '';
    const providerSessionId = event?.object?.id || event?.data?.id || event?.result?.id || event?.data?.checkoutSessionId;
    // Payment codes carry our correlation id in data.metadata.sessionId; hosted
    // checkout echoes it back as callbackState.
    const callbackState =
      event?.data?.callbackState ||
      event?.result?.callbackState ||
      event?.data?.metadata?.sessionId ||
      event?.result?.metadata?.sessionId;
    // Prefer the event name (payment_code.completed) to derive status; fall back
    // to a status field or the payment code's progress flag.
    const statusRaw =
      (eventName.includes('.') ? eventName.split('.').pop() : undefined) ||
      event?.data?.status ||
      event?.result?.status ||
      event?.type;
    const isCompletedFlag = event?.data?.progress?.isCompleted === true;
    const status = isCompletedFlag ? 'completed' : monimeService.normaliseStatus(statusRaw);

    // Public "restore access" payments use callbackState "restore:<id>". Handle
    // these separately: on completion, renew the subscription + reactivate.
    if (typeof callbackState === 'string' && callbackState.startsWith('restore:')) {
      const restoreId = callbackState.slice('restore:'.length);
      await reconcileRestoreSession(restoreId, status);
      return res.status(200).json({ received: true });
    }

    // Subscription/plan payments use callbackState "subscription:<id>". These
    // settle into the PLATFORM's account; on completion we activate the plan.
    if (typeof callbackState === 'string' && callbackState.startsWith('subscription:')) {
      const subSessionId = callbackState.slice('subscription:'.length);
      const { SubscriptionCheckout } = await import('../services/subscriptionCheckoutService.js');
      await SubscriptionCheckout.reconcile(subSessionId, status);
      return res.status(200).json({ received: true });
    }

    let session = null as any;
    if (callbackState) session = await db('payment_sessions').where({ id: callbackState }).first();
    if (!session && providerSessionId) session = await db('payment_sessions').where({ provider_session_id: providerSessionId }).first();

    if (!session) {
      // Cannot match the event to a session (and therefore to a tenant). Do NOT
      // apply any payment — quarantine the raw event for manual review, then ack
      // so the provider stops retrying (financial-management spec Req 1.5).
      logger.warn('Monime webhook: no matching payment session — quarantining', { providerSessionId, callbackState });
      await db('payment_webhook_quarantine')
        .insert({
          provider: 'monime',
          raw_payload: JSON.stringify(event),
          reason: `Unmatched webhook (providerSessionId=${providerSessionId ?? 'none'}, callbackState=${callbackState ?? 'none'})`.slice(0, 200),
          created_at: new Date(),
        })
        .catch((e) => logger.error('Failed to quarantine unmatched Monime webhook', { error: (e as Error).message }));
      return res.status(200).json({ received: true }); // ack so Monime stops retrying
    }

    await reconcileSession(session.id, status);
    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Monime webhook error', { error: (error as Error).message });
    // 500 so the provider RETRIES: a paid-but-unrecorded payment is far worse
    // than a retry. Reconciliation is idempotent (session row locked + status
    // checked in-transaction), so retries can't double-record.
    return res.status(500).json({ received: false });
  }
});

/**
 * Reconcile a public "restore access" payment: on completion, renew the tenant's
 * subscription and reactivate it. Idempotent — only acts once per session.
 */
async function reconcileRestoreSession(
  restoreId: string,
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired'
) {
  const session = await db('restore_payment_sessions').where({ id: restoreId }).first();
  if (!session) {
    logger.warn(`Monime restore webhook: no matching restore session ${restoreId}`);
    return;
  }
  if (session.status === 'completed') return; // already handled

  if (status !== 'completed') {
    await db('restore_payment_sessions').where({ id: restoreId }).update({ status, updated_at: new Date() });
    return;
  }

  const { completeRestore } = await import('../services/restoreAccessService.js');
  await completeRestore(session.tenant_id);
  await db('restore_payment_sessions').where({ id: restoreId }).update({ status: 'completed', updated_at: new Date() });
  logger.info(`Restore payment reconciled — tenant ${session.tenant_id} reactivated (session ${restoreId})`);

  // Notify the school their access is restored (best-effort).
  try {
    const tenant = await db('tenants').where({ id: session.tenant_id }).first();
    const contact = tenant?.contact_email;
    if (contact) {
      const { default: emailService } = await import('../services/emailService');
      await emailService.sendTenantStatusEmail(contact, { schoolName: tenant.name, status: 'restored' });
    }
  } catch (mailErr: any) {
    logger.warn(`Restore confirmation email failed for tenant ${session.tenant_id}: ${mailErr?.message || mailErr}`);
  }
}

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

  let applied = false;
  let receiptNumber: string | null = null;
  await db.transaction(async (trx) => {
    // Lock the session row and re-check inside the transaction so a retried or
    // duplicated webhook arriving at the same moment can't record twice.
    const locked = await trx('payment_sessions').where({ id: sessionId }).forUpdate().first();
    if (!locked || locked.status === 'completed') return;
    applied = true;

    // Record the payment (payments.id is a uuid PK) with the school's next
    // sequential receipt number (stored, so reprints and emails match).
    const paymentId = crypto.randomUUID();
    const { nextReceiptNumber } = await import('../services/finance/core.js');
    receiptNumber = await nextReceiptNumber(trx, session.tenant_id, new Date());
    await trx('payments').insert({
      receipt_number: receiptNumber,
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
        .where({ student_id: session.student_id, tenant_id: session.tenant_id })
        .whereIn('status', ['pending', 'partial', 'overdue'])
        .orderBy('due_date', 'asc')
        .forUpdate();
      await applyAmountToFees(trx, openFees, Number(session.amount));
    }

    // Balance right after this payment, for the receipt.
    const { studentOutstanding } = await import('../services/finance/core.js');
    await trx('payments').where({ id: paymentId }).update({ balance_after: await studentOutstanding(trx, session.tenant_id, session.student_id) });

    await trx('payment_sessions').where({ id: sessionId }).update({
      status: 'completed',
      payment_id: paymentId,
      updated_at: new Date(),
    });
  });
  if (!applied) return; // another delivery already reconciled it

  logger.info(`Monime payment reconciled for session ${sessionId}`);

  // Tell the bursar (best-effort).
  try {
    const { notifyFinanceStaff } = await import('../services/finance/core.js');
    const st = await db('students').where({ id: session.student_id }).first('first_name', 'last_name');
    await notifyFinanceStaff(session.tenant_id, ['accountant'], {
      subject: 'Online payment received',
      message: `Le ${Number(session.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} paid online for ${[st?.first_name, st?.last_name].filter(Boolean).join(' ') || 'a student'}${receiptNumber ? ` (receipt ${receiptNumber})` : ''}.`,
      url: '/finance/payments', sourceType: 'payment', sourceId: sessionId,
    });
  } catch { /* never block the webhook */ }

  // Send a payment receipt email to the payer (best-effort — never block/fail
  // the webhook because email delivery hiccuped).
  try {
    if (receiptNumber) {
      // The stored receipt (same number, items and balance as a reprint).
      const { receiptService } = await import('../services/finance/receiptService.js');
      await receiptService.email(session.tenant_id, receiptNumber, null);
    } else {
      await sendPaymentReceipt(session);
    }
  } catch (mailErr: any) {
    logger.warn(`Could not send payment receipt for session ${sessionId}: ${mailErr?.message || mailErr}`);
  }
}

/**
 * Look up the student + guardian for a completed session and email a receipt.
 */
async function sendPaymentReceipt(session: any) {
  const student = await db('students').where({ id: session.student_id }).first();
  if (!student) return;

  const studentName = [student.first_name, student.last_name].filter(Boolean).join(' ') || 'Student';

  // Prefer a linked guardian's email; fall back to the student's own email.
  let payerEmail: string | null = student.email || null;
  let payerName = studentName;
  const guardianLink = await db('student_guardians')
    .where({ student_id: session.student_id, status: 'active' })
    .first()
    .catch(() => null);
  if (guardianLink?.guardian_id) {
    const guardian = await db('users').where({ id: guardianLink.guardian_id }).first().catch(() => null);
    if (guardian?.email) {
      payerEmail = guardian.email;
      payerName = [guardian.first_name, guardian.last_name].filter(Boolean).join(' ') || payerName;
    }
  }
  if (!payerEmail) return;

  // Remaining outstanding balance across the student's fees. The fees table
  // tracks the outstanding amount in `balance` (falling back to `amount`).
  const openFees = await db('fees')
    .where({ student_id: session.student_id })
    .whereIn('status', ['pending', 'partial', 'overdue']);
  const balanceRemaining = openFees.reduce(
    (sum: number, f: any) => sum + Math.max(0, Number(f.balance ?? f.amount ?? 0)),
    0
  );

  // Unique, human-friendly receipt number: RCPT-<year>-<8 uppercase hex>.
  const receiptNumber = `RCPT-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  const { default: emailService } = await import('../services/emailService');
  await emailService.sendPaymentReceiptEmail(session.tenant_id, payerEmail, {
    payerName,
    studentName,
    amount: session.amount,
    currency: 'Le',
    method: 'Mobile / Card (Monime)',
    reference: session.provider_session_id || undefined,
    receiptNumber,
    date: new Date(),
    balanceRemaining,
  });
}

/**
 * Apply a paid amount across a list of fees (oldest first), reducing each fee's
 * balance and updating its status. Used so online payments auto-settle the
 * student's fee ledger, not just the invoice.
 */
async function applyAmountToFees(trx: any, fees: any[], amount: number) {
  // Delegate the arithmetic to the pure helper (unit-tested for monotonicity),
  // then persist the resulting per-fee balances.
  const feeLikes = fees.map((f: any) => ({ id: f.id, balance: Number(f.balance ?? f.amount) || 0 }));
  const { applications } = applyAmount(feeLikes, amount);
  for (const app of applications) {
    await trx('fees').where({ id: app.id }).update({
      balance: app.newBalance,
      status: app.status,
      updated_at: new Date(),
    });
  }
}

export default router;
