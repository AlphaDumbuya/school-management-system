/**
 * Rotating card tints — gives list/grid cards a subtle, distinct background so
 * items are visually separated on mobile (where borders alone read flat).
 *
 * Usage: `className={cardTint(index)}` on the card container. Colors are gentle
 * pastels that work in light mode and stay readable; dark-mode variants keep
 * them muted.
 */
const TINTS = [
  'bg-blue-50/70 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30',
  'bg-emerald-50/70 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30',
  'bg-amber-50/70 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30',
  'bg-violet-50/70 border-violet-100 dark:bg-violet-950/20 dark:border-violet-900/30',
  'bg-rose-50/70 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30',
  'bg-sky-50/70 border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/30',
  'bg-teal-50/70 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/30',
  'bg-indigo-50/70 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30',
];

/** Return a tint class for the given item index (rotates through the palette). */
export function cardTint(index: number): string {
  return TINTS[((index % TINTS.length) + TINTS.length) % TINTS.length];
}

export default cardTint;
