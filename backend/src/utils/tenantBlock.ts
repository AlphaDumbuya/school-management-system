/**
 * tenantBlock: what a signed-out person is told when their school cannot be
 * used (suspended, expired, archived). The text comes from what the platform
 * owner actually recorded when suspending (category and reason), so the login
 * screen explains the real situation instead of one fixed sentence.
 *
 * Who sees what:
 *  - the school owner (principal) gets the exact reason and a next step;
 *  - everyone else gets a neutral summary by category (no internal wording,
 *    for example parents are not told the school's bill is overdue) and is
 *    pointed to their school administrator.
 */
export type SuspensionCategory = 'payment' | 'policy' | 'abuse' | 'review' | 'security' | 'other';

export interface TenantBlockInfo {
  /** Machine code the login screen switches on. */
  code: 'TENANT_SUSPENDED' | 'TENANT_SUSPENDED_USER' | 'TENANT_UNAVAILABLE';
  /** Sentence(s) for the error response. */
  message: string;
  /** Structured details for a richer banner. */
  suspension: {
    status: string;
    category: SuspensionCategory;
    headline: string;
    summary: string;
    /** Owner only. */
    reason?: string;
    /** Owner only. */
    nextStep?: string;
    suspendedAt?: string;
  };
}

const CATEGORIES: SuspensionCategory[] = ['payment', 'policy', 'abuse', 'review', 'security', 'other'];

const OWNER_NEXT_STEP: Record<SuspensionCategory, string> = {
  payment: 'Settle the outstanding subscription payment to restore access. Use the secure pay-and-restore link in the email sent to the account owner, or contact WiSkul support.',
  policy: 'Reply to WiSkul support addressing the reason above so the matter can be reviewed.',
  review: 'Send WiSkul support the documents or details requested to complete the review.',
  security: 'Contact WiSkul support so we can confirm your identity and secure the account.',
  abuse: 'Contact WiSkul support to respond to the concern raised.',
  other: 'Contact WiSkul support to restore access.',
};

const MEMBER_SUMMARY: Record<SuspensionCategory, string> = {
  payment: "The school's subscription is awaiting renewal.",
  policy: "The school's account is under review by WiSkul.",
  review: "The school's account is under review by WiSkul.",
  security: "The school's account has been paused as a security precaution.",
  abuse: "The school's account is under review by WiSkul.",
  other: "The school's account is temporarily on hold.",
};

const longDate = (iso?: string | null) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
};

const parseSettings = (raw: unknown): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw) || {}; } catch { return {}; } }
  return typeof raw === 'object' ? (raw as Record<string, any>) : {};
};

/** Describe why a school can't be used, for the person trying to sign in. */
export function describeTenantBlock(tenant: { status?: string | null; settings?: unknown }, isOwner: boolean): TenantBlockInfo {
  const status = String(tenant.status || '').toLowerCase();
  const settings = parseSettings(tenant.settings);
  const cat = String(settings.suspension_category || '').toLowerCase();
  const category: SuspensionCategory = (CATEGORIES as string[]).includes(cat) ? (cat as SuspensionCategory) : 'other';
  const reason = typeof settings.suspension_reason === 'string' ? settings.suspension_reason.trim() : '';
  const when = longDate(settings.suspended_at);

  if (status === 'suspended') {
    if (isOwner) {
      const next = OWNER_NEXT_STEP[category];
      return {
        code: 'TENANT_SUSPENDED',
        message: `Your school account was suspended${when ? ` on ${when}` : ''}.${reason ? ` Reason: ${reason}.` : ''} ${next}`,
        suspension: {
          status, category, headline: 'Your school account is suspended',
          summary: reason ? `Reason: ${reason}` : 'Access has been paused by WiSkul.',
          reason: reason || undefined, nextStep: next, suspendedAt: settings.suspended_at,
        },
      };
    }
    return {
      code: 'TENANT_SUSPENDED_USER',
      message: `${MEMBER_SUMMARY[category]} Please contact your school administrator.`,
      suspension: {
        status, category, headline: 'Your school account is currently suspended',
        summary: MEMBER_SUMMARY[category], suspendedAt: settings.suspended_at,
      },
    };
  }

  if (status === 'expired') {
    return isOwner
      ? {
        code: 'TENANT_SUSPENDED',
        message: "Your school's subscription has expired. Renew your plan to restore access for everyone at your school.",
        suspension: {
          status, category: 'payment', headline: "Your school's subscription has expired",
          summary: 'Renew the plan to restore access.',
          reason: 'Subscription expired', nextStep: OWNER_NEXT_STEP.payment,
        },
      }
      : {
        code: 'TENANT_SUSPENDED_USER',
        message: "Your school's subscription has ended. Please contact your school administrator.",
        suspension: { status, category: 'payment', headline: "Your school's subscription has ended", summary: MEMBER_SUMMARY.payment },
      };
  }

  return {
    code: 'TENANT_UNAVAILABLE',
    message: isOwner
      ? 'Your school account is unavailable. Please contact WiSkul support.'
      : 'Your school account is unavailable. Please contact your school administrator.',
    suspension: { status: status || 'inactive', category: 'other', headline: 'Your school account is unavailable', summary: MEMBER_SUMMARY.other },
  };
}
