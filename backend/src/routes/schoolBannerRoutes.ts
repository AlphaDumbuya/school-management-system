/**
 * School dashboard banner.
 *
 *   PUT    /api/v1/school-banner   { photo: "data:image/jpeg|png|webp;base64,...", inline?: boolean }
 *   DELETE /api/v1/school-banner
 *       Principal / super admin (the owner is a principal). The school is always the
 *       signed-in user's own; no tenant id is read from the request. The demo school
 *       stays read-only through the global demoReadOnly guard (these are not /public).
 *       Reply: { success, data: { bannerUrl } } where bannerUrl is the short,
 *       versioned URL also returned as `schoolBannerUrl` by /auth/me.
 *
 *   GET /api/v1/public/branding/:tenantId/banner?v=<version>
 *       The image bytes (see `schoolBannerHandler`, mounted in brandingRoutes next to
 *       the logo). Public like the logo, because an <img> tag can't send a token.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { recordAudit } from '../utils/auditTrail';
import { logger } from '@utils/logger';
import { removeSchoolBanner, readSchoolBanner, setSchoolBanner } from '@services/schoolBannerService';

const router = Router();

const UUIDISH = /^[0-9a-f-]{8,64}$/i;

/** The signed-in user's own school. */
function ownTenant(req: Request): { tenantId: string; userId: string } {
  const tenantId = (req.user as any)?.tenant_id as string | undefined;
  const userId = req.auth?.userId;
  if (!userId) throw new AppError('Please sign in again.', 401, 'UNAUTHORIZED');
  if (!tenantId) throw new AppError('This account is not linked to a school.', 400, 'TENANT_CONTEXT_MISSING');
  return { tenantId, userId };
}

router.put(
  '/',
  authenticate,
  attachUserContext,
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, userId } = ownTenant(req);
      const data = await setSchoolBanner(tenantId, userId, req.body?.photo, { inline: req.body?.inline === true });
      await recordAudit({ req, userId, action: 'school_banner.set', entityType: 'school_banner' });
      res.json({ success: true, message: 'School banner saved', data });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/',
  authenticate,
  attachUserContext,
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, userId } = ownTenant(req);
      const data = await removeSchoolBanner(tenantId, userId);
      await recordAudit({ req, userId, action: 'school_banner.remove', entityType: 'school_banner' });
      res.json({ success: true, message: 'School banner removed', data });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Streams the banner image. The URL carries ?v=<hash of the stored banner>: when it
 * matches the current banner the response is cached for a day (a new banner has a
 * new hash and so a new URL); without a matching hash it is only cached for minutes,
 * so a stale link can never pin an old picture.
 */
export async function schoolBannerHandler(req: Request, res: Response) {
  const { tenantId } = req.params;
  if (!UUIDISH.test(tenantId)) return res.status(404).end();
  try {
    const banner = await readSchoolBanner(tenantId);
    if (!banner) {
      res.set('Cache-Control', 'no-store');
      return res.status(404).end();
    }
    const current = String(req.query.v || '') === banner.version;
    const etag = `"banner-${banner.version}"`;
    res.set({
      ETag: etag,
      'Cache-Control': current ? 'public, max-age=86400, immutable' : 'public, max-age=300, must-revalidate',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.set({ 'Content-Type': banner.type, 'Content-Length': String(banner.body.length) });
    return res.end(banner.body);
  } catch (e) {
    logger.warn(`school banner failed for tenant ${tenantId}: ${(e as any)?.message || e}`);
    return res.status(404).end();
  }
}

export default router;
