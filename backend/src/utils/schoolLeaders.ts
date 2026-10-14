/**
 * schoolLeaders — who an email about a school's leadership items should go to,
 * and what each leader is called in emails.
 *
 *  - The school owner (a `principal` account flagged `users.is_owner`) holds
 *    billing, payment settings, verification and leadership accounts, so emails
 *    about those go to the owner(s). A school with no named owner yet keeps the
 *    old behaviour: its principals stand in as owners (see tenantOwner.ts).
 *  - The `principal` role is shown as "Head Teacher" in a primary/nursery-only
 *    school and "Principal" otherwise (see schoolLevels.ts).
 */
import { db } from './database';
import { leadTitle, schoolTypeFor } from './schoolLevels';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Trim, drop invalid addresses and de-duplicate (case-insensitive), keeping order. */
export function uniqueEmails(list: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const e = String(raw || '').trim();
    const k = e.toLowerCase();
    if (!e || !EMAIL_RE.test(e) || seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/**
 * Active owner accounts of a school. With no named owner, the active principals
 * (who count as owners until one is named). Each row has id, email and name.
 */
export async function schoolOwners(tenantId?: string | null): Promise<Array<{ id: string; email: string | null; name: string }>> {
  if (!tenantId) return [];
  const pick = (q: any) => q.select('id', 'email', 'first_name', 'last_name').orderBy('created_at', 'asc');
  let rows: any[] = [];
  try {
    rows = await pick(db('users').where({ tenant_id: tenantId, role: 'principal', status: 'active', is_owner: true }));
  } catch {
    rows = []; // is_owner column not there yet: fall through to principals
  }
  if (!rows.length) {
    rows = await pick(db('users').where({ tenant_id: tenantId, role: 'principal', status: 'active' })).catch(() => []);
  }
  return rows.map((r) => ({ id: r.id, email: r.email || null, name: [r.first_name, r.last_name].filter(Boolean).join(' ') }));
}

/** Email addresses of the school owner(s), see schoolOwners. */
export async function ownerEmails(tenantId?: string | null): Promise<string[]> {
  return uniqueEmails((await schoolOwners(tenantId)).map((o) => o.email));
}

/**
 * Who hears about plan, billing and payment matters: the owner(s) plus the
 * school's billing contact (tenants.contact_email). Falls back to the school
 * profile email when neither exists.
 */
export async function billingRecipients(tenantId?: string | null): Promise<string[]> {
  if (!tenantId) return [];
  const [owners, tenant] = await Promise.all([
    ownerEmails(tenantId),
    db('tenants').where({ id: tenantId }).first('contact_email').catch(() => null),
  ]);
  const found = uniqueEmails([...owners, tenant?.contact_email]);
  if (found.length) return found;
  const school = await db('schools').where({ tenant_id: tenantId }).first('email').catch(() => null);
  return uniqueEmails([school?.email]);
}

/** "Head Teacher" or "Principal" for this school. */
export async function leadTitleFor(tenantId?: string | null): Promise<'Head Teacher' | 'Principal'> {
  return leadTitle(await schoolTypeFor(db, tenantId));
}

const ROLE_NAMES: Record<string, string> = {
  super_admin: 'WiSkul Support',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  guardian: 'Parent',
  accountant: 'Accountant',
  admissions_officer: 'Admissions Officer',
};

/**
 * What to call a role in an email: "School Owner" for an owner, the school's
 * lead title for a principal, otherwise a readable role name.
 */
export async function roleLabelFor(tenantId: string | null | undefined, role?: string | null, isOwner?: boolean | null): Promise<string> {
  const r = String(role || '').toLowerCase();
  if (r === 'principal') {
    const title = await leadTitleFor(tenantId);
    return isOwner ? `School Owner (${title})` : title;
  }
  return ROLE_NAMES[r] || r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
