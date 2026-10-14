/**
 * Own profile photo — any signed-in user (every role) sets, changes or removes
 * the photo on THEIR OWN account. The account is always the one behind the
 * token; a user id is never read from the request.
 *
 * Where the photo lives (same columns the rest of the app already reads):
 *  - users.photo_url: the general photo (header avatar, staff ID cards, directories).
 *  - users.profile_photo_url: the account owner's verification photo. /me shows it
 *    first, so when it is set it is updated too, or a new photo would stay hidden.
 *  - students.photo_url: the school's record photo (ID cards, class lists, report
 *    cards). A student's own photo fills it only when the school has not set one
 *    (or when it already holds the student's previous own photo), so an official
 *    photo is never overwritten.
 *
 * Storage is the same as POST /api/v1/uploads: the tenant's photos folder in
 * durable storage, inline (base64) on local disk or when storage is down.
 */
import { db } from '../utils/database.js';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import fileStorageService from '@services/fileStorageService';

/** 2 MB, the same limit as staff/student photo uploads. */
export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

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

/** Read a `data:image/...;base64,` photo into a checked buffer. */
function decodePhoto(input: unknown): { mime: string; buffer: Buffer } {
  if (typeof input !== 'string' || !input.startsWith('data:')) {
    throw new AppError('Choose a JPG, PNG or WebP photo.', 400, 'PHOTO_INVALID');
  }
  const comma = input.indexOf(',');
  const header = comma > 0 ? input.slice(5, comma).toLowerCase() : '';
  const [mimeRaw, encoding] = header.split(';');
  const mime = ALLOWED[mimeRaw];
  if (!mime || encoding !== 'base64') {
    throw new AppError('Choose a JPG, PNG or WebP photo.', 400, 'PHOTO_INVALID');
  }
  const b64 = input.slice(comma + 1).replace(/\s/g, '');
  // Size check before decoding: base64 is 4 characters per 3 bytes.
  if (b64.length > Math.ceil(PROFILE_PHOTO_MAX_BYTES / 3) * 4) {
    throw new AppError('Photo is too large. Please use an image under 2 MB.', 400, 'PHOTO_TOO_LARGE');
  }
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new AppError('This photo could not be read. Please choose another one.', 400, 'PHOTO_INVALID');
  }
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length === 0 || buffer.length > PROFILE_PHOTO_MAX_BYTES) {
    throw new AppError('Photo is too large. Please use an image under 2 MB.', 400, 'PHOTO_TOO_LARGE');
  }
  if (sniffImageType(buffer) !== mime) {
    throw new AppError('This file is not a JPG, PNG or WebP photo.', 400, 'PHOTO_INVALID');
  }
  return { mime, buffer };
}

/** Durable storage URL, or the inline image when storage is local, down, or asked for. */
async function storePhoto(buffer: Buffer, mime: string, tenantId: string | null, forceInline: boolean): Promise<string> {
  const inline = `data:${mime};base64,${buffer.toString('base64')}`;
  // Local disk is not shared or durable (see uploadRoutes), so keep photos inline there.
  if (forceInline || fileStorageService.isLocal()) return inline;
  try {
    const result = await fileStorageService.uploadFile(buffer, {
      folder: `tenants/${tenantId || 'shared'}/photos`,
      contentType: mime,
      maxSize: PROFILE_PHOTO_MAX_BYTES,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    return result.url;
  } catch (err) {
    logger.warn(`Profile photo storage failed, keeping it inline: ${(err as Error).message}`);
    return inline;
  }
}

type OwnUser = { id: string; role: string; tenant_id: string | null; photo_url: string | null; profile_photo_url: string | null };

async function loadUser(userId: string): Promise<OwnUser> {
  const user = await db('users')
    .where({ id: userId })
    .first('id', 'role', 'tenant_id', 'photo_url', 'profile_photo_url');
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  return user as OwnUser;
}

/** The avatar /me would now return (same order as GET /api/v1/auth/me). */
async function resolvedAvatar(userId: string): Promise<string | null> {
  const user = await loadUser(userId);
  let url: string | null = user.profile_photo_url || user.photo_url || null;
  if (!url && user.role === 'student') {
    const student = await db('students').where({ user_id: user.id }).first('photo_url').catch(() => null);
    if (student?.photo_url) url = student.photo_url;
  }
  return url;
}

export async function setOwnProfilePhoto(
  userId: string,
  photo: unknown,
  opts: { inline?: boolean } = {},
): Promise<{ profilePhotoUrl: string | null }> {
  const user = await loadUser(userId);
  const { mime, buffer } = decodePhoto(photo);
  const url = await storePhoto(buffer, mime, user.tenant_id, opts.inline === true);
  const now = new Date();

  await db.transaction(async (trx) => {
    const patch: Record<string, unknown> = { photo_url: url, updated_at: now };
    if (user.profile_photo_url) patch.profile_photo_url = url;
    await trx('users').where({ id: user.id }).update(patch);

    if (user.role === 'student') {
      await trx('students')
        .where({ user_id: user.id })
        .where((q) => {
          q.whereNull('photo_url').orWhere('photo_url', '');
          if (user.photo_url) q.orWhere('photo_url', user.photo_url);
        })
        .update({ photo_url: url, updated_at: now });
    }
  });

  logger.info(`Profile photo updated by user ${user.id} (${user.role})`);
  return { profilePhotoUrl: await resolvedAvatar(user.id) };
}

export async function removeOwnProfilePhoto(userId: string): Promise<{ profilePhotoUrl: string | null }> {
  const user = await loadUser(userId);
  const now = new Date();

  await db.transaction(async (trx) => {
    await trx('users').where({ id: user.id }).update({ photo_url: null, profile_photo_url: null, updated_at: now });
    // Only clear the student record photo when it is the student's own photo;
    // a photo the school took stays (and then shows as the avatar again).
    if (user.role === 'student' && user.photo_url) {
      await trx('students')
        .where({ user_id: user.id, photo_url: user.photo_url })
        .update({ photo_url: null, updated_at: now });
    }
  });

  logger.info(`Profile photo removed by user ${user.id} (${user.role})`);
  return { profilePhotoUrl: await resolvedAvatar(user.id) };
}

export default { setOwnProfilePhoto, removeOwnProfilePhoto, PROFILE_PHOTO_MAX_BYTES };
