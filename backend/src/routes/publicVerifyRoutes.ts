import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/database.js';
import { QrCodeService } from '../services/qrCodeService.js';
import { AppError } from '../middleware/errorHandler.js';
import { getRestoreInfo, verifyRestoreToken } from '../services/restoreAccessService.js';
import { monimeService } from '../services/monimeService.js';
import { logger } from '../utils/logger.js';

/**
 * Public ID verification routes.
 *
 * These endpoints are intentionally UNAUTHENTICATED so that a QR code printed
 * on an ID card can be scanned by anyone (a gate guard, another staff member)
 * with a phone camera and instantly verified. Tenant context is resolved from
 * the signed payload embedded in the QR, so no login is required.
 *
 * Security is preserved by the SHA-256 tenant-secret hash inside the payload,
 * plus rate-limiting / brute-force protection in QrCodeService.
 */
const router = Router();
const qrCodeService = new QrCodeService(db);

/**
 * POST /api/v1/public/verify-id
 * Body: { value: string, deviceId?: string }
 * `value` may be the raw QR content, a full verify URL, or a base64url payload.
 */
router.post('/verify-id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { value, deviceId } = req.body || {};
    if (!value || typeof value !== 'string') {
      throw new AppError('Missing verification value', 400);
    }
    const device = (typeof deviceId === 'string' && deviceId) || `public-${req.ip || 'unknown'}`;
    const verification = await qrCodeService.verifyScannedValue(value, device);
    res.json({ verification });
  } catch (error) {
    next(error);
  }
});

/**
 * Public "restore access" flow — lets a SUSPENDED school pay to reactivate
 * WITHOUT logging in. Access is granted only via a signed token (in the emailed
 * link), which only permits paying — never reading data or signing in.
 */

/** GET /api/v1/public/restore/info?token=... → school name, plan, amount due. */
router.get('/restore/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.query.token || '');
    if (!token) throw new AppError('Missing restore token', 400, 'RESTORE_TOKEN_MISSING');
    const info = await getRestoreInfo(token);
    res.json({ success: true, data: info });
  } catch (error) {
    next(error);
  }
});

function publicOrigin(req: Request): string {
  const envBase = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL;
  if (envBase && !/localhost|127\.0\.0\.1/.test(envBase)) return envBase.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host');
  return `${proto}://${host}`;
}

/** POST /api/v1/public/restore/checkout { token } → Monime redirect URL. */
router.post('/restore/checkout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!monimeService.isConfigured()) {
      return res.status(503).json({ success: false, error: 'Online payments are not configured yet. Please contact support.' });
    }
    const token = String(req.body?.token || '');
    if (!token) throw new AppError('Missing restore token', 400, 'RESTORE_TOKEN_MISSING');
    const tenantId = verifyRestoreToken(token);
    const info = await getRestoreInfo(token);
    if (info.alreadyActive) {
      return res.json({ success: true, data: { alreadyActive: true } });
    }
    if (!(info.amountDue > 0)) {
      return res.status(400).json({ success: false, error: 'No payable amount for this account. Please contact support.' });
    }

    // Track a restore session so the webhook can reconcile it.
    const [session] = await db('restore_payment_sessions')
      .insert({
        tenant_id: tenantId,
        amount: info.amountDue,
        currency: 'SLE',
        provider: 'monime',
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const origin = publicOrigin(req);
    const successUrl = `${origin}/restore-access?token=${encodeURIComponent(token)}&status=success`;
    const cancelUrl = `${origin}/restore-access?token=${encodeURIComponent(token)}&status=cancelled`;

    const checkout = await monimeService.createCheckoutSession({
      name: `WiSkul access restore — ${info.schoolName}`,
      amount: info.amountDue,
      successUrl,
      cancelUrl,
      metadata: { purpose: 'restore', tenantId, restoreSessionId: session.id },
      callbackState: `restore:${session.id}`,
    });

    await db('restore_payment_sessions')
      .where({ id: session.id })
      .update({ provider_session_id: checkout.sessionId, redirect_url: checkout.redirectUrl, updated_at: new Date() });

    logger.info(`Restore checkout created for tenant ${tenantId}, session ${session.id}`);
    res.json({ success: true, data: { redirectUrl: checkout.redirectUrl, sessionId: session.id } });
  } catch (error) {
    next(error);
  }
});

export default router;
