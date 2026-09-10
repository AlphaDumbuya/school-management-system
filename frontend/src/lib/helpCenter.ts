/**
 * Help Center content model.
 *
 * The Support area is a two-level help center:
 *   - /support               → a directory of module TOPICS (cards) + search + tickets
 *   - /support/:topicId       → a descriptive "how to operate" guide for one module
 *
 * Content is authored here as structured data so pages stay declarative. Rich
 * text supports INLINE LINKS: author a paragraph as an array of segments, where
 * a segment can be plain text or a link token `{ text, to }`. This lets a
 * sentence mention a feature and turn the phrase itself into a link — e.g.
 * "to see the list of actions, [click here](/students/directory)".
 */
import type { UserRole } from '@appTypes/index';

/** A single inline segment: plain string, or a link with visible text + route. */
export type RichSegment = string | { text: string; to: string };
/** A rich paragraph is a sequence of segments rendered inline. */
export type RichText = RichSegment[];

export interface HelpStep {
  /** Short imperative title, e.g. "Mark a class register". */
  title: string;
  /** Body paragraphs; each supports inline links. */
  body: RichText[];
  /** Optional primary link shown as a button under the step. */
  action?: { label: string; to: string };
}

export interface HelpArticle {
  id: string;
  heading: string;
  intro: RichText;
  steps: HelpStep[];
  /** Optional tips/notes shown as a callout. */
  tips?: RichText[];
}

export interface HelpModule {
  id: string;
  title: string;
  /** lucide icon name, resolved on the page. */
  icon: string;
  /** One-line summary shown on the directory card. */
  summary: string;
  /** Longer lead paragraph shown at the top of the module page. */
  intro: RichText;
  /** Roles that should see this module. */
  roles: UserRole[];
  /** Primary route this module manages (the "Open" link). */
  route?: string;
  routeLabel?: string;
  /** Descriptive how-to articles. */
  articles: HelpArticle[];
}

// Helper to keep authoring terse.
const link = (text: string, to: string) => ({ text, to });

// ── Modules ──────────────────────────────────────────────────────────────────

const SETTINGS: HelpModule = {
  id: 'settings',
  title: 'School Settings',
  icon: 'Settings',
  summary: 'Configure your school foundation — info, academic year, ID format, grading, finance and communications.',
  roles: ['principal', 'super_admin'],
  route: '/settings',
  routeLabel: 'Open Settings',
  intro: [
    'Settings is the control centre for your school. The values here appear on every ID card, report card, invoice and email, so complete them before enrolling people. Open ',
    link('School Settings', '/settings'),
    ' to begin.',
  ],
  articles: [
    {
      id: 'foundation',
      heading: 'Set up your school foundation',
      intro: ['These one-time configurations underpin everything else. Do them in order.'],
      steps: [
        {
          title: 'Complete School Info',
          body: [[
            'Add your school name, logo, contact details and address in ',
            link('School Info', '/settings?tab=school'),
            '. This branding is used across ID cards, report cards, invoices and every email your school sends.',
          ]],
          action: { label: 'School Info', to: '/settings?tab=school' },
        },
        {
          title: 'Set the academic year & terms',
          body: [[
            'Define your academic year and term dates in ',
            link('Academic Config', '/settings?tab=academic'),
            '. Timetables, results and report cards all depend on these dates.',
          ]],
          action: { label: 'Academic Config', to: '/settings?tab=academic' },
        },
        {
          title: 'Choose your ID number format',
          body: [[
            'In ',
            link('ID Format', '/settings?tab=id-format'),
            ', set the prefix, year and padding for student, staff and admission numbers. Set this before enrolling people so numbers stay consistent.',
          ]],
          action: { label: 'ID Format', to: '/settings?tab=id-format' },
        },
        {
          title: 'Confirm the grading scale',
          body: [[
            'Review grade bands and the pass mark in ',
            link('Grading Scale', '/settings?tab=grading'),
            '. These drive results and report cards.',
          ]],
          action: { label: 'Grading Scale', to: '/settings?tab=grading' },
        },
        {
          title: 'Set finance & communication defaults',
          body: [[
            'Pick your currency, accepted payment methods and late-fee rules in ',
            link('Financial Info', '/settings?tab=financial'),
            ', then set your sender identity in ',
            link('Communications', '/settings?tab=comms'),
            '.',
          ]],
        },
      ],
      tips: [[
        'Secure your account: turn on two-factor authentication in ',
        link('Security', '/settings?tab=security'),
        '.',
      ]],
    },
  ],
};

