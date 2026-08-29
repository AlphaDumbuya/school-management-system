/**
 * Main Layout Component
 * Wrapper for main application layout with sidebar and header
 * Phase 11: Frontend Dashboard Implementation
 */

import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <Header onMenuClick={handleMenuClick} sidebarOpen={sidebarOpen} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />

        {/* Content area — tight horizontal gutter on mobile so content isn't
            choked; comfortable padding from sm upwards. */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-2 py-3 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
