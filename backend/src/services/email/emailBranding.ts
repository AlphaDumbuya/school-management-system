/**
 * emailBranding — resolves the correct sender identity, contact details, and
 * logo for an email, depending on whether it's a PLATFORM email (WiSkul → the
 * world) or a TENANT email (a specific school → its parents/students/staff).
 *
 * Multi-tenant rule:
 *  - Platform emails (contact form, school-registration welcome) carry WiSkul
 *    branding and WiSkul contacts.
 *  - Tenant emails (discipline, admissions, finance, report cards, etc.) carry
 *    the SCHOOL's own name/email/phone/address/logo, pulled live from the
 *    `schools` table (falling back to `tenants`, then to WiSkul platform
 *    defaults if a school hasn't filled in its profile).
 */
import { db } from '@utils/database.js';
import { logger } from '@utils/logger.js';
import { publicAppUrl, publicApiUrl } from '@utils/publicUrl.js';
import { PLATFORM_LOGO_PNG_BASE64 } from '../../assets/platformLogo.js';

export interface EmailBranding {
  /** Display name used as the "from" name and in the header/footer. */
  name: string;
  /** Public contact email shown in the footer (reply-to for tenant emails). */
  contactEmail: string;
  /** Optional phone shown in the footer. */
  contactPhone?: string;
  /** Optional postal address shown in the footer. */
  address?: string;
  /** Optional website shown in the footer. */
  website?: string;
  /** Optional logo URL rendered in the header (falls back to a text logo). */
  logoUrl?: string;
  /** Optional school motto, shown under the name in the header. */
  motto?: string;
  /** The app URL used to build working action links. */
  appUrl: string;
  /** True for platform-level (WiSkul) emails. */
  isPlatform: boolean;
  /**
   * How this tenant's transactional emails are sent:
   *   'platform' — from the platform's verified address (school name + reply-to). Default.
   *   'own'      — fully from the school's own verified email address.
   */
  senderMode?: 'platform' | 'own';
  /** Whether the setup team has verified the school's own sender in the provider. */
  senderVerified?: boolean;
  /** Optional dedicated From address for 'own' mode (falls back to contactEmail). */
  fromAddress?: string;
}

/**
 * The public app origin every email link is built on. FRONTEND_URL may hold a
 * comma-separated CORS list, so only its first entry is used; PUBLIC_APP_URL
 * wins when set. Never ends with a slash.
 */
export function appBaseUrl(): string {
  // Never localhost in production (see utils/publicUrl).
  return publicAppUrl();
}

/** Absolute link into the app (path must start with '/'). */
export function appLink(path: string): string {
  return `${appBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Where the API is publicly reachable (same origin as the app on Vercel). */
function apiBaseUrl(): string {
  return publicApiUrl();
}

/** Small stable hash so a new logo gets a new (cache-busting) URL. */
function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Email-safe logo URL for a school: always the public branding endpoint, which
 * serves the logo from wherever it is stored (S3, data: URL, local disk).
 */
export function tenantLogoEmailUrl(tenantId: string, storedLogo?: string | null): string | undefined {
  if (!tenantId || !storedLogo) return undefined;
  return `${apiBaseUrl()}/api/v1/public/branding/${encodeURIComponent(tenantId)}/logo?v=${shortHash(storedLogo)}`;
}

/** Email-safe URL of the WiSkul logo (see GET /api/v1/public/branding/platform/logo.png). */
export function platformLogoEmailUrl(): string {
  return `${apiBaseUrl()}/api/v1/public/branding/platform/logo.png?v=${shortHash(PLATFORM_LOGO_PNG_BASE64)}`;
}
/** The platform (WiSkul) branding used for platform emails and as the ultimate fallback. */
export function platformBranding(): EmailBranding {
  return {
    name: process.env.BREVO_SENDER_NAME || 'WiSkul',
    contactEmail: process.env.SUPPORT_EMAIL || 'support@wiskulsl.com',
    contactPhone: process.env.SUPPORT_PHONE || '+232 78 261 892',
    address: process.env.SUPPORT_ADDRESS || '75 Main Road, Kossoh Town, Sierra Leone',
    website: appBaseUrl(),
    // Platform emails show the WiSkul logo from the same public branding
    // endpoint school logos use (an embedded, email-sized image), so it always
    // loads: no dependence on a static file, a redirect or PLATFORM_LOGO_URL.
    logoUrl: platformLogoEmailUrl(),
    appUrl: appBaseUrl(),
    isPlatform: true,
  };
}

/**
 * Resolve a specific school's branding for tenant emails. Reads `schools`
 * (richest), then `tenants` for anything missing, then platform defaults.
 * Never throws — always returns usable branding.
 */
export async function resolveTenantBranding(tenantId: string): Promise<EmailBranding> {
  const platform = platformBranding();
  if (!tenantId) return platform;

  try {
    const school = await db('schools').where({ tenant_id: tenantId }).first();
    const tenant = await db('tenants').where({ id: tenantId }).first();

    const name =
      school?.name || tenant?.name || platform.name;
    const contactEmail =
      school?.email || tenant?.contact_email || platform.contactEmail;
    const contactPhone =
      school?.phone || tenant?.contact_phone || undefined;
    const rawWebsite = String(school?.website || '').trim();
    const website = rawWebsite ? (/^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`) : undefined;
    // The stored logo may be an expiring S3 link, a data: URL or a local path —
    // none of which email clients can show. Use the public branding endpoint.
    const rawLogo = school?.logo_url || tenant?.logo_url || undefined;
    // Only embed the logo if the server can actually serve it; otherwise the
    // email shows the school's monogram instead of a broken image.
    let logoUrl: string | undefined;
    if (rawLogo) {
      const { tenantLogoAvailable } = await import('../../routes/brandingRoutes.js');
      if (await tenantLogoAvailable(tenantId, rawLogo).catch(() => false)) logoUrl = tenantLogoEmailUrl(tenantId, rawLogo);
    }
    const address = [school?.address || tenant?.address, school?.city, school?.country]
      .map((v: any) => String(v || '').trim()).filter(Boolean)
      .filter((v: string, i: number, all: string[]) => all.indexOf(v) === i).join(', ') || undefined;

    const senderMode: 'platform' | 'own' = school?.email_sender_mode === 'own' ? 'own' : 'platform';
    const senderVerified = !!school?.email_sender_verified;
    const fromAddress = school?.email_from_address || undefined;

    return {
      name,
      contactEmail,
      contactPhone,
      address,
      website,
      logoUrl,
      motto: school?.motto || undefined,
      appUrl: appBaseUrl(),
      isPlatform: false,
      senderMode,
      senderVerified,
      fromAddress,
    };
  } catch (err: any) {
    logger.warn(`resolveTenantBranding failed for tenant ${tenantId}: ${err?.message}`);
    return { ...platform, isPlatform: false };
  }
}
