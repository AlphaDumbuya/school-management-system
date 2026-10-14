/**
 * The school's dashboard banner link.
 *
 * The server sends a SHORT relative link such as
 * `/api/v1/public/branding/<tenantId>/banner?v=ab12cd34ef` (never the image
 * itself). On the web the app and API share an origin, so it works as it is. In
 * the Android app (or any build with VITE_API_URL set) the page is not on the API
 * host, so the link is prefixed with the API address once, when the user is stored.
 */
import { API_CONFIG } from '@config/api.config';
import type { AuthUser } from '@appTypes/index';

/** Make a server-relative banner link loadable from this build. Absolute and inline links pass through. */
export function resolveBannerUrl(url?: string | null): string | null {
  if (!url) return null;
  if (!url.startsWith('/')) return url;
  const base = String(API_CONFIG.baseURL || '').replace(/\/+$/, '');
  return base ? `${base}${url}` : url;
}

/** The user with `schoolBannerUrl` ready to use as an image source (same object when nothing changes). */
export function withBannerSrc<T extends Partial<AuthUser> | null | undefined>(user: T): T {
  if (!user || !user.schoolBannerUrl) return user;
  const resolved = resolveBannerUrl(user.schoolBannerUrl);
  return resolved === user.schoolBannerUrl ? user : ({ ...user, schoolBannerUrl: resolved } as T);
}
