/**
 * Onboarding content + persistence.
 *
 * Provides role-aware first-login walkthrough steps and the data that powers the
 * dedicated Guide page. Completion is stored per user AND per tenant in
 * localStorage so a principal who finishes onboarding in one school workspace
 * isn't marked complete in another (multi-tenant safe).
 */
import type { UserRole } from '@appTypes/index';

export interface OnboardingStep {
  title: string;
  body: string;
  /** Where this step points the user (route) — shown as a "Take me there" link. */
  route?: string;
  routeLabel?: string;
}

export interface GuideSection {
  id: string;
  title: string;
  icon?: string; // lucide icon name, resolved on the guide page
  intro: string;
  points: string[];
  route?: string;
  routeLabel?: string;
}

/** An ordered setup phase for roles (like principal) that must configure things first. */
export interface SetupPhase {
  order: number;
  title: string;
  why: string;
  tasks: { label: string; route?: string; routeLabel?: string }[];
  /** True when this phase is a hard prerequisite before running the school. */
  required?: boolean;
}

export interface RoleGuide {
  headline: string;
  intro: string;
  steps: OnboardingStep[];
  sections: GuideSection[];
  /** Optional ordered setup roadmap (mainly for principal / super admin). */
  setupOrder?: SetupPhase[];
}

// ── Persistence (per user + tenant) ─────────────────────────────────────────

const key = (userId?: string, tenantId?: string) =>
  `wiskul.onboarding.done.${tenantId ?? 'no-tenant'}.${userId ?? 'anon'}`;

export function isOnboardingComplete(userId?: string, tenantId?: string): boolean {
  try {
    return localStorage.getItem(key(userId, tenantId)) === '1';
  } catch {
    return true; // fail safe: never block the app if storage is unavailable
  }
}

export function markOnboardingComplete(userId?: string, tenantId?: string): void {
  try {
    localStorage.setItem(key(userId, tenantId), '1');
  } catch {
    /* ignore */
  }
}

export function resetOnboarding(userId?: string, tenantId?: string): void {
  try {
    localStorage.removeItem(key(userId, tenantId));
  } catch {
    /* ignore */
  }
}

// ── Role content ────────────────────────────────────────────────────────────

