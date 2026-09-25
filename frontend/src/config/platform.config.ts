/**
 * Platform (WiSkul) support contact — used on pre-auth screens (e.g. the login
 * suspension banner) where we can't resolve a tenant's own contact.
 *
 * Configurable via Vite env so it's maintained in one place across the app and
 * per-environment, with sensible production defaults.
 */
export const PLATFORM_SUPPORT = {
  email: (import.meta.env.VITE_SUPPORT_EMAIL as string) || 'support@wiskulsl.com',
  phone: (import.meta.env.VITE_SUPPORT_PHONE as string) || '+232 78 261 892',
};

/** tel: href with spaces stripped. */
export const platformSupportTel = () => `tel:${PLATFORM_SUPPORT.phone.replace(/\s+/g, '')}`;