const PEOPLE: HelpModule = {
  id: 'students',
  title: 'Students & Enrolment',
  icon: 'Users',
  summary: 'Enrol students, manage profiles and process admissions applications.',
  roles: ['principal', 'super_admin', 'teacher', 'admissions_officer'],
  route: '/students/directory',
  routeLabel: 'Student Directory',
  intro: [
    'Manage every student from enquiry to enrolment. Start in the ',
    link('Student Directory', '/students/directory'),
    ' to add students, or review applicants in ',
    link('Admissions', '/students/admissions'),
    '.',
  ],
  articles: [
    {
      id: 'enrol',
      heading: 'Enrol and manage students',
      intro: [
        'Students belong to classes, so make sure a class exists first — create one in ',
        link('Classes', '/academic/classes'),
        '.',
      ],
      steps: [
        {
          title: 'Add a student',
          body: [[
            'Open the ',
            link('Student Directory', '/students/directory'),
            ' and use the add action to enrol a student into a class. Their ID number is generated from your configured ID format.',
          ]],
          action: { label: 'Student Directory', to: '/students/directory' },
        },
        {
          title: 'View and edit profiles',
          body: [[
            'See detailed records, guardians and history in ',
            link('Student Profiles', '/students/profiles'),
            '.',
          ]],
          action: { label: 'Student Profiles', to: '/students/profiles' },
        },
        {
          title: 'Search quickly',
          body: [[
            'Search by full name (either order) or ID number. Results are ordered by ID so you can scan a class in sequence.',
          ]],
        },
      ],
    },
    {
      id: 'admissions',
      heading: 'Process admissions',
      intro: ['Move applicants through the pipeline to enrolment.'],
      steps: [
        {
          title: 'Review applications',
          body: [[
            'Open ',
            link('Admissions', '/students/admissions'),
            ' to see applications grouped by stage: new, under review, approved and enrolled.',
          ]],
          action: { label: 'Admissions', to: '/students/admissions' },
        },
        {
          title: 'Approve or reject',
          body: [[
            'Update an application\'s status to record a decision. Applicants are emailed automatically with the outcome.',
          ]],
        },
      ],
    },
  ],
};

const ATTENDANCE: HelpModule = {
  id: 'attendance',
  title: 'Attendance',
  icon: 'ClipboardCheck',
  summary: 'Mark daily registers, review logs and spot at-risk students early.',
  roles: ['principal', 'super_admin', 'teacher', 'parent', 'student'],
  route: '/students/attendance',
  routeLabel: 'Open Attendance',
  intro: [
    'Track daily attendance per class. Open ',
    link('Attendance', '/students/attendance'),
    ' to mark a register or review trends.',
  ],
  articles: [
    {
      id: 'mark',
      heading: 'Mark and review attendance',
      intro: ['Registers save instantly and work offline — they sync when you reconnect.'],
      steps: [
        {
          title: 'Mark a class register',
          body: [[
            'In ',
            link('Attendance', '/students/attendance'),
            ', pick the class and set each student present, late or absent. The tiles are colour-coded so the register is easy to scan.',
          ]],
          action: { label: 'Attendance', to: '/students/attendance' },
        },
        {
          title: 'Review logs & at-risk students',
          body: [[
            'Use the logs and analytics view to review past attendance. Students crossing your warning/critical thresholds are flagged automatically — thresholds are set in ',
            link('Attendance Rules', '/settings?tab=attendance'),
            '.',
          ]],
        },
      ],
    },
  ],
};

