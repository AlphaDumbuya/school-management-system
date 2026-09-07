/**
 * Main Header Component
 * Navigation and user menu
 * Phase 11: Frontend Dashboard Implementation
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBars, FaUser, FaCog, FaBookOpen } from 'react-icons/fa';
import { FaRightFromBracket } from 'react-icons/fa6';
import useAuth from '@hooks/useAuth';
import useAuthStore from '@store/authStore';
import schoolConfigService from '@services/schoolConfigService';
import { NotificationBell } from './NotificationBell';
import clsx from 'clsx';

interface HeaderProps {
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // System alerts feed is principal/super_admin only.
  const canSeeAlerts = user?.role === 'principal' || user?.role === 'super_admin';

  // Sync missing tenant school info
  useEffect(() => {
    if (user && (!user.schoolName || !user.schoolLogoUrl)) {
      schoolConfigService
        .getSchoolInfo()
        .then((res) => {
          if (res.success && res.data) {
            const fetchedName = res.data.name;
            const fetchedLogo = res.data.logo_url;
            if (fetchedName && (user.schoolName !== fetchedName || user.schoolLogoUrl !== fetchedLogo)) {
              const updatedUser = {
                ...user,
                schoolName: fetchedName || user.schoolName,
                schoolLogoUrl: fetchedLogo ?? user.schoolLogoUrl,
              };
              useAuthStore.getState().setUser(updatedUser);
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
  };

  const handleProfile = () => {
    // The dedicated /profile route is a placeholder; the real profile editor
    // lives in Settings → My Profile.
    navigate('/settings?tab=profile');
    setUserMenuOpen(false);
  };

  const handleGuide = () => {
    navigate('/guide');
    setUserMenuOpen(false);
  };

  const handleSettings = () => {
    // Open the broader configuration (defaults to the Security tab so it's
    // clearly distinct from "My Profile").
    navigate('/settings?tab=security');
    setUserMenuOpen(false);
  };

  // Derived display values for the user menu.
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Your Account';
  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() ||
    (user?.email?.[0]?.toUpperCase() ?? 'U');
  const roleLabel = (user?.role || '').replace(/_/g, ' ');

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="px-3 sm:px-6 py-2 sm:py-4 flex items-center justify-between">
        {/* Left side - Logo and menu toggle */}
        <div className="flex items-center gap-2 sm:gap-4">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="text-gray-600 hover:text-gray-900 p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 lg:hidden"
              title="Toggle sidebar"
            >
              <FaBars className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          <div className="flex items-center gap-2">
            {user?.schoolLogoUrl && (
              <img
                src={user.schoolLogoUrl}
                alt={user.schoolName || 'School Logo'}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain bg-white p-0.5 border border-gray-200"
              />
            )}
            <h1 className="text-sm sm:text-xl font-bold text-gray-900 whitespace-nowrap">
              <span className="sm:hidden">{user?.schoolName || 'SMS'}</span>
              <span className="hidden sm:inline">{user?.schoolName || (sidebarOpen ? 'School Management' : 'SMS')}</span>
            </h1>
          </div>
        </div>

        {/* Right side - Notifications and user menu */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Notifications */}
          <NotificationBell canSeeAlerts={!!canSeeAlerts} />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className="flex items-center gap-2 pl-1 pr-1 sm:pr-2.5 py-1 rounded-full sm:rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0 shadow-sm ring-2 ring-white">
                {initials}
              </div>
              <div className="hidden sm:block text-left leading-tight max-w-[160px]">
                <p className="font-semibold text-gray-900 text-sm truncate">{fullName}</p>
                <p className="text-gray-500 text-[11px] capitalize truncate">{roleLabel}</p>
              </div>
              <svg
                className={clsx('hidden sm:block w-4 h-4 text-gray-400 transition-transform', userMenuOpen && 'rotate-180')}
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {userMenuOpen && (
              <>
                {/* click-away backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  {/* Identity block */}
                  <div className="px-4 py-4 bg-gradient-to-br from-blue-50 to-indigo-50/60 flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm ring-2 ring-white">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{fullName}</p>
                      {user?.email && (
                        <p className="text-gray-500 text-xs truncate">{user.email}</p>
                      )}
                      <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        {roleLabel}
                      </span>
                    </div>
                  </div>

                  <div className="py-1.5">
                    <MenuItem
                      icon={<FaUser className="w-4 h-4" />}
                      label="My Profile"
                      hint="Edit your name, email & password"
                      onClick={handleProfile}
                    />
                    <MenuItem
                      icon={<FaCog className="w-4 h-4" />}
                      label="Settings"
                      hint="Security, 2FA & configuration"
                      onClick={handleSettings}
                    />
                    <MenuItem
                      icon={<FaBookOpen className="w-4 h-4" />}
                      label="Guide & Help"
                      hint="Learn how to use the platform"
                      onClick={handleGuide}
                    />
                  </div>

                  <div className="border-t border-gray-100 py-1.5">
                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                    >
                      <FaRightFromBracket className="w-4 h-4" />
                      <span className="font-medium">Sign out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

/** A single dropdown menu row with an icon, label and a subtle hint line. */
const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}> = ({ icon, label, hint, onClick }) => (
  <button
    role="menuitem"
    onClick={onClick}
    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors group"
  >
    <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 flex items-center justify-center flex-shrink-0 transition-colors">
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-medium text-gray-800">{label}</span>
      {hint && <span className="block text-[11px] text-gray-400 truncate">{hint}</span>}
    </span>
  </button>
);

export default Header;
