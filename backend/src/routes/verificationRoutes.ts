/**
 * School verification routes (simple instant, entry-based).
 * Mounted at /api/v1/verification. Owner-only.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { db } from '@utils/database';
import verificationService from '@services/verificationService';

const router = Router();

async function resolveTenantId(userId: string): Promise<string> {
  const user = await db('users').select('tenant_id').where({ id: userId }).first();
  if (!user?.tenant_id) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user.tenant_id;
}

/** GET /api/v1/verification/status */
router.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth.userId;
    const tenantId = await resolveTenantId(userId);
    const status = await verificationService.getStatus(userId, tenantId);
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/verification/verify */
router.post('/verify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth.userId;
    const tenantId = await resolveTenantId(userId);
    const { legalName, emisCode, idType, idNumber, idName, schoolLevel, district, yearEstablished } = req.body;
    const result = await verificationService.verify(userId, tenantId, {
      legalName,
      emisCode,
      idType,
      idNumber,
      idName,
      schoolLevel,
      district,
      yearEstablished: yearEstablished != null ? Number(yearEstablished) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/verification/profile-photo */
router.post('/profile-photo', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth.userId;
    const tenantId = await resolveTenantId(userId);
    const { url } = req.body;
    await verificationService.setProfilePhoto(userId, tenantId, url);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
