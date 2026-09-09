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

// Repo + release used to source the APK. Overridable via env.
const GH_REPO = process.env.GITHUB_APK_REPO || 'AlphaDumbuya/school-management-system';
const GH_RELEASE_TAG = process.env.GITHUB_APK_RELEASE_TAG || 'android-latest';
const GH_TOKEN = process.env.GITHUB_RELEASE_TOKEN || process.env.GITHUB_TOKEN;
// Optional direct/public APK URL (e.g. a CDN/Blob). If set, we redirect to it.
const APK_DIRECT_URL = process.env.APK_DOWNLOAD_TARGET;

async function countDownload(): Promise<void> {
  try {
    const has = await db.schema.hasTable('app_stats');
    if (!has) return;
    const updated = await db('app_stats').where({ key: 'apk_downloads' }).increment('value', 1);
    if (!updated) {
      await db('app_stats').insert({ key: 'apk_downloads', value: 1 }).onConflict('key').ignore();
    }
    await db('app_stats').where({ key: 'apk_downloads' }).update({ updated_at: new Date() });
  } catch (err) {
    logger.warn(`APK download count failed: ${String((err as any)?.message || err)}`);
  }
}

/**
 * Resolve the browser-download URL of the APK asset on the GitHub Release.
 * Uses the GitHub API with a token so it works even for a PRIVATE repo.
 */
async function resolveReleaseAssetUrl(): Promise<string | null> {
  if (!GH_TOKEN) return null;
  try {
    const relRes = await fetch(
      `https://api.github.com/repos/${GH_REPO}/releases/tags/${GH_RELEASE_TAG}`,
      { headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'wiskul-app' } }
    );
    if (!relRes.ok) return null;
    const rel: any = await relRes.json();
    const asset = (rel.assets || []).find((a: any) => /\.apk$/i.test(a.name));
    return asset?.url || null; // the API asset URL (needs octet-stream accept + token)
  } catch (err) {
    logger.warn(`Resolve release asset failed: ${String((err as any)?.message || err)}`);
    return null;
  }
}

/**
 * Public: count a download, then serve the APK.
 *   - If APK_DOWNLOAD_TARGET is set (a public URL/CDN), redirect to it.
 *   - Else stream the latest GitHub Release asset (works for private repos via
 *     GITHUB_RELEASE_TOKEN). Streaming avoids exposing the token to the client.
 */
router.get('/app/download', async (_req: Request, res: Response) => {
  await countDownload();

  if (APK_DIRECT_URL) {
    res.redirect(302, APK_DIRECT_URL);
    return;
  }

  const assetApiUrl = await resolveReleaseAssetUrl();
  if (!assetApiUrl) {
    res.status(503).json({ error: 'App download is temporarily unavailable. Please try again later.' });
    return;
  }

  try {
    const assetRes = await fetch(assetApiUrl, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/octet-stream', 'User-Agent': 'wiskul-app' },
      redirect: 'follow',
    });
    if (!assetRes.ok || !assetRes.body) {
      res.status(502).json({ error: 'Could not fetch the app package.' });
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="wiskul.apk"');
    const len = assetRes.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    // Stream the asset body straight through to the client.
    const reader = (assetRes.body as any).getReader?.();
    if (reader) {
      // Web ReadableStream (Node 18+ fetch)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } else {
      // Node stream fallback
      (assetRes.body as any).pipe(res);
    }
  } catch (err) {
    logger.error(`APK stream failed: ${String((err as any)?.message || err)}`);
    if (!res.headersSent) res.status(502).json({ error: 'Could not download the app package.' });
  }
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
