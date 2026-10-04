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