const ACADEMICS: HelpModule = {
  id: 'academics',
  title: 'Academics & Results',
  icon: 'GraduationCap',
  summary: 'Classes, subjects, timetables, results and report cards.',
  roles: ['principal', 'super_admin', 'teacher', 'student', 'parent'],
  route: '/academic/results',
  routeLabel: 'Results & Grades',
  intro: [
    'Run the full academic cycle — from building ',
    link('Classes', '/academic/classes'),
    ' and ',
    link('Subjects', '/academic/subjects'),
    ' to publishing ',
    link('Report Cards', '/academic/report-cards'),
    '.',
  ],
  articles: [
    {
      id: 'structure',
      heading: 'Build classes, subjects & timetables',
      intro: ['Set up the structure students and lessons hang off.'],
      steps: [
        {
          title: 'Create classes',
          body: [['Add your classes and streams in ', link('Classes', '/academic/classes'), '.']],
          action: { label: 'Classes', to: '/academic/classes' },
        },
        {
          title: 'Add subjects',
          body: [['Define the subjects taught in ', link('Subjects', '/academic/subjects'), '.']],
          action: { label: 'Subjects', to: '/academic/subjects' },
        },
        {
          title: 'Build timetables',
          body: [['Lay out the weekly schedule per class in ', link('Timetables', '/academic/timetables'), '.']],
          action: { label: 'Timetables', to: '/academic/timetables' },
        },
      ],
    },
    {
      id: 'results',
      heading: 'Enter results & publish report cards',
      intro: ['Record scores and ratings, then generate report cards.'],
      steps: [
        {
          title: 'Enter scores & ratings',
          body: [[
            'In ',
            link('Results & Grades', '/academic/results'),
            ', record Test 1 and Test 2 cognitive scores plus affective and psychomotor ratings for each student.',
          ]],
          action: { label: 'Results', to: '/academic/results' },
        },
        {
          title: 'Publish report cards',
          body: [[
            'Once grades are in, generate and publish report cards from ',
            link('Report Cards', '/academic/report-cards'),
            '.',
          ]],
          action: { label: 'Report Cards', to: '/academic/report-cards' },
        },
        {
          title: 'Promote students',
          body: [[
            'At year end, move students to the next class in ',
            link('Promotions', '/academic/promotions'),
            '.',
          ]],
        },
      ],
    },
  ],
};

const FINANCE: HelpModule = {
  id: 'finance',
  title: 'Fees & Payments',
  icon: 'Wallet',
  summary: 'Fee structures, invoices, payments and receipts.',
  roles: ['principal', 'super_admin', 'accountant'],
  route: '/finance/invoices',
  routeLabel: 'Invoices',
  intro: [
    'Collect and reconcile school fees. Define what to charge in ',
    link('Fees', '/finance/fees'),
    ', bill students in ',
    link('Invoices', '/finance/invoices'),
    ', and reconcile money received in ',
    link('Payments', '/finance/payments'),
    '.',
  ],
  articles: [
    {
      id: 'billing',
      heading: 'Bill and collect fees',
      intro: ['Set up fee structures, then invoice and record payments.'],
      steps: [
        {
          title: 'Define fee structures',
          body: [['Create the fees you charge (tuition, levies, etc.) in ', link('Fees', '/finance/fees'), '.']],
          action: { label: 'Fees', to: '/finance/fees' },
        },
        {
          title: 'Issue invoices',
          body: [[
            'Bill a student or a whole class in ',
            link('Invoices', '/finance/invoices'),
            '. Balances update as payments are recorded.',
          ]],
          action: { label: 'Invoices', to: '/finance/invoices' },
        },
        {
          title: 'Record payments & receipts',
          body: [[
            'In ',
            link('Payments', '/finance/payments'),
            ', record part- or full payments across mobile money, card, bank transfer and wallets, and generate receipts.',
          ]],
          action: { label: 'Payments', to: '/finance/payments' },
        },
      ],
    },
  ],
};

