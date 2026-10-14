/**
 * Public school branding assets (UNAUTHENTICATED), for email clients.
 *
 *   GET /api/v1/public/branding/:tenantId/logo
 *
 * Email clients can't show most stored logos directly: S3 links are presigned
 * and expire after an hour, base64 `data:` images are blocked by Gmail/Outlook,
 * and local-disk URLs point at the API host. This endpoint serves the school's
 * CURRENT logo from a stable absolute URL, whatever storage it lives in.
 *
 * Safety: only images are served, a school can only expose files under its own
 * storage folder (or the shared logos folder), path traversal is refused, and
 * remote fetches are https-only to public hosts with a size cap.
 */
import express, { Request, Response } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { PLATFORM_LOGO_PNG_BASE64 } from '../assets/platformLogo';

const router = express.Router();
let platformLogo: Buffer | null = null;
const platformLogoBuffer = () => (platformLogo ??= Buffer.from(PLATFORM_LOGO_PNG_BASE64, 'base64'));

const MAX_BYTES = 2 * 1024 * 1024;
const UUIDISH = /^[0-9a-f-]{8,64}$/i;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|172\.(1[6-9]|2\d|3[01])\.)/i;

function isImageType(t: string | undefined | null): t is string {
  return !!t && /^image\/(png|jpe?g|gif|webp|svg\+xml)$/i.test(t);
}

function typeFromKey(key: string): string {
  const ext = key.split('?')[0].split('.').pop()?.toLowerCase();
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' } as Record<string, string>)[ext || ''] || 'image/png';
}

/** Storage key inside our own bucket / local storage, if the URL points there. */
function ownStorageKey(raw: string): string | null {
  try {
    if (raw.startsWith('/storage/')) return decodeURIComponent(raw.slice('/storage/'.length).split('?')[0]);
    const u = new URL(raw);
    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '';
    const endpointHost = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).host : '';
    const publicHost = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).host : '';
    let p = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    if (u.pathname.startsWith('/storage/') && (u.host === publicHost || PRIVATE_HOST.test(u.hostname))) {
      return p.slice('storage/'.length);
    }
    const isOurS3 = bucket && (u.hostname.startsWith(`${bucket}.`) || (endpointHost && u.host === endpointHost) || /amazonaws\.com$/i.test(u.hostname));
    if (!isOurS3) return null;
    if (bucket && p.startsWith(`${bucket}/`)) p = p.slice(bucket.length + 1);
    return p;
  } catch {
    return null;
  }
}

