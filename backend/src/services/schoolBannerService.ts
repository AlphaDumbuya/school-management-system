/**
 * School dashboard banner: one photo per school (building, assembly, sports day)
 * shown behind the welcome hero on every role's dashboard.
 *
 * Storage (no migration): one row in `school_config_settings`, key `school_banner`.
 *  - value `tenants/<tenantId>/banners/<file>`: the object's key in durable
 *    storage (S3, or the local storage folder), never a presigned link, because
 *    those expire after an hour.
 *  - value `data:image/...;base64,...`: inline fallback, used exactly where the
 *    logo and photo uploads use it (local-disk storage, or storage is down).
 *
 * The school is always the one behind the signed-in user; a tenant id is never
 * read from a write request. Reading is public by tenant id, like the logo
 * (an <img> tag can't send a token), and serves image bytes only.
 */
import crypto from 'crypto';
import { db } from '../utils/database.js';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import fileStorageService from '@services/fileStorageService';

export const BANNER_SETTING_KEY = 'school_banner';
/** About 1.2 MB: the browser shrinks to 1600x600 JPEG first, which is far smaller. */
export const BANNER_MAX_BYTES = Math.round(1.2 * 1024 * 1024);

const UUIDISH = /^[0-9a-f-]{8,64}$/i;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const TYPE_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

/** The real type from the file's first bytes, so a renamed file can't pass as a photo. */
function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Read a `data:image/...;base64,` banner into a checked buffer. */
function decodeBanner(input: unknown): { mime: string; buffer: Buffer } {
  const invalid = () => new AppError('Choose a JPG, PNG or WebP photo.', 400, 'BANNER_INVALID');
  const tooLarge = () => new AppError('This banner is too large. Please use an image under 1.2 MB.', 400, 'BANNER_TOO_LARGE');
  if (typeof input !== 'string' || !input.startsWith('data:')) throw invalid();
  const comma = input.indexOf(',');
  const header = comma > 0 ? input.slice(5, comma).toLowerCase() : '';
  const [mimeRaw, encoding] = header.split(';');
  const mime = ALLOWED[mimeRaw];
  if (!mime || encoding !== 'base64') throw invalid();
  const b64 = input.slice(comma + 1).replace(/\s/g, '');
  // Size check before decoding: base64 is 4 characters per 3 bytes.
  if (b64.length > Math.ceil(BANNER_MAX_BYTES / 3) * 4) throw tooLarge();
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new AppError('This photo could not be read. Please choose another one.', 400, 'BANNER_INVALID');
  }
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length === 0 || buffer.length > BANNER_MAX_BYTES) throw tooLarge();
  if (sniffImageType(buffer) !== mime) {
    throw new AppError('This file is not a JPG, PNG or WebP photo.', 400, 'BANNER_INVALID');
  }
  return { mime, buffer };
}

/** Short cache-busting hash of the stored value (same as Postgres left(md5(value), 10)). */
const versionOf = (value: string) => crypto.createHash('md5').update(value).digest('hex').slice(0, 10);

/** Storage keys we accept: this school's banners folder only, no path tricks. */
const isOwnBannerKey = (tenantId: string, key: string) =>
  key.startsWith(`tenants/${tenantId}/banners/`) && !key.split('/').includes('..') && !/[\\\0]/.test(key);

/**
 * The short URL the browser uses to load this school's banner, e.g.
 * `/api/v1/public/branding/<tenantId>/banner?v=ab12cd34ef`, or null when the
 * school has none. Only a 10-character hash is read from the database, never the
 * image, so this is cheap enough for /me. Never throws.
 */
export async function schoolBannerUrl(tenantId?: string | null): Promise<string | null> {
  if (!tenantId || !UUIDISH.test(String(tenantId))) return null;
  try {
    const row = await db('school_config_settings')
      .where({ tenant_id: tenantId, setting_key: BANNER_SETTING_KEY })
      .whereNotNull('setting_value')
      .whereRaw("setting_value <> ''")
      .first(db.raw('left(md5(setting_value), 10) as v'));
    return row?.v ? `/api/v1/public/branding/${tenantId}/banner?v=${row.v}` : null;
  } catch {
    return null;
  }
}