const IDENTITY: HelpModule = {
  id: 'identity',
  title: 'ID Cards & Verification',
  icon: 'CreditCard',
  summary: 'Design templates, issue QR ID cards and verify any card.',
  roles: ['principal', 'super_admin', 'admissions_officer'],
  route: '/identity/cards',
  routeLabel: 'ID Cards',
  intro: [
    'Issue verified digital ID cards with QR codes. Design the look in ',
    link('Templates', '/identity/templates'),
    ', generate cards in ',
    link('ID Cards', '/identity/cards'),
    ', and check any card in the ',
    link('QR Verifier', '/verify-id'),
    '.',
  ],
  articles: [
    {
      id: 'issue',
      heading: 'Design and issue ID cards',
      intro: ['Create a template once, then generate cards for individuals or in bulk.'],
      steps: [
        {
          title: 'Design a card template',
          body: [[
            'Build your card layout, colours and fields in ',
            link('Templates', '/identity/templates'),
            '.',
          ]],
          action: { label: 'Templates', to: '/identity/templates' },
        },
        {
          title: 'Generate cards',
          body: [[
            'In ',
            link('ID Cards', '/identity/cards'),
            ', generate a single card or bulk-generate for a class or the whole school. Pick a member from the picker and choose PVC or badge format.',
          ]],
          action: { label: 'ID Cards', to: '/identity/cards' },
        },
        {
          title: 'Verify a card',
          body: [[
            'Anyone can confirm a card is genuine using the ',
            link('QR Verifier', '/verify-id'),
            ' — scan the QR or type its value. Verification is scoped to your school\'s cards and shows the holder\'s name, role, class and photo.',
          ]],
          action: { label: 'QR Verifier', to: '/verify-id' },
        },
      ],
    },
  ],
};

const EVENTS: HelpModule = {
  id: 'events',
  title: 'Events & Calendar',
  icon: 'CalendarDays',
  summary: 'Create school events, manage RSVPs and view the calendar.',
  roles: ['principal', 'super_admin', 'teacher', 'parent', 'student'],
  route: '/events/school',
  routeLabel: 'School Events',
  intro: [
    'Plan and share school events. Browse everything in ',
    link('School Events', '/events/school'),
    ', see dates in the ',
    link('Calendar', '/events/calendar'),
    ', and track what you\'re attending in ',
    link('My Events', '/events/my-events'),
    '.',
  ],
  articles: [
    {
      id: 'manage',
      heading: 'Create and manage events',
      intro: ['Publish events and keep the community informed.'],
      steps: [
        {
          title: 'Create an event',
          body: [[
            'In ',
            link('School Events', '/events/school'),
            ', add an event with its date, venue and description. It appears on the ',
            link('Calendar', '/events/calendar'),
            ' for everyone who can see it.',
          ]],
          action: { label: 'School Events', to: '/events/school' },
        },
        {
          title: 'Track attendance & RSVPs',
          body: [[
            'People manage what they\'re attending in ',
            link('My Events', '/events/my-events'),
            '. Admins can review turnout in ',
            link('Event Analytics', '/events/analytics'),
            '.',
          ]],
        },
      ],
    },
  ],
};

const COMMUNICATION: HelpModule = {
  id: 'communication',
  title: 'Announcements',
  icon: 'Megaphone',
  summary: 'Broadcast news and updates to parents, staff and students.',
  roles: ['principal', 'super_admin', 'teacher', 'parent', 'student', 'accountant', 'admissions_officer'],
  route: '/communication/announcements',
  routeLabel: 'Announcements',
  intro: [
    'Keep everyone informed. Post updates in ',
    link('Announcements', '/communication/announcements'),
    ' and choose who sees them.',
  ],
  articles: [
    {
      id: 'post',
      heading: 'Post an announcement',
      intro: ['Reach the right audience with a targeted message.'],
      steps: [
        {
          title: 'Write and publish',
          body: [[
            'Open ',
            link('Announcements', '/communication/announcements'),
            ', compose your message and choose the audience (e.g. all parents, a class, or staff). Recipients see it in-app and, where enabled, by email.',
          ]],
          action: { label: 'Announcements', to: '/communication/announcements' },
        },
      ],
    },
  ],
};

