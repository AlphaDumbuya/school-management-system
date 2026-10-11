/**
 * The public demo school (seeded by scripts/seedDemoTenant.ts).
 *
 * Its accounts sign in with published passwords from the marketing site, so
 * the school is read-only for everyone (see middleware/demoReadOnly.ts) and
 * no email is ever sent to its addresses.
 */
import { db } from '@utils/database';

/** Every demo account's email is on this domain (it has no mailbox). */
export const DEMO_EMAIL_DOMAIN = 'demo.wiskulsl.com';
export const DEMO_TENANT_SLUG = 'wiskul-demo';

export function isDemoEmail(email: unknown): boolean {
  return String(email || '').trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

const cache = new Map<string, { demo: boolean; at: number }>();
const TTL_MS = 5 * 60_000;

/** Is this school the demo school? (tenants.settings.demo = true; cached 5 min) */
export async function isDemoTenant(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return false;
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.demo;
  const row = await db('tenants').where({ id: tenantId }).first('settings').catch(() => null);
  let settings: any = row?.settings;
  if (typeof settings === 'string') { try { settings = JSON.parse(settings); } catch { settings = {}; } }
  const demo = settings?.demo === true;
  cache.set(tenantId, { demo, at: Date.now() });
  return demo;
}