async function loadLogo(tenantId: string, raw: string): Promise<{ body: Buffer; type: string } | null> {
  // 0) Legacy Settings upload saved on the API server's disk (uploads/logos).
  const legacy = /^\/(?:storage\/)?uploads\/logos\/([^/?#]+)$/.exec(raw.split('?')[0]);
  if (legacy) {
    const name = legacy[1];
    if (!name.startsWith(`logo-${tenantId}-`) || name.includes('..')) return null;
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const body = await fs.readFile(path.join(process.cwd(), 'uploads', 'logos', name));
      return body.length <= MAX_BYTES ? { body, type: typeFromKey(name) } : null;
    } catch {
      return null; // file not on this server (e.g. serverless redeploy)
    }
  }

  // 1) Inline data: URL (upload fallback).
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(raw);
  if (m) {
    const body = Buffer.from(m[2], 'base64');
    return isImageType(m[1]) && body.length <= MAX_BYTES ? { body, type: m[1].toLowerCase() } : null;
  }

  // 2) A file in our own storage (S3 presigned URL or local /storage path).
  const key = ownStorageKey(raw);
  if (key) {
    const safe = !key.split('/').includes('..') && (key.startsWith(`tenants/${tenantId}/`) || key.startsWith('logos/'));
    if (!safe) return null;
    try {
      const { default: storage } = await import('../services/fileStorageService.js');
      const body = await storage.getFile(key);
      return body.length <= MAX_BYTES ? { body, type: typeFromKey(key) } : null;
    } catch (e) {
      logger.warn(`branding logo: storage read failed for tenant ${tenantId}: ${(e as any)?.message || e}`);
      // fall through to a direct fetch (a presigned URL may still be valid)
    }
  }

  // 3) Any other public https image.
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' || PRIVATE_HOST.test(u.hostname)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(u.toString(), { signal: ctrl.signal, redirect: 'follow' });
    const type = (r.headers.get('content-type') || '').split(';')[0].trim();
    if (!r.ok || !isImageType(type)) return null;
    const body = Buffer.from(await r.arrayBuffer());
    return body.length <= MAX_BYTES ? { body, type } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Bytes of any image the school stored (a pupil's photo, for example), read with
 * the same safety rules as the logo: inline data, the school's own storage
 * folder, or a public https address. Null when it cannot be read (no logging:
 * callers fall back to initials).
 */
export async function readTenantImage(tenantId: string, ref?: string | null): Promise<{ body: Buffer; type: string } | null> {
  if (!UUIDISH.test(String(tenantId || ''))) return null;
  const raw = String(ref || '').trim();
  if (!raw) return null;
  try {
    return await loadLogo(tenantId, raw);
  } catch {
    return null;
  }
}

/** The school's current logo bytes, or null (with the reason logged). */
export async function readTenantLogo(tenantId: string, rawLogo?: string | null): Promise<{ body: Buffer; type: string } | null> {
  if (!UUIDISH.test(String(tenantId || ''))) return null;
  let raw = String(rawLogo || '').trim();
  if (!raw) {
    const school = await db('schools').where({ tenant_id: tenantId }).first('logo_url');
    const tenant = school?.logo_url ? null : await db('tenants').where({ id: tenantId }).first('logo_url');
    raw = String(school?.logo_url || tenant?.logo_url || '').trim();
  }
  if (!raw) return null;
  const logo = await loadLogo(tenantId, raw);
  if (!logo) logger.warn(`School logo for tenant ${tenantId} could not be loaded (${raw.slice(0, 60)}${raw.length > 60 ? '…' : ''}). Re-upload it in Settings → School Info.`);
  return logo;
}

/**
 * Is the logo servable? Cached for 10 minutes so sending many emails doesn't
 * re-read it each time. Emails only embed the logo when this is true, so a
 * missing file shows the clean monogram instead of a broken image.
 */
const availability = new Map<string, { at: number; ok: boolean }>();
export async function tenantLogoAvailable(tenantId: string, rawLogo?: string | null): Promise<boolean> {
  const key = `${tenantId}|${String(rawLogo || '').slice(0, 200)}`;
  const hit = availability.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.ok;
  const ok = !!(await readTenantLogo(tenantId, rawLogo).catch(() => null));
  availability.set(key, { at: Date.now(), ok });
  return ok;
}

/**
 * The WiSkul logo for PLATFORM emails (password reset, welcome, billing,
 * newsletters…). Served from the API like school logos, from a small embedded
 * image, so it doesn't depend on a static file or an environment variable.
 * The ?v= hash in the URL changes if the logo ever does.
 */
router.get('/platform/logo.png', (_req: Request, res: Response) => {
  const body = platformLogoBuffer();
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': String(body.length),
    'Cache-Control': 'public, max-age=86400, immutable',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
  });
  return res.end(body);
});
router.get('/:tenantId/logo', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  if (!UUIDISH.test(tenantId)) return res.status(404).end();
  try {
    const logo = await readTenantLogo(tenantId);
    if (!logo) return res.status(404).end();
    res.set({
      'Content-Type': logo.type,
      'Content-Length': String(logo.body.length),
      // URLs carry ?v=<hash of the stored logo>, so a new logo gets a new URL.
      'Cache-Control': 'public, max-age=86400, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
      // An SVG must never run script if opened directly.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    });
    return res.end(logo.body);
  } catch (e) {
    logger.warn(`branding logo failed for tenant ${tenantId}: ${(e as any)?.message || e}`);
    return res.status(404).end();
  }
});

export default router;
