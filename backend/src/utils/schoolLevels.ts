/**
 * schoolLevels — which level tiers a school has, from the school level it chose
 * at registration (stored as the text setting `school_type`), and what the
 * school's top leader is called as a result.
 *
 *   Nursery / Primary / Nursery & Primary      → the leader is the "Head Teacher"
 *   JSS / SSS / JSS & SSS                       → the leader is the "Principal"
 *   anything with both a primary and a secondary level → "Principal"
 *
 * The account's role stays `principal` underneath; only the NAME changes.
 * Mirrors frontend/src/lib/staffDesignations.ts (schoolLevels).
 */
import type { Knex } from 'knex';

/** The school levels a school can choose (same list as the registration form). */
export const SCHOOL_LEVEL_VALUES = [
  'Nursery / Early Childhood', 'Primary', 'Junior Secondary', 'Senior Secondary',
  'Nursery & Primary', 'Primary & Junior Secondary', 'Secondary (JSS & SSS)',
  'Nursery, Primary & Junior Secondary', 'Primary, Junior & Senior Secondary', 'Primary & Secondary',
  'Technical & Vocational',
];

export function schoolLevels(schoolType?: string | null): { primary: boolean; secondary: boolean } {
  const t = (schoolType || '').toLowerCase();
  if (!t) return { primary: true, secondary: true };
  const primary = /primary|nursery|early childhood|k-?12|k12/.test(t);
  const secondary = /secondary|jss|sss|junior|senior|k-?12|k12|technical|vocational/.test(t);
  if (!primary && !secondary) return { primary: true, secondary: true };
  return { primary, secondary };
}

/** "Head Teacher" for a primary-only (or nursery) school, otherwise "Principal". */
export function leadTitle(schoolType?: string | null): 'Head Teacher' | 'Principal' {
  const { primary, secondary } = schoolLevels(schoolType);
  return primary && !secondary ? 'Head Teacher' : 'Principal';
}

/** The school's chosen level text, or null if none was saved. */
export async function schoolTypeFor(conn: Knex, tenantId?: string | null): Promise<string | null> {
  if (!tenantId) return null;
  try {
    const row = await conn('school_config_settings').where({ tenant_id: tenantId, setting_key: 'school_type' }).first('setting_value');
    return row?.setting_value ? String(row.setting_value) : null;
  } catch {
    return null;
  }
}
