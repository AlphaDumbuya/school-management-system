/**
 * schoolNameFor: the one rule for the school name printed on an ID card, used by the card face, the card list, the
 * details window, the PDF/image export and the template editor.
 *
 *   1. the name the template was DESIGNED with, if it really is a school's name;
 *   2. otherwise the signed-in user's own school (its registered name).
 *
 * The built-in samples earlier versions stored or showed ("WI SKUL ACADEMY", "Ginyard ...", "SCHOOL NAME") are not
 * school names: a template that carries one is treated as having none, so a school never prints another school's (or
 * the platform's) name on its cards. A real school whose name merely contains "WiSkul" is NOT affected.
 */
import { useAuthStore } from '../../../store/authStore';

/** The exact placeholder texts the editor, the card face and the PDF used to fall back to. */
export const isSampleSchoolName = (s?: string | null): boolean => {
  const t = String(s || '').trim();
  return !t || /^wi\s*-?\s*skul\s+academy$/i.test(t) || /^ginyard\b/i.test(t) || /^school name$/i.test(t);
};

/** The first real school name from the template's own name, then the fallbacks in order; '' if there is none. */
export function resolveSchoolName(templateName?: string | null, ...fallbacks: Array<string | null | undefined>): string {
  for (const candidate of [templateName, ...fallbacks]) {
    if (!isSampleSchoolName(candidate)) return String(candidate).trim();
  }
  return '';
}

/** The signed-in user's school name (empty if unknown). Works outside React too. */
export function getSchoolNameSync(): string {
  const user = useAuthStore.getState().user as { schoolName?: string } | null;
  return String(user?.schoolName || '').trim();
}

/** Hook form, so a component re-renders if the school name arrives after sign-in. */
export function useSchoolName(): string {
  const name = useAuthStore((s) => (s.user as { schoolName?: string } | null)?.schoolName);
  return String(name || '').trim();
}