const TEACHING: HelpModule = {
  id: 'teaching',
  title: 'Teaching Tools',
  icon: 'BookOpen',
  summary: 'Your classes, timetable, attendance and assignments in one place.',
  roles: ['teacher'],
  route: '/teacher/dashboard',
  routeLabel: 'My Dashboard',
  intro: [
    'Everything for your classes is a click away. Start at your ',
    link('Dashboard', '/teacher/dashboard'),
    ' for today\'s schedule.',
  ],
  articles: [
    {
      id: 'daily',
      heading: 'Run your day',
      intro: ['A typical teaching day in the app.'],
      steps: [
        {
          title: 'Check today\'s classes',
          body: [['Your ', link('Dashboard', '/teacher/dashboard'), ' shows your assigned classes and today\'s ', link('Timetable', '/academic/timetables'), '.']],
          action: { label: 'My Dashboard', to: '/teacher/dashboard' },
        },
        {
          title: 'Mark attendance',
          body: [['Take the register for your class in ', link('Attendance', '/students/attendance'), ' — it saves instantly, even offline.']],
          action: { label: 'Attendance', to: '/students/attendance' },
        },
        {
          title: 'Set assignments & enter results',
          body: [[
            'Manage coursework in ',
            link('Assignments', '/academic/assignments'),
            ', and record scores in ',
            link('Results', '/academic/results'),
            '.',
          ]],
        },
      ],
    },
  ],
};

const PLATFORM: HelpModule = {
  id: 'platform',
  title: 'Platform Console',
  icon: 'Building',
  summary: 'Oversee every school (tenant), subscriptions and platform analytics.',
  roles: ['super_admin'],
  route: '/platform/tenants',
  routeLabel: 'Manage Tenants',
  intro: [
    'Run the whole platform. Manage schools in ',
    link('Tenants', '/platform/tenants'),
    ', billing in ',
    link('Subscriptions', '/platform/subscriptions'),
    ', and triage help requests in ',
    link('Support', '/platform/support'),
    '.',
  ],
  articles: [
    {
      id: 'operate',
      heading: 'Operate the platform',
      intro: ['Provision schools and keep the platform healthy.'],
      steps: [
        {
          title: 'Manage tenants',
          body: [['Create, review, suspend or restore school workspaces in ', link('Tenants', '/platform/tenants'), '.']],
          action: { label: 'Tenants', to: '/platform/tenants' },
        },
        {
          title: 'Monitor & communicate',
          body: [[
            'Watch platform health in ',
            link('Analytics', '/platform/analytics'),
            ' and broadcast to schools from ',
            link('Communications', '/platform/communications'),
            '.',
          ]],
        },
      ],
    },
  ],
};

const ACCOUNT: HelpModule = {
  id: 'account',
  title: 'Account & Security',
  icon: 'ShieldCheck',
  summary: 'Profile, verification, two-factor authentication and login help.',
  roles: ['principal', 'super_admin', 'teacher', 'student', 'parent', 'accountant', 'admissions_officer'],
  route: '/settings?tab=security',
  routeLabel: 'Security',
  intro: [
    'Keep your account safe and your profile up to date. Manage security in ',
    link('Settings → Security', '/settings?tab=security'),
    '.',
  ],
  articles: [
    {
      id: 'secure',
      heading: 'Secure your account',
      intro: ['A few minutes here protects your school\'s data.'],
      steps: [
        {
          title: 'Enable two-factor authentication',
          body: [['Turn on 2FA in ', link('Security', '/settings?tab=security'), ' using an authenticator app.']],
          action: { label: 'Security', to: '/settings?tab=security' },
        },
        {
          title: 'Add a profile photo & get verified',
          body: [[
            'Upload a photo on your verification page. Once verified, a badge appears next to your name across the app.',
          ]],
        },
        {
          title: 'Forgot your password?',
          body: [[
            'Sign out and use the "Forgot password" link on the login screen — a secure reset link is emailed to you.',
          ]],
        },
      ],
    },
  ],
};

export const HELP_MODULES: HelpModule[] = [
  SETTINGS,
  PEOPLE,
  ACADEMICS,
  ATTENDANCE,
  FINANCE,
  IDENTITY,
  EVENTS,
  COMMUNICATION,
  TEACHING,
  PLATFORM,
  ACCOUNT,
];

/** Modules visible to a given role. */
export function getModulesForRole(role?: UserRole): HelpModule[] {
  if (!role) return HELP_MODULES.filter((m) => m.id === 'account');
  return HELP_MODULES.filter((m) => m.roles.includes(role));
}

export function getModule(id?: string): HelpModule | undefined {
  return HELP_MODULES.find((m) => m.id === id);
}

/** Flatten a RichText to a plain string (for search matching). */
export function richToPlain(rt: RichText): string {
  return rt.map((s) => (typeof s === 'string' ? s : s.text)).join('');
}
