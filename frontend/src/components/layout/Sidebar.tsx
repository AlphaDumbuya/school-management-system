/**
 * Sidebar Navigation Component
 * Main navigation menu with role-based items organized by module
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
  FaBuilding,
  FaAward,
  FaBarcode,
  FaComments,
  FaShieldAlt,
  FaBookOpen,
  FaChevronUp,
  FaChevronDown,
} from 'react-icons/fa';
import { FaRightFromBracket, FaAnglesLeft, FaAnglesRight } from 'react-icons/fa6';
import useAuth, { getDashboardPath } from '@hooks/useAuth';
import clsx from 'clsx';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  badge?: string;
  group?: string;
  module?: string;
  version?: 'v1' | 'v2';
}

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  /** Desktop-only: render a slim icon-only rail. */
  collapsed?: boolean;
  /** Toggle the collapsed rail (desktop). */
  onToggleCollapse?: () => void;
}

const navItems: NavItem[] = [
  // ── ACADEMIC MANAGEMENT ─────────────────────────────────────────────
  {
    label: 'Classes & Streams',
    icon: <FaBook className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/classes',
    roles: ['super_admin', 'principal', 'teacher'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Subjects',
    icon: <FaClipboardList className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/subjects',
    roles: ['super_admin', 'principal'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Timetables',
    icon: <FaClock className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/timetables',
    roles: ['super_admin', 'principal', 'teacher'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Assignments',
    icon: <FaClipboardList className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/assignments',
    roles: ['super_admin', 'principal', 'teacher', 'student'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Exam Timetable',
    icon: <FaClock className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/exam-timetable',
    roles: ['super_admin', 'principal', 'teacher'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Results & Grades',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/results',
    roles: ['super_admin', 'principal', 'teacher', 'student', 'parent'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Report Cards',
    icon: <FaFileImport className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/report-cards',
    roles: ['super_admin', 'principal', 'teacher', 'student', 'parent'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Promotions',
    icon: <FaAward className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/promotions',
    roles: ['super_admin', 'principal'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },

  // ── STUDENT MANAGEMENT ──────────────────────────────────────────────
  {
    label: 'Student Directory',
    icon: <FaUsers className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/students/directory',
    roles: ['super_admin', 'principal', 'teacher', 'admissions_officer'],
    module: 'Student Management',
    group: 'Students',
    version: 'v1',
  },
  {
    label: 'Admissions',
    icon: <FaClipboardList className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/students/admissions',
    roles: ['super_admin', 'principal', 'admissions_officer'],
    module: 'Student Management',
    group: 'Students',
    version: 'v1',
  },
  {
    label: 'Student Profiles',
    icon: <FaUsers className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/students/profiles',
    roles: ['super_admin', 'principal', 'teacher', 'admissions_officer'],
    module: 'Student Management',
    group: 'Students',
    version: 'v1',
  },
  {
    label: 'Attendance',
    icon: <FaCalendar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/students/attendance',
    roles: ['super_admin', 'principal', 'teacher', 'parent', 'student'],
    module: 'Student Management',
    group: 'Students',
    version: 'v1',
  },
  {
    label: 'Discipline & Conduct',
    icon: <FaShieldAlt className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/discipline',
    roles: ['super_admin', 'principal', 'teacher'],
    module: 'Student Management',
    group: 'Students',
    version: 'v1',
  },

  // ── STAFF MANAGEMENT ────────────────────────────────────────────────
  {
    label: 'Teachers',
    icon: <FaUserTie className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/staff/teachers',
    roles: ['super_admin', 'principal'],
    module: 'Staff Management',
    group: 'Staff',
    version: 'v1',
  },
  {
    label: 'Non-Teaching Staff',
    icon: <FaUsers className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/staff/members',
    roles: ['super_admin', 'principal'],
    module: 'Staff Management',
    group: 'Staff',
    version: 'v2',
  },
  {
    label: 'Leave Management',
    icon: <FaCalendar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/staff/leave',
    roles: ['super_admin', 'principal', 'teacher'],
    module: 'Staff Management',
    group: 'Staff',
    version: 'v2',
  },
  {
    label: 'Performance Reviews',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/staff/performance',
    roles: ['super_admin', 'principal'],
    module: 'Staff Management',
    group: 'Staff',
    version: 'v2',
  },

  // ── FINANCIAL MANAGEMENT ────────────────────────────────────────────
  {
    label: 'Fee Structures',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/fees',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Invoices',
    icon: <FaFileImport className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/invoices',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Payments & Receipts',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/payments',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Expenses',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/expenses',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v2',
  },
  {
    label: 'Payroll',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/payroll',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v2',
  },
  {
    label: 'Scholarships',
    icon: <FaAward className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/scholarships',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v2',
  },

  // ── COMMUNICATION ───────────────────────────────────────────────────
  {
    label: 'Announcements',
    icon: <FaBell className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/communication/announcements',
    roles: ['super_admin', 'principal', 'teacher', 'parent', 'student', 'accountant', 'admissions_officer'],
    module: 'Communication',
    group: 'Communication',
    version: 'v1',
  },
  {
    label: 'Messages',
    icon: <FaComments className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/communication/messages',
    roles: ['super_admin', 'principal', 'teacher', 'parent', 'student'],
    module: 'Communication',
    group: 'Communication',
    version: 'v2',
  },
  {
    label: 'SMS & WhatsApp',
    icon: <FaComments className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/communication/sms',
    roles: ['super_admin', 'principal', 'accountant', 'admissions_officer'],
    module: 'Communication',
    group: 'Communication',
    version: 'v2',
  },
  {
    label: 'Email Notifications',
    icon: <FaBell className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/communication/email',
    roles: ['super_admin', 'principal', 'accountant', 'admissions_officer'],
    module: 'Communication',
    group: 'Communication',
    version: 'v2',
  },

  // ── IDENTITY MANAGEMENT ────────────────────────────────────────────
  {
    label: 'ID Cards',
    icon: <FaBarcode className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/identity/cards',
    roles: ['super_admin', 'principal', 'admissions_officer'],
    module: 'Identity Management',
    group: 'Identity',
    version: 'v1',
  },
  {
    label: 'Card Templates',
    icon: <FaBarcode className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/identity/templates',
    roles: ['super_admin', 'principal'],
    module: 'Identity Management',
    group: 'Identity',
    version: 'v1',
  },

  // ── EVENTS MANAGEMENT ──────────────────────────────────────────────
  {
    label: 'School Events',
    icon: <FaAward className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/events/school',
    roles: ['super_admin', 'principal', 'teacher', 'parent', 'student'],
    module: 'Events Management',
    group: 'Events',
    version: 'v1',
  },
  {
    label: 'Calendar',
    icon: <FaCalendar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/events/calendar',
    roles: ['super_admin', 'principal', 'teacher', 'parent', 'student'],
    module: 'Events Management',
    group: 'Events',
    version: 'v1',
  },
  {
    label: 'My Events',
    icon: <FaCalendar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/events/my-events',
    roles: ['super_admin', 'principal', 'teacher', 'parent', 'student'],
    module: 'Events Management',
    group: 'Events',
    version: 'v1',
  },
  {
    label: 'Event Analytics',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/events/analytics',
    roles: ['super_admin', 'principal'],
    module: 'Events Management',
    group: 'Events',
    version: 'v1',
  },

  // ── REPORTS & ANALYTICS ────────────────────────────────────────────
  {
    label: 'Academic Reports',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/reports/academic',
    roles: ['super_admin', 'principal', 'teacher'],
    module: 'Reports & Analytics',
    group: 'Reports',
    version: 'v2',
  },
  {
    label: 'Financial Reports',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/reports/financial',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Reports & Analytics',
    group: 'Reports',
    version: 'v2',
  },
  {
    label: 'Attendance Reports',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/reports/attendance',
    roles: ['super_admin', 'principal', 'teacher'],
    module: 'Reports & Analytics',
    group: 'Reports',
    version: 'v2',
  },
  {
    label: 'Enrollment Reports',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/reports/enrollment',
    roles: ['super_admin', 'principal', 'admissions_officer'],
    module: 'Reports & Analytics',
    group: 'Reports',
    version: 'v2',
  },
  {
    label: 'Discipline Reports',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/reports/discipline',
    roles: ['super_admin', 'principal'],
    module: 'Reports & Analytics',
    group: 'Reports',
    version: 'v2',
  },

  // ── PLATFORM MANAGEMENT (SUPER ADMIN ONLY) ────────────────────────
  {
    label: 'Tenant Management',
    icon: <FaBuilding className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/platform/tenants',
    roles: ['super_admin'],
    module: 'Platform Management',
    group: 'Platform',
    version: 'v1',
  },
  {
    label: 'Subscriptions',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/platform/subscriptions',
    roles: ['super_admin'],
    module: 'Platform Management',
    group: 'Platform',
    version: 'v1',
  },
  {
    label: 'Platform Analytics',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/platform/analytics',
    roles: ['super_admin'],
    module: 'Platform Management',
    group: 'Platform',
    version: 'v1',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, collapsed = false, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, canAccess } = useAuth();
  // Footer account menu (Guide/Settings/Logout) — collapsed by default to save space.
  const [footerOpen, setFooterOpen] = React.useState(false);

  const dashboardPath = user ? getDashboardPath(user.role) : '/dashboard';

  // Preserve the sidebar's own scroll position across route changes so the
  // active item doesn't jump out of view when navigating.
  const navScrollRef = React.useRef<HTMLElement | null>(null);
  const SCROLL_KEY = 'wiskul.sidebar.scrollTop';

  const rememberScroll = () => {
    try {
      if (navScrollRef.current) {
        sessionStorage.setItem(SCROLL_KEY, String(navScrollRef.current.scrollTop));
      }
    } catch { /* ignore */ }
  };

  // Restore the saved scroll position after navigation re-renders.
  React.useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    try {
      const saved = Number(sessionStorage.getItem(SCROLL_KEY) || '0');
      if (saved > 0) el.scrollTop = saved;
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
  };

  const handleNavigation = (path: string) => {
    rememberScroll();
    navigate(path);
    onClose?.();
  };

  // Flag to toggle v2 items. Set to false for Version 1.0.0 release.
  const ENABLE_V2_FEATURES = false;

  // Filter nav items based on user role & release version
  const filteredNavItems = navItems.filter((item) => {
    if (!ENABLE_V2_FEATURES && item.version === 'v2') return false;
    return canAccess(item.roles as any[]);
  });

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
          'fixed lg:static top-16 lg:top-auto bottom-0 lg:inset-y-0 left-0 bg-gray-900 text-white transition-all duration-300 ease-in-out z-40 overflow-hidden',
          // Mobile is always full 16rem; desktop width depends on collapsed state.
          collapsed ? 'w-64 lg:w-[76px]' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Logo section */}
          <div className={clsx('py-4 sm:py-5 border-b border-gray-800 flex-shrink-0', collapsed ? 'px-2 lg:flex lg:justify-center' : 'px-4 sm:px-6')}>
            <div className={clsx('flex items-center gap-2 sm:gap-3', collapsed && 'lg:gap-0')}>
              {user?.schoolLogoUrl ? (
                <img
                  src={user.schoolLogoUrl}
                  alt={user.schoolName || 'School Logo'}
                  className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg object-contain bg-white p-1 border border-gray-700 flex-shrink-0"
                />
              ) : (
                <div className="w-9 sm:w-10 h-9 sm:h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm sm:text-lg text-white flex-shrink-0">
                  {user?.schoolName ? user.schoolName.substring(0, 2).toUpperCase() : 'SMS'}
                </div>
              )}
              <div className={clsx('min-w-0 flex-1', collapsed && 'lg:hidden')}>
                <h2 className="font-bold text-sm sm:text-lg truncate">{user?.schoolName || 'School Management'}</h2>
                <p className="text-gray-400 text-xs truncate capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Navigation items */}
          <nav
            ref={navScrollRef}
            onScroll={rememberScroll}
            className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-1 sm:space-y-2 overflow-y-auto min-h-0"
          >
            {/* Dashboard — always visible, role-aware path */}
            <button
              onClick={() => handleNavigation(dashboardPath)}
              title={collapsed ? 'Dashboard' : undefined}
              aria-current={location.pathname === dashboardPath ? 'page' : undefined}
              className={clsx(
                'relative w-full flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded-lg transition-colors duration-200 text-sm',
                collapsed ? 'px-3 lg:px-0 lg:justify-center' : 'px-3 sm:px-4',
                location.pathname === dashboardPath
                  ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-900/40 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:rounded-r before:bg-amber-400'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <FaHome className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0" />
              <span className={clsx('flex-1 text-left font-medium truncate', collapsed && 'lg:hidden')}>Dashboard</span>
              {!collapsed && location.pathname === dashboardPath && <FaChevronRight className="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />}
            </button>

            {/* Role-filtered nav items with group headers */}
            {(() => {
              let lastGroup = '';
              // Current path without query/hash, for reliable active matching.
              const currentPath = location.pathname.replace(/\/+$/, '') || '/';
              return filteredNavItems.map((item) => {
                const showGroup = item.group && item.group !== lastGroup;
                if (item.group) lastGroup = item.group;
                const itemPath = item.path.replace(/\/+$/, '');
                // Active when exactly on the item path OR on a nested sub-route of it
                // (segment-aware so "/students" never matches "/students-x").
                const isActive = currentPath === itemPath || currentPath.startsWith(itemPath + '/');
                return (
                  <React.Fragment key={item.path}>
                    {showGroup && (
                      collapsed ? (
                        <div className="hidden lg:block mx-2 my-2 border-t border-gray-800" aria-hidden />
                      ) : (
                        <p className="px-3 sm:px-4 pt-3 sm:pt-4 pb-1 sm:pb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                          {item.group}
                        </p>
                      )
                    )}
                    <button
                      onClick={() => handleNavigation(item.path)}
                      title={collapsed ? item.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={clsx(
                        'relative w-full flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 rounded-lg transition-colors duration-200 text-sm',
                        collapsed ? 'px-3 lg:px-0 lg:justify-center' : 'px-3 sm:px-4',
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-900/40 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:rounded-r before:bg-amber-400'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      )}
                    >
                      <div className="relative w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 flex items-center justify-center">
                        {item.icon}
                        {/* Collapsed: show a dot for items that have a badge */}
                        {collapsed && item.badge && (
                          <span className="hidden lg:block absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                        )}
                      </div>
                      <span className={clsx('flex-1 text-left font-medium truncate', collapsed && 'lg:hidden')}>{item.label}</span>
                      {!collapsed && item.badge && (
                        <span className="bg-red-600 text-white text-xs px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0">
                          {item.badge}
                        </span>
                      )}
                      {!collapsed && isActive && <FaChevronRight className="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />}
                    </button>
                  </React.Fragment>
                );
              });
            })()}
          </nav>

          {/* Compact account footer — expands to reveal Guide / Settings / Logout */}
          <div className="border-t border-gray-800 px-2 sm:px-3 py-2 flex-shrink-0">
            {/* Expandable action menu (only when not collapsed rail) */}
            {footerOpen && !collapsed && (
              <div className="mb-1.5 space-y-1 animate-fade-in">
                <button
                  onClick={() => { handleNavigation('/guide'); setFooterOpen(false); }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm',
                    location.pathname === '/guide' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <FaBookOpen className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium truncate">Guide &amp; Help</span>
                </button>
                <button
                  onClick={() => { handleNavigation('/settings'); setFooterOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-200 text-sm"
                >
                  <FaCog className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium truncate">Settings</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-900 hover:bg-opacity-20 transition-colors duration-200 text-sm"
                >
                  <FaRightFromBracket className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium truncate">Logout</span>
                </button>
              </div>
            )}

            {/* Collapsed rail: show icon-only actions stacked (no room for the profile row) */}
            {collapsed ? (
              <div className="hidden lg:flex flex-col items-center gap-1">
                <button onClick={() => handleNavigation('/guide')} title="Guide & Help"
                  className="w-full flex justify-center py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                  <FaBookOpen className="w-5 h-5" />
                </button>
                <button onClick={() => handleNavigation('/settings')} title="Settings"
                  className="w-full flex justify-center py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                  <FaCog className="w-5 h-5" />
                </button>
                <button onClick={handleLogout} title="Logout"
                  className="w-full flex justify-center py-2.5 rounded-lg text-red-400 hover:bg-red-900 hover:bg-opacity-20 transition-colors">
                  <FaRightFromBracket className="w-5 h-5" />
                </button>
              </div>
            ) : (
              /* Expanded rail: single compact profile row that toggles the menu */
              <button
                onClick={() => setFooterOpen((v) => !v)}
                aria-expanded={footerOpen}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-800 transition-colors group"
              >
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || 'U'}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold text-white truncate">
                    {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account'}
                  </span>
                  <span className="block text-[11px] text-gray-400 truncate capitalize">{user?.role?.replace('_', ' ')}</span>
                </span>
                {footerOpen ? (
                  <FaChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                ) : (
                  <FaChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" />
                )}
              </button>
            )}

            {/* Desktop-only collapse/expand toggle — slim single row */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className={clsx(
                  'hidden lg:flex w-full items-center gap-2 py-2 mt-1 rounded-lg text-gray-500 hover:bg-gray-800 hover:text-white transition-colors duration-200 text-xs',
                  collapsed ? 'justify-center' : 'px-3'
                )}
              >
                {collapsed ? <FaAnglesRight className="w-4 h-4 flex-shrink-0" /> : <FaAnglesLeft className="w-4 h-4 flex-shrink-0" />}
                <span className={clsx('font-medium truncate', collapsed && 'lg:hidden')}>Collapse sidebar</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
