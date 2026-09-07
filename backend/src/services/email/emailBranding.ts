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

/** Trim trailing slash so we can safely concatenate paths. */
function appBaseUrl(): string {
  return (process.env.FRONTEND_URL || 'https://www.wiskulsl.com').replace(/\/$/, '');
}

/** The platform (WiSkul) branding used for platform emails and as the ultimate fallback. */
export function platformBranding(): EmailBranding {
  return {
    name: process.env.BREVO_SENDER_NAME || 'WiSkul',
    contactEmail: process.env.SUPPORT_EMAIL || 'support@wiskulsl.com',
    contactPhone: process.env.SUPPORT_PHONE || '+232 78 261 892',
    address: process.env.SUPPORT_ADDRESS || '75 Main Road, Kossoh Town, Sierra Leone',
    website: appBaseUrl(),
    logoUrl: undefined, // platform uses the text "WiSkul" logo
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
    const address =
      school?.address || tenant?.address || undefined;
    const website = school?.website || undefined;
    const logoUrl = school?.logo_url || tenant?.logo_url || undefined;

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
