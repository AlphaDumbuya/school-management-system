/**
 * PublicNavbar — Premium shared navigation for all public-facing pages.
 *
 * Features:
 *  • Transparent → frosted-glass on scroll
 *  • Active-page indicator with animated teal underline
 *  • Smooth animated mobile drawer (slides in from right)
 *  • "Sign In" ghost button + primary CTA
 *  • Animated cyber hamburger → X
 *  • Keyboard-accessible (Escape closes drawer)
 *  • Zero external dependencies beyond react-router-dom
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PublicNavbarProps {
  /** Override the primary CTA button text */
  ctaText?: string;
  /** What happens when the primary CTA is clicked */
  ctaAction?: 'login' | 'custom';
  /** Custom CTA handler (used when ctaAction === 'custom') */
  onCtaClick?: () => void;
}

interface NavItem {
  label: string;
  path: string;
}

// ── Nav link definitions ───────────────────────────────────────────────────────

const NAV_LINKS: NavItem[] = [
  { label: 'Home',     path: '/'         },
  { label: 'Features', path: '/features' },
  { label: 'Why Us',   path: '/why'      },
  { label: 'Benefits', path: '/benefits' },
  { label: 'Pricing',  path: '/pricing'  },
  { label: 'Contact',  path: '/contact'  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  ctaText    = 'Get Started',
  ctaAction  = 'login',
  onCtaClick,
}) => {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [scrolled,    setScrolled]    = useState(false);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  /* ── Scroll detection ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Close drawer on route change ── */
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  /* ── Escape key ── */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setDrawerOpen(false);
  }, []);
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /* ── Lock body scroll when drawer is open ── */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  /* ── CTA handler ── */
  const handleCta = () => {
    if (ctaAction === 'custom' && onCtaClick) {
      onCtaClick();
    } else {
      navigate('/login');
    }
    setDrawerOpen(false);
  };

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(path);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── NAV BAR ──────────────────────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        style={{
          position:       'fixed',
          top:            0,
          left:           0,
          right:          0,
          zIndex:         1000,
          transition:     'background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
          background:     scrolled
            ? 'rgba(16, 16, 36, 0.88)'
            : 'rgba(16, 16, 36, 0.0)',
          backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
          borderBottom:   scrolled
            ? '1px solid rgba(0, 212, 170, 0.12)'
            : '1px solid transparent',
          boxShadow:      scrolled
            ? '0 4px 32px rgba(0, 0, 0, 0.4)'
            : 'none',
        }}
      >
        <div style={{
          maxWidth:       '1280px',
          margin:         '0 auto',
          padding:        '0 2rem',
          height:         '68px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            '1.5rem',
        }}>

          {/* ── Logo ── */}
          <Link
            to="/"
            aria-label="WiSkul home"
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            '0.6rem',
              textDecoration: 'none',
              flexShrink:     0,
            }}
          >
            <div style={{
              width:        '36px',
              height:       '36px',
              borderRadius: '10px',
              background:   'linear-gradient(135deg, #00d4aa 0%, #00a8a0 100%)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              boxShadow:    '0 0 18px rgba(0,212,170,0.35)',
              flexShrink:   0,
            }}>
              {/* Wi logo mark */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 5l3.5 10L10 8l3.5 7L17 5"
                  stroke="#101024"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span style={{
              fontSize:    '1.2rem',
              fontWeight:  900,
              color:       '#ffffff',
              letterSpacing: '-0.02em',
              lineHeight:  1,
            }}>
              Wi<span style={{ color: '#00d4aa' }}>Skul</span>
            </span>
          </Link>

          {/* ── Desktop Links ── */}
          <div style={{
            display:    'none',
            alignItems: 'center',
            gap:        '0.25rem',
            flex:       1,
            justifyContent: 'center',
          }} className="pn-desktop-links">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  style={{
                    position:       'relative',
                    padding:        '0.45rem 0.85rem',
                    borderRadius:   '8px',
                    fontSize:       '0.875rem',
                    fontWeight:     active ? 600 : 400,
                    color:          active ? '#00d4aa' : 'rgba(255,255,255,0.7)',
                    textDecoration: 'none',
                    transition:     'color 0.2s, background 0.2s',
                    background:     active ? 'rgba(0,212,170,0.08)' : 'transparent',
                    whiteSpace:     'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = '#ffffff';
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)';
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                >
                  {link.label}
                  {/* Active underline */}
                  {active && (
                    <span style={{
                      position:     'absolute',
                      bottom:       '4px',
                      left:         '50%',
                      transform:    'translateX(-50%)',
                      width:        '18px',
                      height:       '2px',
                      borderRadius: '2px',
                      background:   '#00d4aa',
                      boxShadow:    '0 0 8px rgba(0,212,170,0.6)',
                    }} />
                  )}
                </Link>
              );
            })}
          </div>

          {/* ── Desktop Actions ── */}
          <div style={{
            display:    'none',
            alignItems: 'center',
            gap:        '0.75rem',
            flexShrink: 0,
          }} className="pn-desktop-actions">
            {/* Ghost Sign In */}
            <button
              onClick={() => navigate('/login')}
              style={{
                padding:      '0.5rem 1.1rem',
                borderRadius: '8px',
                border:       '1px solid rgba(255,255,255,0.15)',
                background:   'transparent',
                color:        'rgba(255,255,255,0.8)',
                fontSize:     '0.875rem',
                fontWeight:   500,
                cursor:       'pointer',
                transition:   'all 0.2s',
                whiteSpace:   'nowrap',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,170,0.4)';
                (e.currentTarget as HTMLElement).style.color = '#ffffff';
                (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,170,0.05)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)';
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              Sign In
            </button>

            {/* Primary CTA */}
            <button
              onClick={handleCta}
              style={{
                padding:      '0.5rem 1.4rem',
                borderRadius: '8px',
                border:       'none',
                background:   'linear-gradient(135deg, #00d4aa 0%, #00b899 100%)',
                color:        '#101024',
                fontSize:     '0.875rem',
                fontWeight:   700,
                cursor:       'pointer',
                transition:   'all 0.25s',
                whiteSpace:   'nowrap',
                boxShadow:    '0 0 0 rgba(0,212,170,0)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 22px rgba(0,212,170,0.4)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 rgba(0,212,170,0)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              {ctaText}
            </button>
          </div>

          {/* ── Mobile Hamburger ── */}
          <button
            onClick={() => setDrawerOpen(v => !v)}
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
            className="pn-hamburger"
            style={{
              display:         'flex',
              flexDirection:   'column',
              justifyContent:  'center',
              alignItems:      'center',
              gap:             '5px',
              width:           '40px',
              height:          '40px',
              background:      'rgba(255,255,255,0.06)',
              border:          '1px solid rgba(255,255,255,0.1)',
              borderRadius:    '10px',
              cursor:          'pointer',
              padding:         0,
              flexShrink:      0,
              transition:      'background 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,170,0.1)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,170,0.3)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <span style={{
              display:    'block',
              width:      '18px',
              height:     '2px',
              borderRadius: '2px',
              background: '#00d4aa',
              transformOrigin: 'center',
              transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s',
              transform:  drawerOpen ? 'translateY(7px) rotate(45deg)' : 'none',
            }} />
            <span style={{
              display:    'block',
              width:      '18px',
              height:     '2px',
              borderRadius: '2px',
              background: '#00d4aa',
              transition: 'opacity 0.2s',
              opacity:    drawerOpen ? 0 : 1,
            }} />
            <span style={{
              display:    'block',
              width:      '18px',
              height:     '2px',
              borderRadius: '2px',
              background: '#00d4aa',
              transformOrigin: 'center',
              transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s',
              transform:  drawerOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
            }} />
          </button>
        </div>
      </nav>

      {/* ── MOBILE DRAWER BACKDROP ────────────────────────────────────────── */}
      <div
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     998,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          transition: 'opacity 0.3s ease',
          opacity:    drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? 'auto' : 'none',
        }}
        className="pn-backdrop"
      />

      {/* ── MOBILE DRAWER ─────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        style={{
          position:   'fixed',
          top:        0,
          right:      0,
          bottom:     0,
          width:      'min(320px, 85vw)',
          zIndex:     999,
          background: 'linear-gradient(180deg, #0f0f27 0%, #13132e 100%)',
          borderLeft: '1px solid rgba(0,212,170,0.15)',
          boxShadow:  drawerOpen ? '-24px 0 80px rgba(0,0,0,0.6)' : 'none',
          transform:  drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          display:    'flex',
          flexDirection: 'column',
          overflowY:  'auto',
        }}
        className="pn-drawer"
      >
        {/* Drawer header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '1.25rem 1.5rem',
          borderBottom:   '1px solid rgba(0,212,170,0.1)',
        }}>
          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}
            onClick={() => setDrawerOpen(false)}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #00d4aa 0%, #00a8a0 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(0,212,170,0.3)',
            }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                <path d="M3 5l3.5 10L10 8l3.5 7L17 5" stroke="#101024" strokeWidth="2.4"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
              Wi<span style={{ color: '#00d4aa' }}>Skul</span>
            </span>
          </Link>

          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
            style={{
              width: '36px', height: '36px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,170,0.1)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,170,0.3)';
              (e.currentTarget as HTMLElement).style.color = '#00d4aa';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer links */}
        <nav aria-label="Mobile navigation" style={{ flex: 1, padding: '1rem 0.75rem' }}>
          {NAV_LINKS.map((link, i) => {
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setDrawerOpen(false)}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            '0.75rem',
                  padding:        '0.85rem 1rem',
                  borderRadius:   '10px',
                  marginBottom:   '2px',
                  textDecoration: 'none',
                  fontSize:       '0.95rem',
                  fontWeight:     active ? 700 : 500,
                  color:          active ? '#00d4aa' : 'rgba(255,255,255,0.75)',
                  background:     active ? 'rgba(0,212,170,0.1)' : 'transparent',
                  borderLeft:     active ? '3px solid #00d4aa' : '3px solid transparent',
                  transition:     'all 0.2s',
                  animationDelay: `${i * 40}ms`,
                }}
              >
                {link.label}
                {active && (
                  <span style={{
                    marginLeft: 'auto',
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#00d4aa',
                    boxShadow: '0 0 8px rgba(0,212,170,0.8)',
                  }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Drawer footer actions */}
        <div style={{
          padding:     '1rem 1.25rem 2rem',
          borderTop:   '1px solid rgba(0,212,170,0.1)',
          display:     'flex',
          flexDirection: 'column',
          gap:         '0.75rem',
        }}>
          <button
            onClick={() => { navigate('/login'); setDrawerOpen(false); }}
            style={{
              width: '100%', padding: '0.8rem',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Sign In
          </button>
          <button
            onClick={handleCta}
            style={{
              width: '100%', padding: '0.9rem',
              borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #00d4aa 0%, #00b899 100%)',
              color: '#101024',
              fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,212,170,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {ctaText}
          </button>
        </div>
      </div>

      {/* ── RESPONSIVE STYLES ─────────────────────────────────────────────── */}
      <style>{`
        /* Show desktop links/actions on md+ */
        @media (min-width: 768px) {
          .pn-desktop-links   { display: flex !important; }
          .pn-desktop-actions { display: flex !important; }
          .pn-hamburger       { display: none !important; }
        }
        /* Always hide drawer chrome on desktop */
        @media (min-width: 768px) {
          .pn-backdrop { display: none !important; }
          .pn-drawer   { display: none !important; }
        }
      `}</style>
    </>
  );
};

export default PublicNavbar;
