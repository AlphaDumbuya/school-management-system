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
// Optional direct/public APK URL from env (e.g. a CDN/Blob). Highest precedence.
const APK_DIRECT_URL = process.env.APK_DOWNLOAD_TARGET;
// Shared secret the APK-build workflow uses to POST the latest Blob URL.
const APK_URL_WEBHOOK_SECRET = process.env.APK_URL_WEBHOOK_SECRET;

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

/** Read the last-published Blob URL persisted by the build workflow. */
async function storedBlobUrl(): Promise<string | null> {
  try {
    const has = await db.schema.hasTable('app_stats');
    if (!has) return null;
    const row = await db('app_stats').where({ key: 'apk_blob_url' }).first();
    return (row?.text_value as string) || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/app/blob-url  — called by the CI workflow after uploading the APK
 * to Vercel Blob. Persists the public URL so /app/download can redirect to it.
 * Auth: shared secret header `x-apk-secret`.
 */
router.post('/app/blob-url', async (req: Request, res: Response) => {
  if (!APK_URL_WEBHOOK_SECRET || req.headers['x-apk-secret'] !== APK_URL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const url = (req.body?.url || '').toString().trim();
  if (!/^https:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Invalid url' });
  }
  // Optional: the APK versionCode (CI run number) so the app can detect updates.
  const version = Number.parseInt(String(req.body?.version ?? ''), 10);
  try {
    const has = await db.schema.hasTable('app_stats');
    if (has) {
      const hasTextCol = await db.schema.hasColumn('app_stats', 'text_value');
      if (hasTextCol) {
        const updated = await db('app_stats').where({ key: 'apk_blob_url' }).update({ text_value: url, updated_at: new Date() });
        if (!updated) await db('app_stats').insert({ key: 'apk_blob_url', value: 0, text_value: url }).onConflict('key').ignore();
      }
      // Persist the latest APK versionCode (numeric `value` column).
      if (Number.isFinite(version) && version > 0) {
        const updatedV = await db('app_stats').where({ key: 'apk_latest_version' }).update({ value: version, updated_at: new Date() });
        if (!updatedV) await db('app_stats').insert({ key: 'apk_latest_version', value: version }).onConflict('key').ignore();
      }
    }
    res.json({ success: true });
  } catch (err) {
    logger.error(`Persist blob url failed: ${String((err as any)?.message || err)}`);
    res.status(500).json({ error: 'Failed to store url' });
  }
});

/**
 * GET /api/v1/app/version — PUBLIC. Returns the latest published APK versionCode
 * so the installed app can compare against its own version and prompt to update.
 * Returns { latestVersion: number | null }.
 */
router.get('/app/version', async (_req: Request, res: Response) => {
  try {
    const has = await db.schema.hasTable('app_stats');
    const row = has ? await db('app_stats').where({ key: 'apk_latest_version' }).first() : null;
    const latestVersion = row?.value != null ? Number(row.value) : null;
    res.json({ latestVersion: Number.isFinite(latestVersion as number) ? latestVersion : null });
  } catch {
    res.json({ latestVersion: null });
  }
});

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

  // 1) Explicit env override (a fixed public URL).
  if (APK_DIRECT_URL) {
    res.redirect(302, APK_DIRECT_URL);
    return;
  }

  // 2) The public Vercel Blob URL published by CI (preferred — public, fast).
  const blobUrl = await storedBlobUrl();
  if (blobUrl) {
    res.redirect(302, blobUrl);
    return;
  }

  // 3) Fallback: stream the private GitHub Release asset via a token.
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
