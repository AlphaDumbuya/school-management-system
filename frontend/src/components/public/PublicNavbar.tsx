/**
 * PublicNavbar — Premium public navigation.
 *
 * Mobile: full-width dropdown below the bar (no side drawer, no duplicate X).
 * Desktop: inline links + ghost Sign In + gradient CTA.
 * Scroll: transparent → frosted-glass after 24 px.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export interface PublicNavbarProps {
  ctaText?:   string;
  ctaAction?: 'login' | 'custom';
  onCtaClick?: () => void;
}

const NAV_LINKS = [
  { label: 'Home',     path: '/'         },
  { label: 'Features', path: '/features' },
  { label: 'Why Us',   path: '/why'      },
  { label: 'Benefits', path: '/benefits' },
  { label: 'Pricing',  path: '/pricing'  },
  { label: 'Contact',  path: '/contact'  },
];

const TEAL = '#00d4aa';
const BG   = '#0d0d21';

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  ctaText    = 'Get Started',
  ctaAction  = 'login',
  onCtaClick,
}) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open,      setOpen]    = useState(false);
  const [scrolled,  setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

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

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleCta = () => {
    setOpen(false);
    ctaAction === 'custom' && onCtaClick ? onCtaClick() : navigate('/login');
  };

  return (
    <>
      <nav
        ref={navRef}
        aria-label="Main navigation"
        style={{
          position:       'fixed',
          top: 0, left: 0, right: 0,
          zIndex:         1000,
          background:     scrolled || open
            ? `rgba(13,13,33,0.95)`
            : 'transparent',
          backdropFilter: scrolled || open ? 'blur(18px) saturate(160%)' : 'none',
          WebkitBackdropFilter: scrolled || open ? 'blur(18px) saturate(160%)' : 'none',
          borderBottom:   scrolled || open
            ? '1px solid rgba(0,212,170,0.1)'
            : '1px solid transparent',
          boxShadow:      scrolled ? '0 4px 40px rgba(0,0,0,0.5)' : 'none',
          transition:     'background 0.3s, border-color 0.3s, box-shadow 0.3s',
        }}
      >
        {/* ── Top bar ──────────────────────────────────────────────── */}
        <div style={{
          maxWidth:       '1280px',
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
            style={{ display:'flex', alignItems:'center', gap:'0.55rem', textDecoration:'none', flexShrink:0 }}
          >
            <div style={{
              width:'34px', height:'34px', borderRadius:'9px',
              background:'linear-gradient(135deg,#00d4aa,#009e9a)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 0 16px rgba(0,212,170,0.35)', flexShrink:0,
            }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M3 5l3.5 10L10 8l3.5 7L17 5" stroke="#0d0d21"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize:'1.15rem', fontWeight:900, color:'#fff', letterSpacing:'-0.02em', lineHeight:1 }}>
              Wi<span style={{ color:TEAL }}>Skul</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="pn-desk-links" style={{
            display:'none', alignItems:'center', gap:'0.15rem',
            flex:1, justifyContent:'center',
          }}>
            {NAV_LINKS.map(link => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={active ? 'pn-link pn-link--active' : 'pn-link'}
                  style={{
                    position:'relative', padding:'0.4rem 0.8rem', borderRadius:'7px',
                    fontSize:'0.875rem', fontWeight: active ? 600 : 400,
                    color: active ? TEAL : 'rgba(255,255,255,0.7)',
                    textDecoration:'none',
                    background: active ? 'rgba(0,212,170,0.08)' : 'transparent',
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
            <button
              onClick={() => navigate('/login')}
              className="pn-btn-ghost"
              style={{
                padding:'0.45rem 1rem', borderRadius:'7px',
                border:'1px solid rgba(255,255,255,0.15)', background:'transparent',
                color:'rgba(255,255,255,0.8)', fontSize:'0.875rem', fontWeight:500,
                cursor:'pointer', transition:'all 0.2s', whiteSpace:'nowrap',
              }}
            >Sign In</button>
            <button
              onClick={handleCta}
              className="pn-btn-cta"
              style={{
                padding:'0.48rem 1.25rem', borderRadius:'7px', border:'none',
                background:`linear-gradient(135deg,${TEAL},#00a898)`,
                color:'#0d0d21', fontSize:'0.875rem', fontWeight:700,
                cursor:'pointer', transition:'all 0.25s', whiteSpace:'nowrap',
                boxShadow:`0 0 0 rgba(0,212,170,0)`,
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
              background: open ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.06)',
              border:`1px solid ${open ? 'rgba(0,212,170,0.3)' : 'rgba(255,255,255,0.12)'}`,
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
              display:'block', width:'17px', height:'2px', borderRadius:'2px',
              background: TEAL, transition:'opacity 0.2s, width 0.2s',
              opacity: open ? 0 : 1, width: open ? 0 : '17px',
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
            overflow:   'hidden',
            maxHeight:  open ? '600px' : '0px',
            opacity:    open ? 1 : 0,
            transition: 'max-height 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
            borderTop:  open ? '1px solid rgba(0,212,170,0.08)' : '1px solid transparent',
          }}
        >
          <div style={{ padding:'0.5rem 1rem 1.25rem' }}>
            {/* Nav links */}
            {NAV_LINKS.map(link => {
              const active = isActive(link.path);
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
                    color: active ? TEAL : 'rgba(255,255,255,0.75)',
                    background: active ? 'rgba(0,212,170,0.08)' : 'transparent',
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
            <div style={{ margin:'0.75rem 0', height:'1px', background:'rgba(255,255,255,0.06)' }}/>

            {/* Actions */}
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              <button
                onClick={() => { navigate('/login'); setOpen(false); }}
                style={{
                  width:'100%', padding:'0.78rem',
                  borderRadius:'9px', border:'1px solid rgba(255,255,255,0.15)',
                  background:'transparent', color:'rgba(255,255,255,0.85)',
                  fontSize:'0.9rem', fontWeight:600, cursor:'pointer',
                  transition:'border-color 0.2s, background 0.2s',
                }}
              >Sign In</button>
              <button
                onClick={handleCta}
                style={{
                  width:'100%', padding:'0.85rem',
                  borderRadius:'9px', border:'none',
                  background:`linear-gradient(135deg,${TEAL},#00a898)`,
                  color:'#0d0d21', fontSize:'0.9rem', fontWeight:700,
                  cursor:'pointer', boxShadow:`0 4px 18px rgba(0,212,170,0.28)`,
                  transition:'box-shadow 0.2s, transform 0.15s',
                }}
              >{ctaText}</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Dim backdrop — behind everything except nav */}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          style={{
            position:'fixed', inset:0, zIndex:999,
            background:'rgba(0,0,0,0.45)',
            backdropFilter:'blur(2px)',
            WebkitBackdropFilter:'blur(2px)',
          }}
        />
      )}

      {/* Spacer so page content starts below the fixed nav */}
      <div style={{ height:'64px' }} aria-hidden="true" className="pn-spacer"/>

      <style>{`
        /* Desktop: show links+actions, hide burger */
        @media (min-width: 768px) {
          .pn-desk-links   { display: flex !important; }
          .pn-desk-actions { display: flex !important; }
          .pn-burger       { display: none  !important; }
          .pn-dropdown     { display: none  !important; }
          .pn-spacer       { height: 0 !important; }
        }

        /* Link hover (desktop) */
        .pn-link:not(.pn-link--active):hover {
          color: #fff !important;
          background: rgba(255,255,255,0.05) !important;
        }
        .pn-btn-ghost:hover {
          border-color: rgba(0,212,170,0.4) !important;
          color: #fff !important;
          background: rgba(0,212,170,0.05) !important;
        }
        .pn-btn-cta:hover {
          box-shadow: 0 0 22px rgba(0,212,170,0.42) !important;
          transform: translateY(-1px) !important;
        }
      `}</style>
    </>
  );
};

export default PublicNavbar;
