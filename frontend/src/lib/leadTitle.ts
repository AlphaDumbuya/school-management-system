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

/** The name to show for a signed-in user's role. */
export function roleDisplayName(user?: { role?: string | null; leadTitle?: string | null; schoolType?: string | null; isNamedOwner?: boolean | null } | null): string {
  const role = String(user?.role || '');
  if (!role) return '';
  if (role === 'principal' && user?.isNamedOwner) return 'School Owner';
  if (role === 'principal') return user?.leadTitle || leadTitleFor(user?.schoolType);
  return pretty(role);
}