const PRINCIPAL: RoleGuide = {
  headline: 'Welcome to WiSkul — let’s set up your school',
  intro:
    'As principal you have full control of your school workspace. Follow the setup roadmap below in order — a few one-time configurations must be done before enrolling people or running day-to-day operations.',
  setupOrder: [
    {
      order: 1,
      title: 'Configure your school foundation',
      why: 'These settings appear on every ID card, report card, invoice and email. Enrolling people or issuing documents before this is set leads to blank logos, wrong contacts and incorrect ID numbers.',
      required: true,
      tasks: [
        { label: 'School Info — name, logo, contacts, address', route: '/settings?tab=school', routeLabel: 'School Info' },
        { label: 'Academic Config — academic year & term dates', route: '/settings?tab=academic', routeLabel: 'Academic Config' },
        { label: 'ID Format — student/staff/admission number pattern', route: '/settings?tab=id-format', routeLabel: 'ID Format' },
        { label: 'Grading Scale — grade bands & pass mark', route: '/settings?tab=grading', routeLabel: 'Grading Scale' },
      ],
    },
    {
      order: 2,
      title: 'Set finance & academic defaults',
      why: 'Decide your school payment policy (minimum payments, instalments) and attendance thresholds before you invoice anyone or track attendance.',
      required: true,
      tasks: [
        { label: 'Financial Info — payment policy (min for new / continuing, instalments)', route: '/settings?tab=financial', routeLabel: 'Financial Info' },
        { label: 'Attendance Rules — warning/critical thresholds', route: '/settings?tab=attendance', routeLabel: 'Attendance Rules' },
      ],
    },
    {
      order: 3,
      title: 'Build your school structure',
      why: 'With settings in place, create the containers people belong to. Classes must exist before you can enrol students or build timetables.',
      required: true,
      tasks: [
        { label: 'Create classes & streams', route: '/academic/classes', routeLabel: 'Classes' },
        { label: 'Add subjects', route: '/academic/subjects', routeLabel: 'Subjects' },
        { label: 'Add teachers & assign them', route: '/staff/teachers', routeLabel: 'Teachers' },
      ],
    },
    {
      order: 4,
      title: 'Enrol students & issue identities',
      why: 'Now bring in students (individually or by bulk import) and issue their digital ID cards.',
      tasks: [
        { label: 'Enrol students / import a class', route: '/students/directory', routeLabel: 'Student Directory' },
        { label: 'Review admissions applications', route: '/students/admissions', routeLabel: 'Admissions' },
        { label: 'Generate ID cards', route: '/identity/cards', routeLabel: 'ID Cards' },
      ],
    },
    {
      order: 5,
      title: 'Run day-to-day operations',
      why: 'Everything is ready — start the academic cycle and keep the school running.',
      tasks: [
        { label: 'Build class timetables', route: '/academic/timetables', routeLabel: 'Timetables' },
        { label: 'Mark attendance', route: '/students/attendance', routeLabel: 'Attendance' },
        { label: 'Enter results & publish report cards', route: '/academic/results', routeLabel: 'Results' },
        { label: 'Issue invoices & collect fees', route: '/finance/invoices', routeLabel: 'Invoices' },
      ],
    },
    {
      order: 6,
      title: 'Secure & maintain',
      why: 'Protect your school’s data and keep everyone informed.',
      tasks: [
        { label: 'Enable two-factor authentication', route: '/settings?tab=security', routeLabel: 'Security' },
        { label: 'Send announcements to parents & staff', route: '/communication/announcements', routeLabel: 'Announcements' },
      ],
    },
  ],
  steps: [
    {
      title: 'Complete your School Information',
      body: 'Add your school name, logo, contact details and address. These appear on ID cards, report cards, invoices and every email sent to parents.',
      route: '/settings?tab=school',
      routeLabel: 'Open School Info',
    },
    {
      title: 'Set your Academic Configuration',
      body: 'Define the academic year and term dates. Grades, timetables and report cards all depend on these.',
      route: '/settings?tab=academic',
      routeLabel: 'Open Academic Config',
    },
    {
      title: 'Configure ID number format',
      body: 'Choose how student, staff and admission numbers are generated (prefix, year, padding). Set this before enrolling people.',
      route: '/settings?tab=id-format',
      routeLabel: 'Open ID Format',
    },
    {
      title: 'Review the Grading Scale',
      body: 'Confirm the grade bands and pass mark used across results and report cards.',
      route: '/settings?tab=grading',
      routeLabel: 'Open Grading Scale',
    },
    {
      title: 'Set Financial & Communication defaults',
      body: 'Pick your currency, accepted payment methods, and the sender name used for notifications to parents and staff.',
      route: '/settings?tab=financial',
      routeLabel: 'Open Financial Info',
    },
    {
      title: 'Add classes, staff and students',
      body: 'Once settings are in place, create your classes, add teachers, then enrol students. You can import in bulk from the Import/Export page.',
      route: '/academic/classes',
      routeLabel: 'Create a Class',
    },
    {
      title: 'Secure your account',
      body: 'Turn on two-factor authentication to protect your school’s data.',
      route: '/settings?tab=security',
      routeLabel: 'Open Security',
    },
  ],
  sections: [
    {
      id: 'settings',
      title: 'School Settings',
      icon: 'Settings',
      intro: 'The control centre for your school. Complete these before day-to-day work.',
      points: [
        'School Info — name, logo, contacts and address used across the platform.',
        'Academic Config — academic year and term dates.',
        'ID Format — how student/staff/admission numbers are generated.',
        'Grading Scale — grade bands and pass mark.',
        'Financial & Communications — currency, payment methods, sender name.',
      ],
      route: '/settings',
      routeLabel: 'Go to Settings',
    },
    {
      id: 'people',
      title: 'Classes, Staff & Students',
      icon: 'Users',
      intro: 'Build your school structure.',
      points: [
        'Create classes and assign levels.',
        'Add teachers and other staff, then set their teaching assignments.',
        'Enrol students individually or import a whole class from a spreadsheet.',
      ],
      route: '/students/directory',
      routeLabel: 'Student Directory',
    },
    {
      id: 'academics',
      title: 'Academics & Results',
      icon: 'GraduationCap',
      intro: 'Run the academic cycle.',
      points: [
        'Build weekly timetables per class.',
        'Enter cognitive scores and affective/psychomotor ratings.',
        'Generate and publish report cards.',
      ],
      route: '/academic/results',
      routeLabel: 'Results & Grades',
    },
    {
      id: 'attendance',
      title: 'Attendance',
      icon: 'ClipboardCheck',
      intro: 'Track daily attendance and spot at-risk students early.',
      points: [
        'Mark a class register in seconds.',
        'Review logs and analytics with automatic at-risk detection.',
      ],
      route: '/students/attendance',
      routeLabel: 'Attendance',
    },
    {
      id: 'finance',
      title: 'Fees & Payments',
      icon: 'Wallet',
      intro: 'Collect and reconcile school fees.',
      points: [
        'Define fee structures and issue invoices.',
        'Accept mobile money, card, bank transfer and wallets.',
        'Send fee reminders and generate receipts automatically.',
      ],
      route: '/finance/invoices',
      routeLabel: 'Invoices',
    },
    {
      id: 'identity',
      title: 'ID Cards',
      icon: 'CreditCard',
      intro: 'Issue verified digital ID cards with QR codes.',
      points: [
        'Design card templates.',
        'Generate cards in bulk for a class or the whole school.',
      ],
      route: '/identity/cards',
      routeLabel: 'ID Cards',
    },
  ],
};

