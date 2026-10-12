import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaCog, FaBookOpen } from 'react-icons/fa';
import { FaRightFromBracket } from 'react-icons/fa6';
import { BadgeCheck, Search as SearchIcon } from 'lucide-react';
import useAuth from '@hooks/useAuth';
import useAuthStore from '@store/authStore';
import schoolConfigService from '@services/schoolConfigService';
import { NotificationBell } from './NotificationBell';
import { GlobalSearchBar } from './GlobalSearchBar';
import { SyncStatusIndicator } from '@components/offline/SyncStatusIndicator';
import clsx from 'clsx';

interface HeaderProps {
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const canSeeAlerts = user?.role === 'principal' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin && user && (!user.schoolName || !user.schoolLogoUrl)) {
      schoolConfigService
        .getSchoolInfo()
        .then((res) => {
          if (res.success && res.data) {
            const fetchedName = res.data.name;
            const fetchedLogo = res.data.logo_url;
            if (fetchedName && (user.schoolName !== fetchedName || user.schoolLogoUrl !== fetchedLogo)) {
              const updatedUser = { ...user, schoolName: fetchedName || user.schoolName, schoolLogoUrl: fetchedLogo ?? user.schoolLogoUrl };
              useAuthStore.getState().setUser(updatedUser);
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleLogout = async () => { await logout(); };
  const handleProfile  = () => { navigate('/settings?tab=profile');  setUserMenuOpen(false); };
  const handleGuide    = () => { navigate('/guide');                   setUserMenuOpen(false); };
  const handleSettings = () => { navigate('/settings?tab=security'); setUserMenuOpen(false); };

  const fullName   = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Your Account';
  const initials   = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? 'U');
  const roleLabel  = (user?.role || '').replace(/_/g, ' ');
  const isVerified = (user as any)?.verificationStatus === 'verified';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="px-2 sm:px-5 py-2 flex items-center gap-1.5 sm:gap-3">

        {/* ── Left: hamburger + logo ── */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="text-gray-500 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100 lg:hidden transition-colors"
              title="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {isSuperAdmin ? (
              <>
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <img src="/logo.png" alt="WiSkul" className="w-full h-full object-contain p-1" />
                </div>
                <div className="hidden sm:block leading-tight min-w-0">
                  <span className="font-black text-base text-[#0f2a5e]">Wi<span className="text-amber-500">Skul</span></span>
                  <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider -mt-0.5">Platform</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                  {user?.schoolLogoUrl
                    ? <img src={user.schoolLogoUrl} alt={user.schoolName || 'School'} className="w-full h-full object-contain p-0.5" />
                    : <img src="/logo.png" alt="WiSkul" className="w-full h-full object-contain p-1" />
                  }
                </div>
                <div className="hidden sm:block leading-tight min-w-0 max-w-[140px] sm:max-w-[180px]">
                  <span className="block font-black text-sm text-gray-900 truncate">{user?.schoolName || 'WiSkul'}</span>
                  <span className="block text-[10px] text-gray-400 font-semibold uppercase tracking-wider -mt-0.5">School Management</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Center: GlobalSearchBar (desktop) ── */}
        <div className="hidden sm:flex flex-1 max-w-xl mx-auto">
          <GlobalSearchBar />
        </div>

        {/* ── Right: actions + user ── */}
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 flex-shrink-0 ml-auto sm:ml-0">

          {/* Mobile search toggle */}
          <button
            onClick={() => setMobileSearchOpen((v) => !v)}
            className="sm:hidden w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-[#315B8C] hover:bg-gray-100 transition-colors flex-shrink-0"
            title="Search"
          >
            <SearchIcon size={17} />
          </button>

          {/* Sync status (teachers only, online → null) */}
          <div className="hidden xs:block flex-shrink-0">
            <SyncStatusIndicator compact />
          </div>

          {/* Notifications */}
          <div className="flex-shrink-0">
            <NotificationBell canSeeAlerts={!!canSeeAlerts} />
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 mx-0.5 hidden sm:block" />

          {/* User menu */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              className="flex items-center gap-2 pl-1 pr-1 sm:pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-[#315B8C] to-[#1d4ed8] rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-sm ring-2 ring-white overflow-hidden">
                  {user?.profilePhotoUrl
                    ? <img src={user.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                    : initials}
                </div>
                {isVerified && (
                  <span className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-[1px] shadow" title="Verified school">
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
                  </span>
                )}
              </div>
              <div className="hidden sm:block text-left leading-tight max-w-[120px] lg:max-w-[140px]">
                <p className="font-bold text-gray-900 text-sm truncate">{fullName}</p>
                <p className="text-gray-400 text-[11px] capitalize truncate">{roleLabel}</p>
              </div>
              <svg
                className={clsx('hidden sm:block w-4 h-4 text-gray-400 transition-transform flex-shrink-0', userMenuOpen && 'rotate-180')}
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div role="menu" className="absolute right-0 mt-2 w-60 sm:w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  {/* Profile header */}
                  <div className="px-4 py-4 bg-gradient-to-br from-[#f0f4ff] to-[#e8f0fe] flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-[#315B8C] to-[#1d4ed8] rounded-xl flex items-center justify-center text-white text-base font-bold shadow-md ring-2 ring-white flex-shrink-0 overflow-hidden">
                      {user?.profilePhotoUrl
                        ? <img src={user.profilePhotoUrl} alt="" className="w-full h-full object-cover" />
                        : initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-sm truncate">{fullName}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#315B8C] text-white capitalize">
                        {roleLabel}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <MenuItem icon={<FaUser size={13} />}     label="My Profile"           hint="Account & details"        onClick={handleProfile} />
                    <MenuItem icon={<FaBookOpen size={13} />} label="Platform Guide"        hint="Learn how to use WiSkul"  onClick={handleGuide} />
                    <MenuItem icon={<FaCog size={13} />}      label="Settings & Security"   hint="Password & preferences"   onClick={handleSettings} />
                  </div>

                  <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                    <button
                      onClick={handleLogout}
                      className="w-full px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <FaRightFromBracket size={13} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile search bar (slides open below header) ── */}
      {mobileSearchOpen && (
        <div className="px-3 pb-3 pt-1.5 border-t border-gray-100 sm:hidden bg-white">
          <GlobalSearchBar
            mobile
            onClose={() => setMobileSearchOpen(false)}
          />
        </div>
      )}
    </header>
  );
};

const MenuItem: React.FC<{ icon: React.ReactNode; label: string; hint?: string; onClick: () => void }> = ({ icon, label, hint, onClick }) => (
  <button role="menuitem" onClick={onClick} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors group">
    <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 group-hover:bg-[#315B8C]/10 group-hover:text-[#315B8C] flex items-center justify-center flex-shrink-0 transition-colors">
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-medium text-gray-800">{label}</span>
      {hint && <span className="block text-[11px] text-gray-400 truncate">{hint}</span>}
    </span>
  </button>
);

export default Header;
