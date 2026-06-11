/**
 * Sidebar Navigation Component
 * Main navigation menu with role-based items
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart3,
  DollarSign,
  Clock,
  Settings,
  LogOut,
  ChevronRight,
} from 'react-icons/fa';
import useAuth from '@hooks/useAuth';
import clsx from 'clsx';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  badge?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    path: '/dashboard',
    roles: ['admin', 'principal', 'teacher', 'student', 'parent', 'guardian', 'accountant', 'admissionsOfficer'],
  },
  {
    label: 'Students',
    icon: <Users className="w-5 h-5" />,
    path: '/students',
    roles: ['admin', 'principal', 'teacher', 'admissionsOfficer'],
  },
  {
    label: 'Classes',
    icon: <BookOpen className="w-5 h-5" />,
    path: '/classes',
    roles: ['admin', 'principal', 'teacher'],
  },
  {
    label: 'Grades',
    icon: <BarChart3 className="w-5 h-5" />,
    path: '/grades',
    roles: ['admin', 'principal', 'teacher', 'student'],
  },
  {
    label: 'Finance',
    icon: <DollarSign className="w-5 h-5" />,
    path: '/finance',
    roles: ['admin', 'principal', 'accountant'],
  },
  {
    label: 'Attendance',
    icon: <Clock className="w-5 h-5" />,
    path: '/attendance',
    roles: ['admin', 'principal', 'teacher', 'student'],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, canAccess } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose?.();
  };

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter((item) =>
    canAccess(item.roles as any[])
  );

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 bg-gray-900 text-white transition-all duration-200 ease-in-out z-40',
          'w-64 overflow-y-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col">
          {/* Logo section */}
          <div className="px-6 py-6 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
                SMS
              </div>
              <div>
                <h2 className="font-bold text-lg">School Management</h2>
                <p className="text-gray-400 text-xs">System</p>
              </div>
            </div>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  {item.icon}
                  <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </button>
              );
            })}
          </nav>

          {/* Settings and logout */}
          <div className="border-t border-gray-800 px-4 py-4 space-y-2">
            <button
              onClick={() => handleNavigation('/settings')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-200"
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm font-medium">Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900 hover:bg-opacity-20 transition-colors duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
