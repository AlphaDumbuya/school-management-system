/**
 * Main Header Component
 * Navigation and user menu
 * Phase 11: Frontend Dashboard Implementation
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBars, FaUser, FaCog } from 'react-icons/fa';
import { FaBell, FaRightFromBracket } from 'react-icons/fa6';
import useAuth from '@hooks/useAuth';
import clsx from 'clsx';

interface HeaderProps {
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, sidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const handleProfile = () => {
    navigate('/profile');
    setUserMenuOpen(false);
  };

  const handleSettings = () => {
    navigate('/settings');
    setUserMenuOpen(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Left side - Logo and menu toggle */}
        <div className="flex items-center gap-4">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100"
              title="Toggle sidebar"
            >
              <FaBars className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">
            {sidebarOpen ? 'School Management' : 'SMS'}
          </h1>
        </div>

        {/* Right side - Notifications and user menu */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 relative"
              title="Notifications"
            >
              <FaBell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Notifications</h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    <div className="p-3 bg-blue-50 rounded border border-blue-200 text-sm">
                      <p className="font-medium text-blue-900">System Update</p>
                      <p className="text-blue-700 text-xs mt-1">
                        Dashboard data will be refreshed at 3 PM
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative ml-4">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div className="text-left text-sm">
                <p className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                <p className="text-gray-500 text-xs capitalize">{user?.role}</p>
              </div>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="py-1">
                  <button
                    onClick={handleProfile}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <FaUser className="w-4 h-4" /> Profile
                  </button>
                  <button
                    onClick={handleSettings}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <FaCog className="w-4 h-4" /> Settings
                  </button>
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <FaRightFromBracket className="w-4 h-4" /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
