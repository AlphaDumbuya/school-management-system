import React from 'react';

/**
 * Small flat/duotone inline illustrations for EmptyState.
 *
 * - Palette: brand blue #1d4ed8 (accent) / #3b82f6 (main) with translucent tints,
 *   so the same art reads on light and dark surfaces.
 * - "Paper" surfaces use currentColor; the wrapper sets white in light mode and
 *   gray-800 in dark mode.
 * - Decorative only (aria-hidden), no animation, each well under 2 KB.
 */
export type EmptyIllustration =
  | 'empty'
  | 'search'
  | 'inbox'
  | 'students'
  | 'finance'
  | 'calendar'
  | 'announcement'
  | 'houses'
  | 'error';

const B = '#3b82f6';
const D = '#1d4ed8';
const stroke = { stroke: B, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

const ART: Record<EmptyIllustration, React.ReactNode> = {
  empty: (
    <>
      <path d="M26 54l12-16h44l12 16v18a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4z" fill="currentColor" {...stroke} />
      <path d="M26 54h20a14 8 0 0 0 28 0h20" fill="none" {...stroke} />
      <path d="M60 14v8M50 18l3 6M70 18l-3 6" fill="none" stroke={D} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  search: (
    <>
      <circle cx="54" cy="44" r="19" fill="currentColor" stroke={D} strokeWidth={4} />
      <path d="M68 58l16 16" stroke={B} strokeWidth={7} strokeLinecap="round" />
      <path d="M46 44h16" stroke={B} strokeWidth={3} strokeLinecap="round" opacity=".6" />
      <circle cx="90" cy="26" r="3" fill={B} opacity=".5" />
      <circle cx="28" cy="72" r="3" fill={D} opacity=".4" />
    </>
  ),
  inbox: (
    <>
      <rect x="26" y="32" width="68" height="44" rx="6" fill="currentColor" {...stroke} />
      <path d="M28 36l32 22 32-22" fill="none" {...stroke} />
      <circle cx="90" cy="30" r="11" fill={D} />
      <path d="M84.5 30l4 4 7-8" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  students: (
    <>
      <circle cx="44" cy="38" r="10" fill={B} />
      <path d="M26 76a18 18 0 0 1 36 0z" fill={B} />
      <circle cx="78" cy="42" r="8" fill={D} />
      <path d="M62 76a16 16 0 0 1 32 0z" fill={D} opacity=".85" />
      <path d="M44 20l14 6-14 6-14-6z" fill={D} />
    </>
  ),
  finance: (
    <>
      <path d="M36 18h44v58l-7-5-7 5-7-5-7 5-7-5z" fill="currentColor" {...stroke} />
      <path d="M44 32h28M44 42h28M44 52h16" stroke={B} strokeWidth={3} strokeLinecap="round" opacity=".6" />
      <circle cx="84" cy="66" r="13" fill={D} />
      <circle cx="84" cy="66" r="6" fill="none" stroke="#fff" strokeWidth={3} />
    </>
  ),
  calendar: (
    <>
      <rect x="26" y="26" width="68" height="52" rx="6" fill="currentColor" {...stroke} />
      <path d="M26 32a6 6 0 0 1 6-6h56a6 6 0 0 1 6 6v8H26z" fill={D} />
      <path d="M42 20v12M78 20v12" stroke={B} strokeWidth={4} strokeLinecap="round" />
      <g fill={B} opacity=".35">
        <rect x="36" y="48" width="10" height="8" rx="2" />
        <rect x="55" y="48" width="10" height="8" rx="2" />
        <rect x="36" y="63" width="10" height="8" rx="2" />
        <rect x="74" y="63" width="10" height="8" rx="2" />
      </g>
      <rect x="74" y="48" width="10" height="8" rx="2" fill={B} />
    </>
  ),
  announcement: (
    <>
      <path d="M32 44h14l32-17v42L46 56H32z" fill="currentColor" {...stroke} />
      <path d="M42 56l4 16h8l-3-14" fill={B} opacity=".5" />
      <path d="M86 40a14 14 0 0 1 0 16M92 32a24 24 0 0 1 0 32" fill="none" stroke={D} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
  houses: (
    <>
      <path d="M28 52l32-26 32 26z" fill={B} stroke={B} strokeWidth={3} strokeLinejoin="round" />
      <rect x="37" y="52" width="46" height="24" fill="currentColor" {...stroke} />
      <rect x="54" y="60" width="12" height="16" rx="2" fill={D} />
      <path d="M60 26V14l10 4-10 4" fill={D} stroke={D} strokeWidth={2} strokeLinejoin="round" />
    </>
  ),
  error: (
    <>
      <path d="M60 22l34 54H26z" fill="currentColor" {...stroke} />
      <path d="M60 40v18" stroke={D} strokeWidth={5} strokeLinecap="round" />
      <circle cx="60" cy="67" r="3.2" fill={D} />
    </>
  ),
};

/** Picks an illustration from the message/description text. */
export function pickIllustration(text: string): EmptyIllustration {
  const t = text.toLowerCase();
  if (/couldn[’']?t|could not|failed|went wrong|\berror\b/.test(t)) return 'error';
  if (/match|found|filter/.test(t)) return 'search';
  if (/announcement/.test(t)) return 'announcement';
  if (/payment|invoice|receipt|\bfees?\b/.test(t)) return 'finance';
  if (/student/.test(t)) return 'students';
  if (/timetable|event|exam/.test(t)) return 'calendar';
  if (/\bhouses?\b|ballot/.test(t)) return 'houses';
  if (/nothing waiting|nothing here|\bno\b.*\byet\b/.test(t)) return 'inbox';
  return 'empty';
}

export const EmptyArt: React.FC<{ name: EmptyIllustration; className?: string }> = ({ name, className = '' }) => (
  <svg
    viewBox="0 0 120 96"
    aria-hidden="true"
    focusable="false"
    className={`h-[72px] sm:h-24 w-auto shrink-0 text-white dark:text-gray-800 ${className}`}
  >
    <circle cx="60" cy="48" r="40" fill={B} opacity=".12" />
    {ART[name]}
  </svg>
);
