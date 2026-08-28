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
  module?: string;
  version?: 'v1' | 'v2';
}

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
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
    version: 'v2',
  },
  {
    label: 'Invoices',
    icon: <FaFileImport className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/invoices',
    roles: ['super_admin', 'principal', 'accountant', 'parent'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v2',
  },
  {
    label: 'Payments & Receipts',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/payments',
    roles: ['super_admin', 'principal', 'accountant', 'parent'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v2',
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
    roles: ['super_admin', 'principal', 'teacher', 'parent', 'student'],
    module: 'Communication',
    group: 'Communication',
    version: 'v2',
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
          'fixed lg:static top-16 lg:top-auto bottom-0 lg:inset-y-0 left-0 bg-gray-900 text-white transition-all duration-200 ease-in-out z-40',
          'w-64 overflow-hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Logo section */}
          <div className="px-4 sm:px-6 py-4 sm:py-6 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
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
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-sm sm:text-lg truncate">{user?.schoolName || 'School Management'}</h2>
                <p className="text-gray-400 text-xs truncate capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-1 sm:space-y-2 overflow-y-auto min-h-0">
            {/* Dashboard — always visible, role-aware path */}
            <button
              onClick={() => handleNavigation(dashboardPath)}
              className={clsx(
                'w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-colors duration-200',
                location.pathname === dashboardPath
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                'text-sm sm:text-sm'
              )}
            >
              <FaHome className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0" />
              <span className="flex-1 text-left font-medium truncate">Dashboard</span>
              {location.pathname === dashboardPath && <FaChevronRight className="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />}
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
                      <p className="px-3 sm:px-4 pt-3 sm:pt-4 pb-1 sm:pb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                        {item.group}
                      </p>
                    )}
                    <button
                      onClick={() => handleNavigation(item.path)}
                      className={clsx(
                        'w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-colors duration-200',
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                        'text-sm sm:text-sm'
                      )}
                    >
                      <div className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 flex items-center justify-center">{item.icon}</div>
                      <span className="flex-1 text-left font-medium truncate">{item.label}</span>
                      {item.badge && (
                        <span className="bg-red-600 text-white text-xs px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0">
                          {item.badge}
                        </span>
                      )}
                      {isActive && <FaChevronRight className="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />}
                    </button>
                  </React.Fragment>
                );
              });
            })()}
          </nav>

          {/* Settings and logout */}
          <div className="border-t border-gray-800 px-3 sm:px-4 py-3 sm:py-4 space-y-1 sm:space-y-2 flex-shrink-0">
            <button
              onClick={() => handleNavigation('/settings')}
              className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors duration-200 text-sm sm:text-sm"
            >
              <FaCog className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0" />
              <span className="font-medium truncate">Settings</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-red-400 hover:bg-red-900 hover:bg-opacity-20 transition-colors duration-200 text-sm sm:text-sm"
            >
              <FaRightFromBracket className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0" />
              <span className="font-medium truncate">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
