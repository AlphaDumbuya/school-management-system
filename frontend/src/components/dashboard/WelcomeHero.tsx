/**
 * WelcomeHero — a friendly greeting banner shown at the top of role dashboards.
 *
 * Gives every role a warm, consistent welcome: a time-of-day greeting, the user's
 * first name, a role label, the current date, and an optional slot for actions or
 * a quick stat. Uses a role-tinted gradient so each role feels a little distinct
 * while staying on-brand.
 */
import React from 'react';
import { Sun, Sunrise, Moon } from 'lucide-react';

export interface WelcomeHeroProps {
  firstName?: string;
  /** Human-readable role label, e.g. "Principal", "Teacher", "Parent". */
  roleLabel?: string;
  /** School or org name shown as a subtle sub-line. */
  schoolName?: string;
  /** Optional short line replacing the default contextual subtitle. */
  subtitle?: string;
  /** Right-aligned slot for actions or a highlight (badge, quick stat, etc.). */
  actions?: React.ReactNode;
  /** Role key drives the gradient tint. */
  role?: string;
}

const timeGreeting = (): { text: string; Icon: React.ComponentType<{ size?: number; className?: string }> } => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', Icon: Sunrise };
  if (h < 17) return { text: 'Good afternoon', Icon: Sun };
  return { text: 'Good evening', Icon: Moon };
};

// Role → gradient. Falls back to brand blue for anything unmapped.
const ROLE_GRADIENT: Record<string, string> = {
  principal: 'from-[#1d4ed8] via-[#2563eb] to-[#3b82f6]',
  super_admin: 'from-[#3730a3] via-[#4f46e5] to-[#6366f1]',
  teacher: 'from-[#047857] via-[#059669] to-[#10b981]',
  accountant: 'from-[#b45309] via-[#d97706] to-[#f59e0b]',
  student: 'from-[#0e7490] via-[#0891b2] to-[#06b6d4]',
  parent: 'from-[#7c3aed] via-[#8b5cf6] to-[#a78bfa]',
  guardian: 'from-[#7c3aed] via-[#8b5cf6] to-[#a78bfa]',
  admissions: 'from-[#be185d] via-[#db2777] to-[#ec4899]',
};

const prettyRole = (role?: string) =>
  role
    ? role
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : '';

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  firstName,
  roleLabel,
  schoolName,
  subtitle,
  actions,
  role = 'principal',
}) => {
  const { text: greeting, Icon } = timeGreeting();
  const gradient = ROLE_GRADIENT[role] ?? ROLE_GRADIENT.principal;
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const label = roleLabel ?? prettyRole(role);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} text-white shadow-lg mb-6`}
    >
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 w-64 h-64 rounded-full bg-black/10 blur-3xl" />
      {/* Dot texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-wider">
            <Icon size={15} />
            {greeting}
          </div>
          <h1 className="mt-1 text-xl sm:text-3xl font-black tracking-tight truncate">
            {firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
          </h1>
          <p className="mt-1 text-sm text-white/85">
            {subtitle ?? (
              <>
                {label && <span className="font-semibold">{label}</span>}
                {label && schoolName ? ' · ' : ''}
                {schoolName}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
            {dateStr}
          </span>
          {actions}
        </div>
      </div>
    </div>
  );
};

export default WelcomeHero;
