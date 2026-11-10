/**
 * Shared building blocks for the company pages. Same theme as the rest of the public site
 * (see docs/THEME_GUIDE.md): deep-navy bands, royal-blue brand, amber calls to action.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import '../../../styles/company.css';
import { PhotoBackdrop, type PhotoSlot } from './photos';

export const NAVY_BAND = 'bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a]';
export const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
  backgroundSize: '26px 26px',
};

/** Eyebrow + title + amber underline + optional subtitle. */
export const SectionHead: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  light?: boolean;
  align?: 'center' | 'left';
}> = ({ eyebrow, title, subtitle, light, align = 'center' }) => (
  <div className={`${align === 'center' ? 'text-center mx-auto' : ''} max-w-2xl mb-12`}>
    <p className={`text-xs font-bold tracking-[0.2em] uppercase mb-2 ${light ? 'text-amber-300' : 'text-[#1d4ed8]'}`}>{eyebrow}</p>
    <h2 className={`text-3xl sm:text-4xl font-black tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
    <div className={`w-12 h-1 bg-[#f59e0b] rounded-full mt-4 ${align === 'center' ? 'mx-auto' : ''}`} />
    {subtitle && <p className={`text-sm sm:text-base mt-4 leading-relaxed ${light ? 'text-blue-100/80' : 'text-slate-500'}`}>{subtitle}</p>}
  </div>
);

/** Navy hero used at the top of inner pages. */
export const PageHero: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  text: string;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}> = ({ eyebrow, title, text, children, aside }) => (
  <section className={`relative pt-28 sm:pt-36 pb-20 sm:pb-24 px-6 sm:px-10 overflow-hidden ${NAVY_BAND}`}>
    <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={DOT_PATTERN} />
    <div className="co-drift absolute top-[-12%] right-[-8%] w-[520px] h-[520px] rounded-full bg-[#1d4ed8]/30 blur-[120px] pointer-events-none" />
    <div className="co-drift absolute bottom-[-20%] left-[-8%] w-[420px] h-[420px] rounded-full bg-amber-400/10 blur-[120px] pointer-events-none" />
    <div className={`relative z-10 max-w-[1400px] mx-auto ${aside ? 'grid grid-cols-1 lg:grid-cols-2 gap-12 items-center' : 'text-center'}`}>
      <div className={aside ? '' : 'max-w-3xl mx-auto'}>
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-white/90 text-xs font-bold tracking-widest uppercase">{eyebrow}</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-[1.1] tracking-tight text-white mb-5">{title}</h1>
        <p className="text-blue-100/90 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0">{text}</p>
        {children && <div className={`mt-8 flex flex-wrap gap-3 ${aside ? '' : 'justify-center'}`}>{children}</div>}
      </div>
      {aside && <div className="relative flex justify-center">{aside}</div>}
    </div>
  </section>
);

/** Primary (amber) and secondary (outline) buttons. */
export const PrimaryButton: React.FC<{ to?: string; onClick?: () => void; children: React.ReactNode; className?: string }> = ({ to, onClick, children, className = '' }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (onClick ? onClick() : to && navigate(to))}
      className={`group inline-flex items-center justify-center gap-2 bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-sm px-7 py-3.5 rounded-lg transition-all duration-300 shadow-lg shadow-amber-500/30 active:scale-95 ${className}`}
    >
      {children}
      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
    </button>
  );
};

export const GhostButton: React.FC<{ to?: string; onClick?: () => void; children: React.ReactNode; dark?: boolean; className?: string }> = ({ to, onClick, children, dark, className = '' }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => (onClick ? onClick() : to && navigate(to))}
      className={`inline-flex items-center justify-center gap-2 font-bold text-sm px-7 py-3.5 rounded-lg border transition-all duration-300 ${
        dark
          ? 'border-slate-300 text-slate-700 hover:border-[#1d4ed8] hover:text-[#1d4ed8]'
          : 'border-white/30 text-white hover:border-white/60 hover:bg-white/10'
      } ${className}`}
    >
      {children}
    </button>
  );
};

/** Closing call-to-action band. */
export const CtaBand: React.FC<{
  title: string;
  text: string;
  primary: { label: string; to: string };
  secondary?: { label: string; to?: string; onClick?: () => void };
  footnote?: React.ReactNode;
  photo?: PhotoSlot;
}> = ({
  title, text, primary, secondary, footnote, photo,
}) => (
  <section className={`relative overflow-hidden px-6 sm:px-10 py-20 sm:py-24 ${NAVY_BAND}`}>
    {photo && <PhotoBackdrop slot={photo} className="opacity-20 mix-blend-luminosity" />}
    <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={DOT_PATTERN} />
    <div className="co-drift absolute top-0 right-0 w-96 h-96 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />
    <div className="relative max-w-3xl mx-auto text-center">
      <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{title}</h2>
      <p className="text-blue-100/80 text-sm sm:text-base leading-relaxed mt-4 max-w-xl mx-auto">{text}</p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <PrimaryButton to={primary.to}>{primary.label}</PrimaryButton>
        {secondary && <GhostButton to={secondary.to} onClick={secondary.onClick}>{secondary.label}</GhostButton>}
      </div>
      {footnote && <p className="mt-6 text-sm text-blue-100/80">{footnote}</p>}
    </div>
  </section>
);

/** A card on the platform pages that points to the School Edition (the same software, owned by the school). */
export const EditionTeaser: React.FC<{ title: string; text: string }> = ({ title, text }) => {
  const navigate = useNavigate();
  return (
    <section className="px-6 sm:px-10 py-16">
      <div className={`relative max-w-5xl mx-auto overflow-hidden rounded-3xl p-8 sm:p-12 ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={DOT_PATTERN} />
        <div className="co-drift absolute -top-10 -right-10 w-72 h-72 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div className="md:col-span-2">
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-amber-300 mb-2">WiSkul School Edition</p>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{title}</h3>
            <p className="text-blue-100/85 text-sm sm:text-base leading-relaxed mt-3">{text}</p>
          </div>
          <div className="flex flex-col gap-3">
            <PrimaryButton onClick={() => navigate('/editions')}>See School Editions</PrimaryButton>
            <GhostButton onClick={() => navigate('/contact?topic=edition')}>Request a quote</GhostButton>
          </div>
        </div>
      </div>
    </section>
  );
};
