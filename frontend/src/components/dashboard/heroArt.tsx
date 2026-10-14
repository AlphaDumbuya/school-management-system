/**
 * HeroArt — small role-themed line illustrations for the WelcomeHero banner.
 * Pure inline SVG, drawn with currentColor strokes so the caller controls
 * colour and opacity (e.g. `text-white/20`). Decorative only.
 */
import React from 'react';

type ArtKey = 'building' | 'globe' | 'clipboard' | 'ledger' | 'study' | 'home' | 'admissions';

/** Maps a dashboard role to its illustration. Unknown roles use the school building. */
const ROLE_ART: Record<string, ArtKey> = {
  principal: 'building',
  owner: 'building',
  super_admin: 'globe',
  teacher: 'clipboard',
  accountant: 'ledger',
  student: 'study',
  parent: 'home',
  guardian: 'home',
  admissions_officer: 'admissions',
};

// All paths are drawn on a 120x120 grid.
const ART: Record<ArtKey, React.ReactNode> = {
  // School building with a flag
  building: (
    <>
      <path d="M60 28V8M60 9H78L72 15L78 21H60" />
      <path d="M22 54L60 30L98 54Z" />
      <circle cx="60" cy="46" r="4" />
      <path d="M34 60V94M52 60V94M68 60V94M86 60V94" />
      <path d="M18 98H102M12 106H108" />
    </>
  ),
  // Globe with network nodes
  globe: (
    <>
      <circle cx="58" cy="62" r="34" />
      <ellipse cx="58" cy="62" rx="14" ry="34" />
      <path d="M24 62H92M29 46Q58 54 87 46M29 78Q58 70 87 78" />
      <circle cx="98" cy="22" r="5" />
      <circle cx="16" cy="26" r="4" />
      <circle cx="104" cy="98" r="4" />
      <path d="M85 36L94 26M32 38L19 29M86 86L101 95" />
    </>
  ),
  // Clipboard with checklist and pencil
  clipboard: (
    <>
      <rect x="22" y="18" width="62" height="86" rx="6" />
      <rect x="40" y="10" width="26" height="16" rx="4" />
      <path d="M34 44L38 48L46 40M54 44H74" />
      <path d="M34 62L38 66L46 58M54 62H74" />
      <path d="M34 80H46M54 80H66" />
      <path d="M78 100L98 80L106 88L86 108L74 112Z" />
      <path d="M92 86L100 94" />
    </>
  ),
  // Ledger book with a coin
  ledger: (
    <>
      <rect x="14" y="22" width="60" height="78" rx="4" />
      <path d="M28 22V100M38 40H64M38 54H64M38 68H56" />
      <circle cx="88" cy="78" r="20" />
      <circle cx="88" cy="78" r="13" />
      <path d="M88 67V89M93 73C90 69 82 70 82 75C82 80 94 79 94 84C94 89 86 90 83 86" />
    </>
  ),
  // Open book with a graduation cap
  study: (
    <>
      <path d="M60 10L98 27L60 44L22 27Z" />
      <path d="M40 36V50Q60 60 80 50V36M98 27V45" />
      <circle cx="98" cy="48" r="2.5" />
      <path d="M12 74Q36 66 60 76Q84 66 108 74V104Q84 96 60 106Q36 96 12 104Z" />
      <path d="M60 76V106" />
    </>
  ),
  // House with a heart and a small book
  home: (
    <>
      <path d="M8 52L44 18L80 52" />
      <path d="M18 46V92H70V46" />
      <path d="M44 84C32 74 30 62 38 60C41 59 43 61 44 64C45 61 47 59 50 60C58 62 56 74 44 84Z" />
      <path d="M72 98Q86 92 94 100Q102 92 116 98V114Q102 108 94 116Q86 108 72 114Z" />
      <path d="M94 100V116" />
    </>
  ),
  // Folder with an ID card and a check badge
  admissions: (
    <>
      <path d="M10 34H42L50 44H98Q102 44 102 48V96Q102 100 98 100H14Q10 100 10 96Z" />
      <rect x="28" y="54" width="54" height="36" rx="4" />
      <circle cx="44" cy="67" r="5" />
      <path d="M36 82Q44 72 52 82M60 66H74M60 74H74" />
      <circle cx="92" cy="90" r="16" />
      <path d="M84 90L90 96L100 83" />
    </>
  ),
};

export const HeroArt: React.FC<{ role?: string; className?: string }> = ({ role, className = '' }) => {
  const key = (role && ROLE_ART[role]) || 'building';
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none ${className}`}
    >
      {ART[key]}
    </svg>
  );
};

export default HeroArt;
