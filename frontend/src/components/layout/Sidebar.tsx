/**
 * Sidebar Navigation Component
 * Main navigation menu with role-based items
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FaHome,
  FaUsers,
  FaBook,
  FaChartBar,
  FaMoneyBill,
  FaCalendar,
  FaCog,
  FaChevronRight,
  FaClipboardList,
  FaUserTie,
  FaBell,
  FaFileImport,
  FaClock,
} from 'react-icons/fa';
import { FaRightFromBracket } from 'react-icons/fa6';
import useAuth, { getDashboardPath } from '@hooks/useAuth';
import clsx from 'clsx';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  badge?: string;
  group?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

const navItems: NavItem[] = [
  // ── Academic ─────────────────────────────────────────────────────
  {
    label: 'Students',
    icon: <FaUsers className="w-5 h-5" />,
    path: '/students',
    roles: ['admin', 'principal', 'teacher', 'admissions_officer'],
    group: 'Academic',
  },
  {
    label: 'Classes',
    icon: <FaBook className="w-5 h-5" />,
    path: '/classes',
    roles: ['admin', 'principal', 'teacher'],
    group: 'Academic',
  },
  {
    label: 'Subjects',
    icon: <FaClipboardList className="w-5 h-5" />,
    path: '/subjects',
    roles: ['admin', 'principal'],
    group: 'Academic',
  },
  {
    label: 'Timetable',
    icon: <FaClock className="w-5 h-5" />,
    path: '/timetable',
    roles: ['admin', 'principal'],
    group: 'Academic',
  },
  {
    label: 'Examinations',
    icon: <FaFileImport className="w-5 h-5" />,
    path: '/examinations',
    roles: ['admin', 'principal'],
    group: 'Academic',
  },
  {
    label: 'Grades',
    icon: <FaChartBar className="w-5 h-5" />,
    path: '/grades',
    roles: ['admin', 'principal', 'teacher', 'student'],
    group: 'Academic',
  },
  {
    label: 'Attendance',
    icon: <FaCalendar className="w-5 h-5" />,
    path: '/attendance',
    roles: ['admin', 'principal', 'teacher', 'student'],
    group: 'Academic',
  },
  // ── Staff ────────────────────────────────────────────────────────
  {
    label: 'Teachers',
    icon: <FaUserTie className="w-5 h-5" />,
    path: '/teachers',
    roles: ['admin', 'principal'],
    group: 'Staff',
  },
  {
    label: 'Staff',
    icon: <FaUsers className="w-5 h-5" />,
    path: '/staff',
    roles: ['admin', 'principal'],
    group: 'Staff',
  },
  // ── Communication ────────────────────────────────────────────────
  {
    label: 'Announcements',
    icon: <FaBell className="w-5 h-5" />,
    path: '/announcements',
    roles: ['admin', 'principal'],
    group: 'Communication',
  },
  {
    label: 'Messages',
    icon: <FaClipboardList className="w-5 h-5" />,
    path: '/messages',
    roles: ['admin', 'principal'],
    group: 'Communication',
  },
  {
    label: 'Notifications',
    icon: <FaBell className="w-5 h-5" />,
    path: '/notifications',
    roles: ['admin'],
    group: 'Communication',
  },
  // ── Finance ──────────────────────────────────────────────────────
  {
    label: 'Finance',
    icon: <FaMoneyBill className="w-5 h-5" />,
    path: '/finance',
    roles: ['admin', 'principal', 'accountant'],
    group: 'Finance',
  },
  // ── Reports ──────────────────────────────────────────────────────
  {
    label: 'Reports',
    icon: <FaChartBar className="w-5 h-5" />,
    path: '/reports',
    roles: ['admin', 'principal', 'accountant'],
    group: 'Reports',
  },
  // ── System (admin only) ──────────────────────────────────────────
  {
    label: 'Users',
    icon: <FaUserTie className="w-5 h-5" />,
    path: '/users',
    roles: ['admin', 'principal'],
    group: 'System',
  },
  {
    label: 'Import / Export',
    icon: <FaFileImport className="w-5 h-5" />,
    path: '/import-export',
    roles: ['admin'],
    group: 'System',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, canAccess } = useAuth();

  const dashboardPath = user ? getDashboardPath(user.role) : '/dashboard';

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
                <p className="text-gray-400 text-xs capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {/* Dashboard — always visible, role-aware path */}
            <button
              onClick={() => handleNavigation(dashboardPath)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200',
                location.pathname === dashboardPath
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <FaHome className="w-5 h-5" />
              <span className="flex-1 text-left text-sm font-medium">Dashboard</span>
              {location.pathname === dashboardPath && <FaChevronRight className="w-4 h-4" />}
            </button>

            {/* Role-filtered nav items with group headers */}
            {(() => {
              let lastGroup = '';
              return filteredNavItems.map((item) => {
                const showGroup = item.group && item.group !== lastGroup;
                if (item.group) lastGroup = item.group;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <React.Fragment key={item.path}>
                    {showGroup && (
                      <p className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-widest text-gray-500">
                        {item.group}
                      </p>
                    )}
                    <button
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
                      {isActive && <FaChevronRight className="w-4 h-4" />}
                    </button>
                  </React.Fragment>
                );
              });
            })()}
          </nav>

          {/* Settings and logout */}
          <div className="border-t border-gray-800 px-4 py-4 space-y-2">
            <button
              onClick={() => handleNavigation('/settings')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-200"
            >
              <FaCog className="w-5 h-5" />
              <span className="text-sm font-medium">Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900 hover:bg-opacity-20 transition-colors duration-200"
            >
              <FaRightFromBracket className="w-5 h-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
