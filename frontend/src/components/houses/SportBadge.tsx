/**
 * The sport-house badge: a shield in the house colour with the house name, and
 * for staff their post (house master / mistress or house teacher). Shown on the
 * profiles of students, their parents, and the teachers attached to a house.
 */
import React from 'react';
import { Shield } from 'lucide-react';
import type { SportBadgeItem } from '@services/houseService';

/** Black or white, whichever reads better on this background colour. */
function textOn(hex?: string | null): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111827' : '#ffffff';
}

/** The colour darkened by `amount` (0 to 1). */
function darken(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.max(0, Math.round(v * (1 - amount)));
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export const SportBadge: React.FC<{
  name: string;
  color: string;
  /** Small text after the name, e.g. "House Master". */
  caption?: string;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ name, color, caption, size = 'md', className = '' }) => {
  const fg = textOn(color);
  const pad = size === 'sm' ? 'pl-1 pr-2.5 py-0.5 text-[11px] gap-1' : 'pl-1.5 pr-3 py-1 text-xs gap-1.5';
  const icon = size === 'sm' ? 11 : 14;
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full font-bold shadow-sm ring-1 ring-black/10 ${pad} ${className}`}
      style={{ background: `linear-gradient(135deg, ${color}, ${darken(color, 0.28)})`, color: fg }}
      title={caption ? `${name} · ${caption}` : name}
    >
      <span className="flex flex-shrink-0 items-center justify-center rounded-full bg-white/25 p-0.5" aria-hidden="true">
        <Shield size={icon} fill="currentColor" strokeWidth={1.5} />
      </span>
      <span className="truncate">{name}</span>
      {caption && <span className="truncate font-semibold opacity-85">· {caption}</span>}
    </span>
  );
};

const postLabel = (p?: string) => (p === 'master' ? 'House Master' : 'House Teacher');

/** A person's badges: own house, each child's house, or house posts. */
export const SportBadges: React.FC<{ items: SportBadgeItem[]; size?: 'sm' | 'md'; className?: string }> = ({ items, size = 'md', className = '' }) => {
  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map((b, i) => (
        <SportBadge
          key={`${b.kind}-${b.house.id}-${b.student_id ?? i}`}
          name={b.house.name}
          color={b.house.color}
          size={size}
          caption={b.kind === 'child' ? b.student_name : b.kind === 'staff' ? postLabel(b.position) : undefined}
        />
      ))}
    </div>
  );
};

export default SportBadge;
