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
  FaLifeRing,
  FaUserCheck,
  FaBalanceScale,
  FaUniversity,
  FaListAlt,
  FaHistory,
  FaLock,
  FaFlag,
  FaTimes,
  FaCrown,
} from 'react-icons/fa';
import { FaRightFromBracket, FaAnglesLeft, FaAnglesRight, FaCircleCheck } from 'react-icons/fa6';
import useAuth, { getDashboardPath } from '@hooks/useAuth';
import { useHouseAccess } from '@hooks/useHouseAccess';
import { routeAccess } from '@lib/planFeatures';
import { isDemoUser } from '@lib/demo';
import { roleDisplayName } from '@lib/leadTitle';
import clsx from 'clsx';

export interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
  badge?: string;
  group?: string;
  module?: string;
  version?: 'v1' | 'v2';
  /** Shown only to someone who holds the role as an extra duty (their main
   *  Dashboard button already covers people whose main job it is). */
  dutyOnly?: boolean;
  /** Shown only to a teacher the principal / admissions officer gave access to. */
  needsHouseAccess?: boolean;
  /** Shown only to an account named as a school owner. */
  namedOwnerOnly?: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  /** Desktop-only: render a slim icon-only rail. */
  collapsed?: boolean;
  /** Toggle the collapsed rail (desktop). */
  onToggleCollapse?: () => void;
}