/** The school's banner bytes and version, or null when none is set or it can't be read. */
export async function readSchoolBanner(tenantId: string): Promise<{ body: Buffer; type: string; version: string } | null> {
  if (!UUIDISH.test(String(tenantId || ''))) return null;
  const row = await db('school_config_settings')
    .where({ tenant_id: tenantId, setting_key: BANNER_SETTING_KEY })
    .first('setting_value');
  const value = String(row?.setting_value || '').trim();
  if (!value) return null;
  const version = versionOf(value);

  if (value.startsWith('data:')) {
    const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(value);
    const body = m ? Buffer.from(m[2], 'base64') : null;
    const type = body ? sniffImageType(body) : null;
    return body && type && body.length <= BANNER_MAX_BYTES ? { body, type, version } : null;
  }

  if (!isOwnBannerKey(tenantId, value)) return null;
  try {
    const body = await fileStorageService.getFile(value);
    const type = sniffImageType(body) || TYPE_BY_EXT[value.split('.').pop()?.toLowerCase() || ''] || null;
    return type && body.length <= BANNER_MAX_BYTES ? { body, type, version } : null;
  } catch (e) {
    logger.warn(`School banner for tenant ${tenantId} could not be read: ${(e as Error).message}`);
    return null;
  }
}

/** Where the tenant's `school_config_settings` rows hang off (schools.school_id). */
async function schoolIdFor(tenantId: string): Promise<string> {
  const existing = await db('school_config_settings').where({ tenant_id: tenantId }).whereNotNull('school_id').first('school_id');
  if (existing?.school_id) return existing.school_id;
  const school = await db('schools').where({ tenant_id: tenantId }).first('school_id');
  if (!school?.school_id) {
    throw new AppError('Save your school information first, then add a banner.', 400, 'SCHOOL_NOT_FOUND');
  }
  return school.school_id;
}

/** Best-effort removal of a replaced or removed stored banner. */
async function dropStored(tenantId: string, value: string | null | undefined) {
  const v = String(value || '');
  if (!v || v.startsWith('data:') || !isOwnBannerKey(tenantId, v)) return;
  try { await fileStorageService.deleteFile(v); } catch { /* an orphan file is harmless */ }
}

export async function setSchoolBanner(
  tenantId: string,
  userId: string,
  photo: unknown,
  opts: { inline?: boolean } = {},
): Promise<{ bannerUrl: string | null }> {
  const { mime, buffer } = decodeBanner(photo);
  const schoolId = await schoolIdFor(tenantId);
  const previous = await db('school_config_settings')
    .where({ tenant_id: tenantId, setting_key: BANNER_SETTING_KEY })
    .first('id', 'setting_value');

  // Durable storage, or inline where the logo/photo uploads keep images inline.
  let value = `data:${mime};base64,${buffer.toString('base64')}`;
  if (opts.inline !== true && !fileStorageService.isLocal()) {
    try {
      const filename = `banner-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${EXT[mime]}`;
      const folder = `tenants/${tenantId}/banners`;
      await fileStorageService.uploadFile(buffer, {
        folder,
        filename,
        contentType: mime,
        maxSize: BANNER_MAX_BYTES,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      value = `${folder}/${filename}`;
    } catch (err) {
      logger.warn(`School banner storage failed, keeping it inline: ${(err as Error).message}`);
    }
  }

  const now = new Date();
  if (previous) {
    await db('school_config_settings').where({ id: previous.id }).update({
      setting_value: value, data_type: 'string', is_public: false, updated_by: userId, updated_at: now,
    });
  } else {
    await db('school_config_settings').insert({
      school_id: schoolId, tenant_id: tenantId, setting_key: BANNER_SETTING_KEY, setting_value: value,
      data_type: 'string', is_public: false, created_by: userId, updated_by: userId,
    });
  }
  if (previous?.setting_value !== value) await dropStored(tenantId, previous?.setting_value);

  logger.info(`School banner updated for tenant ${tenantId} by user ${userId}`);
  return { bannerUrl: await schoolBannerUrl(tenantId) };
}

export async function removeSchoolBanner(tenantId: string, userId: string): Promise<{ bannerUrl: null }> {
  const previous = await db('school_config_settings')
    .where({ tenant_id: tenantId, setting_key: BANNER_SETTING_KEY })
    .first('id', 'setting_value');
  if (previous) {
    await db('school_config_settings').where({ id: previous.id }).delete();
    await dropStored(tenantId, previous.setting_value);
    logger.info(`School banner removed for tenant ${tenantId} by user ${userId}`);
  }
  return { bannerUrl: null };
}

export default { setSchoolBanner, removeSchoolBanner, readSchoolBanner, schoolBannerUrl, BANNER_MAX_BYTES };
