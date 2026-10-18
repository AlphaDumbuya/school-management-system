/**
 * What to call people by role. The school owner's account role is `principal`,
 * but a primary / nursery school has a Head Teacher, not a Principal. The name
 * follows the school level the school chose; permissions are unchanged.
 */
import { schoolLevels } from '@lib/staffDesignations';

/** "Head Teacher" for a primary-only (or nursery) school, otherwise "Principal". */
export function leadTitleFor(schoolType?: string | null): 'Head Teacher' | 'Principal' {
  const { primary, secondary } = schoolLevels(schoolType);
  return primary && !secondary ? 'Head Teacher' : 'Principal';
}

const pretty = (s: string) => s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** The school levels a school can pick (the same list as the registration form). */
export const SCHOOL_LEVEL_OPTIONS: Array<{ group: string; label: string; value: string }> = [
  { group: 'One level', value: 'Nursery / Early Childhood', label: 'Nursery only (Pre-School, Nursery 1 – 3)' },
  { group: 'One level', value: 'Primary', label: 'Primary only (Class 1 – Class 6)' },
  { group: 'One level', value: 'Junior Secondary', label: 'Junior Secondary only (JSS 1 – JSS 3)' },
  { group: 'One level', value: 'Senior Secondary', label: 'Senior Secondary only (SSS 1 – SSS 3)' },
  { group: 'Two levels', value: 'Nursery & Primary', label: 'Nursery & Primary' },
  { group: 'Two levels', value: 'Primary & Junior Secondary', label: 'Primary & Junior Secondary (Class 1 – JSS 3)' },
  { group: 'Two levels', value: 'Secondary (JSS & SSS)', label: 'Junior & Senior Secondary (JSS 1 – SSS 3)' },
  { group: 'Three or more levels', value: 'Nursery, Primary & Junior Secondary', label: 'Nursery, Primary & Junior Secondary' },
  { group: 'Three or more levels', value: 'Primary, Junior & Senior Secondary', label: 'Primary, Junior & Senior Secondary (Class 1 – SSS 3)' },
  { group: 'Three or more levels', value: 'Primary & Secondary', label: 'Nursery, Primary, Junior & Senior Secondary (all levels)' },
  { group: 'Other', value: 'Technical & Vocational', label: 'Technical & Vocational Institute / College' },
];

/** The option groups of SCHOOL_LEVEL_OPTIONS, in display order (for <optgroup>s). */
export const SCHOOL_LEVEL_GROUPS: string[] = Array.from(new Set(SCHOOL_LEVEL_OPTIONS.map((o) => o.group)));

/** The name to show for a signed-in user's role. */
export function roleDisplayName(user?: { role?: string | null; leadTitle?: string | null; schoolType?: string | null; isNamedOwner?: boolean | null } | null): string {
  const role = String(user?.role || '');
  if (!role) return '';
  if (role === 'principal' && user?.isNamedOwner) return 'School Owner';
  if (role === 'principal') return user?.leadTitle || leadTitleFor(user?.schoolType);
  return pretty(role);
}
