import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/database.js';
import { QrCodeService } from '../services/qrCodeService.js';
import { AppError } from '../middleware/errorHandler.js';

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

export default router;