const TEACHER: RoleGuide = {
  headline: 'Welcome — here’s how to run your classes',
  intro: 'Everything you need for your classes is a click away.',
  steps: [
    { title: 'Check your classes & schedule', body: 'Your dashboard shows the classes assigned to you and today’s timetable.', route: '/teacher/dashboard', routeLabel: 'My Dashboard' },
    { title: 'Mark attendance', body: 'Open the class register, mark students present/late/absent, and it saves instantly.', route: '/students/attendance', routeLabel: 'Attendance' },
    { title: 'Enter scores & ratings', body: 'Record Test 1 and Test 2 scores, plus affective and psychomotor ratings per student.', route: '/academic/results', routeLabel: 'Results & Grades' },
    { title: 'Publish report cards', body: 'Once grades are in, generate report cards for your class.', route: '/academic/report-cards', routeLabel: 'Report Cards' },
    { title: 'Secure your account', body: 'Enable two-factor authentication in Settings.', route: '/settings?tab=security', routeLabel: 'Security' },
  ],
  sections: [
    { id: 'classes', title: 'Classes & Timetable', icon: 'BookOpen', intro: 'See your assigned classes and weekly schedule.', points: ['View classes and student lists.', 'Check your daily and weekly timetable.'], route: '/academic/timetables', routeLabel: 'Timetables' },
    { id: 'attendance', title: 'Attendance', icon: 'ClipboardCheck', intro: 'Mark and review attendance for your classes.', points: ['Quick class register.', 'Review past attendance.'], route: '/students/attendance', routeLabel: 'Attendance' },
    { id: 'results', title: 'Results & Ratings', icon: 'ClipboardList', intro: 'Enter and manage grades.', points: ['Cognitive scores (Test 1 + Test 2).', 'Affective & psychomotor ratings.', 'Report cards.'], route: '/academic/results', routeLabel: 'Results' },
  ],
};

const ACCOUNTANT: RoleGuide = {
  headline: 'Welcome — manage your school’s finances',
  intro: 'Track revenue, invoices and outstanding balances.',
  steps: [
    { title: 'Review the finance overview', body: 'Your dashboard summarises revenue, collections and outstanding fees.', route: '/accountant/dashboard', routeLabel: 'My Dashboard' },
    { title: 'Manage invoices', body: 'Issue invoices, record payments and track balances per student.', route: '/finance/invoices', routeLabel: 'Invoices' },
    { title: 'Reconcile payments', body: 'View all payments across methods and generate receipts.', route: '/finance/payments', routeLabel: 'Payments' },
  ],
  sections: [
    { id: 'invoices', title: 'Invoices', icon: 'FileText', intro: 'Issue and track invoices.', points: ['Create invoices per student or class.', 'Record part-payments and balances.'], route: '/finance/invoices', routeLabel: 'Invoices' },
    { id: 'payments', title: 'Payments', icon: 'Wallet', intro: 'Reconcile incoming payments.', points: ['View payments by method.', 'Generate and share receipts.'], route: '/finance/payments', routeLabel: 'Payments' },
  ],
};

