/**
 * WelcomeHero — a premium animated greeting banner for role dashboards.
 * Features: live clock, animated gradient mesh, floating orbs, shimmer
 * greeting, glassmorphism date pill, and role-tinted identity.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Sun, Sunrise, Moon, Sparkles } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { roleDisplayName } from '@lib/leadTitle';
import { HeroArt } from './heroArt';

// Role colour over a school photo: only behind the text. On phones the text
// spans the whole width, so a light tint stays on the right; from `sm` up the
// right side of the photo is left clear.
const PHOTO_TINT_CLASS = [
  '[-webkit-mask-image:linear-gradient(to_right,rgba(0,0,0,0.82),rgba(0,0,0,0.30))]',
  '[mask-image:linear-gradient(to_right,rgba(0,0,0,0.82),rgba(0,0,0,0.30))]',
  'sm:[-webkit-mask-image:linear-gradient(to_right,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.45)_32%,transparent_62%)]',
  'sm:[mask-image:linear-gradient(to_right,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.45)_32%,transparent_62%)]',
].join(' ');

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
  // The admissions dashboard passes 'admissions'; it is the admissions_officer theme and art.
  const roleKey = role === 'admissions' ? 'admissions_officer' : role;
  const theme = ROLE_THEME[roleKey] ?? ROLE_THEME.principal;
  // The school's top leader is a "Head Teacher" in a primary-only school, a "Principal" otherwise.
  const authUser = useAuthStore((st) => st.user);
  const label = roleLabel ?? (role === 'principal' ? roleDisplayName(authUser) : prettyRole(role));

  // School banner photo (decorative). Shown only once it has loaded; any failure keeps the plain gradient.
  const bannerUrl = authUser?.schoolBannerUrl || null;
  const [photoState, setPhotoState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setPhotoState('loading');
    // A cached image can finish before React attaches onLoad.
    const el = imgRef.current;
    if (el?.complete) setPhotoState(el.naturalWidth > 0 ? 'loaded' : 'failed');
  }, [bannerUrl]);
  const showPhoto = !!bannerUrl && photoState === 'loaded';

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
      {/* ── School banner photo (behind everything; absolutely positioned so it can't shift layout) ── */}
      {bannerUrl && photoState !== 'failed' && (
        <>
          <img
            ref={imgRef}
            src={bannerUrl}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            {...({ fetchpriority: 'high' } as Record<string, string>)}
            onLoad={() => setPhotoState('loaded')}
            onError={() => setPhotoState('failed')}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${showPhoto ? 'opacity-100' : 'opacity-0'}`}
          />
          {showPhoto && (
            <>
              {/* Role colour behind the text only, so the photo keeps its own colours */}
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.gradient} ${PHOTO_TINT_CLASS}`} />
              {/* A light shade under the text keeps white copy readable on a bright photo */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-black/10 sm:to-transparent" />
            </>
          )}
        </>
      )}

      {/* ── Animated mesh orbs (the plain gradient only: over a photo they read as haze) ── */}
      {!showPhoto && (
        <>
          <div className={`pointer-events-none absolute -top-12 -right-12 w-64 h-64 rounded-full ${theme.orb} opacity-20 blur-3xl animate-pulse motion-reduce:animate-none`} />
          <div className={`pointer-events-none absolute -bottom-16 -left-12 w-72 h-72 rounded-full ${theme.orb} opacity-10 blur-[80px] animate-[pulse_4s_ease-in-out_1s_infinite] motion-reduce:animate-none`} />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[180px] bg-white/5 blur-[50px] rounded-full" />
        </>
      )}

      {/* ── Role line art (sm+ only; hidden while a school photo is showing) ── */}
      {!showPhoto && (
        <HeroArt
          role={roleKey}
          className="hidden sm:block absolute -bottom-3 right-4 lg:right-8 h-28 w-28 lg:h-36 lg:w-36 text-white/20"
        />
      )}

      {/* ── Dot texture (plain gradient only) ── */}
      {!showPhoto && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.9) 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
        />
      )}

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
          <div className={`inline-flex flex-col items-start sm:items-end gap-0.5 rounded-xl ${showPhoto ? 'bg-black/20' : 'bg-white/10'} backdrop-blur-sm ring-1 ring-white/20 px-3 sm:px-4 py-2 sm:py-2.5 shadow-inner`}>
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
