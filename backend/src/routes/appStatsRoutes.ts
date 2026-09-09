/**
 * App stats routes — mobile-app (APK) download tracking.
 *
 *   GET /api/v1/app/download          → increments the counter, then redirects
 *                                        to the APK. Public (no auth) so the
 *                                        marketing site + app links can use it.
 *   GET /api/v1/app/download-count    → current count (super-admin only).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { UserRole } from '../types/auth';
import { db } from '@utils/database';
import { logger } from '@utils/logger';

const router = Router();

const APK_URL =
  process.env.APK_DOWNLOAD_TARGET ||
  'https://www.wiskulsl.com/downloads/wiskul.apk';

/** Public: count a download, then redirect to the APK file. */
router.get('/app/download', async (_req: Request, res: Response) => {
  try {
    const has = await db.schema.hasTable('app_stats');
    if (has) {
      // Atomic upsert-increment so concurrent clicks don't lose counts.
      const updated = await db('app_stats').where({ key: 'apk_downloads' }).increment('value', 1);
      if (!updated) {
        await db('app_stats').insert({ key: 'apk_downloads', value: 1 }).onConflict('key').ignore();
      }
      await db('app_stats').where({ key: 'apk_downloads' }).update({ updated_at: new Date() });
    }
  } catch (err) {
    // Never block the download because counting failed.
    logger.warn(`APK download count failed: ${String((err as any)?.message || err)}`);
  }
  res.redirect(302, APK_URL);
});

/** Super-admin: read the current download count. */
router.get('/app/download-count', authenticate, authorize(UserRole.SUPER_ADMIN), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const has = await db.schema.hasTable('app_stats');
    const row = has ? await db('app_stats').where({ key: 'apk_downloads' }).first() : null;
    res.json({ success: true, data: { downloads: Number(row?.value ?? 0), updatedAt: row?.updated_at ?? null } });
  } catch (error) {
    next(error);
  }
});

export default router;