const ADMISSIONS: RoleGuide = {
  headline: 'Welcome — manage admissions',
  intro: 'Move applicants through the pipeline to enrolment.',
  steps: [
    { title: 'Review the pipeline', body: 'See applications grouped by stage: new, under review, approved, enrolled.', route: '/admissions/dashboard', routeLabel: 'My Dashboard' },
    { title: 'Process applications', body: 'Open an application to review details and update its status. Decisions email the applicant automatically.', route: '/admissions/dashboard', routeLabel: 'Applications' },
  ],
  sections: [
    { id: 'pipeline', title: 'Applications Pipeline', icon: 'Users', intro: 'Track applicants from enquiry to enrolment.', points: ['Move applications through stages.', 'Approve or reject with automatic notifications.'], route: '/admissions/dashboard', routeLabel: 'Admissions' },
  ],
};

const STUDENT: RoleGuide = {
  headline: 'Welcome to your student portal',
  intro: 'See your grades, attendance, schedule and fees in one place.',
  steps: [
    { title: 'Your overview', body: 'Your dashboard shows attendance, average grade, today’s classes and any fees due.', route: '/student/dashboard', routeLabel: 'My Dashboard' },
    { title: 'Check results', body: 'View your published results per term.', route: '/student/dashboard', routeLabel: 'Results' },
    { title: 'Secure your account', body: 'Enable two-factor authentication in Settings.', route: '/settings?tab=security', routeLabel: 'Security' },
  ],
  sections: [
    { id: 'overview', title: 'Your Dashboard', icon: 'GraduationCap', intro: 'Everything about your studies at a glance.', points: ['Attendance rate and average grade.', 'Today’s schedule.', 'Outstanding fees.'], route: '/student/dashboard', routeLabel: 'Dashboard' },
  ],
};

const PARENT: RoleGuide = {
  headline: 'Welcome — follow your children’s progress',
  intro: 'Monitor attendance, grades and fees for each of your children.',
  steps: [
    { title: 'Select a child', body: 'Switch between your children to see their individual progress.', route: '/parent/dashboard', routeLabel: 'My Dashboard' },
    { title: 'Review grades & attendance', body: 'See published results and attendance trends per child.', route: '/parent/dashboard', routeLabel: 'Overview' },
    { title: 'Pay fees', body: 'View outstanding balances and pay securely online.', route: '/parent/dashboard', routeLabel: 'Fees' },
  ],
  sections: [
    { id: 'overview', title: 'Children Overview', icon: 'Users', intro: 'Aggregate and per-child insights.', points: ['Attendance and grades per child.', 'Outstanding fees and online payment.'], route: '/parent/dashboard', routeLabel: 'Dashboard' },
  ],
};

const SUPER_ADMIN: RoleGuide = {
  headline: 'Welcome to the WiSkul platform console',
  intro: 'Oversee every school (tenant) on the platform.',
  steps: [
    { title: 'Platform overview', body: 'Monitor total schools, active tenants, new signups and platform health.', route: '/platform/dashboard', routeLabel: 'Platform Dashboard' },
    { title: 'Manage tenants', body: 'Create, review and manage individual school workspaces.', route: '/platform/tenants', routeLabel: 'Manage Tenants' },
  ],
  sections: [
    { id: 'tenants', title: 'Tenants', icon: 'Building', intro: 'Every school is an isolated tenant.', points: ['Provision and manage school workspaces.', 'Review subscriptions and usage.'], route: '/platform/tenants', routeLabel: 'Tenants' },
  ],
};

const GUIDES: Record<UserRole, RoleGuide> = {
  principal: PRINCIPAL,
  super_admin: SUPER_ADMIN,
  teacher: TEACHER,
  accountant: ACCOUNTANT,
  admissions_officer: ADMISSIONS,
  student: STUDENT,
  parent: PARENT,
};

export function getRoleGuide(role?: UserRole): RoleGuide {
  return (role && GUIDES[role]) || PRINCIPAL;
}
