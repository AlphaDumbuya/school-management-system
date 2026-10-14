/**
 * classScope — which classes belong to the school's level, so class pickers
 * only offer classes the school actually runs (a Primary school never shows
 * JSS/SSS classes). Mirrors backend/src/utils/schoolLevels.ts (classTier /
 * schoolClassTiers / classInSchoolScope), which already filters
 * GET /api/v1/classes. Use this for lists that don't come from that endpoint
 * (the offline class cache) and for level pickers.
 *
 * Conservative: a class whose level can't be told is always kept, and an
 * unset or unusual school level ("Mixed") keeps everything.
 */
import { schoolLevels } from '@lib/staffDesignations';

export type ClassTier = 'nursery' | 'primary' | 'jss' | 'sss';

/**
 * The class tiers a school's level covers. Nursery and primary count as one
 * tier (the "primary" side of schoolLevels()); secondary is split into JSS /
 * SSS only when the level names just one of them.
 */
export function schoolClassTiers(schoolType?: string | null): Set<ClassTier> {
  const t = (schoolType || '').toLowerCase();
  const { primary, secondary } = schoolLevels(schoolType);
  const tiers = new Set<ClassTier>();
  if (primary) { tiers.add('nursery'); tiers.add('primary'); }
  if (secondary) {
    const junior = /junior|jss|\bjhs\b/.test(t);
    const senior = /senior|sss|\bshs\b/.test(t);
    const both = /technical|vocational|k-?12/.test(t) || (!junior && !senior);
    if (both || junior) tiers.add('jss');
    if (both || senior) tiers.add('sss');
  }
  return tiers;
}

function tierOf(text?: string | null): ClassTier | null {
  const s = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  if (/^(NURSERY|PRENURSERY|KG|KINDERGARTEN|PRESCHOOL|CRECHE|PLAYGROUP|EARLYCHILDHOOD)/.test(s)) return 'nursery';
  if (/^(CLASS|STANDARD)\d/.test(s) || /^PRIMARY/.test(s)) return 'primary';
  if (/^(JSS|JHS|JUNIORSECONDARY|JUNIORHIGH)/.test(s) || /^JS\d/.test(s)) return 'jss';
  if (/^(SSS|SHS|SENIORSECONDARY|SENIORHIGH)/.test(s) || /^SS\d/.test(s)) return 'sss';
  return null;
}

/** A class's tier from its level code ("CLASS4", "JSS 1"), else its name; null if unknown. */
export function classTier(level?: string | null, name?: string | null): ClassTier | null {
  return tierOf(level) ?? tierOf(name);
}

/** True when the class fits the school's level (unknown-level classes always fit). */
export function classInSchoolScope(cls: { level?: string | null; name?: string | null }, schoolType?: string | null): boolean {
  const tier = classTier(cls.level, cls.name);
  return !tier || schoolClassTiers(schoolType).has(tier);
}

/** Keep only the classes within the school's level. */
export function filterClassesToSchool<T extends { level?: string | null; name?: string | null }>(classes: T[], schoolType?: string | null): T[] {
  const tiers = schoolClassTiers(schoolType);
  if (tiers.size === 4) return classes;
  return classes.filter((c) => {
    const tier = classTier(c.level, c.name);
    return !tier || tiers.has(tier);
  });
}
