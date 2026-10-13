/**
 * WelcomeHero — a premium animated greeting banner for role dashboards.
 * Features: live clock, animated gradient mesh, floating orbs, shimmer
 * greeting, glassmorphism date pill, and role-tinted identity.
 */
import React, { useEffect, useState } from 'react';
import { Sun, Sunrise, Moon, Sparkles } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { roleDisplayName } from '@lib/leadTitle';

export interface WelcomeHeroProps {
  firstName?: string;
  roleLabel?: string;
  schoolName?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Shown under the greeting, e.g. the sport-house badge. */
  badges?: React.ReactNode;
  role?: string;
}

const timeGreeting = (): { text: string; Icon: React.ComponentType<{ size?: number; className?: string }> } => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', Icon: Sunrise };
  if (h < 17) return { text: 'Good afternoon', Icon: Sun };
  return { text: 'Good evening', Icon: Moon };
};

// Role → rich gradient pair [from-color, via-color, to-color, orb-color]
const ROLE_THEME: Record<string, { gradient: string; orb: string; ring: string }> = {
  principal:        { gradient: 'from-[#0f2a8a] via-[#1d4ed8] to-[#3b82f6]',   orb: 'bg-blue-400',   ring: 'ring-blue-400/30' },
  super_admin:      { gradient: 'from-[#1e1b4b] via-[#4338ca] to-[#6366f1]',   orb: 'bg-indigo-400', ring: 'ring-indigo-400/30' },
  teacher:          { gradient: 'from-[#064e3b] via-[#059669] to-[#34d399]',   orb: 'bg-emerald-400',ring: 'ring-emerald-400/30' },
  accountant:       { gradient: 'from-[#78350f] via-[#d97706] to-[#fbbf24]',   orb: 'bg-amber-400',  ring: 'ring-amber-400/30' },
  student:          { gradient: 'from-[#0c4a6e] via-[#0891b2] to-[#38bdf8]',   orb: 'bg-sky-400',    ring: 'ring-sky-400/30' },
  parent:           { gradient: 'from-[#4a1d96] via-[#7c3aed] to-[#a78bfa]',   orb: 'bg-violet-400', ring: 'ring-violet-400/30' },
  guardian:         { gradient: 'from-[#4a1d96] via-[#7c3aed] to-[#a78bfa]',   orb: 'bg-violet-400', ring: 'ring-violet-400/30' },
  admissions_officer:{ gradient: 'from-[#831843] via-[#db2777] to-[#f472b6]',  orb: 'bg-pink-400',   ring: 'ring-pink-400/30' },
};

const prettyRole = (role?: string) =>
  role ? role.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  firstName,
  roleLabel,
  schoolName,
  subtitle,
  actions,
  badges,
  role = 'principal',
}) => {
  const { text: greeting, Icon } = timeGreeting();
  const theme = ROLE_THEME[role] ?? ROLE_THEME.principal;
  // The school's top leader is a "Head Teacher" in a primary-only school, a "Principal" otherwise.
  const authUser = useAuthStore((st) => st.user);
  const label = roleLabel ?? (role === 'principal' ? roleDisplayName(authUser) : prettyRole(role));

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradient} text-white shadow-2xl mb-6 ring-1 ${theme.ring}`}>
      {/* ── Animated mesh orbs ── */}
      <div className={`pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full ${theme.orb} opacity-20 blur-3xl animate-pulse`} />
      <div className={`pointer-events-none absolute -bottom-16 -left-12 w-72 h-72 rounded-full ${theme.orb} opacity-10 blur-[80px]`} style={{ animation: 'pulse 4s ease-in-out infinite 1s' }} />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[180px] bg-white/5 blur-[50px] rounded-full" />

      {/* ── Dot texture ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* ── Top shimmer line ── */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      {/* ── Content ── */}
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-5 p-4 sm:p-7">
        {/* Left: greeting */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-white/75 text-[11px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.18em] mb-1">
            <Icon size={13} className="opacity-90 flex-shrink-0" />
            <span className="truncate">{greeting}</span>
            <Sparkles size={11} className="text-amber-300 opacity-80 flex-shrink-0" />
          </div>

          <h1 className="text-xl sm:text-[2rem] font-black tracking-tight leading-tight drop-shadow-sm">
            {firstName ? (
              <>
                Welcome back,{' '}
                <span className="relative inline-block">
                  <span className="relative z-10">{firstName}!</span>
                  <span className="absolute bottom-0 inset-x-0 h-[3px] bg-amber-400/70 rounded-full" />
                </span>
              </>
            ) : (
              'Welcome back!'
            )}
          </h1>

          <p className="mt-1.5 text-xs sm:text-sm text-white/80 leading-relaxed">
            {subtitle ?? (
              <>
                {label && <span className="font-semibold">{label}</span>}
                {label && schoolName ? <span className="opacity-60 mx-1.5">·</span> : ''}
                {schoolName && <span className="opacity-80">{schoolName}</span>}
              </>
            )}
          </p>
          {badges && <div className="mt-2">{badges}</div>}
        </div>

        {/* Right: date + time pill + actions */}
        <div className="flex flex-col items-start sm:items-end gap-2 sm:gap-2.5 flex-shrink-0">
          {/* Date pill */}
          <div className="inline-flex flex-col items-start sm:items-end gap-0.5 rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20 px-3 sm:px-4 py-2 sm:py-2.5 shadow-inner">
            <span className="text-[10px] sm:text-[11px] font-semibold text-white/70 uppercase tracking-wider">{dateStr}</span>
            <span className="text-lg sm:text-xl font-black text-white tabular-nums tracking-tight leading-none">{timeStr}</span>
          </div>
          {actions}
        </div>
      </div>
    </div>
  );
};

export default WelcomeHero;
