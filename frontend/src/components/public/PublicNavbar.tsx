/**
 * PublicNavbar - Shared navigation component for public marketing pages
 * Used on Landing, Features, and Pricing pages
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface PublicNavbarProps {
  onCtaClick?: () => void;
  ctaText?: string;
  ctaAction?: 'coming-soon' | 'login' | 'custom';
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({ 
  onCtaClick, 
  ctaText = 'Get Started',
  ctaAction = 'coming-soon'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleCtaClick = () => {
    if (onCtaClick) {
      onCtaClick();
    } else if (ctaAction === 'login') {
      navigate('/login');
    }
  };

  const handleAnchorClick = (anchorId: string) => {
    const element = document.getElementById(anchorId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // Determine if we're on a public/marketing page
  const isPublicPage = [
    '/',
    '/features',
    '/pricing',
    '/why',
    '/benefits',
    '/contact'
  ].includes(location.pathname);

  const isHomePage = location.pathname === '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#1a1a2e]/95 backdrop-blur-xl border-b border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-4 flex items-center justify-between">
        {/* Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer" 
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
          {isHomePage ? (
            <>
              <a 
                href="#features" 
                onClick={(e) => { e.preventDefault(); handleAnchorClick('features'); }}
                className="hover:text-white transition-colors"
              >
                Overview
              </a>
              <span 
                onClick={() => navigate('/features')} 
                className="hover:text-white cursor-pointer transition-colors"
              >
                All Features
              </span>
              <a 
                href="#why" 
                onClick={(e) => { e.preventDefault(); handleAnchorClick('why'); }}
                className="hover:text-white transition-colors"
              >
                Why WiSkul
              </a>
              <a 
                href="#benefits" 
                onClick={(e) => { e.preventDefault(); handleAnchorClick('benefits'); }}
                className="hover:text-white transition-colors"
              >
                Benefits
              </a>
            </>
          ) : (
            <>
              <span 
                onClick={() => navigate('/')} 
                className={`cursor-pointer transition-colors ${isActive('/') ? 'text-[#00d4aa] font-semibold' : 'hover:text-white'}`}
              >
                Home
              </span>
              <span 
                onClick={() => navigate('/features')} 
                className={`cursor-pointer transition-colors ${isActive('/features') ? 'text-[#00d4aa] font-semibold' : 'hover:text-white'}`}
              >
                Features
              </span>
              <span 
                onClick={() => navigate('/why')} 
                className={`cursor-pointer transition-colors ${isActive('/why') ? 'text-[#00d4aa] font-semibold' : 'hover:text-white'}`}
              >
                Why WiSkul
              </span>
              <span 
                onClick={() => navigate('/benefits')} 
                className={`cursor-pointer transition-colors ${isActive('/benefits') ? 'text-[#00d4aa] font-semibold' : 'hover:text-white'}`}
              >
                Benefits
              </span>
            </>
          )}
          <span 
            onClick={() => navigate('/pricing')} 
            className={`cursor-pointer transition-colors ${isActive('/pricing') ? 'text-[#00d4aa] font-semibold' : 'hover:text-white'}`}
          >
            Pricing
          </span>
          <span 
            onClick={() => navigate('/contact')} 
            className={`cursor-pointer transition-colors ${isActive('/contact') ? 'text-[#00d4aa] font-semibold' : 'hover:text-white'}`}
          >
            Contact
          </span>
        </div>
        
        {/* Desktop CTA Button */}
        <button
          onClick={handleCtaClick}
          className="hidden md:block bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-xs sm:text-sm px-5 sm:px-7 py-2.5 rounded-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,212,170,0.3)] active:scale-95"
        >
          {ctaText}
        </button>

        {/* Mobile Menu Button - Hamburger Icon */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex flex-col gap-1.5 w-8 h-8 items-center justify-center"
          aria-label="Toggle menu"
        >
          <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile Menu Dropdown with Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 md:hidden z-40 bg-black/20 backdrop-blur-sm"
          onClick={closeMobileMenu}
        />
      )}
      
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'} relative z-50`}>
        <div className="px-6 py-4 bg-[#16213e] border-t border-white/[0.06] space-y-3">
          {isHomePage ? (
            <>
              <a 
                href="#features" 
                onClick={(e) => { e.preventDefault(); handleAnchorClick('features'); closeMobileMenu(); }}
                className="block py-2.5 text-gray-300 hover:text-white transition-colors"
              >
                Overview
              </a>
              <span 
                onClick={() => { navigate('/features'); closeMobileMenu(); }}
                className="block py-2.5 text-gray-300 hover:text-white cursor-pointer transition-colors"
              >
                All Features
              </span>
              <a 
                href="#why" 
                onClick={(e) => { e.preventDefault(); handleAnchorClick('why'); closeMobileMenu(); }}
                className="block py-2.5 text-gray-300 hover:text-white transition-colors"
              >
                Why WiSkul
              </a>
              <a 
                href="#benefits" 
                onClick={(e) => { e.preventDefault(); handleAnchorClick('benefits'); closeMobileMenu(); }}
                className="block py-2.5 text-gray-300 hover:text-white transition-colors"
              >
                Benefits
              </a>
            </>
          ) : (
            <>
              <span 
                onClick={() => { navigate('/'); closeMobileMenu(); }}
                className={`block py-2.5 cursor-pointer transition-colors ${isActive('/') ? 'text-[#00d4aa] font-semibold' : 'text-gray-300 hover:text-white'}`}
              >
                Home
              </span>
              <span 
                onClick={() => { navigate('/features'); closeMobileMenu(); }}
                className={`block py-2.5 cursor-pointer transition-colors ${isActive('/features') ? 'text-[#00d4aa] font-semibold' : 'text-gray-300 hover:text-white'}`}
              >
                Features
              </span>
              <span 
                onClick={() => { navigate('/why'); closeMobileMenu(); }}
                className={`block py-2.5 cursor-pointer transition-colors ${isActive('/why') ? 'text-[#00d4aa] font-semibold' : 'text-gray-300 hover:text-white'}`}
              >
                Why WiSkul
              </span>
              <span 
                onClick={() => { navigate('/benefits'); closeMobileMenu(); }}
                className={`block py-2.5 cursor-pointer transition-colors ${isActive('/benefits') ? 'text-[#00d4aa] font-semibold' : 'text-gray-300 hover:text-white'}`}
              >
                Benefits
              </span>
            </>
          )}
          <span 
            onClick={() => { navigate('/pricing'); closeMobileMenu(); }}
            className={`block py-2.5 cursor-pointer transition-colors ${isActive('/pricing') ? 'text-[#00d4aa] font-semibold' : 'text-gray-300 hover:text-white'}`}
          >
            Pricing
          </span>
          <span 
            onClick={() => { navigate('/contact'); closeMobileMenu(); }}
            className={`block py-2.5 cursor-pointer transition-colors ${isActive('/contact') ? 'text-[#00d4aa] font-semibold' : 'text-gray-300 hover:text-white'}`}
          >
            Contact
          </span>
          <button
            onClick={() => { handleCtaClick(); closeMobileMenu(); }}
            className="w-full bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-bold text-sm px-6 py-3 rounded-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,212,170,0.3)] active:scale-95 mt-2"
          >
            {ctaText}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default PublicNavbar;
