/**
 * PublicNavbar — Premium public navigation.
 *
 * Mobile: full-width dropdown below the bar (no side drawer, no duplicate X).
 * Desktop: inline links + ghost Sign In + gradient CTA.
 * Scroll: transparent → frosted-glass after 24 px.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LiveDemoModal, { openLiveDemo } from './LiveDemoModal';

export interface PublicNavbarProps {
  ctaText?:   string;
  ctaAction?: 'login' | 'custom';
  onCtaClick?: () => void;
}

interface NavLinkDef {
  label: string;
  path: string;
  /** Other paths that should also light this link up (the product pages live under "Products"). */
  also?: string[];
}

const NAV_LINKS: NavLinkDef[] = [
  { label: 'Home',           path: '/' },
  { label: 'Products',       path: '/products', also: ['/wiskul', '/why', '/benefits'] },
  { label: 'Features',       path: '/features' },
  { label: 'Pricing',        path: '/pricing' },
  { label: 'School Edition', path: '/editions' },
  { label: 'Services',       path: '/services' },
  { label: 'About',          path: '/about' },
  { label: 'Contact',        path: '/contact' },
];

// Royal-blue brand + amber CTA to match the reference theme.
const TEAL = '#1d4ed8'; // (name kept for minimal churn) — brand blue
const CTA_ORANGE = '#f59e0b';

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  ctaText    = 'Get Started',
  ctaAction  = 'login',
  onCtaClick,
}) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open,      setOpen]    = useState(false);
  const [scrolled,  setScrolled] = useState(false);

  /* scroll */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* close on route change */
  useEffect(() => setOpen(false), [location.pathname]);

  /* Escape key */
  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);
  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  /* lock body scroll when open */
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const isActive = (link: NavLinkDef) => {
    if (link.path === '/') return location.pathname === '/';
    return [link.path, ...(link.also ?? [])].some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  };

  const handleCta = () => {
    setOpen(false);
    if (ctaAction === 'custom' && onCtaClick) {
      onCtaClick();
    } else {
      navigate('/register');
    }
  };

  const isCtaSignIn = ctaText.toLowerCase().includes('sign in') || ctaText.toLowerCase().includes('login');

  return (
    <>
      <nav
        aria-label="Main navigation"
        style={{
          position:       'fixed',
          top: 0, left: 0, right: 0,
          zIndex:         1000,
          background:     scrolled || open
            ? 'rgba(255,255,255,0.92)'
            : 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          borderBottom:   scrolled || open
            ? '1px solid rgba(15,23,42,0.08)'
            : '1px solid transparent',
          boxShadow:      scrolled ? '0 4px 30px rgba(15,23,42,0.06)' : 'none',
          transition:     'background 0.3s, border-color 0.3s, box-shadow 0.3s',
        }}
      >
        {/* ── Top bar ──────────────────────────────────────────────── */}
        {/* 1400px of content plus the side padding, so the bar lines up with the page sections (px-6 sm:px-10). */}
        <div className="pn-bar" style={{
          maxWidth:       '1480px',
          margin:         '0 auto',
          padding:        '0 1.5rem',
          height:         '64px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            '1rem',
        }}>

          {/* Logo */}
          <Link
            to="/"
            aria-label="WiSkul home"
            style={{ display:'flex', alignItems:'center', gap:'0.6rem', textDecoration:'none', flexShrink:0 }}
          >
            <img
              src="/logo.png"
              alt="WiSkul Logo"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                objectFit: 'contain',
                boxShadow: '0 0 16px rgba(0,212,170,0.35)',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize:'1.2rem', fontWeight:900, color:'#0f172a', letterSpacing:'-0.02em', lineHeight:1 }}>
              Wi<span style={{ color:'#1d4ed8' }}>Skul</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="pn-desk-links" style={{
            display:'none', alignItems:'center', gap:'0.5rem',
            flex:1, justifyContent:'center',
          }}>
            {NAV_LINKS.map(link => {
              const active = isActive(link);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={active ? 'pn-link pn-link--active' : 'pn-link'}
                  style={{
                    position:'relative', padding:'0.4rem 0.65rem', borderRadius:'7px',
                    fontSize:'0.875rem', fontWeight: 600,
                    color: active ? '#1d4ed8' : 'rgba(15,23,42,0.65)',
                    textDecoration:'none',
                    background: active ? 'rgba(29,78,216,0.08)' : 'transparent',
                    transition:'color 0.18s, background 0.18s',
                    whiteSpace:'nowrap',
                  }}
                >
                  {link.label}
                  {active && (
                    <span style={{
                      position:'absolute', bottom:'3px', left:'50%',
                      transform:'translateX(-50%)',
                      width:'16px', height:'2px', borderRadius:'2px',
                      background:TEAL, boxShadow:`0 0 6px ${TEAL}`,
                    }}/>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Desktop actions */}
          <div className="pn-desk-actions" style={{ display:'none', alignItems:'center', gap:'0.65rem', flexShrink:0 }}>
            {!isCtaSignIn && (
              <button
                onClick={() => navigate('/login')}
                className="pn-btn-ghost"
                style={{
                  padding:'0.45rem 1rem', borderRadius:'7px',
                  border:'1px solid rgba(15,23,42,0.15)', background:'transparent',
                  color:'rgba(15,23,42,0.75)', fontSize:'0.875rem', fontWeight:500,
                  cursor:'pointer', transition:'all 0.2s', whiteSpace:'nowrap',
                }}
              >Sign In</button>
            )}
            <button
              onClick={openLiveDemo}
              className="pn-btn-ghost"
              style={{
                padding:'0.45rem 1rem', borderRadius:'7px',
                border:'1px solid rgba(29,78,216,0.35)', background:'rgba(29,78,216,0.05)',
                color:'#1d4ed8', fontSize:'0.875rem', fontWeight:600,
                cursor:'pointer', transition:'all 0.2s', whiteSpace:'nowrap',
              }}
            >Live demo</button>
            <button
              onClick={handleCta}
              className="pn-btn-cta"
              style={{
                padding:'0.48rem 1.25rem', borderRadius:'7px', border:'none',
                background:`linear-gradient(135deg,${CTA_ORANGE},#d97706)`,
                color:'#fff', fontSize:'0.875rem', fontWeight:700,
                cursor:'pointer', transition:'all 0.25s', whiteSpace:'nowrap',
                boxShadow:`0 4px 14px rgba(245,158,11,0.3)`,
              }}
            >{ctaText}</button>
          </div>

          {/* Hamburger — mobile only. Animates to × when open. No separate close btn. */}
          <button
            className="pn-burger"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="pn-dropdown"
            style={{
              display:'flex', flexDirection:'column', justifyContent:'center',
              alignItems:'center', gap:'5px',
              width:'40px', height:'40px', padding:0, flexShrink:0,
              background: open ? 'rgba(0,212,170,0.1)' : 'rgba(15,23,42,0.04)',
              border:`1px solid ${open ? 'rgba(0,212,170,0.3)' : 'rgba(15,23,42,0.12)'}`,
              borderRadius:'9px', cursor:'pointer', transition:'background 0.2s, border-color 0.2s',
            }}
          >
            <span style={{
              display:'block', width:'17px', height:'2px', borderRadius:'2px',
              background: TEAL, transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
              transformOrigin:'center',
              transform: open ? 'translateY(7px) rotate(45deg)' : 'none',
            }}/>
            <span style={{
              display:'block', height:'2px', borderRadius:'2px',
              background: TEAL, transition:'opacity 0.2s, width 0.2s',
              opacity: open ? 0 : 1, width: open ? '0px' : '17px',
            }}/>
            <span style={{
              display:'block', width:'17px', height:'2px', borderRadius:'2px',
              background: TEAL, transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
              transformOrigin:'center',
              transform: open ? 'translateY(-7px) rotate(-45deg)' : 'none',
            }}/>
          </button>
        </div>

        {/* ── Mobile dropdown ──────────────────────────────────────── */}
        <div
          id="pn-dropdown"
          role="navigation"
          aria-label="Mobile navigation"
          className="pn-dropdown"
          style={{
            position:   'relative',
            zIndex:     1001,
            overflow:   'hidden',
            maxHeight:  open ? '600px' : '0px',
            opacity:    open ? 1 : 0,
            // Block taps entirely when closed so hidden links never intercept.
            pointerEvents: open ? 'auto' : 'none',
            background: 'rgba(255,255,255,0.98)',
            transition: 'max-height 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
            borderTop:  open ? '1px solid rgba(15,23,42,0.08)' : '1px solid transparent',
          }}
        >
          <div style={{ padding:'0.5rem 1rem 1.25rem' }}>
            {/* Nav links */}
            {NAV_LINKS.map(link => {
              const active = isActive(link);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setOpen(false)}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'0.75rem 0.9rem', borderRadius:'9px', marginBottom:'2px',
                    textDecoration:'none', fontSize:'0.95rem',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#1d4ed8' : 'rgba(15,23,42,0.75)',
                    background: active ? 'rgba(29,78,216,0.08)' : 'transparent',
                    borderLeft:`3px solid ${active ? TEAL : 'transparent'}`,
                    transition:'background 0.15s, color 0.15s',
                  }}
                >
                  <span>{link.label}</span>
                  {active && (
                    <span style={{
                      width:'6px', height:'6px', borderRadius:'50%',
                      background: TEAL, boxShadow:`0 0 7px ${TEAL}`,
                      flexShrink:0,
                    }}/>
                  )}
                </Link>
              );
            })}

            {/* Divider */}
            <div style={{ margin:'0.75rem 0', height:'1px', background:'rgba(15,23,42,0.08)' }}/>

            {/* Actions */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {!isCtaSignIn && (
                <button
                  onClick={() => { navigate('/login'); setOpen(false); }}
                  style={{
                    width:'100%', padding:'0.78rem',
                    borderRadius:'9px', border:'1px solid rgba(15,23,42,0.15)',
                    background:'transparent', color:'rgba(15,23,42,0.85)',
                    fontSize:'0.9rem', fontWeight:600, cursor:'pointer',
                    transition:'border-color 0.2s, background 0.2s',
                  }}
                >Sign In</button>
              )}
              <button
                onClick={() => { setOpen(false); openLiveDemo(); }}
                style={{
                  width:'100%', padding:'0.78rem',
                  borderRadius:'9px', border:'1px solid rgba(29,78,216,0.35)',
                  background:'rgba(29,78,216,0.05)', color:'#1d4ed8',
                  fontSize:'0.9rem', fontWeight:600, cursor:'pointer',
                }}
              >Get a live demo</button>
              <button
                onClick={handleCta}
                style={{
                  width:'100%', padding:'0.85rem',
                  borderRadius:'9px', border:'none',
                  background:`linear-gradient(135deg,${CTA_ORANGE},#d97706)`,
                  color:'#fff', fontSize:'0.9rem', fontWeight:700,
                  cursor:'pointer', boxShadow:`0 4px 18px rgba(245,158,11,0.3)`,
                  transition:'box-shadow 0.2s, transform 0.15s',
                }}
              >{ctaText}</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Dim backdrop — sits BELOW the nav/dropdown (z 998) and only dims the
          page area, so it can never intercept taps on the menu links. */}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          style={{
            position:'fixed', left:0, right:0, bottom:0, top:'64px', zIndex:998,
            background:'rgba(0,0,0,0.45)',
            backdropFilter:'blur(2px)',
            WebkitBackdropFilter:'blur(2px)',
          }}
        />
      )}

      {/* One demo popup for every public page; any button can open it with openLiveDemo(). */}
      <LiveDemoModal />

      {/* Spacer so page content starts below the fixed nav */}
      <div style={{ height:'64px' }} aria-hidden="true" className="pn-spacer"/>

      <style>{`
        @media (min-width: 640px) {
          .pn-bar          { padding: 0 2.5rem !important; }
        }
        @media (min-width: 768px) {
          .pn-spacer       { height: 0 !important; }
        }
        /* Eight links plus Sign In, Live demo and the CTA need a wide bar, so the full menu starts at 1240px. */
        @media (min-width: 1240px) {
          .pn-desk-links   { display: flex !important; }
          .pn-desk-actions { display: flex !important; }
          .pn-burger       { display: none  !important; }
          .pn-dropdown     { display: none  !important; }
        }

        /* Link hover (desktop) */
        .pn-link:not(.pn-link--active):hover {
          color: #0f172a !important;
          background: rgba(15,23,42,0.04) !important;
        }
        .pn-btn-ghost:hover {
          border-color: rgba(29,78,216,0.4) !important;
          color: #1d4ed8 !important;
          background: rgba(29,78,216,0.06) !important;
        }
        .pn-btn-cta:hover {
          box-shadow: 0 6px 22px rgba(245,158,11,0.45) !important;
          transform: translateY(-1px) !important;
          filter: brightness(1.05) !important;
        }
      `}</style>
    </>
  );
};

export default PublicNavbar;