export const navItems: NavItem[] = [
  // ── SCHOOL OWNER ────────────────────────────────────────────────────
  {
    label: 'Owner Overview',
    icon: <FaCrown className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/owner',
    roles: ['principal'],
    module: 'School Owner',
    group: 'Owner',
    version: 'v1',
    namedOwnerOnly: true,
  },
  // ── ACADEMIC MANAGEMENT ─────────────────────────────────────────────
  {
    label: 'Classes & Streams',
    icon: <FaBook className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/classes',
    roles: ['super_admin', 'principal', 'teacher', 'admissions_officer'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Subjects',
    icon: <FaClipboardList className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/subjects',
    roles: ['super_admin', 'principal', 'teacher', 'admissions_officer', 'student', 'parent'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Timetables',
    icon: <FaClock className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/timetables',
    roles: ['super_admin', 'principal', 'teacher', 'admissions_officer', 'student', 'parent'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Assignments',
    icon: <FaClipboardList className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/assignments',
    roles: ['super_admin', 'principal', 'teacher', 'student', 'parent', 'guardian'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Exam Timetable',
    icon: <FaClock className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/exam-timetable',
    roles: ['super_admin', 'principal', 'teacher', 'student', 'parent', 'admissions_officer'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Results & Grades',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/results',
    roles: ['super_admin', 'principal', 'teacher', 'student', 'parent', 'admissions_officer'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
  },
  {
    label: 'Report Cards',
    icon: <FaFileImport className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/academic/report-cards',
    roles: ['super_admin', 'principal', 'teacher', 'student', 'parent', 'admissions_officer'],
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
    label: 'Sport House',
    icon: <FaFlag className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/students/houses',
    roles: ['super_admin', 'principal', 'admissions_officer'],
    module: 'Student Management',
    group: 'Students',
    version: 'v1',
  },
  {
    label: 'My Sport House',
    icon: <FaFlag className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/students/houses',
    roles: ['teacher'],
    module: 'Student Management',
    group: 'Students',
    version: 'v1',
    needsHouseAccess: true,
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

  // ── EXTRA JOBS (Bursar / Admissions Officer / Teaching held on top of the main job) ──
  {
    label: 'Finance Overview',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/accountant/dashboard',
    roles: ['accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
    dutyOnly: true,
  },
  {
    label: 'Teaching Overview',
    icon: <FaBook className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/teacher/dashboard',
    roles: ['teacher'],
    module: 'Academic Management',
    group: 'Academic',
    version: 'v1',
    dutyOnly: true,
  },
  {
    label: 'Admissions Overview',
    icon: <FaClipboardList className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/admissions/dashboard',
    roles: ['admissions_officer'],
    module: 'Student Management',
    group: 'Students',
    version: 'v1',
    dutyOnly: true,
  },

  // ── STAFF MANAGEMENT ────────────────────────────────────────────────
  {
    // Professional staff: teachers, accountants (Bursar), admissions officers,
    // all onboarded the same way.
    label: 'Teaching & Admin Staff',
    icon: <FaUserTie className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/staff/teachers',
    roles: ['super_admin', 'principal'],
    module: 'Staff Management',
    group: 'Staff',
    version: 'v1',
  },
  {
    label: 'Staff Attendance',
    icon: <FaCalendar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/staff/attendance',
    roles: ['principal', 'teacher', 'accountant', 'admissions_officer'],
    module: 'Staff Management',
    group: 'Staff',
    version: 'v1',
  },
  {
    // Security, cleaners, cooks, drivers: easy onboarding, no login.
    label: 'Support Staff',
    icon: <FaUsers className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/staff/members',
    roles: ['super_admin', 'principal'],
    module: 'Staff Management',
    group: 'Staff',
    version: 'v1',
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
    label: 'Arrears & Aging',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/aging',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Discounts & Scholarships',
    icon: <FaAward className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/discounts',
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
    version: 'v1',
  },
  {
    label: 'Petty Cash',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/petty-cash',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Budget',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/budgets',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Fees & Payments',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/my-fees',
    roles: ['student', 'parent', 'guardian'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Payroll',
    icon: <FaMoneyBill className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/payroll',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Financial Statements',
    icon: <FaBalanceScale className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/reports',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Journal',
    icon: <FaBook className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/journal',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Chart of Accounts',
    icon: <FaListAlt className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/accounts',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Bank Reconciliation',
    icon: <FaUniversity className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/bank-reconciliation',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'Finance Audit Log',
    icon: <FaHistory className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/audit-log',
    roles: ['super_admin', 'principal', 'accountant'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
  },
  {
    label: 'My Payslips',
    icon: <FaFileImport className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/finance/my-payslips',
    roles: ['principal', 'teacher', 'accountant', 'admissions_officer'],
    module: 'Financial Management',
    group: 'Finance',
    version: 'v1',
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
    label: 'Support',
    icon: <FaLifeRing className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/support',
    roles: ['principal', 'teacher', 'accountant', 'admissions_officer'],
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
    roles: ['super_admin', 'principal', 'admissions_officer'],
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
    label: 'Academic Archive',
    icon: <FaChartBar className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/reports/academic',
    roles: ['super_admin', 'principal'],
    module: 'Reports & Analytics',
    group: 'Reports',
    version: 'v1',
  },
  {
    label: 'Audit Log',
    icon: <FaShieldAlt className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/audit-log',
    roles: ['principal'],
    module: 'Reports & Analytics',
    group: 'Reports',
    version: 'v1',
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
  {
    label: 'Communications',
    icon: <FaComments className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/platform/communications',
    roles: ['super_admin'],
    module: 'Platform Management',
    group: 'Platform',
    version: 'v1',
  },
  {
    label: 'Demo Requests',
    icon: <FaUserCheck className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/platform/demo-requests',
    roles: ['super_admin'],
    module: 'Platform Management',
    group: 'Platform',
    version: 'v1',
  },
  {
    label: 'Support Triage',
    icon: <FaLifeRing className="w-4 sm:w-5 h-4 sm:h-5" />,
    path: '/platform/support',
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
  // Accordion: which group is currently open. null = all collapsed.
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);

  const dashboardPath = user ? getDashboardPath(user.role) : '/dashboard';

  // Preserve the sidebar's own scroll position across route changes so the
  // active item doesn't jump out of view when navigating.
  const navScrollRef = React.useRef<HTMLElement | null>(null);
  const activeItemRef = React.useRef<HTMLButtonElement | null>(null);
  // Per person: a position saved in another portal (or another account on this device) must
  // never be applied to this one.
  const SCROLL_KEY = `wiskul.sidebar.scrollTop.${user?.id ?? 'anon'}`;

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

  // Accordion toggle. Opening a group closes the one that was open, and when that
  // one sits ABOVE it the list shrinks under the scroll position, so the group the
  // user just opened ends up above the visible area. Remember which group was
  // opened and bring its header to the top once the new layout is in place.
  const groupHeaderRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const scrollToGroupRef = React.useRef<string | null>(null);

  const toggleGroup = (group: string) => {
    scrollToGroupRef.current = openGroup === group ? null : group;
    setOpenGroup((prev) => (prev === group ? null : group));
  };

  React.useLayoutEffect(() => {
    const group = scrollToGroupRef.current;
    scrollToGroupRef.current = null;
    const nav = navScrollRef.current;
    const header = group ? groupHeaderRefs.current.get(group) : null;
    if (!nav || !header) return;
    const n = nav.getBoundingClientRect();
    const h = header.getBoundingClientRect();
    if (h.height === 0) return; // drawer is closed / hidden
    const top = Math.max(0, nav.scrollTop + (h.top - n.top) - 8);
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nav.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }, [openGroup]);

  // Keep the sidebar ON the active item: after a page change, once the right group is
  // open (and whenever the drawer is opened), scroll the highlighted item into view if
  // it is hidden. Each page mounts its own layout, so this runs on every navigation.
  React.useEffect(() => {
    const el = activeItemRef.current;
    const nav = navScrollRef.current;
    if (!nav) return;
    // On the dashboard (the first link) the list sits at the top, with the active link in view.
    const onDashboard = (location.pathname.replace(/\/+$/, '') || '/') === dashboardPath;
    if (onDashboard && !el) {
      nav.scrollTop = 0;
      try { sessionStorage.setItem(SCROLL_KEY, '0'); } catch { /* ignore */ }
      return;
    }
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      const n = nav.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      if (e.height === 0) return; // drawer is closed / hidden
      if (e.top < n.top + 8 || e.bottom > n.bottom - 8) {
        nav.scrollTop += e.top - n.top - n.height / 2 + e.height / 2;
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [location.pathname, openGroup, isOpen]);
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

  const isSuperAdmin = user?.role === 'super_admin';
  // A teacher sees "My House" only after being given access to it.
  const houseAccess = useHouseAccess(user?.role);

  // Memoize so filteredNavItems has a stable reference — required for groupedNav
  // useMemo and the auto-open useEffect to not fire on every render.
  const filteredNavItems = React.useMemo(() => navItems.filter((item) => {
    if (!ENABLE_V2_FEATURES && item.version === 'v2') return false;
    if (isSuperAdmin) return item.group === 'Platform';
    if (item.needsHouseAccess && !houseAccess.hasAccess) return false;
    if (item.namedOwnerOnly && !(user as any)?.isNamedOwner) return false;
    if (item.dutyOnly) {
      // Only for a teacher holding this as an extra duty.
      const duties = ((user as any)?.staffDuties ?? []) as string[];
      return !item.roles.includes(String(user?.role)) && duties.some((d) => item.roles.includes(d));
    }
    if (!canAccess(item.roles as any[])) return false;
    // Plan features: hide what the school's plan doesn't include. Read-only
    // items (held on the trial / an earlier plan) stay, badged below.
    return routeAccess(user, item.path) !== 'locked';
    // Re-filter when the role, duties or plan change (live role sync after a
    // promotion, a new Bursar duty, an upgrade), not only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isSuperAdmin, user?.role, (user as any)?.isNamedOwner, houseAccess.hasAccess, JSON.stringify((user as any)?.staffDuties ?? []), JSON.stringify(user?.planAccess?.features ?? null)]);

  // Group the filtered items.
  const groupedNav = React.useMemo(() => {
    const map = new Map<string, NavItem[]>();
    filteredNavItems.forEach((item) => {
      const g = item.group || 'Other';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    });
    return map;
  }, [filteredNavItems]);

  // Auto-open the group that contains the current active route.
  // Only runs when the pathname changes — does NOT fight manual accordion clicks
  // because the group-header toggle doesn't change the route.
  React.useEffect(() => {
    const currentPath = location.pathname.replace(/\/+$/, '') || '/';
    for (const [group, items] of groupedNav.entries()) {
      const hasActive = items.some((item) => {
        const ip = item.path.replace(/\/+$/, '');
        return currentPath === ip || currentPath.startsWith(ip + '/');
      });
      if (hasActive) {
        setOpenGroup(group);
        return;
      }
    }
    // Note: groupedNav intentionally omitted from deps — we only want this to
    // run on route change, not on every render cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[45] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          // Phone / small screens: a full-height drawer ABOVE the header (so it never overlaps it
          // part-way), kept clear of the status bar and gesture bar with the safe-area insets.
          'fixed lg:static inset-y-0 left-0 bg-gray-900 text-white transition-all duration-300 ease-in-out z-50 lg:z-40 overflow-hidden pt-[env(safe-area-inset-top)] lg:pt-0',
          // Mobile is always full 16rem; desktop width depends on collapsed state.
          collapsed ? 'w-64 lg:w-[76px]' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Logo section */}
          <div className={clsx('py-4 sm:py-5 border-b border-gray-800 flex-shrink-0', collapsed ? 'px-2 lg:flex lg:justify-center' : 'px-4 sm:px-6')}>
            <div className={clsx('flex items-center gap-2 sm:gap-3', collapsed && 'lg:gap-0')}>
              {/* Super admin is the PLATFORM operator — never branded as a tenant school. */}
              {isSuperAdmin ? (
                <>
                  <img src="/logo.png" alt="WiSkul" className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg object-contain bg-white p-1 border border-gray-700 flex-shrink-0" />
                  <div className={clsx('min-w-0 flex-1', collapsed && 'lg:hidden')}>
                    <h2 className="font-bold text-sm sm:text-lg truncate">Wi<span className="text-amber-400">Skul</span></h2>
                    <p className="text-gray-400 text-xs truncate">Platform Console</p>
                  </div>
                </>
              ) : (
                <>
                  {isDemoUser(user) ? (
                    // The public demo school wears the WiSkul logo, like the platform itself.
                    <img src="/logo.png" alt="WiSkul" className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg object-contain bg-white p-1 border border-gray-700 flex-shrink-0" />
                  ) : user?.schoolLogoUrl ? (
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
                    <p className="text-gray-400 text-xs truncate">{roleDisplayName(user)}</p>
                  </div>
                </>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="lg:hidden ml-auto flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <FaTimes className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation items */}
          <nav
            ref={navScrollRef}
            onScroll={rememberScroll}
            className="flex-1 px-2 sm:px-4 py-3 sm:py-6 space-y-1 sm:space-y-2 overflow-y-auto min-h-0"
          >
            {/* Dashboard — always visible, role-aware path */}
            <button
              onClick={() => handleNavigation(dashboardPath)}
              title={collapsed ? 'Dashboard' : undefined}
              aria-current={location.pathname === dashboardPath ? 'page' : undefined}
              className={clsx(
                'relative w-full flex items-center gap-2 sm:gap-3 py-2 sm:py-2.5 lg:py-3 rounded-lg transition-colors duration-200 text-xs sm:text-sm',
                collapsed ? 'px-3 lg:px-0 lg:justify-center' : 'px-2.5 sm:px-4',
                location.pathname === dashboardPath
                  ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-900/40 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:rounded-r before:bg-amber-400'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <FaHome className="w-4 sm:h-4 sm:w-5 lg:h-5 flex-shrink-0" />
              <span className={clsx('flex-1 text-left font-medium truncate', collapsed && 'lg:hidden')}>Dashboard</span>
              {!collapsed && location.pathname === dashboardPath && <FaChevronRight className="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />}
            </button>

            {/* Role-filtered nav items — accordion by group */}
            {(() => {
              const currentPath = location.pathname.replace(/\/+$/, '') || '/';
              return Array.from(groupedNav.entries()).map(([group, items]) => {
                const isGroupOpen = collapsed || openGroup === group;
                const groupHasActive = items.some((item) => {
                  const ip = item.path.replace(/\/+$/, '');
                  return currentPath === ip || currentPath.startsWith(ip + '/');
                });

                return (
                  <div key={group}>
                    {/* Group header / toggle */}
                    {collapsed ? (
                      <div className="hidden lg:block mx-2 my-2 border-t border-gray-800" aria-hidden />
                    ) : (
                      <button
                        ref={(el) => {
                          if (el) groupHeaderRefs.current.set(group, el);
                          else groupHeaderRefs.current.delete(group);
                        }}
                        onClick={() => toggleGroup(group)}
                        className={clsx(
                          'w-full flex items-center justify-between px-2.5 sm:px-4 pt-2.5 sm:pt-4 pb-1 sm:pb-1.5 sm:pb-2 text-[11px] sm:text-xs font-semibold uppercase tracking-widest transition-colors duration-150',
                          groupHasActive ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'
                        )}
                        aria-expanded={isGroupOpen}
                      >
                        <span>{group}</span>
                        {isGroupOpen
                          ? <FaChevronUp className="w-2.5 h-2.5 flex-shrink-0" />
                          : <FaChevronDown className="w-2.5 h-2.5 flex-shrink-0" />}
                      </button>
                    )}

                    {/* Group items — collapse/expand */}
                    {isGroupOpen && items.map((item) => {
                      const itemPath = item.path.replace(/\/+$/, '');
                      const isActive = currentPath === itemPath || currentPath.startsWith(itemPath + '/');
                      const readOnly = routeAccess(user, item.path) === 'read_only';
                      return (
                        <button
                          key={item.path}
                          ref={isActive ? activeItemRef : undefined}
                          onClick={() => handleNavigation(item.path)}
                          title={collapsed ? `${item.label}${readOnly ? ' (read-only)' : ''}` : readOnly ? 'Read-only on your current plan' : undefined}
                          aria-label={readOnly ? `${item.label}, read-only` : undefined}
                          aria-current={isActive ? 'page' : undefined}
                          className={clsx(
                            'relative w-full flex items-center gap-2 sm:gap-3 py-2 sm:py-2.5 lg:py-3 rounded-lg transition-colors duration-200 text-xs sm:text-sm',
                            collapsed ? 'px-3 lg:px-0 lg:justify-center' : 'px-2.5 sm:px-4',
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-900/40 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-1 before:rounded-r before:bg-amber-400'
                              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          )}
                        >
                          <div className="relative w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 flex items-center justify-center">
                            {item.icon}
                            {collapsed && item.badge && (
                              <span className="hidden lg:block absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                            )}
                          </div>
                          <span className={clsx('flex-1 text-left font-medium truncate', collapsed && 'lg:hidden', readOnly && !isActive && 'text-gray-400')}>{item.label}</span>
                          {readOnly && (
                            <FaLock
                              aria-hidden="true"
                              className={clsx('w-3 h-3 flex-shrink-0', isActive ? 'text-amber-200' : 'text-amber-400', collapsed && 'lg:hidden')}
                            />
                          )}
                          {!collapsed && item.badge && (
                            <span className="bg-red-600 text-white text-xs px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0">
                              {item.badge}
                            </span>
                          )}
                          {!collapsed && isActive && <FaChevronRight className="w-3 sm:w-4 h-3 sm:h-4 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </nav>

          {/* Compact account footer — expands to reveal Guide / Settings / Logout.
              pb-safe keeps it clear of the phone's gesture bar in the app. */}
          <div className="border-t border-gray-800 px-2 sm:px-3 py-2 flex-shrink-0 pb-safe">
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
                <span className="relative flex-shrink-0">
                  {(user?.profilePhotoUrl || user?.profileImage) ? (
                    <img src={user.profilePhotoUrl || user.profileImage} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] text-white text-xs font-black flex items-center justify-center">
                      {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || 'U'}
                    </span>
                  )}
                  {(user as any)?.verificationStatus === 'verified' && (
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full" title="Verified school">
                      <FaCircleCheck className="w-3.5 h-3.5 text-emerald-400 bg-[#1f2937] rounded-full" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold text-white truncate">
                    {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Account'}
                  </span>
                  <span className="block text-[11px] text-gray-400 truncate">{roleDisplayName(user)}</span>
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
