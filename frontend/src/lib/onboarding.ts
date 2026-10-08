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

export interface GuideFaq {
  q: string;
  a: string;
}

export interface RoleGuide {
  headline: string;
  intro: string;
  steps: OnboardingStep[];
  sections: GuideSection[];
  /** Optional ordered roadmap (principal: setup; teacher: your term rhythm). */
  setupOrder?: SetupPhase[];
  /** Heading + intro for the roadmap block (defaults to the setup wording). */
  setupTitle?: string;
  setupIntro?: string;
  /** Short "good to know" rules shown as callouts (e.g. how years work). */
  keyRules?: { title: string; body: string }[];
  /** Common questions for this role. */
  faqs?: GuideFaq[];
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

/** sessionStorage flag: "open the walkthrough on the next layout mount". */
export const REPLAY_WALKTHROUGH_FLAG = 'wiskul.replay-walkthrough';

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
        { label: 'Grading & Results — grade scales', route: '/settings?tab=grading', routeLabel: 'Grading & Results' },
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
      title: 'Set your payment policy',
      body: 'All amounts are in Sierra Leonean Leones (Le). Set your minimum payments for new and continuing students, per-term clearance and whether instalments are allowed. You can override any of these per class in Fee Structures.',
      route: '/settings?tab=financial',
      routeLabel: 'Open Financial Info',
    },
    {
      title: 'Connect online payments',
      body: 'Link your school’s Monime account so parents can pay fees online and the money settles directly to you.',
      route: '/settings?tab=payments',
      routeLabel: 'Open Payments',
    },
    {
      title: 'Add classes, staff and students',
      body: 'Once settings are in place, create your classes, add teachers, then enrol students. You can import a whole class from a CSV right in the Student Directory.',
      route: '/academic/classes',
      routeLabel: 'Create a Class',
    },
    {
      title: 'Starting a new academic year',
      body: 'When the year ends, use Start New Academic Year in Academic Config. Last year is archived as read-only history; classes, subjects and timetables carry forward, but fee structures start fresh each year.',
      route: '/settings?tab=academic',
      routeLabel: 'Open Academic Config',
    },
    {
      title: 'Secure your account',
      body: 'Turn on two-factor authentication, and optionally add a passkey for password-free sign-in, to protect your school’s data.',
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
        'Academic Config — term dates, and Start New Academic Year at year-end.',
        'ID Format — how student/staff/admission numbers are generated.',
        'Grading & Results — grade scales and publishing results.',
        'Financial Info — payment policy (all amounts in Leones); Payments — connect Monime.',
        'Security — two-factor authentication and passkeys.',
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
      intro: 'Collect and reconcile school fees (in Leones).',
      points: [
        'Define fee structures per class (they reset each new year).',
        'Issue invoices and record payments — cash, bank, card or mobile money.',
        'Accept online payments via Monime, send reminders and generate receipts.',
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
  headline: 'Welcome — here’s how to run your classes on WiSkul',
  intro:
    'WiSkul only shows you the classes you teach or lead, and the students in them. Your principal sets up the school, the classes and your assignments; you take registers, set work, enter results and keep parents informed. This guide walks through every part of your workspace.',

  // ── First-login walkthrough (also "Replay walkthrough") ──
  steps: [
    {
      title: 'Start on your Overview',
      body: 'Your dashboard shows the classes you teach or lead this year, today’s timetable, your students and what needs attention. If a class is missing, ask your principal to assign you to it.',
      route: '/teacher/dashboard',
      routeLabel: 'Open my Overview',
    },
    {
      title: 'Sign in when you arrive',
      body: 'Each school day, open Teacher Attendance and tap “Sign in as present” (or “late”), then sign out when you leave. Your principal sees the register; if they marked you before you arrived, you can still sign in.',
      route: '/staff/attendance',
      routeLabel: 'Teacher Attendance',
    },
    {
      title: 'Take the class register',
      body: 'In Attendance → Class Register, pick your class, date and session, then tap P / L / A / E for each student, or “Mark All Present”. Every tap saves straight away, with no Submit button. No signal? Marks are kept on your phone and sync when you reconnect.',
      route: '/students/attendance',
      routeLabel: 'Take a register',
    },
    {
      title: 'Set assignments',
      body: 'Create homework and classwork for your classes with a due date and instructions, then keep an eye on how many students have submitted.',
      route: '/academic/assignments',
      routeLabel: 'Assignments',
    },
    {
      title: 'Enter Test 1 & Test 2 scores',
      body: 'In Results & Grades, choose your class, subject and term, then type each student’s scores. The mean, grade and position are worked out for you. Add affective and psychomotor ratings and a comment for each student, too.',
      route: '/academic/results',
      routeLabel: 'Results & Grades',
    },
    {
      title: 'Check report cards',
      body: 'Preview each student’s report card to check scores and comments. Cards stay a draft until your principal publishes them to students and parents.',
      route: '/academic/report-cards',
      routeLabel: 'Report Cards',
    },
    {
      title: 'Record conduct',
      body: 'Log an infraction or a behavioural note (positive or a concern) for a student in your classes. Your principal decides any actions; confidential records are only seen by you and the principal.',
      route: '/discipline',
      routeLabel: 'Discipline & Conduct',
    },
    {
      title: 'Talk to your class',
      body: 'Post an announcement to one of your classes, for its students, parents or both. You can also email it. Only that class sees it.',
      route: '/communication/announcements',
      routeLabel: 'Announcements',
    },
    {
      title: 'Last year is history',
      body: 'Most pages have a year picker that opens on the current year. Choose a past year to look back at your old classes, results and attendance. Past years are read-only history, so new work always goes into this year.',
    },
    {
      title: 'Secure your account',
      body: 'Set a strong password, turn on two-factor authentication and add a passkey for quick sign-in. On a phone, check Offline & Storage to see what’s saved on the device.',
      route: '/settings?tab=security',
      routeLabel: 'Open Security',
    },
  ],

  // ── Your term rhythm (rendered like the principal's roadmap) ──
  setupTitle: 'Your teaching rhythm',
  setupIntro: 'What a typical day, week and term looks like in WiSkul.',
  setupOrder: [
    {
      order: 1,
      title: 'Every school day',
      why: 'Attendance is time-sensitive: parents are notified when their child is checked in or out.',
      tasks: [
        { label: 'Sign in (and out) in Teacher Attendance', route: '/staff/attendance', routeLabel: 'Teacher Attendance' },
        { label: 'Take each class register', route: '/students/attendance', routeLabel: 'Attendance' },
        { label: 'Check today’s timetable on your Overview', route: '/teacher/dashboard', routeLabel: 'Overview' },
      ],
    },
    {
      order: 2,
      title: 'Every week',
      why: 'Keep work flowing and parents in the loop.',
      tasks: [
        { label: 'Set assignments and follow up on submissions', route: '/academic/assignments', routeLabel: 'Assignments' },
        { label: 'Record conduct notes as things happen', route: '/discipline', routeLabel: 'Discipline' },
        { label: 'Post class announcements', route: '/communication/announcements', routeLabel: 'Announcements' },
      ],
    },
    {
      order: 3,
      title: 'Each term',
      why: 'Results feed the report cards your principal publishes.',
      tasks: [
        { label: 'Check the exam timetable', route: '/academic/exam-timetable', routeLabel: 'Exam Timetable' },
        { label: 'Enter Test 1 & Test 2 scores and ratings', route: '/academic/results', routeLabel: 'Results & Grades' },
        { label: 'Preview report cards and comments', route: '/academic/report-cards', routeLabel: 'Report Cards' },
      ],
    },
  ],

  keyRules: [
    {
      title: 'You see your own classes',
      body: 'Classes, students, attendance, results and conduct are limited to the classes you teach (a subject) or lead (class teacher). Ask your principal if an assignment is missing.',
    },
    {
      title: 'One year at a time',
      body: 'Pages open on the current academic year and follow the school when it moves to a new one. Pick a past year to view history; it is read-only. The one exception is Results, which stays editable for late corrections and shows an amber warning while you’re in a past year.',
    },
    {
      title: 'Your principal publishes',
      body: 'Report cards and events you create stay drafts until the principal publishes them. Timetables, exam timetables, classes and subjects are set by the principal; you can view them.',
    },
    {
      title: 'Works on a weak connection',
      body: 'On the app, your class lists stay available offline. Registers and new assignments made offline are kept on the device and sync automatically when you’re back online.',
    },
  ],

  sections: [
    {
      id: 'overview',
      title: 'Overview',
      icon: 'BarChart2',
      intro: 'Your classes, timetable and students at a glance.',
      points: [
        'Classes you teach or lead this year, with student counts.',
        'Today’s timetable and quick links to take a register or enter scores.',
        'A notice while your school is moving students into a new year.',
      ],
      route: '/teacher/dashboard',
      routeLabel: 'Overview',
    },
    {
      id: 'classes',
      title: 'Classes, Subjects & Timetables',
      icon: 'BookOpen',
      intro: 'Where you teach, what you teach and when.',
      points: [
        'Classes & Streams: your classes with their students and capacity.',
        'Subjects: the school’s subject list (read-only).',
        'Timetables: your class timetables for the week (set by the principal).',
      ],
      route: '/academic/timetables',
      routeLabel: 'Timetables',
    },
    {
      id: 'assignments',
      title: 'Assignments',
      icon: 'FileText',
      intro: 'Set work and follow it up.',
      points: [
        'Create an assignment for one of your classes with a due date.',
        'See how many students have submitted and how many are graded, plus what’s overdue.',
        'You can create assignments offline on the app. They sync when you reconnect.',
      ],
      route: '/academic/assignments',
      routeLabel: 'Assignments',
    },
    {
      id: 'exams',
      title: 'Exam Timetable',
      icon: 'CalendarDays',
      intro: 'When and where each exam happens.',
      points: [
        'See the exam schedule for your classes, by term.',
        'The principal schedules exams; you can view them.',
      ],
      route: '/academic/exam-timetable',
      routeLabel: 'Exam Timetable',
    },
    {
      id: 'results',
      title: 'Results & Report Cards',
      icon: 'ClipboardList',
      intro: 'Enter scores and prepare report cards.',
      points: [
        'Enter Test 1 and Test 2 per subject. Mean, grade and position are automatic.',
        'Add affective and psychomotor ratings, conduct and a teacher’s comment.',
        'Preview report cards. Students and parents see them once the principal publishes.',
      ],
      route: '/academic/results',
      routeLabel: 'Results & Grades',
    },
    {
      id: 'students',
      title: 'Student Directory & Profiles',
      icon: 'Users',
      intro: 'Everything about the students you teach.',
      points: [
        'Directory: your students, with their class, for the year you pick.',
        'Profiles: one student’s details, results, attendance and conduct, filtered by year.',
        'You can see students you teach now, or taught in a past year.',
      ],
      route: '/students/profiles',
      routeLabel: 'Student Profiles',
    },
    {
      id: 'attendance',
      title: 'Attendance',
      icon: 'ClipboardCheck',
      intro: 'Registers, logs and at-risk students.',
      points: [
        'Class Register: pick class, date and session (morning, afternoon or full day), then tap P / L / A / E for each student.',
        'Attendance Logs: search, filter and correct a record for the current year.',
        'Analytics: attendance rates by class, and students below 75%.',
        'Parents are notified when their child is checked in or out.',
      ],
      route: '/students/attendance',
      routeLabel: 'Attendance',
    },
    {
      id: 'teacher-attendance',
      title: 'Teacher Attendance',
      icon: 'UserCheck',
      intro: 'Your own daily sign-in and sign-out.',
      points: [
        'Sign in as present or late when you arrive, and sign out when you leave.',
        'Add a comment for the principal (e.g. “Arrived late — clinic visit”).',
        'See your attendance rate and history for any year.',
      ],
      route: '/staff/attendance',
      routeLabel: 'Teacher Attendance',
    },
    {
      id: 'discipline',
      title: 'Discipline & Conduct',
      icon: 'ShieldCheck',
      intro: 'Record behaviour fairly and consistently.',
      points: [
        'Infractions: choose the type (e.g. tardiness, fighting); severity is set automatically.',
        'Behavioural notes: positive notes, concerns, observations and commendations.',
        'You can record for students currently in your classes. You see your own records.',
        'Mark a record confidential so only you and the principal see it.',
      ],
      route: '/discipline',
      routeLabel: 'Discipline & Conduct',
    },
    {
      id: 'announcements',
      title: 'Announcements',
      icon: 'Megaphone',
      intro: 'Reach your class quickly.',
      points: [
        'Post to one of this year’s classes, for students, parents or both.',
        'Mark it high priority, and optionally email it too.',
        'Edit or delete your own posts. Past years’ posts are read-only.',
      ],
      route: '/communication/announcements',
      routeLabel: 'Announcements',
    },
    {
      id: 'events',
      title: 'School Events & Calendar',
      icon: 'Calendar',
      intro: 'What’s happening at school.',
      points: [
        'School Events: browse published events, or create one (it’s a draft until the principal publishes).',
        'Calendar: month and agenda views of every published event.',
        'My Events: events you’ve registered for.',
      ],
      route: '/events/calendar',
      routeLabel: 'Calendar',
    },
    {
      id: 'account',
      title: 'Settings, Help & Support',
      icon: 'Settings',
      intro: 'Your account, your device and getting help.',
      points: [
        'My Profile: your name, email and password.',
        'Security: two-factor authentication and passkeys.',
        'Offline & Storage: see and clear what’s saved on this device. Un-synced work is always kept.',
        'Support: help articles, and a ticket to the WiSkul team if you’re stuck.',
      ],
      route: '/settings',
      routeLabel: 'Settings',
    },
  ],

  faqs: [
    {
      q: 'A class or student is missing from my pages.',
      a: 'You only see classes you’re assigned to teach or lead, for the year selected. Check the year picker shows the current year, then ask your principal to add the assignment.',
    },
    {
      q: 'Why can’t I edit last year’s attendance or conduct?',
      a: 'Past academic years are kept as read-only history so records can’t change after the year closes. New records always go into the current year.',
    },
    {
      q: 'My class looks empty right after the new year started.',
      a: 'Your principal is still moving students into this year’s classes. You’ll see a notice until it’s done, and the students appear as soon as they’re moved.',
    },
    {
      q: 'Do I need internet to take the register?',
      a: 'Not on the app. Marks taken offline are saved on your device and sync automatically. Keep the app open for a moment once you’re back online.',
    },
    {
      q: 'When do parents see results?',
      a: 'When the principal publishes report cards for the term. Until then your scores and comments are a draft that only staff can see.',
    },
    {
      q: 'I forgot my password.',
      a: 'Use “Forgot password” on the sign-in page, or ask your principal to reset it. Once you’re in, you can change it any time in Settings → My Profile.',
    },
  ],
};

const ACCOUNTANT: RoleGuide = {
  headline: 'Welcome — here’s how to run your school’s money on WiSkul',
  intro:
    'As bursar you bill fees, collect and receipt payments, follow up arrears, record what the school spends, run payroll and keep the books. Every money record posts to the accounts automatically, so the statements are always up to date. The principal sets the payment policy and approves the big decisions.',

  // ── First-login walkthrough (also "Replay walkthrough") ──
  steps: [
    {
      title: 'Start on your Overview',
      body: 'Billed, collected and outstanding for the year, cash received today and this month, what’s overdue, discounts waiting for approval, and money still owed from earlier years. Every finance page is one tap away from here.',
      route: '/accountant/dashboard',
      routeLabel: 'Open my Overview',
    },
    {
      title: 'Set up and bill the fees',
      body: 'In Fee Structures, set each class’s term tuition and one-off charges for the year, then Bill it. Saving a structure alone charges nobody; billing creates each student’s fees.',
      route: '/finance/fees',
      routeLabel: 'Fee Structures',
    },
    {
      title: 'Record payments and give receipts',
      body: 'In Record Payment, start typing a name, admission number, class or a parent’s phone and pick the student from the list. It takes cash, bank transfer, cheque or card and settles the oldest fees first. Every payment gets a numbered receipt (PDF, and emailed if the school turned that on). Online payments come in by themselves.',
      route: '/finance/payments',
      routeLabel: 'Payments & Receipts',
    },
    {
      title: 'Invoices and reminders',
      body: 'Generate invoices for a class, level or term with a due date, and send balance reminders to families who owe.',
      route: '/finance/invoices',
      routeLabel: 'Invoices',
    },
    {
      title: 'Follow up arrears and discounts',
      body: 'Arrears & Aging shows who owes and for how long. Discounts & Scholarships handles sibling, staff-child and scholarship discounts and one-off waivers. Big ones wait for the principal.',
      route: '/finance/aging',
      routeLabel: 'Arrears & Aging',
    },
    {
      title: 'Record what the school spends',
      body: 'Expenses for bills, supplies and repairs (with a photo of the receipt), Petty Cash for the small cash float, and a Budget per category that warns when spending goes over.',
      route: '/finance/expenses',
      routeLabel: 'Expenses',
    },
    {
      title: 'Run the monthly payroll',
      body: 'Set each staff member’s pay once. Each month start a pay run: PAYE and NASSIT are worked out, the principal approves it, you pay and mark it paid, and staff get their payslips.',
      route: '/finance/payroll',
      routeLabel: 'Payroll',
    },
    {
      title: 'The books keep themselves',
      body: 'Financial Statements gives the trial balance, income statement, balance sheet and cash flow for any year. Use the Journal only for what the system can’t know, like opening balances, bank charges or paying PAYE to the NRA.',
      route: '/finance/reports',
      routeLabel: 'Financial Statements',
    },
    {
      title: 'Check the bank statement',
      body: 'In Bank Reconciliation, import the bank or mobile-money statement (CSV), let Auto-match pair it with the books, and deal with whatever is left.',
      route: '/finance/bank-reconciliation',
      routeLabel: 'Bank Reconciliation',
    },
    {
      title: 'Secure your account',
      body: 'You handle the school’s money: use a strong password, turn on two-factor authentication and add a passkey. Settings also shows the school’s payment policy.',
      route: '/settings?tab=security',
      routeLabel: 'Open Security',
    },
  ],

  // ── Your finance rhythm ──
  setupTitle: 'Your finance rhythm',
  setupIntro: 'What a typical day, week, month and year looks like for the bursar.',
  setupOrder: [
    {
      order: 1,
      title: 'Every day',
      why: 'Families expect a receipt the same day, and cash on hand should match the books.',
      tasks: [
        { label: 'Record cash, bank and cheque payments', route: '/finance/payments', routeLabel: 'Payments' },
        { label: 'Record expenses and petty cash spends', route: '/finance/expenses', routeLabel: 'Expenses' },
        { label: 'Sign in on Staff Attendance (today only, before the cut-off)', route: '/staff/attendance', routeLabel: 'Staff Attendance' },
      ],
    },
    {
      order: 2,
      title: 'Every week',
      why: 'Arrears are easier to collect while they are young.',
      tasks: [
        { label: 'Check Arrears & Aging and send reminders', route: '/finance/aging', routeLabel: 'Arrears & Aging' },
        { label: 'Reconcile the bank and mobile-money statements', route: '/finance/bank-reconciliation', routeLabel: 'Bank Reconciliation' },
        { label: 'Top up petty cash if it’s low', route: '/finance/petty-cash', routeLabel: 'Petty Cash' },
      ],
    },
    {
      order: 3,
      title: 'Every month',
      why: 'Staff are paid on time and PAYE / NASSIT reach the NRA and NASSIT.',
      tasks: [
        { label: 'Start the pay run and send it for approval', route: '/finance/payroll', routeLabel: 'Payroll' },
        { label: 'Record PAYE / NASSIT paid over (journal template)', route: '/finance/journal', routeLabel: 'Journal' },
        { label: 'Review the income statement and budget', route: '/finance/reports', routeLabel: 'Statements' },
      ],
    },
    {
      order: 4,
      title: 'Each new year and term',
      why: 'Fees, invoices and the budget start fresh every academic year.',
      tasks: [
        { label: 'Set and bill the fee structures', route: '/finance/fees', routeLabel: 'Fee Structures' },
        { label: 'Generate invoices with due dates', route: '/finance/invoices', routeLabel: 'Invoices' },
        { label: 'Prepare the budget for the principal to approve', route: '/finance/budgets', routeLabel: 'Budget' },
      ],
    },
  ],

  keyRules: [
    {
      title: 'Money is never deleted',
      body: 'A wrong payment is refunded, an expense or petty cash entry is voided, an invoice is voided and a manual journal is reversed, always with a reason. The original stays on record and the Finance Audit Log shows who did what.',
    },
    {
      title: 'The principal decides the big things',
      body: 'The principal sets the payment policy (Settings shows it to you), approves discounts above your limit, budgets and pay runs, and closes the books for a finished period.',
    },
    {
      title: 'One year at a time',
      body: 'Pages open on the current academic year. Past years are read-only: no new fees, invoices or expenses go into a closed year. Money still owed from earlier years stays visible and can be collected.',
    },
    {
      title: 'The books post themselves',
      body: 'Every fee, payment, refund, discount, expense, petty cash movement and paid pay run is posted to the accounts automatically. Fees receivable, Student credit and Petty cash can only change through their own pages.',
    },
    {
      title: 'Online payments record themselves',
      body: 'When a family pays online (Monime), the payment, receipt and balance update on their own and you get a notification. To refund one, send the money back from your Monime dashboard, then press Refund on the payment here so the balance and the books match.',
    },
  ],

  sections: [
    {
      id: 'overview',
      title: 'Overview',
      icon: 'BarChart2',
      intro: 'The year’s money at a glance.',
      points: [
        'Billed, collected and outstanding for the selected year, from the fee records.',
        'Cash received today and this month, overdue charges, discounts and approvals waiting.',
        'Money still owed from earlier years, recent payments and links to every finance page.',
      ],
      route: '/accountant/dashboard',
      routeLabel: 'Overview',
    },
    {
      id: 'fees',
      title: 'Fee Structures',
      icon: 'Coins',
      intro: 'What each class pays this year.',
      points: [
        'Term tuition plus one-off year charges (uniform, exam levy…), billed in Term 1.',
        'A class can override the school’s payment policy (minimum payment, instalments, late fee).',
        'Bill to create the charges; unbill removes only unpaid, uninvoiced charges. A billed structure can’t be deleted.',
      ],
      route: '/finance/fees',
      routeLabel: 'Fee Structures',
    },
    {
      id: 'invoices',
      title: 'Invoices',
      icon: 'FileText',
      intro: 'Bills sent to families.',
      points: [
        'Generate invoices from outstanding fees for a class, level or term, with a due date.',
        'Open an invoice for its lines and payments; send reminders to defaulters.',
        'Void an unpaid invoice with a reason; its fees can be invoiced again.',
      ],
      route: '/finance/invoices',
      routeLabel: 'Invoices',
    },
    {
      id: 'payments',
      title: 'Payments & Receipts',
      icon: 'Receipt',
      intro: 'Every payment, online or recorded by you.',
      points: [
        'Record a payment (cash, bank transfer, cheque, card). It settles the oldest fees first, and a double click never records it twice.',
        'Paying more than is owed? Tick “keep the extra as account credit”.',
        'Numbered receipts (RCP-…), PDF and email; refund a recorded payment with a reason.',
        'Find a student by typing part of the name, admission number, class or a parent’s phone.',
        'Click a student’s name for their profile (class, parents’ phones and emails), statement, discounts, credit, instalment plan and receipts.',
      ],
      route: '/finance/payments',
      routeLabel: 'Payments & Receipts',
    },
    {
      id: 'aging',
      title: 'Arrears & Aging',
      icon: 'Timer',
      intro: 'Who owes, and for how long.',
      points: [
        'Not yet due, 1–30, 31–60, 61–90 and over 90 days, per student and class.',
        'Remind one family or everyone listed; export the list.',
        'Run the overdue check: marks fees overdue and adds late fees if the school turned them on.',
      ],
      route: '/finance/aging',
      routeLabel: 'Arrears & Aging',
    },
    {
      id: 'discounts',
      title: 'Discounts & Scholarships',
      icon: 'Percent',
      intro: 'Money taken off fees, never counted as collected.',
      points: [
        'Discount types: sibling, staff child, scholarship/bursary or custom; percent or fixed.',
        'Discounts above your limit wait for the principal (they are notified).',
        'Withdraw a waiting request, or revoke a discount you gave within your limit (the amount is owed again); only the principal revokes what they approved.',
      ],
      route: '/finance/discounts',
      routeLabel: 'Discounts',
    },
    {
      id: 'expenses',
      title: 'Expenses, Petty Cash & Budget',
      icon: 'Wallet',
      intro: 'What the school spends.',
      points: [
        'Expenses by category (pick “Other” to type your own), with vendor, method and a receipt photo.',
        'Petty cash funds: top up, record spends (they become expenses), return what’s left to the bank.',
        'A budget per category for the year; the principal approves it, and spending shows against it.',
      ],
      route: '/finance/expenses',
      routeLabel: 'Expenses',
    },
    {
      id: 'payroll',
      title: 'Payroll & Payslips',
      icon: 'Users',
      intro: 'Monthly salaries with PAYE and NASSIT.',
      points: [
        'Staff pay: basic salary, allowances, regular deductions and bank details for every staff member.',
        'Pay run: draft (add bonuses or one-off deductions) → the principal approves → you mark it paid.',
        'Payslip PDFs and emails; every staff member sees their own under My Payslips.',
      ],
      route: '/finance/payroll',
      routeLabel: 'Payroll',
    },
    {
      id: 'statements',
      title: 'Financial Statements',
      icon: 'Scale',
      intro: 'The reports a board or auditor asks for.',
      points: [
        'Trial balance, income statement, balance sheet, cash flow and general ledger.',
        'By academic year or by dates; export to CSV, Excel or PDF.',
        'A books check shows that everything balances and agrees with the fee and petty cash records.',
      ],
      route: '/finance/reports',
      routeLabel: 'Financial Statements',
    },
    {
      id: 'journal',
      title: 'Journal & Chart of Accounts',
      icon: 'BookOpen',
      intro: 'Every entry in the books.',
      points: [
        'Automatic entries from fees, payments, expenses and payroll, plus your manual journals.',
        'Templates for opening balances, cash banked, PAYE / NASSIT paid, bank charges and donations.',
        'The Chart of Accounts lists every account; add your own (a second bank account, equipment, a loan).',
      ],
      route: '/finance/journal',
      routeLabel: 'Journal',
    },
    {
      id: 'bank',
      title: 'Bank Reconciliation',
      icon: 'Landmark',
      intro: 'Make the bank statement and the books agree.',
      points: [
        'Import a CSV statement; lines already imported are skipped.',
        'Auto-match, match the rest by hand, or add a missing item (bank charges, interest) to the books.',
        'Enter the statement balance to see the difference reach zero.',
      ],
      route: '/finance/bank-reconciliation',
      routeLabel: 'Bank Reconciliation',
    },
    {
      id: 'audit',
      title: 'Finance Audit Log',
      icon: 'History',
      intro: 'Who changed what, and when.',
      points: [
        'Every change to fees, payments, discounts, expenses, payroll and the books.',
        'Filter by area, person, dates or text; expand a row to see what changed.',
      ],
      route: '/finance/audit-log',
      routeLabel: 'Audit Log',
    },
    {
      id: 'account',
      title: 'Announcements, Settings & Support',
      icon: 'Settings',
      intro: 'Talk to families and manage your account.',
      points: [
        'Post announcements to all, parents or students (school-wide), for example fee deadlines.',
        'Settings: your profile, password, two-factor and passkeys, and the school’s payment policy (read-only).',
        'Support: raise a ticket with the WiSkul team. My Payslips and Staff Attendance are here for you too.',
      ],
      route: '/settings',
      routeLabel: 'Settings',
    },
  ],

  faqs: [
    {
      q: 'A parent paid cash at the office. How do I record it?',
      a: 'Payments & Receipts → Record Payment. Find the student, choose what the payment is for, enter the amount and method. It settles the oldest fees first and gives a numbered receipt you can print or email.',
    },
    {
      q: 'How do I refund a payment made online (Monime)?',
      a: 'WiSkul can\'t send money back through Monime. Send the refund from your Monime dashboard first, then press Refund on that payment in Payments & Receipts with a reason, so the fee balance and the books match. If the family should keep the money as credit instead, give a credit note on their account.',
    },
    {
      q: 'I recorded a payment against the wrong student. What now?',
      a: 'Refund that payment with a reason (it puts the balance back on the fees), then record it again for the right student. Payments are never deleted, so the audit log shows both.',
    },
    {
      q: 'Why does my discount say “waiting for approval”?',
      a: 'It’s above the amount you can give alone (see Settings → Payment Policy). The principal is notified and approves or rejects it under Discounts & Scholarships.',
    },
    {
      q: 'Why can’t I change last year’s fee structure or add an expense to it?',
      a: 'Past academic years are read-only so the year’s figures can’t change after the fact. Money still owed from that year stays on the student and can still be collected.',
    },
    {
      q: 'How do I record PAYE and NASSIT paid to the NRA and NASSIT?',
      a: 'When a pay run is marked paid, what you owe them is recorded. When you pay it over, open the Journal → New journal → “PAYE / NASSIT paid over”, enter the amounts and post it.',
    },
    {
      q: 'I forgot to sign in yesterday. Can I do it now?',
      a: 'No. Staff Attendance lets you sign in for today only, until the school’s closing time. Ask the principal to record any other day.',
    },
    {
      q: 'The new year’s trial balance already shows money. Is that right?',
      a: 'Yes. Cash, bank and money still owed carry forward from earlier years; income and expenses start at zero each year. Last year’s result shows as “Accumulated surplus from earlier years”.',
    },
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
  intro:
    'Everything about your school year in one place: your classes and timetable, homework, exams, results, report cards, attendance and fees. Everything here is yours only, and it’s read-only. Your teachers and school office keep it up to date.',

  // ── First-login walkthrough (also "Replay walkthrough") ──
  steps: [
    {
      title: 'Start on your Overview',
      body: 'Your dashboard shows this year’s class, attendance, average grade, today’s classes and any fees due. Use the year picker at the top to look back at an earlier year.',
      route: '/student/dashboard',
      routeLabel: 'Open my Overview',
    },
    {
      title: 'Your timetable and subjects',
      body: 'Timetables shows your class’s week. Subjects lists what you study this year. Both change automatically when you move up a class.',
      route: '/academic/timetables',
      routeLabel: 'Timetables',
    },
    {
      title: 'Homework and assignments',
      body: 'Assignments lists the work your teachers set for your class, with instructions and due dates. Hand your work to your teacher; once they record it you’ll see “Handed in” or your mark here.',
      route: '/academic/assignments',
      routeLabel: 'Assignments',
    },
    {
      title: 'Exams',
      body: 'Exam Timetable shows when and where each subject’s exam is, per term.',
      route: '/academic/exam-timetable',
      routeLabel: 'Exam Timetable',
    },
    {
      title: 'Results and report cards',
      body: 'Results & Grades shows your Test 1, Test 2 and mean per subject, and where you rank in your class. Report Cards shows your full booklet. Both appear only after the school releases them for the term.',
      route: '/academic/results',
      routeLabel: 'Results & Grades',
    },
    {
      title: 'Attendance',
      body: 'Attendance shows every day you were marked present, late, excused or absent, and your attendance rate for the year.',
      route: '/students/attendance',
      routeLabel: 'Attendance',
    },
    {
      title: 'Fees and paying online',
      body: 'Fees & Payments shows what was billed, what’s paid and what’s still owed, per year and term. Money owed from an earlier year still has to be paid. You can pay online with the Pay button when your school has it switched on.',
      route: '/finance/my-fees',
      routeLabel: 'Fees & Payments',
    },
    {
      title: 'Secure your account',
      body: 'Change your password, turn on two-factor authentication and add a passkey for quick sign-in.',
      route: '/settings?tab=security',
      routeLabel: 'Open Security',
    },
  ],

  setupTitle: 'Your school year',
  setupIntro: 'What to check, and when.',
  setupOrder: [
    {
      order: 1,
      title: 'Every school day',
      why: 'Know where you need to be and what’s due.',
      tasks: [
        { label: 'Check today’s classes on your Overview', route: '/student/dashboard', routeLabel: 'Overview' },
        { label: 'See what homework is due', route: '/academic/assignments', routeLabel: 'Assignments' },
        { label: 'Read new announcements', route: '/communication/announcements', routeLabel: 'Announcements' },
      ],
    },
    {
      order: 2,
      title: 'Before and after exams',
      why: 'Plan your revision, then see how you did.',
      tasks: [
        { label: 'Check the exam timetable', route: '/academic/exam-timetable', routeLabel: 'Exam Timetable' },
        { label: 'View released results and your class position', route: '/academic/results', routeLabel: 'Results & Grades' },
        { label: 'Open or print your report card', route: '/academic/report-cards', routeLabel: 'Report Cards' },
      ],
    },
    {
      order: 3,
      title: 'Each term',
      why: 'Stay clear on fees and attendance.',
      tasks: [
        { label: 'Check and pay your fees', route: '/finance/my-fees', routeLabel: 'Fees & Payments' },
        { label: 'Check your attendance rate', route: '/students/attendance', routeLabel: 'Attendance' },
        { label: 'See upcoming school events', route: '/events/calendar', routeLabel: 'Calendar' },
      ],
    },
  ],

  keyRules: [
    {
      title: 'Only your own records',
      body: 'You only ever see your own results, attendance and fees, and your own class’s timetable, homework and exams.',
    },
    {
      title: 'One year at a time',
      body: 'Pages open on the current academic year. Pick an earlier year to see your old classes, results, attendance and report cards. When you’re promoted, your portal moves to your new class by itself.',
    },
    {
      title: 'Results appear when released',
      body: 'Teachers enter scores during the term, but you only see them after the school releases that term’s results. Unreleased scores are never shown.',
    },
    {
      title: 'Moving up a stage',
      body: 'Finishing Nursery 3, Class 6 or JSS 3 moves you up into Class 1, JSS 1 or SSS 1 at the same school. Finishing SSS 3 means you’ve graduated: your past years stay available to look back on.',
    },
  ],

  sections: [
    { id: 'overview', title: 'Overview', icon: 'GraduationCap', intro: 'Your year at a glance.', points: ['Your class (or classes, if you moved up mid-year).', 'Attendance rate, average grade and today’s classes.', 'Fees for the year, plus anything still owed from earlier years.'], route: '/student/dashboard', routeLabel: 'Overview' },
    { id: 'academics', title: 'Subjects, Timetable & Assignments', icon: 'BookOpen', intro: 'What you study and what’s due.', points: ['Subjects and the weekly timetable for your class.', 'Assignments with instructions, due dates and your own status or mark.', 'Overdue work is flagged; past years are history and never “overdue”.'], route: '/academic/assignments', routeLabel: 'Assignments' },
    { id: 'results', title: 'Exams, Results & Report Cards', icon: 'BarChart2', intro: 'How you’re doing.', points: ['Exam dates per term.', 'Test 1, Test 2, mean and subject rank once released.', 'Class ranking and your full report-card booklet, printable.'], route: '/academic/results', routeLabel: 'Results & Grades' },
    { id: 'attendance', title: 'Attendance', icon: 'ClipboardCheck', intro: 'Your record, day by day.', points: ['Present, late, excused and absent days for the year.', 'A warning if your attendance drops below 75%.'], route: '/students/attendance', routeLabel: 'Attendance' },
    { id: 'fees', title: 'Fees & Payments', icon: 'Wallet', intro: 'What’s billed, paid and owed.', points: ['Per year and per term, all in Leones (Le).', 'Pay online when your school has it switched on.'], route: '/finance/my-fees', routeLabel: 'Fees & Payments' },
    { id: 'news', title: 'Announcements & Events', icon: 'Calendar', intro: 'What’s happening at school.', points: ['Announcements for students and for your class.', 'Published school events, the calendar, and events you’ve registered for.'], route: '/communication/announcements', routeLabel: 'Announcements' },
    { id: 'account', title: 'Settings & Help', icon: 'Settings', intro: 'Your account and getting help.', points: ['Change your password; turn on two-factor sign-in or a passkey.', 'Support: help articles, or ask the school office.'], route: '/settings', routeLabel: 'Settings' },
  ],

  faqs: [
    { q: 'My results aren’t showing.', a: 'Results appear only after the school releases them for the term. If a term was released and you still see nothing, check the year picker shows the right year, then ask your class teacher.' },
    { q: 'My class or timetable looks wrong after the new year started.', a: 'The school may still be moving students into this year’s classes. You’ll see a notice until it’s done. Last year’s class is under last year in the year picker.' },
    { q: 'How do I hand in an assignment?', a: 'Give your work to your teacher as they ask. When they record it, the assignment shows “Handed in” and later your mark and feedback.' },
    { q: 'Why does it say I still owe fees from last year?', a: 'Unpaid fees from an earlier year don’t disappear in a new year. They’re shown separately so you know exactly which year they’re from, and you can pay them with the Pay button.' },
    { q: 'I forgot my password.', a: 'Use “Forgot password” on the sign-in page, or ask the school office to reset it. You can change it any time in Settings.' },
  ],
};

const PARENT: RoleGuide = {
  headline: 'Welcome — follow your children’s progress',
  intro:
    'Follow each of your children at school: their class and timetable, homework, exams, results, report cards, attendance and fees. You see only your own children, and everything is read-only. Teachers and the school office keep it up to date.',

  // ── First-login walkthrough (also "Replay walkthrough") ──
  steps: [
    {
      title: 'Start on your Overview',
      body: 'Your dashboard shows every child you’re linked to, with their class, attendance, average score and fees for the year. Tap a child to see their details. Use the year picker at the top to look back at an earlier year.',
      route: '/parent/dashboard',
      routeLabel: 'Open my Overview',
    },
    {
      title: 'One child at a time',
      body: 'If you have more than one child at the school, every page has a child switcher. Each child is shown in their own class, so siblings in different classes are never mixed.',
      route: '/parent/dashboard',
      routeLabel: 'Overview',
    },
    {
      title: 'Timetable, homework and exams',
      body: 'Timetables shows your child’s week, Assignments lists the homework their teachers set (with due dates and whether it was handed in), and Exam Timetable shows when each exam is.',
      route: '/academic/assignments',
      routeLabel: 'Assignments',
    },
    {
      title: 'Results and report cards',
      body: 'Results & Grades shows Test 1, Test 2 and the mean per subject, and where your child ranks in their class. Report Cards shows the full booklet to view or print. Both appear only after the school releases them for the term.',
      route: '/academic/results',
      routeLabel: 'Results & Grades',
    },
    {
      title: 'Attendance',
      body: 'Attendance shows when your child arrived and left school today, and their full record for the year: present, late, excused or absent.',
      route: '/students/attendance',
      routeLabel: 'Attendance',
    },
    {
      title: 'Fees and paying online',
      body: 'Fees & Payments shows what was billed, what’s paid and what’s still owed for each child, per year and term. Money owed from an earlier year still has to be paid. Pay online with the Pay button when your school has it switched on.',
      route: '/finance/my-fees',
      routeLabel: 'Fees & Payments',
    },
    {
      title: 'Secure your account',
      body: 'Change your password, turn on two-factor authentication and add a passkey for quick sign-in.',
      route: '/settings?tab=security',
      routeLabel: 'Open Security',
    },
  ],

  setupTitle: 'Staying involved',
  setupIntro: 'What to check, and when.',
  setupOrder: [
    {
      order: 1,
      title: 'Every school day',
      why: 'Know your child got to school, and what’s due.',
      tasks: [
        { label: 'See today’s arrival and departure', route: '/students/attendance', routeLabel: 'Attendance' },
        { label: 'Check homework due', route: '/academic/assignments', routeLabel: 'Assignments' },
        { label: 'Read new announcements', route: '/communication/announcements', routeLabel: 'Announcements' },
      ],
    },
    {
      order: 2,
      title: 'Around exams',
      why: 'Help them prepare, then see how they did.',
      tasks: [
        { label: 'Check the exam timetable', route: '/academic/exam-timetable', routeLabel: 'Exam Timetable' },
        { label: 'View released results and class position', route: '/academic/results', routeLabel: 'Results & Grades' },
        { label: 'Open or print the report card', route: '/academic/report-cards', routeLabel: 'Report Cards' },
      ],
    },
    {
      order: 3,
      title: 'Each term',
      why: 'Keep fees clear and know what’s coming up.',
      tasks: [
        { label: 'Check and pay fees for each child', route: '/finance/my-fees', routeLabel: 'Fees & Payments' },
        { label: 'See upcoming school events', route: '/events/calendar', routeLabel: 'Calendar' },
      ],
    },
  ],

  keyRules: [
    {
      title: 'Only your own children',
      body: 'You only ever see the children linked to your account, and only their own records. If a child is missing, ask the school office to link them.',
    },
    {
      title: 'Each child in their own class',
      body: 'Every page is for one child at a time. Brothers and sisters in different classes, or at different stages, each show their own timetable, homework, results and fees.',
    },
    {
      title: 'One year at a time',
      body: 'Pages open on the current academic year. Pick an earlier year to look back. When a child is promoted, their pages move to the new class by themselves, and last year stays available as history.',
    },
    {
      title: 'Moving up a stage',
      body: 'Finishing Nursery 3, Class 6 or JSS 3 moves a child up to Class 1, JSS 1 or SSS 1 at the same school. Finishing SSS 3 means they’ve graduated; their past years stay available.',
    },
    {
      title: 'Results appear when released',
      body: 'Teachers enter scores during the term, but you only see them after the school releases that term’s results.',
    },
  ],

  sections: [
    { id: 'overview', title: 'Overview', icon: 'Users', intro: 'All your children at a glance.', points: ['Each child’s class this year (both, if they moved up mid-year).', 'Attendance, average score and fees per child.', 'A clear notice for any fees still owed from earlier years.'], route: '/parent/dashboard', routeLabel: 'Overview' },
    { id: 'academics', title: 'Subjects, Timetable & Assignments', icon: 'BookOpen', intro: 'What your child studies and what’s due.', points: ['Subjects and the weekly timetable for their class.', 'Homework with due dates, whether it was handed in, and the mark.'], route: '/academic/assignments', routeLabel: 'Assignments' },
    { id: 'results', title: 'Exams, Results & Report Cards', icon: 'BarChart2', intro: 'How your child is doing.', points: ['Exam dates per term.', 'Released results, subject rank and class position.', 'The full report-card booklet, printable.'], route: '/academic/results', routeLabel: 'Results & Grades' },
    { id: 'attendance', title: 'Attendance', icon: 'ClipboardCheck', intro: 'Arrival, departure and the full record.', points: ['Today’s check-in and check-out times.', 'Present, late, excused and absent days for the year.'], route: '/students/attendance', routeLabel: 'Attendance' },
    { id: 'fees', title: 'Fees & Payments', icon: 'Wallet', intro: 'Billed, paid and owed, per child.', points: ['Per year and term, in Leones (Le).', 'Total owed across all your children.', 'Pay online when your school has it switched on.'], route: '/finance/my-fees', routeLabel: 'Fees & Payments' },
    { id: 'news', title: 'Announcements & Events', icon: 'Calendar', intro: 'What’s happening at school.', points: ['Announcements for parents and for your child’s class.', 'Published school events and the calendar.'], route: '/communication/announcements', routeLabel: 'Announcements' },
    { id: 'account', title: 'Settings & Help', icon: 'Settings', intro: 'Your account and getting help.', points: ['Change your password; turn on two-factor sign-in or a passkey.', 'Support: help articles, or contact the school office.'], route: '/settings', routeLabel: 'Settings' },
  ],

  faqs: [
    { q: 'One of my children is missing.', a: 'Each child has to be linked to your account by the school. Ask the school office to link them; they appear on your next visit.' },
    { q: 'My child moved up a class. Where is last year?', a: 'Their pages move to the new class automatically. Pick last year in the year picker to see the old class, results, attendance and fees.' },
    { q: 'Why can’t I see this term’s results yet?', a: 'Results appear only after the school releases them for the term. Until then they’re a draft that only teachers and the principal can see.' },
    { q: 'Why does it say I still owe fees from last year?', a: 'Unpaid fees from an earlier year don’t disappear in a new year. They’re shown separately, named by child and year, and you can pay them with the Pay button.' },
    { q: 'I forgot my password.', a: 'Use “Forgot password” on the sign-in page, or ask the school office to reset it. You can change it any time in Settings.' },
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

/**
 * The guide for a role. A teacher who also holds the Bursar and/or Admissions
 * duty gets those guides' sections, rules and questions added after their own.
 */
export function getRoleGuide(role?: UserRole, duties?: ReadonlyArray<string> | null): RoleGuide {
  const base = (role && GUIDES[role]) || PRINCIPAL;
  if (role !== 'teacher' || !Array.isArray(duties) || duties.length === 0) return base;
  const extras = ([['accountant', ACCOUNTANT, 'Bursar'], ['admissions_officer', ADMISSIONS, 'Admissions']] as const)
    .filter(([d]) => duties.includes(d));
  if (extras.length === 0) return base;
  const jobs = extras.map(([, , label]) => label).join(' and ');
  return {
    ...base,
    headline: `${base.headline} (and your ${jobs} work)`,
    intro: `${base.intro} You also hold the ${jobs} duty, so those parts of the guide are below your teaching sections.`,
    sections: [
      ...base.sections,
      ...extras.flatMap(([d, g, label]) => g.sections.map((s) => ({ ...s, id: `${d}-${s.id}`, title: `${label}: ${s.title}` }))),
    ],
    keyRules: [...(base.keyRules || []), ...extras.flatMap(([, g]) => g.keyRules || [])],
    faqs: [...(base.faqs || []), ...extras.flatMap(([, g]) => g.faqs || [])],
  };
}
