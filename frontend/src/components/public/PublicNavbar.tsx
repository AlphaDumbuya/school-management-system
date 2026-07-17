/**
 * PublicNavbar - Professional Shared Navigation
 * Cybersecurity-themed dark design with consistent links across all pages
 * Features: Smooth animations, mobile-optimized hamburger, backdrop menu
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface PublicNavbarProps {
  onCtaClick?: () => void;
  ctaText?: string;
  ctaAction?: 'coming-soon' | 'login' | 'custom';
}

interface NavLink {
  label: string;
  path?: string;
  anchor?: string;
  onClick?: () => void;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  onCtaClick,
  ctaText = 'Get Started',
  ctaAction = 'coming-soon',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleAnchorClick = (anchorId: string) => {
    const element = document.getElementById(anchorId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCtaClick = () => {
    if (onCtaClick) {
      onCtaClick();
    } else if (ctaAction === 'login') {
      navigate('/login');
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const isHomePage = location.pathname === '/';

  // Define navigation links - consistent across all pages
  const navLinks: NavLink[] = [
    ...(isHomePage
      ? [
          { label: 'Overview', anchor: 'features', onClick: () => handleAnchorClick('features') },
          { label: 'All Features', path: '/features' },
          { label: 'Why WiSkul', anchor: 'why', onClick: () => handleAnchorClick('why') },
          { label: 'Benefits', anchor: 'benefits', onClick: () => handleAnchorClick('benefits') },
        ]
      : [
          { label: 'Home', path: '/' },
          { label: 'Features', path: '/features' },
          { label: 'Why WiSkul', path: '/why' },
          { label: 'Benefits', path: '/benefits' },
        ]),
    { label: 'Pricing', path: '/pricing' },
    { label: 'Contact', path: '/contact' },
  ];

  const handleNavClick = (link: NavLink) => {
    if (link.onClick) {
      link.onClick();
      setMobileMenuOpen(false);
    } else if (link.path) {
      navigate(link.path);
      setMobileMenuOpen(false);
    }
  };

  const isNavActive = (link: NavLink) => link.path && isActive(link.path);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1a1a2e]/95 backdrop-blur-xl border-b border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-4 flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
        >
          <img
            src="/logo.png"
            alt="WiSkul"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-contain"
          />
          <span className="text-lg sm:text-xl font-black tracking-tight">
            Wi<span className="text-[#00d4aa]">Skul</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-300">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNavClick(link)}
              className={`transition-colors duration-200 ${
                isNavActive(link)
                  ? 'text-[#00d4aa] font-semibold'
                  : 'hover:text-white'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Desktop CTA Button */}
        <button
          onClick={handleCtaClick}
          className="hidden md:block bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-xs sm:text-sm px-5 sm:px-7 py-2.5 rounded-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,212,170,0.3)] active:scale-95"
        >
          {ctaText}
        </button>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex flex-col gap-1.5 w-8 h-8 items-center justify-center group"
          aria-label="Toggle menu"
        >
          {/* Animated cyber-themed hamburger */}
          <span
            className={`w-5 h-0.5 bg-[#00d4aa] transition-all duration-300 origin-center ${
              mobileMenuOpen ? 'rotate-45 translate-y-2' : ''
            }`}
          />
          <span
            className={`w-5 h-0.5 bg-[#00d4aa] transition-all duration-300 ${
              mobileMenuOpen ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`w-5 h-0.5 bg-[#00d4aa] transition-all duration-300 origin-center ${
              mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
            }`}
          />
        </button>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 md:hidden z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Dropdown */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 relative z-50 ${
          mobileMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 py-4 bg-gradient-to-b from-[#16213e] to-[#1a1a2e] border-t border-[#00d4aa]/20 space-y-1">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => handleNavClick(link)}
              className={`w-full text-left py-3 px-4 rounded-lg transition-all duration-200 ${
                isNavActive(link)
                  ? 'bg-[#00d4aa]/10 text-[#00d4aa] font-semibold border-l-2 border-[#00d4aa] pl-3'
                  : 'text-gray-300 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {link.label}
            </button>
          ))}

          {/* Mobile CTA Button */}
          <button
            onClick={() => {
              handleCtaClick();
              setMobileMenuOpen(false);
            }}
            className="w-full bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-sm px-6 py-3.5 rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,212,170,0.3)] active:scale-95 mt-4"
          >
            {ctaText}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default PublicNavbar;
