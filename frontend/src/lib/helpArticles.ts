/**
 * Help Center content — collections and articles.
 *
 * All copy describes ONLY features that are live in v1. Rich text segments can
 * be plain strings or `{ text, to }` link tokens. Author terse, factual steps.
 *
 * Types live in helpCenter.ts; this module is pure data to keep it readable.
 */
import type { HelpArticle, HelpCollection } from './helpCenter';

const link = (text: string, to: string) => ({ text, to });
const SUPPORT_EMAIL = 'support@wiskulsl.com';

// ── Collections (topic groups) ───────────────────────────────────────────────

export const HELP_COLLECTIONS: HelpCollection[] = [
  { id: 'getting-started', title: 'Getting started', icon: 'Rocket', description: 'Set up your school, learn the basics, and get productive fast.' },
  { id: 'academic-year', title: 'Academic year', icon: 'CalendarClock', description: 'How the year works, past-year history, and starting a new year.' },
  { id: 'settings', title: 'School settings', icon: 'Settings', description: 'Configure every tab: school info, academic config, IDs, grading, finance and more.' },
  { id: 'students', title: 'Students & admissions', icon: 'Users', description: 'Enrol students, manage profiles and logins, and process applications.' },
  { id: 'academics', title: 'Academics & results', icon: 'GraduationCap', description: 'Classes, subjects, timetables, results, report cards and promotions.' },
  { id: 'attendance', title: 'Attendance & conduct', icon: 'ClipboardCheck', description: 'Mark registers, review trends, and manage discipline records.' },
  { id: 'finance', title: 'Fees & payments', icon: 'Wallet', description: 'Fee structures, invoices, collecting payments and online payment.' },
  { id: 'identity', title: 'ID cards', icon: 'CreditCard', description: 'Design templates, issue QR ID cards, and verify any card.' },
  { id: 'events', title: 'Events & announcements', icon: 'CalendarDays', description: 'School events, the calendar, and broadcasting announcements.' },
  { id: 'reports', title: 'Reports & archive', icon: 'BarChart2', description: 'The academic archive and per-student history across years.' },
  { id: 'account', title: 'Account & security', icon: 'ShieldCheck', description: 'Your profile, password, two-factor authentication and passkeys.' },
  { id: 'mobile', title: 'Mobile app & offline', icon: 'Smartphone', description: 'Using the app, offline attendance, and keeping it up to date.' },
  { id: 'billing', title: 'Plan & billing', icon: 'Receipt', description: 'Plans, limits, upgrading, and how in-app payment works.' },
  { id: 'platform', title: 'Platform console', icon: 'Building', description: 'For platform admins: tenants, subscriptions and support triage.' },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: 'Wrench', description: 'Fix common problems with login, sync, payments and email.' },
];

// Shorthand builders keep the data terse.
const p = (text: any[]) => ({ type: 'p' as const, text });
const steps = (items: { title: string; body: any[][]; action?: { label: string; to: string } }[]) => ({ type: 'steps' as const, items });
const list = (items: any[][]) => ({ type: 'list' as const, items });
const tip = (text: any[], title?: string) => ({ type: 'callout' as const, tone: 'tip' as const, title, text });
const note = (text: any[], title?: string) => ({ type: 'callout' as const, tone: 'note' as const, title, text });
const warn = (text: any[], title?: string) => ({ type: 'callout' as const, tone: 'warning' as const, title, text });

const ALL_STAFF: any[] = ['principal', 'super_admin', 'teacher', 'accountant', 'admissions_officer'];

export const HELP_ARTICLES: HelpArticle[] = [
  // ══════════════════ GETTING STARTED ══════════════════
  {
    id: 'welcome',
    collection: 'getting-started',
    title: 'Welcome to WiSkul',
    summary: 'What WiSkul does and how to find your way around.',
    roles: [...ALL_STAFF, 'student', 'parent'],
    popular: true,
    keywords: ['overview', 'introduction', 'navigation', 'sidebar', 'dashboard'],
    sections: [
      {
        id: 'what',
        heading: 'What WiSkul is',
        blocks: [
          p(['WiSkul is a complete school management system: enrolment, classes, attendance, results and report cards, fees and online payments, ID cards, events and announcements — all in one place, in Sierra Leonean Leones.']),
          p(['What you see depends on your role. Principals and platform admins configure the school; teachers run their classes; accountants handle fees; admissions officers process applicants; students and parents see their own records.']),
        ],
      },
      {
        id: 'navigate',
        heading: 'Finding your way around',
        blocks: [
          list([
            ['The left sidebar groups everything by area (Academic, Students, Finance, and so on). Tap a group to expand it.'],
            ['Your ', link('Dashboard', '/dashboard'), ' is the home screen for your role.'],
            ['The ', link('Platform Guide', '/guide'), ' gives a role-aware walkthrough you can replay any time.'],
            ['This Help Center has step-by-step articles and a search box at the top.'],
          ]),
          tip(['New to the school? Principals should start with ', link('Set up your school', '/support/getting-started/first-setup'), '.']),
        ],
      },
    ],
    related: ['first-setup', 'account-security'],
  },
  {
    id: 'first-setup',
    collection: 'getting-started',
    title: 'Set up your school (principals)',
    summary: 'The one-time setup, in the right order, before you enrol anyone.',
    roles: ['principal', 'super_admin'],
    popular: true,
    route: '/settings',
    routeLabel: 'Open Settings',
    keywords: ['onboarding', 'first steps', 'configure', 'new school', 'roadmap'],
    sections: [
      {
        id: 'order',
        heading: 'Do these in order',
        blocks: [
          p(['Each step builds on the previous one, so the sequence matters. The values you set here appear on every ID card, report card, invoice and email.']),
          steps([
            { title: 'Complete School Info', body: [['Add your name, logo, contact details and address in ', link('School Info', '/settings?tab=school'), '. This branding is used everywhere.']], action: { label: 'School Info', to: '/settings?tab=school' } },
            { title: 'Set the academic year & terms', body: [['Choose 2 or 3 terms and set each term\'s start/end dates in ', link('Academic Config', '/settings?tab=academic'), '. Attendance, results and report cards depend on these dates.']], action: { label: 'Academic Config', to: '/settings?tab=academic' } },
            { title: 'Choose your ID number format', body: [['Set prefixes and numbering in ', link('ID Format', '/settings?tab=id-format'), ' before enrolling people, so numbers stay consistent.']], action: { label: 'ID Format', to: '/settings?tab=id-format' } },
            { title: 'Confirm grading & results', body: [['Review grade scales in ', link('Grading & Results', '/settings?tab=grading'), '.']], action: { label: 'Grading & Results', to: '/settings?tab=grading' } },
            { title: 'Set your finance policy', body: [['Set minimum payments and instalment rules in ', link('Financial Info', '/settings?tab=financial'), '. You can override these per class later.']], action: { label: 'Financial Info', to: '/settings?tab=financial' } },
            { title: 'Build classes, then enrol students', body: [['Create ', link('Classes', '/academic/classes'), ' and ', link('Subjects', '/academic/subjects'), ', then add students in the ', link('Student Directory', '/students/directory'), '.']] },
          ]),
          tip(['The ', link('Platform Guide', '/guide'), ' shows this as a numbered roadmap with "Required" steps flagged.']),
        ],
      },
      {
        id: 'secure',
        heading: 'Secure your account',
        blocks: [p(['Before you finish, turn on two-factor authentication in ', link('Security', '/settings?tab=security'), '. See ', link('Protect your account', '/support/account/account-security'), '.'])],
      },
    ],
    related: ['school-info', 'academic-config', 'id-format', 'account-security'],
  },
  {
    id: 'roles-explained',
    collection: 'getting-started',
    title: 'Roles and what each can do',
    summary: 'The user roles in WiSkul and the access each has.',
    roles: [...ALL_STAFF],
    keywords: ['permissions', 'access', 'principal', 'teacher', 'accountant', 'admissions', 'parent', 'student', 'guardian'],
    sections: [
      {
        id: 'roles',
        heading: 'The roles',
        blocks: [
          { type: 'table', head: ['Role', 'Can do'], rows: [
            [['Principal'], ['Full access to the school: settings, people, academics, finance, reports.']],
            [['Teacher'], ['Their assigned classes: attendance, results, assignments, behavioural notes.']],
            [['Accountant'], ['Fees, invoices, payments and expenses.']],
            [['Admissions officer'], ['Admissions pipeline, student records and ID cards.']],
            [['Parent / Guardian'], ['Their children: results, fees, attendance, events, announcements.']],
            [['Student'], ['Their own results, timetable, fees, assignments and events.']],
            [['Platform admin'], ['The whole platform across every school (see Platform console).']],
          ] },
        ],
      },
    ],
    related: ['welcome'],
  },

  // ══════════════════ ACADEMIC YEAR ══════════════════
  {
    id: 'how-the-year-works',
    collection: 'academic-year',
    title: 'How the academic year works',
    summary: 'The current year opens by default; past years are read-only history.',
    roles: [...ALL_STAFF, 'student', 'parent'],
    popular: true,
    keywords: ['year filter', 'past year', 'history', 'read only', 'all years', 'session'],
    sections: [
      {
        id: 'year-filter',
        heading: 'The year filter',
        blocks: [
          p(['Most pages have an Academic Year selector in the top bar. It opens on your school\'s current (active) year, so by default you always see today\'s data.']),
          list([
            ['Pick a past year to view it as history. A banner reminds you that you\'re viewing a past year.'],
            ['Where offered, choose "All years" to see everything at once.'],
          ]),
        ],
      },
      {
        id: 'read-only',
        heading: 'Past years are read-only',
        blocks: [
          p(['Past years are a record of what happened, so editing is switched off there. On a past year you can view and print, but Edit, Delete and status actions are hidden on Classes, Assignments, Students, Discipline, ID Cards and more.']),
          note(['Results are the one exception: you can still enter or correct scores for a past year (with a warning banner), because late corrections and promotions sometimes depend on last year\'s results.']),
          p(['Finance is handled sensibly too: you can\'t raise new invoices in a past year, but outstanding arrears can still be reminded and paid.']),
        ],
      },
    ],
    related: ['start-new-year', 'academic-config'],
  },
  {
    id: 'start-new-year',
    collection: 'academic-year',
    title: 'Start a new academic year',
    summary: 'Move the whole school into the next year without deleting anything.',
    roles: ['principal', 'super_admin'],
    popular: true,
    route: '/settings?tab=academic',
    routeLabel: 'Academic Config',
    keywords: ['rollover', 'new year', 'promote', 'archive', 'carry forward', 'next year'],
    sections: [
      {
        id: 'how',
        heading: 'How to start a new year',
        blocks: [
          steps([
            { title: 'Open Academic Config', body: [['Go to ', link('Settings → Academic Config', '/settings?tab=academic'), ' and find the amber "Start a New Academic Year" panel.']] },
            { title: 'Start the new year', body: [['Choose Start New Academic Year, enter the new year as YYYY/YYYY, and confirm with Start New Year.']] },
            { title: 'Set the new term dates', body: [['Update the term start/end dates for the new year and Save Academic Config.']] },
          ]),
        ],
      },
      {
        id: 'carries',
        heading: 'What carries forward',
        blocks: [
          p(['Starting a new year is non-destructive — nothing is deleted. Last year is archived as history.']),
          list([
            ['Classes, subjects, teacher assignments and the timetable are copied into the new year.'],
            ['Every active student moves into their class for the new year. Students you already promoted land in their new class.'],
          ]),
          warn(['Fee structures start fresh each year — they are NOT copied. Set up this year\'s fees in ', link('Fee Structures', '/finance/fees'), '. This is intentional, so last year\'s amounts never bill by mistake.']),
          tip(['You can still promote from last year\'s results afterwards in ', link('Promotions', '/academic/promotions'), '. There\'s also a "Bring last year into this year" option if you need to pull last year\'s setup across again.']),
        ],
      },
    ],
    related: ['how-the-year-works', 'promotions', 'fee-structures'],
  },

  // ══════════════════ SETTINGS ══════════════════
  {
    id: 'settings-overview',
    collection: 'settings',
    title: 'Settings overview',
    summary: 'What each settings tab does and who can see it.',
    roles: ['principal', 'super_admin', 'teacher'],
    route: '/settings',
    routeLabel: 'Open Settings',
    keywords: ['tabs', 'configuration', 'preferences'],
    sections: [
      {
        id: 'tabs',
        heading: 'The tabs',
        blocks: [
          p(['Everyone has My Profile and Security. Teachers also get Offline & Storage. The rest are for principals and platform admins.']),
          { type: 'table', head: ['Tab', 'What it controls'], rows: [
            [[link('My Profile', '/settings?tab=profile')], ['Your name, email, password, language and date format.']],
            [[link('Security', '/settings?tab=security')], ['Two-factor authentication and passkeys.']],
            [['Offline & Storage'], ['Teachers: manage cached data for offline use.']],
            [[link('School Info', '/settings?tab=school')], ['Name, logo, contacts, address, accreditation.']],
            [[link('Academic Config', '/settings?tab=academic')], ['Terms, term dates and starting a new year.']],
            [[link('ID Format', '/settings?tab=id-format')], ['Prefixes and numbering for student/staff/admission IDs.']],
            [[link('Grading & Results', '/settings?tab=grading')], ['Grade scales and publishing results.']],
            [[link('Attendance Rules', '/settings?tab=attendance')], ['Warning/critical thresholds and the late cutoff.']],
            [[link('Report Card', '/settings?tab=report-card')], ['Report card borders, watermark and display options.']],
            [[link('Financial Info', '/settings?tab=financial')], ['School payment policy (minimums, instalments).']],
            [[link('Payments', '/settings?tab=payments')], ['Connect your school\'s Monime account for online fees.']],
            [[link('Plan & Billing', '/settings?tab=billing')], ['Your subscription plan and limits.']],
            [[link('File Storage', '/settings?tab=storage')], ['Where uploads are stored.']],
          ] },
          note(['Saving a settings tab never changes your academic year. The year only moves when you use Start New Academic Year.']),
        ],
      },
    ],
    related: ['school-info', 'academic-config', 'id-format', 'financial-settings', 'payments-setup'],
  },
  {
    id: 'school-info',
    collection: 'settings',
    title: 'School Info',
    summary: 'Your school identity, contacts and address — used across the app.',
    roles: ['principal', 'super_admin'],
    route: '/settings?tab=school',
    routeLabel: 'School Info',
    keywords: ['logo', 'motto', 'emis', 'accreditation', 'address', 'branding'],
    sections: [
      {
        id: 'fields',
        heading: 'What to fill in',
        blocks: [
          list([
            ['Identity: school name, short name/code, founded year, motto, registration/accreditation number and EMIS code.'],
            ['Contact: general email, phone, website, and the principal\'s name and email.'],
            ['Address: physical address, city, province, postal code and country.'],
            ['Logo: upload your crest — it appears on ID cards, report cards and invoices.'],
          ]),
          tip(['Complete this before issuing any ID cards or report cards so the branding is correct from the start.']),
        ],
      },
    ],
    related: ['first-setup', 'id-cards-issue'],
  },
  {
    id: 'academic-config',
    collection: 'settings',
    title: 'Academic Config',
    summary: 'Set your terms and term dates; see the current year.',
    roles: ['principal', 'super_admin'],
    route: '/settings?tab=academic',
    routeLabel: 'Academic Config',
    keywords: ['terms', 'semester', 'term dates', 'current year'],
    sections: [
      {
        id: 'config',
        heading: 'Terms and dates',
        blocks: [
          list([
            ['The Current Academic Year is shown read-only with an "Active" badge. It only changes via Start New Academic Year.'],
            ['Choose 2 Terms (Semesters) or 3 Terms (Standard).'],
            ['Set each term\'s Start and End date. Term 3 appears only when you pick 3 terms.'],
          ]),
          p(['Save with Save Academic Config. Accurate dates matter — attendance windows, results and report cards all key off them.']),
        ],
      },
    ],
    related: ['start-new-year', 'how-the-year-works'],
  },
  {
    id: 'id-format',
    collection: 'settings',
    title: 'ID Format',
    summary: 'Design the ID numbers for students, staff and admissions.',
    roles: ['principal', 'super_admin'],
    route: '/settings?tab=id-format',
    routeLabel: 'ID Format',
    keywords: ['prefix', 'numbering', 'student id', 'admission number', 'counter'],
    sections: [
      {
        id: 'build',
        heading: 'Build your format',
        blocks: [
          list([
            ['Set prefixes — Student (default STU), Staff/Teacher (TCH) and Admission (ADM).'],
            ['Pick a separator (-, _, . or none) and whether to include the year (full, short or none).'],
            ['Choose counter digits (3–6). A live preview shows each ID type.'],
            ['Optionally continue from an existing numbering system by entering your last-used number.'],
          ]),
          warn(['Set this before enrolling people. New IDs use this format; existing IDs are never changed.']),
        ],
      },
    ],
    related: ['first-setup', 'students-add'],
  },
  {
    id: 'financial-settings',
    collection: 'settings',
    title: 'Financial Info & payment policy',
    summary: 'School-wide rules for minimum payments and instalments.',
    roles: ['principal', 'super_admin', 'accountant'],
    route: '/settings?tab=financial',
    routeLabel: 'Financial Info',
    keywords: ['minimum payment', 'instalment', 'part payment', 'policy', 'leones', 'currency'],
    sections: [
      {
        id: 'policy',
        heading: 'The payment policy',
        blocks: [
          p(['Currency is fixed to Sierra Leonean Leones (Le) across the system. The policy here applies to every class by default and is enforced automatically whenever a fee is paid — online or recorded manually.']),
          list([
            ['Minimum payment for new students (%) and for continuing students (%).'],
            ['Minimum per-term clearance (%).'],
            ['Late-fee surcharge (%) — informational.'],
            ['Allow instalments (part payments). When off, families must pay the full balance in one go.'],
            ['Charges compulsory first — a part payment clears non-tuition charges before tuition.'],
          ]),
          tip(['Any class can override these on its own fee structure in ', link('Fee Structures', '/finance/fees'), '.']),
        ],
      },
    ],
    related: ['fee-structures', 'payments-record', 'payments-setup'],
  },
  {
    id: 'payments-setup',
    collection: 'settings',
    title: 'Connect Monime for online payments',
    summary: 'Link your school\'s Monime account so fees settle to you.',
    roles: ['principal', 'super_admin', 'accountant'],
    route: '/settings?tab=payments',
    routeLabel: 'Payments settings',
    keywords: ['monime', 'online payment', 'space id', 'token', 'mobile money'],
    sections: [
      {
        id: 'connect',
        heading: 'Connect your account',
        blocks: [
          steps([
            { title: 'Open Payments settings', body: [['Go to ', link('Settings → Payments', '/settings?tab=payments'), '.']] },
            { title: 'Enter your Monime details', body: [['Paste your Monime Space ID and access token, then save.']] },
          ]),
          note(['Once connected, online fee payments settle directly into your school\'s own Monime account. Set this up as part of your finance configuration so parents can pay online from day one.']),
        ],
      },
    ],
    related: ['financial-settings', 'my-fees', 'payments-record'],
  },
  {
    id: 'report-card-settings',
    collection: 'settings',
    title: 'Report Card appearance',
    summary: 'Borders, watermark, photo and display options for report cards.',
    roles: ['principal', 'super_admin'],
    route: '/settings?tab=report-card',
    routeLabel: 'Report Card settings',
    keywords: ['report card', 'border', 'watermark', 'template'],
    sections: [
      { id: 'style', heading: 'Styling', blocks: [p(['Choose border styles, an optional watermark, whether to show the student photo, and other display options. A live preview shows the effect before you save.'])] },
    ],
    related: ['report-cards', 'grading-publish'],
  },
  {
    id: 'grading-publish',
    collection: 'settings',
    title: 'Grading & publishing results',
    summary: 'Set grade scales and release results to students and parents.',
    roles: ['principal', 'super_admin'],
    route: '/settings?tab=grading',
    routeLabel: 'Grading & Results',
    keywords: ['grade scale', 'publish', 'release results', 'pass mark'],
    sections: [
      {
        id: 'scales',
        heading: 'Grade scales and release',
        blocks: [
          p(['Add grade scales — letter grades (A–F), percentages (0–100) or numeric points. If none are configured, standard scales apply.']),
          note(['Students and parents only see a report card once its results are published here. Staff can preview drafts before release.']),
        ],
      },
    ],
    related: ['results-enter', 'report-cards'],
  },

  // ══════════════════ STUDENTS ══════════════════
  {
    id: 'students-add',
    collection: 'students',
    title: 'Enrol and manage students',
    summary: 'Add students to a class, edit profiles, import and export.',
    roles: ['principal', 'super_admin', 'teacher', 'admissions_officer'],
    popular: true,
    route: '/students/directory',
    routeLabel: 'Student Directory',
    keywords: ['add student', 'enrol', 'csv import', 'export', 'directory', 'move class'],
    sections: [
      {
        id: 'add',
        heading: 'Add a student',
        blocks: [
          p(['A student joins a class, so create the class first in ', link('Classes', '/academic/classes'), '.']),
          steps([
            { title: 'Open the directory', body: [['Go to the ', link('Student Directory', '/students/directory'), '. Switch between Grid and List view with the toggle.']] },
            { title: 'Add the student', body: [['Use Add Student, fill in the details and pick a class. The ID number is generated from your ID format.']] },
            { title: 'Edit or move later', body: [['Edit a student any time. Changing their class moves their enrolment within the current year.']] },
          ]),
        ],
      },
      {
        id: 'import',
        heading: 'Import and export',
        blocks: [
          list([
            ['Import a class from a spreadsheet with Import — download the template, fill it in and upload the CSV.'],
            ['Export the whole directory to Excel, CSV or PDF with Export.'],
          ]),
          note(['Imports accept .csv files only (up to 2000 rows). Save your spreadsheet as CSV first.']),
          tip(['Search by full name (either order) or ID number. Results are ordered by ID so you can scan a class in sequence.']),
        ],
      },
    ],
    related: ['student-logins', 'admissions', 'id-format'],
  },
  {
    id: 'student-logins',
    collection: 'students',
    title: 'Student & parent portal logins',
    summary: 'Find and reset the student and parent login credentials.',
    roles: ['principal', 'super_admin', 'admissions_officer'],
    route: '/students/profiles',
    routeLabel: 'Student Profiles',
    keywords: ['password', 'login', 'credentials', 'reset password', 'parent account', 'portal'],
    sections: [
      {
        id: 'creds',
        heading: 'Portal credentials card',
        blocks: [
          p(['Open a student in ', link('Student Profiles', '/students/profiles'), ' to see the Portal Login Credentials card for both the student and the parent.']),
          list([
            ['Passwords are hidden by default — use Show / Hide to reveal them.'],
            ['Students sign in with their student ID number as the username; parents sign in with their email.'],
            ['Reset to a fresh demo password with the reset action, then use Show to read the new one.'],
            ['Provision or link a parent account with "Provision / Link Parent Account". Siblings reuse the same parent.'],
          ]),
          note(['Once a user sets their own password, the card shows "Uses their own password" and a reset is needed to issue a new demo password.']),
        ],
      },
    ],
    related: ['students-add', 'account-security', 'login-help'],
  },
  {
    id: 'admissions-online',
    collection: 'students',
    title: 'Online applications',
    summary: 'Share the application link, and what families see and get.',
    roles: ['principal', 'super_admin', 'admissions_officer'],
    route: '/students/admissions',
    routeLabel: 'Admissions',
    keywords: ['apply online', 'application link', 'share', 'families', 'duplicate', 'spam'],
    sections: [
      {
        id: 'share',
        heading: 'Share the link',
        blocks: [
          p(['On ', link('Admissions', '/students/admissions'), ', copy or share the Online admission link (also in Settings → Admissions & IDs). Use Preview to see the form families get.']),
          list([
            ['Families need no account. They fill in the child, parent, medical and emergency details for this year\'s classes.'],
            ['They get an application number on screen and by email; you get a notification and the application arrives as New.'],
            ['The same child sent twice (same name, birthday and phone) keeps the first application. A family can send up to 5 applications a day.'],
          ]),
          note(['If the school turns on the security check (Cloudflare Turnstile), families tick it before sending.']),
        ],
      },
    ],
    related: ['admissions', 'students-add'],
  },
  {
    id: 'admissions',
    collection: 'students',
    title: 'Process admissions',
    summary: 'Move applicants through the pipeline to enrolment.',
    roles: ['principal', 'super_admin', 'admissions_officer'],
    route: '/students/admissions',
    routeLabel: 'Admissions',
    keywords: ['applications', 'applicants', 'approve', 'reject', 'apply link', 'enrol'],
    sections: [
      {
        id: 'pipeline',
        heading: 'The applications pipeline',
        blocks: [
          p(['Open ', link('Admissions', '/students/admissions'), ' to track applicants from application to enrolment, grouped by stage, for one intake year.']),
          list([
            ['Share your public application link so families can apply online. Each new one arrives as New and admissions staff are notified.'],
            ['Open an application: Start review, Schedule interview (the family is emailed the time and place), then Approve, Waitlist or Reject (a reason is required).'],
            ['Tick the documents handed in, add staff notes, and see every step on the Timeline.'],
            ['Mark withdrawn when the family no longer wants the place. Rejected, withdrawn and approved applications can be reopened.'],
          ]),
          note(['Each decision email is sent once. Withdrawals and notes are never emailed.']),
        ],
      },
      {
        id: 'enrol',
        heading: 'Enrolling an approved child',
        blocks: [
          p(['Approving does not create a student. Press ', link('Enrol', '/students/admissions?status=approved'), ' and choose a class of the current year (places left are shown).']),
          list([
            ['WiSkul creates the student number in the school’s ID format, enrols them, links the parent (siblings share one parent account) and creates student and parent sign-ins.'],
            ['The sign-ins are shown once; they are also on the Student Profile.'],
            ['Enrol can’t create the same student twice, and a class from last year can’t be used.'],
            ['Walk-ins: on + New Application, tick “Accept and enrol now”.'],
          ]),
          note(['Admissions needs an internet connection — it shows a "requires internet" state when offline.']),
        ],
      },
    ],
    related: ['students-add'],
  },

  // ══════════════════ ACADEMICS ══════════════════
  {
    id: 'classes-subjects',
    collection: 'academics',
    title: 'Classes, subjects & timetables',
    summary: 'Build the structure your students and lessons hang off.',
    roles: ['principal', 'super_admin', 'teacher'],
    popular: true,
    route: '/academic/classes',
    routeLabel: 'Classes',
    keywords: ['class', 'stream', 'subject', 'timetable', 'exam timetable', 'period'],
    sections: [
      {
        id: 'build',
        heading: 'Set up the structure',
        blocks: [
          steps([
            { title: 'Create classes and streams', body: [['Add classes (and streams/capacity) in ', link('Classes & Streams', '/academic/classes'), '.']], action: { label: 'Classes', to: '/academic/classes' } },
            { title: 'Add subjects', body: [['Define the subjects taught, with credits, in ', link('Subjects', '/academic/subjects'), '.']], action: { label: 'Subjects', to: '/academic/subjects' } },
            { title: 'Build the weekly timetable', body: [['Lay out periods per class in ', link('Timetables', '/academic/timetables'), ' with Add period.']], action: { label: 'Timetables', to: '/academic/timetables' } },
            { title: 'Schedule exams', body: [['Set exam days per class and term in ', link('Exam Timetable', '/academic/exam-timetable'), '.']], action: { label: 'Exam Timetable', to: '/academic/exam-timetable' } },
          ]),
          note(['The timetable copies forward when you start a new year; fee structures do not.']),
        ],
      },
    ],
    related: ['results-enter', 'assignments', 'start-new-year'],
  },
  {
    id: 'assignments',
    collection: 'academics',
    title: 'Assignments',
    summary: 'Set coursework for a class and track it.',
    roles: ['principal', 'super_admin', 'teacher', 'student', 'parent'],
    route: '/academic/assignments',
    routeLabel: 'Assignments',
    keywords: ['homework', 'coursework', 'due date'],
    sections: [
      {
        id: 'use',
        heading: 'Create and view',
        blocks: [
          p(['In ', link('Assignments', '/academic/assignments'), ', teachers create assignments for their classes and subjects with a due date. Students and parents see the assignments for their class.']),
          note(['Teachers can only edit assignments they created. On a past year, assignments are read-only.']),
        ],
      },
    ],
    related: ['classes-subjects', 'results-enter'],
  },
  {
    id: 'results-enter',
    collection: 'academics',
    title: 'Enter results & ratings',
    summary: 'Record Test 1 and Test 2 scores plus affective ratings.',
    roles: ['principal', 'super_admin', 'teacher'],
    popular: true,
    route: '/academic/results',
    routeLabel: 'Results & Grades',
    keywords: ['grades', 'scores', 'test 1', 'test 2', 'ratings', 'affective', 'psychomotor'],
    sections: [
      {
        id: 'enter',
        heading: 'Record scores',
        blocks: [
          steps([
            { title: 'Pick the class, subject and term', body: [['Open ', link('Results & Grades', '/academic/results'), ' and choose what you\'re marking.']] },
            { title: 'Enter Test 1 and Test 2', body: [['Type each student\'s scores. Means and ranks are calculated for you.']] },
            { title: 'Add ratings', body: [['Use the Ratings dialog to record affective and psychomotor ratings. The dialog opens pre-filled with any ratings already saved, so you never lose existing ones.']] },
          ]),
          note(['Entering scores for a past year is allowed, with a warning banner, so you can make late corrections.']),
        ],
      },
      {
        id: 'publish',
        heading: 'Publishing',
        blocks: [p(['Students and parents see results only once published — see ', link('Grading & publishing results', '/support/settings/grading-publish'), '.'])],
      },
    ],
    related: ['report-cards', 'grading-publish', 'how-the-year-works'],
  },
  {
    id: 'report-cards',
    collection: 'academics',
    title: 'Report cards',
    summary: 'Generate, publish, print and verify report cards.',
    roles: ['principal', 'super_admin', 'teacher', 'student', 'parent'],
    popular: true,
    route: '/academic/report-cards',
    routeLabel: 'Report Cards',
    keywords: ['report card', 'pdf', 'print', 'booklet', 'qr', 'publish'],
    sections: [
      {
        id: 'generate',
        heading: 'Generate and share',
        blocks: [
          list([
            ['Choose a class, student and year in ', link('Report Cards', '/academic/report-cards'), '.'],
            ['Download a single PDF, the whole class, or print directly.'],
            ['At year-end, the full-year report booklet becomes available.'],
            ['Printed cards carry a QR code anyone can scan to verify the card is genuine.'],
          ]),
          note(['Parents and students see a card only after its results are published in Grading & Results.']),
        ],
      },
    ],
    related: ['results-enter', 'grading-publish', 'report-card-settings'],
  },
  {
    id: 'promotions',
    collection: 'academics',
    title: 'Promote students',
    summary: 'Move a class up at year-end based on their results.',
    roles: ['principal', 'super_admin'],
    route: '/academic/promotions',
    routeLabel: 'Promotions',
    keywords: ['promote', 'repeat', 'graduate', 'year end'],
    sections: [
      {
        id: 'promote',
        heading: 'Run promotions',
        blocks: [
          p(['In ', link('Promotions', '/academic/promotions'), ', pick a class and year, set each student\'s outcome (Promote, Promote on effort, Repeat or Graduate) and their target class, then run the promotion.']),
          tip(['Promote from last year\'s results after you\'ve started the new year — see ', link('Start a new academic year', '/support/academic-year/start-new-year'), '.']),
        ],
      },
    ],
    related: ['start-new-year', 'results-enter'],
  },

  // ══════════════════ ATTENDANCE & CONDUCT ══════════════════
  {
    id: 'attendance-mark',
    collection: 'attendance',
    title: 'Mark & review attendance',
    summary: 'Take the daily register and spot at-risk students.',
    roles: ['principal', 'super_admin', 'teacher'],
    popular: true,
    route: '/students/attendance',
    routeLabel: 'Attendance',
    keywords: ['register', 'present', 'absent', 'late', 'excused', 'offline'],
    sections: [
      {
        id: 'mark',
        heading: 'Take the register',
        blocks: [
          p(['In ', link('Attendance', '/students/attendance'), ', pick the class and mark each student Present, Absent, Late or Excused. The tiles are colour-coded for quick scanning.']),
          tip(['Registers save instantly and work offline — they sync when you reconnect.']),
        ],
      },
      {
        id: 'review',
        heading: 'Review trends',
        blocks: [p(['Use the analytics view to review history. Students crossing your warning/critical thresholds are flagged automatically — set those in ', link('Attendance Rules', '/settings?tab=attendance'), '.'])],
      },
    ],
    related: ['discipline', 'offline-use'],
  },
  {
    id: 'discipline',
    collection: 'attendance',
    title: 'Discipline & conduct',
    summary: 'Record infractions, actions, notes, appeals and conduct reports.',
    roles: ['principal', 'super_admin', 'teacher'],
    route: '/discipline',
    routeLabel: 'Discipline',
    keywords: ['behaviour', 'infraction', 'conduct', 'appeal', 'note', 'sanction'],
    sections: [
      {
        id: 'tabs',
        heading: 'The tabs',
        blocks: [
          list([
            ['Infractions — log incidents and assign an action.'],
            ['Actions — track sanctions and cancel them if needed.'],
            ['Appeals — review and decide on appeals (principal/super admin).'],
            ['Notes — behavioural notes teachers can add and edit.'],
            ['Conduct Reports — generate and share conduct summaries.'],
          ]),
          note(['On a past year, discipline records are read-only.']),
        ],
      },
    ],
    related: ['attendance-mark'],
  },

  {
    id: 'staff-sign-in',
    collection: 'attendance',
    title: 'Staff sign-in and sign-out',
    summary: 'Record your own arrival and departure each school day.',
    roles: ['teacher', 'accountant', 'admissions_officer'],
    popular: true,
    route: '/staff/attendance',
    routeLabel: 'Staff Attendance',
    keywords: ['sign in', 'sign out', 'staff attendance', 'late', 'arrival', 'clock in'],
    sections: [
      {
        id: 'how',
        heading: 'Each day',
        blocks: [
          steps([
            { title: 'Sign in when you arrive', body: [['Open ', link('Staff Attendance', '/staff/attendance'), ' and tap Sign in as present (or late), with an optional comment.']] },
            { title: 'Sign out when you leave', body: [['Tap Sign out for today. Your times appear in your history.']] },
          ]),
          note(['You can only sign in for today, until the school’s closing time (set by the principal, 18:00 by default). For a day you missed, or after the cut-off, ask the principal to record it.']),
          note(['If the principal already recorded you as absent or excused today, only they can change it.']),
        ],
      },
    ],
    related: ['account-security'],
  },

  // ══════════════════ FINANCE ══════════════════
  {
    id: 'bursar-start',
    collection: 'finance',
    title: 'Start here: the bursar’s workspace',
    summary: 'What each finance page is for, and the order to work in.',
    roles: ['principal', 'super_admin', 'accountant'],
    popular: true,
    route: '/accountant/dashboard',
    routeLabel: 'Finance Overview',
    keywords: ['bursar', 'accountant', 'finance', 'overview', 'start', 'dashboard'],
    sections: [
      {
        id: 'order',
        heading: 'The usual order',
        blocks: [
          steps([
            { title: 'Set and bill the fees', body: [['Each new year, set every class’s fees in ', link('Fee Structures', '/finance/fees'), ' and Bill them. Saving alone charges nobody.']] },
            { title: 'Collect and receipt', body: [['Record office payments in ', link('Payments & Receipts', '/finance/payments'), '. Online payments record themselves.']] },
            { title: 'Follow up', body: [['Use ', link('Arrears & Aging', '/finance/aging'), ' and invoices to remind families who owe.']] },
            { title: 'Record spending and pay staff', body: [[link('Expenses', '/finance/expenses'), ', ', link('Petty Cash', '/finance/petty-cash'), ', ', link('Budget', '/finance/budgets'), ' and monthly ', link('Payroll', '/finance/payroll'), '.']] },
            { title: 'Check the books', body: [[link('Financial Statements', '/finance/reports'), ' and ', link('Bank Reconciliation', '/finance/bank-reconciliation'), '. The books post themselves from everything above.']] },
          ]),
          tip(['The ', link('Platform Guide', '/guide'), ' has a day / week / month routine for the bursar and a walkthrough you can replay.']),
        ],
      },
      {
        id: 'rules',
        heading: 'Rules that apply everywhere',
        blocks: [
          list([
            ['Money is never deleted: payments are refunded, expenses and invoices voided, journals reversed, always with a reason.'],
            ['The principal sets the payment policy (you can read it in ', link('Settings → Payment Policy', '/settings?tab=policy'), ') and approves large discounts, budgets and pay runs.'],
            ['Past academic years are read-only, but money still owed from them can be collected.'],
            ['Every change is in the ', link('Finance Audit Log', '/finance/audit-log'), '.'],
          ]),
        ],
      },
    ],
    related: ['payments-record', 'discounts', 'accounting'],
  },
  {
    id: 'fee-structures',
    collection: 'finance',
    title: 'Fee structures and billing',
    summary: 'Set what each class pays this year, then bill it.',
    roles: ['principal', 'super_admin', 'accountant'],
    popular: true,
    route: '/finance/fees',
    routeLabel: 'Fee Structures',
    keywords: ['fees', 'tuition', 'charges', 'levy', 'bill', 'unbill', 'structure'],
    sections: [
      {
        id: 'build',
        heading: 'Set up and bill',
        blocks: [
          steps([
            { title: 'Pick the class', body: [['In ', link('Fee Structures', '/finance/fees'), ', choose a class for the year.']] },
            { title: 'Enter the fees', body: [['Tuition per term, plus one-off year charges (uniform, exam levy, ID card…), which are billed in Term 1. A class can override the school payment policy here.']] },
            { title: 'Bill', body: [['Bill a term or the whole year. This creates each student’s charges. Approved discounts and scholarships come off automatically.']] },
          ]),
          warn(['Fee structures start fresh each academic year. Set them up again after the school starts a new year.']),
          note(['Unbill removes only charges with no payment and not on an invoice; any discount on them is taken back and re-applied if you bill again. A billed structure can’t be deleted.']),
        ],
      },
    ],
    related: ['invoices', 'discounts', 'financial-settings'],
  },
  {
    id: 'invoices',
    collection: 'finance',
    title: 'Invoices and reminders',
    summary: 'Bill families, remind defaulters, void mistakes.',
    roles: ['principal', 'super_admin', 'accountant'],
    route: '/finance/invoices',
    routeLabel: 'Invoices',
    keywords: ['invoice', 'bill', 'reminder', 'defaulter', 'generate', 'void'],
    sections: [
      {
        id: 'use',
        heading: 'Bill and remind',
        blocks: [
          list([
            ['Generate Invoices: for a class, level or term, with a due date, from the fees still owed.'],
            ['Open an invoice to see its lines and payments; families can pay it online.'],
            ['Send reminders to one family or to every defaulter; the button disables while sending.'],
            ['Void an unpaid invoice with a reason. Its fees can be invoiced again. A paid invoice can’t be voided.'],
          ]),
          note(['In a past year you can’t generate new invoices, but outstanding ones can still be reminded and paid.']),
        ],
      },
    ],
    related: ['fee-structures', 'payments-record', 'aging-reminders'],
  },
  {
    id: 'payments-record',
    collection: 'finance',
    title: 'Record payments & receipts',
    summary: 'Find the student fast, record cash, bank, cheque or card, and give a receipt.',
    roles: ['principal', 'super_admin', 'accountant'],
    popular: true,
    route: '/finance/payments',
    routeLabel: 'Payments & Receipts',
    keywords: ['payment', 'receipt', 'record payment', 'cash', 'refund', 'overpayment', 'credit', 'search student'],
    sections: [
      {
        id: 'record',
        heading: 'Record a payment',
        blocks: [
          steps([
            { title: 'Find the student', body: [['In ', link('Payments & Receipts', '/finance/payments'), ', choose Record Payment and start typing: part of the name, the admission number, the class, or a parent’s name or phone. Each result shows the class, the guardian and what the student owes. Use the arrow keys and Enter, or click.']] },
            { title: 'Pick what it pays for', body: [['The full balance, a year, a term, or a term’s charges only. Only items with something owed are offered.']] },
            { title: 'Pay in full or part', body: [['Choose Pay in full, or Part payment and type the amount received (or tap a suggestion). The dialog shows the school’s minimum and what is left owing. If the school requires full payment, Part payment is switched off.']] },
            { title: 'Amount, method, date', body: [['Cash, bank transfer, cheque or card, with an optional reference. The amount settles the oldest charges first. Clicking twice never records it twice.']] },
          ]),
          note(['Paying more than is owed? Tick “Keep the extra as account credit”. The extra becomes credit, which you can apply to later fees or refund.']),
        ],
      },
      {
        id: 'receipts',
        heading: 'Receipts',
        blocks: [
          list([
            ['Every payment gets a numbered receipt (RCP-year-number), shared by all charges it paid.'],
            ['View or download the PDF from the payment row; it shows the balance at the time and is stamped REFUNDED if refunded.'],
            ['If the school turned it on, recorded payments are emailed to the family automatically. You can also email receipts for a date range.'],
          ]),
        ],
      },
      {
        id: 'refund',
        heading: 'Wrong payment? Refund it',
        blocks: [
          p(['Use Refund on the payment, with a reason. The amount goes back on the fees and the receipt is stamped. Then record it correctly. Online (Monime) payments are refunded through the payment provider, not here.']),
        ],
      },
    ],
    related: ['student-account', 'invoices', 'payments-setup'],
  },
  {
    id: 'student-account',
    collection: 'finance',
    title: 'A student’s account',
    summary: 'Profile, statement, discounts, credit, instalments and receipts in one window.',
    roles: ['principal', 'super_admin', 'accountant'],
    route: '/finance/payments',
    routeLabel: 'Payments & Receipts',
    keywords: ['student', 'profile', 'statement', 'guardian', 'phone', 'instalment', 'plan', 'credit note'],
    sections: [
      {
        id: 'open',
        heading: 'Open it',
        blocks: [p(['Click a student’s name on Payments, Arrears & Aging or Discounts.'])],
      },
      {
        id: 'tabs',
        heading: 'The tabs',
        blocks: [
          list([
            ['Profile: photo, class, status, the parents’ phone numbers and emails (tap to call or email), what is owed this year and in total, credit, the last payment, and Send a fee reminder.'],
            ['Statement: every charge, discount, late fee, payment and refund with a running balance; download it as a PDF; waive a late fee with a reason.'],
            ['Discounts: give, withdraw or revoke this student’s discounts.'],
            ['Credit: issue a credit note, apply credit to fees, or refund it in cash.'],
            ['Instalments: set up a payment plan (even split or custom dates) for what is owed.'],
            ['Receipts: every receipt, to view, download or email again.'],
          ]),
          note(['The profile shows only what finance needs. Results, attendance, discipline and logins stay with the teaching staff.']),
        ],
      },
    ],
    related: ['payments-record', 'discounts', 'aging-reminders'],
  },
  {
    id: 'discounts',
    collection: 'finance',
    title: 'Discounts, scholarships and waivers',
    summary: 'Sibling, staff-child and scholarship discounts, one-off waivers and approvals.',
    roles: ['principal', 'super_admin', 'accountant'],
    popular: true,
    route: '/finance/discounts',
    routeLabel: 'Discounts & Scholarships',
    keywords: ['discount', 'scholarship', 'bursary', 'waiver', 'sibling', 'staff child', 'approval', 'revoke'],
    sections: [
      {
        id: 'types',
        heading: 'Set up discount types once',
        blocks: [
          p(['Under Discount types, create e.g. “Second child 10%”, “Staff child 50%” or “Academic scholarship”: percent or a fixed amount, on tuition only or all charges. Switch a type off instead of deleting it.']),
        ],
      },
      {
        id: 'give',
        heading: 'Give a discount',
        blocks: [
          steps([
            { title: 'Find the student', body: [['Give a discount → type the name, admission number, class or a parent’s phone.']] },
            { title: 'Choose the discount', body: [['A discount type, or a one-off waiver with its own name, amount and reason. Choose the whole year or one term.']] },
            { title: 'Approval', body: [['Within your limit (Settings → Payment Policy) it is approved at once and comes off the fees. Above it, or a percentage on fees not billed yet, it waits for the principal, who is notified. You get a notification when they decide.']] },
          ]),
          tip(['Sibling discounts: open the type and use “Find eligible siblings”. Children at school that year are grouped by parent account or guardian phone, oldest first.']),
          note(['A discount only reduces what is still owed. If the fees are already paid, you’re told how much couldn’t be taken off; issue a credit note on the Credit tab if the family should get it back.']),
        ],
      },
      {
        id: 'undo',
        heading: 'Withdraw or revoke',
        blocks: [
          list([
            ['Withdraw a request that is still waiting.'],
            ['Revoke a discount you gave within your limit; the amount is owed again. A discount the principal approved can only be revoked by the principal.'],
            ['Past years are read-only.'],
          ]),
        ],
      },
    ],
    related: ['student-account', 'financial-settings', 'fee-structures'],
  },
  {
    id: 'aging-reminders',
    collection: 'finance',
    title: 'Arrears, aging and late fees',
    summary: 'See who owes and for how long, remind families, and run the overdue check.',
    roles: ['principal', 'super_admin', 'accountant'],
    route: '/finance/aging',
    routeLabel: 'Arrears & Aging',
    keywords: ['arrears', 'aging', 'overdue', 'late fee', 'reminder', 'defaulters', 'debtors'],
    sections: [
      {
        id: 'use',
        heading: 'Use it',
        blocks: [
          list([
            ['Balances are split into not yet due, 1–30, 31–60, 61–90 and over 90 days. Tap a bucket to filter.'],
            ['Filter by section or a minimum amount, export the list, and remind one family or everyone listed.'],
            ['Run overdue check marks fees overdue and, if the school turned late fees on, adds one late fee per overdue charge. It also runs every night.'],
            ['Families keeping to an instalment plan are not charged late fees. Waive a late fee from the student’s Statement.'],
          ]),
        ],
      },
    ],
    related: ['invoices', 'student-account', 'financial-settings'],
  },
  {
    id: 'expenses-budget',
    collection: 'finance',
    title: 'Expenses, petty cash and the budget',
    summary: 'Record what the school spends and keep it within budget.',
    roles: ['principal', 'super_admin', 'accountant'],
    route: '/finance/expenses',
    routeLabel: 'Expenses',
    keywords: ['expense', 'spending', 'petty cash', 'float', 'budget', 'receipt photo', 'void'],
    sections: [
      {
        id: 'expenses',
        heading: 'Expenses',
        blocks: [
          list([
            ['Record each expense with its date, category (pick Other to type your own), vendor, payment method and a photo or PDF of the receipt.'],
            ['A mistake is voided with a reason, never deleted. Petty cash and payroll expenses are voided from their own page.'],
            ['You are warned when a category goes over its budget.'],
          ]),
        ],
      },
      {
        id: 'petty',
        heading: 'Petty cash',
        blocks: [p(['Create a fund with a float, top it up, record each spend (it becomes an expense), and return what is left to the bank. A spend can’t be more than the cash in the fund.'])],
      },
      {
        id: 'budget',
        heading: 'Budget',
        blocks: [p(['Set an amount per category (optionally per department) for the year. The principal approves it; editing an approved budget sends it back for approval. Spending shows against each line.'])],
      },
    ],
    related: ['accounting', 'payroll'],
  },
  {
    id: 'payroll',
    collection: 'finance',
    title: 'Payroll, PAYE and NASSIT',
    summary: 'Staff pay, the monthly pay run and payslips.',
    roles: ['principal', 'super_admin', 'accountant'],
    route: '/finance/payroll',
    routeLabel: 'Payroll',
    keywords: ['payroll', 'salary', 'payslip', 'paye', 'nassit', 'nra', 'pay run'],
    sections: [
      {
        id: 'run',
        heading: 'Each month',
        blocks: [
          steps([
            { title: 'Staff pay (once)', body: [['Set each staff member’s basic salary, allowances, regular deductions and bank details.']] },
            { title: 'Start the pay run', body: [['Choose the month. PAYE and NASSIT are worked out for everyone with a salary; add bonuses or one-off deductions. The principal is notified.']] },
            { title: 'Approval and payment', body: [['The principal approves it. Pay the staff, then mark the run paid (you are notified when it is approved).']] },
            { title: 'Payslips', body: [['Download or email payslips. Staff see their own under My Payslips.']] },
          ]),
          note(['PAYE bands and NASSIT rates are pre-filled with Sierra Leone rates and can be edited by the principal on the PAYE & NASSIT tab.']),
          tip(['When you pay PAYE / NASSIT over, record it in the Journal with the “PAYE / NASSIT paid over” template.']),
        ],
      },
    ],
    related: ['accounting', 'expenses-budget'],
  },
  {
    id: 'accounting',
    collection: 'finance',
    title: 'The books: statements, journal and accounts',
    summary: 'Trial balance, income statement, balance sheet, cash flow and manual journals.',
    roles: ['principal', 'super_admin', 'accountant'],
    route: '/finance/reports',
    routeLabel: 'Financial Statements',
    keywords: ['trial balance', 'income statement', 'balance sheet', 'cash flow', 'ledger', 'journal', 'chart of accounts', 'close books', 'audit'],
    sections: [
      {
        id: 'auto',
        heading: 'The books post themselves',
        blocks: [p(['Every fee, payment, refund, discount, credit, expense, petty cash movement and paid pay run is posted to the accounts automatically. A change or void posts a correction.'])],
      },
      {
        id: 'reports',
        heading: 'Financial Statements',
        blocks: [
          list([
            ['Trial balance, income statement, balance sheet, cash flow and the ledger for any account, by academic year or by dates; export CSV, Excel or PDF.'],
            ['The books check confirms everything balances and agrees with the fee, credit and petty cash records.'],
            ['In a new year, cash, bank and money owed carry forward; income and expenses start at zero.'],
          ]),
        ],
      },
      {
        id: 'journal',
        heading: 'Journal, accounts and closing',
        blocks: [
          list([
            ['Post a manual journal only for what the system can’t know: opening balances, cash banked, PAYE / NASSIT paid, bank charges, donations. Debits must equal credits.'],
            ['Reverse a manual journal (once, with a reason); entries are never edited or deleted.'],
            ['Add accounts in the Chart of Accounts, e.g. a second bank account or equipment.'],
            ['The principal can close the books up to a date; nothing can then be posted on or before it.'],
            ['The Finance Audit Log lists every change, who made it and when.'],
          ]),
        ],
      },
    ],
    related: ['bank-reconciliation', 'payroll'],
  },
  {
    id: 'bank-reconciliation',
    collection: 'finance',
    title: 'Bank reconciliation',
    summary: 'Match the bank or mobile-money statement to the books.',
    roles: ['principal', 'super_admin', 'accountant'],
    route: '/finance/bank-reconciliation',
    routeLabel: 'Bank Reconciliation',
    keywords: ['bank', 'reconcile', 'statement', 'csv', 'match', 'mobile money', 'bank charges'],
    sections: [
      {
        id: 'steps',
        heading: 'Reconcile an account',
        blocks: [
          steps([
            { title: 'Import the statement', body: [['Pick the account, Import statement, choose the CSV from your bank or provider and say which column is the date, description, reference and amount. Lines already imported are skipped.']] },
            { title: 'Auto-match', body: [['Pairs statement lines with book items of the same amount within 7 days, preferring a matching reference.']] },
            { title: 'Deal with the rest', body: [['Match a line to one or more book items of the same total, add a missing item (bank charges, interest) to the books, or ignore a line.']] },
            { title: 'Check the difference', body: [['Enter the statement’s closing balance. When the difference is zero, the account is reconciled.']] },
          ]),
          note(['An import can be undone while none of its lines are matched.']),
        ],
      },
    ],
    related: ['accounting'],
  },
  {
    id: 'my-fees',
    collection: 'finance',
    title: 'Pay school fees online (parents & students)',
    summary: 'View your fees and pay with mobile money.',
    roles: ['student', 'parent', 'guardian'],
    popular: true,
    route: '/finance/my-fees',
    routeLabel: 'Fees & Payments',
    keywords: ['pay fees', 'monime', 'ussd', 'mobile money', 'balance', 'online payment'],
    sections: [
      {
        id: 'pay',
        heading: 'View and pay',
        blocks: [
          p(['Open ', link('Fees & Payments', '/finance/my-fees'), ' to see what\'s owed. Parents see each linked child.']),
          list([
            ['Tap Pay to pay online through Monime (mobile money / card). You\'re returned to the app once it completes.'],
            ['A USSD code option is available for mobile-money payment without leaving your phone.'],
          ]),
          note(['Parents with no linked children see "No children linked" — ask the school to link your account.']),
        ],
      },
    ],
    related: ['payments-setup', 'login-help'],
  },

  // ══════════════════ IDENTITY ══════════════════
  {
    id: 'id-cards-issue',
    collection: 'identity',
    title: 'Design & issue ID cards',
    summary: 'Create a template, then generate QR ID cards.',
    roles: ['principal', 'super_admin', 'admissions_officer'],
    popular: true,
    route: '/identity/cards',
    routeLabel: 'ID Cards',
    keywords: ['id card', 'template', 'badge', 'pvc', 'qr', 'bulk', 'expiry'],
    sections: [
      {
        id: 'issue',
        heading: 'From template to card',
        blocks: [
          steps([
            { title: 'Design a template', body: [['Build the layout, colours and fields in ', link('Card Templates', '/identity/templates'), '. The admissions office saves designs as drafts and submits them; the principal approves. Then set the default design for each role (admissions: student cards).']], action: { label: 'Card Templates', to: '/identity/templates' } },
            { title: 'Generate cards', body: [['In ', link('ID Cards', '/identity/cards'), ', generate one card or bulk-generate for a class or the whole school.']], action: { label: 'ID Cards', to: '/identity/cards' } },
            { title: 'Manage a card', body: [['Regenerate, revoke or report a card lost from its row. Cards show an expiry date.']] },
          ]),
          note(['Cards are printed on approved designs only. To change an approved design, duplicate it and submit the copy. ID cards are issued per academic year and expire yearly; the Expiring Soon tab lists cards due for renewal.']),
        ],
      },
      {
        id: 'verify',
        heading: 'Verify a card',
        blocks: [p(['Anyone can confirm a card is genuine using the ', link('QR Verifier', '/verify-id'), ' — scan the QR or type its value. It shows the holder\'s name, role, class and photo, and flags expired or revoked cards.'])],
      },
    ],
    related: ['school-info'],
  },

  // ══════════════════ EVENTS & ANNOUNCEMENTS ══════════════════
  {
    id: 'events',
    collection: 'events',
    title: 'Events & calendar',
    summary: 'Create events, track RSVPs and view the calendar.',
    roles: ['principal', 'super_admin', 'teacher', 'parent', 'student'],
    route: '/events/school',
    routeLabel: 'School Events',
    keywords: ['event', 'calendar', 'rsvp', 'my events'],
    sections: [
      {
        id: 'manage',
        heading: 'Create and track',
        blocks: [
          list([
            ['Create an event with date, venue and description in ', link('School Events', '/events/school'), '. It appears on the ', link('Calendar', '/events/calendar'), '.'],
            ['Double-click a day on the calendar to add an event quickly.'],
            ['Everyone tracks what they\'re attending in ', link('My Events', '/events/my-events'), '.'],
            ['Admins review turnout in ', link('Event Analytics', '/events/analytics'), '.'],
          ]),
          note(['New events go into the current year.']),
        ],
      },
    ],
    related: ['announcements'],
  },
  {
    id: 'announcements',
    collection: 'events',
    title: 'Announcements',
    summary: 'Broadcast news to parents, staff and students.',
    roles: [...ALL_STAFF, 'parent', 'student'],
    route: '/communication/announcements',
    routeLabel: 'Announcements',
    keywords: ['announcement', 'broadcast', 'notice', 'audience'],
    sections: [
      {
        id: 'post',
        heading: 'Post an announcement',
        blocks: [
          p(['In ', link('Announcements', '/communication/announcements'), ', compose a message and choose the audience (e.g. all parents, a class, or staff). Recipients see it in-app and, where enabled, by email.']),
          note(['Past-year announcements are read-only.']),
        ],
      },
    ],
    related: ['events'],
  },

  // ══════════════════ REPORTS ══════════════════
  {
    id: 'academic-archive',
    collection: 'reports',
    title: 'Academic archive & student history',
    summary: 'View a full snapshot of any past year and any student\'s record.',
    roles: ['principal', 'super_admin'],
    route: '/reports/academic',
    routeLabel: 'Academic Archive',
    keywords: ['archive', 'history', 'snapshot', 'past year', 'student lookup'],
    sections: [
      {
        id: 'archive',
        heading: 'Browse a year',
        blocks: [
          p(['In ', link('Academic Archive', '/reports/academic'), ', pick a year to see its full record: students enrolled, classes with their teacher and averages, results, attendance, and promotions. Print it for your files.']),
        ],
      },
      {
        id: 'history',
        heading: 'Look up a student across years',
        blocks: [
          p(['Search a student by name or admission number to open their complete history — attendance and fees per year, enrolments, terms and results — and jump straight to a report card.']),
        ],
      },
    ],
    related: ['report-cards', 'how-the-year-works'],
  },

  // ══════════════════ ACCOUNT & SECURITY ══════════════════
  {
    id: 'account-security',
    collection: 'account',
    title: 'Protect your account (2FA & passkeys)',
    summary: 'Turn on two-factor authentication and add a passkey.',
    roles: [...ALL_STAFF, 'parent', 'student'],
    popular: true,
    route: '/settings?tab=security',
    routeLabel: 'Security',
    keywords: ['2fa', 'two factor', 'authenticator', 'passkey', 'backup codes', 'security'],
    sections: [
      {
        id: '2fa',
        heading: 'Two-factor authentication',
        blocks: [
          steps([
            { title: 'Open Security', body: [['Go to ', link('Settings → Security', '/settings?tab=security'), '.']] },
            { title: 'Scan the QR code', body: [['Scan it with an authenticator app, then enter the 6-digit code to confirm.']] },
            { title: 'Save your backup codes', body: [['Copy and store the backup codes somewhere safe — you\'ll need one if you lose your device.']] },
          ]),
          tip(['Strongly recommended for every principal and accountant account.']),
        ],
      },
      {
        id: 'passkeys',
        heading: 'Passkeys',
        blocks: [p(['Under Advanced security you can add a passkey for password-free sign-in. Give it a name (e.g. "My phone"); you can rename or remove it later.'])],
      },
      {
        id: 'profile',
        heading: 'Profile & password',
        blocks: [p(['Update your name, email, language and date format in ', link('My Profile', '/settings?tab=profile'), '. Change your password there too (minimum 8 characters).'])],
      },
    ],
    related: ['login-help', 'student-logins'],
  },
  {
    id: 'login-help',
    collection: 'account',
    title: 'Signing in & password resets',
    summary: 'How to log in, and what to do if you\'re locked out.',
    roles: [...ALL_STAFF, 'parent', 'student'],
    keywords: ['login', 'sign in', 'forgot password', 'reset', 'locked out', 'backup code'],
    sections: [
      {
        id: 'signin',
        heading: 'How to sign in',
        blocks: [
          list([
            ['Students sign in with their student ID number; staff and parents with their email.'],
            ['If 2FA is on, enter your authenticator code. Lost your device? Use one of your backup codes instead.'],
            ['You can also sign in with a passkey if you\'ve added one.'],
          ]),
        ],
      },
      {
        id: 'reset',
        heading: 'Forgot your password',
        blocks: [p(['Use the "Forgot password" link on the login screen — a secure reset link is emailed to you. If it doesn\'t arrive, check spam or raise a ticket.'])],
      },
    ],
    related: ['account-security', 'student-logins', 'contact-support'],
  },

  // ══════════════════ MOBILE & OFFLINE ══════════════════
  {
    id: 'offline-use',
    collection: 'mobile',
    title: 'Using the app offline',
    summary: 'What works offline and how syncing happens.',
    roles: ['principal', 'super_admin', 'teacher'],
    keywords: ['offline', 'sync', 'cache', 'no internet', 'attendance offline'],
    sections: [
      {
        id: 'offline',
        heading: 'Offline-first',
        blocks: [
          p(['The app caches your data so you can keep working without a connection. Attendance registers save locally and sync automatically when you reconnect.']),
          note(['Some pages need internet (Admissions, Fees, Invoices, Payments and the platform console) and show a "requires internet" message when offline.']),
          tip(['Teachers can review anything that failed to sync on the Sync Issues page, and manage cached data in Settings → Offline & Storage.']),
        ],
      },
    ],
    related: ['app-updates', 'attendance-mark'],
  },
  {
    id: 'app-updates',
    collection: 'mobile',
    title: 'Installing & updating the app',
    summary: 'First launch, onboarding and update prompts.',
    roles: [...ALL_STAFF, 'parent', 'student'],
    keywords: ['install', 'update', 'android', 'new version', 'onboarding'],
    sections: [
      {
        id: 'updates',
        heading: 'Keeping current',
        blocks: [
          p(['On first launch the app shows a short welcome walkthrough, then the login screen. When a new version is available you\'ll see a prompt — accept it to load the latest app.']),
          tip(['If the app isn\'t showing your latest changes, pull to refresh, or tap the update badge if one appears.']),
        ],
      },
    ],
    related: ['offline-use'],
  },

  // ══════════════════ BILLING ══════════════════
  {
    id: 'plan-billing',
    collection: 'billing',
    title: 'Plans, limits & upgrading',
    summary: 'Compare plans and change yours in-app.',
    roles: ['principal', 'super_admin'],
    route: '/settings?tab=billing',
    routeLabel: 'Plan & Billing',
    keywords: ['plan', 'upgrade', 'downgrade', 'freetong', 'combra', 'bintumani', 'limits', 'subscription'],
    sections: [
      {
        id: 'plans',
        heading: 'The plans',
        blocks: [
          list([
            ['Every plan includes the core: classes, timetables, the student directory, attendance, assignments, results, report cards, fees and online payments, announcements and the parent and student portals.'],
            ['Higher plans add modules such as ID cards, events, discipline, expenses and budgets, payroll and full accounting, and raise the student and staff limits.'],
            ['Prices, limits and the exact features of each plan are shown on the plan cards in ', link('Plan & Billing', '/settings?tab=billing'), '.'],
          ]),
        ],
      },
      {
        id: 'read-only',
        heading: 'When a feature becomes read-only',
        blocks: [
          p(['If your school used a feature during its free trial (or on a higher plan) and your current plan doesn’t include it, nothing is deleted. The page stays in the menu with a lock icon: you can open it and view your records, but you can’t add or change anything until you upgrade.']),
          p(['Features your school has never had are hidden from the menu.']),
          p(['Portals work differently: the Parent, Admissions Officer and Bursar portals are part of Combra and Bintumani. When a plan doesn’t include a portal, its users can’t sign in (their accounts are kept), and new accounts for that portal can’t be created. Plan & Billing shows exactly what your plan includes and how many accounts each portal affects.']),
        ],
      },
      {
        id: 'upgrade',
        heading: 'Changing plan',
        blocks: [
          p(['Choose a plan to upgrade or downgrade. Paid changes use an in-app USSD mobile-money code — copy the code or dial it. Your plan activates automatically once payment is confirmed.']),
          note(['Changing plan may require your school to be verified first.']),
        ],
      },
    ],
    related: ['first-setup'],
  },

  // ══════════════════ PLATFORM ══════════════════
  {
    id: 'platform-console',
    collection: 'platform',
    title: 'Platform console',
    summary: 'Run every school from one place (platform admins).',
    roles: ['super_admin'],
    route: '/platform/tenants',
    routeLabel: 'Tenant Management',
    keywords: ['tenant', 'school', 'subscription', 'triage', 'newsletter', 'analytics'],
    sections: [
      {
        id: 'operate',
        heading: 'What you can do',
        blocks: [
          list([
            ['Manage schools in ', link('Tenant Management', '/platform/tenants'), ' — create, review, suspend or restore workspaces and set the email sender.'],
            ['Review plans in ', link('Subscriptions', '/platform/subscriptions'), '.'],
            ['Watch health in ', link('Platform Analytics', '/platform/analytics'), '.'],
            ['Send newsletters from ', link('Communications', '/platform/communications'), '.'],
            ['Answer schools\' tickets in ', link('Support Triage', '/platform/support'), '.'],
          ]),
        ],
      },
    ],
    related: [],
  },

  // ══════════════════ TROUBLESHOOTING ══════════════════
  {
    id: 'troubleshoot-common',
    collection: 'troubleshooting',
    title: 'Common problems & fixes',
    summary: 'Quick fixes for login, sync, payment and email issues.',
    roles: [...ALL_STAFF, 'parent', 'student'],
    popular: true,
    keywords: ['problem', 'error', 'not working', 'sync', 'payment failed', 'email', 'stale'],
    sections: [
      {
        id: 'fixes',
        heading: 'Try these first',
        blocks: [
          { type: 'table', head: ['Problem', 'What to do'], rows: [
            [['Can\'t sign in'], ['Students use their student ID; staff/parents use email. Use "Forgot password" to reset. If 2FA, use a backup code.']],
            [['App shows old data'], ['Pull to refresh, or tap the update badge. Offline pages sync when you reconnect.']],
            [['A payment didn\'t go through'], ['Check the student\'s balance and payment history on the Payments page before retrying — a partial amount may already be recorded.']],
            [['Parent sees "No children linked"'], ['Ask the school to link your account in Student Profiles.']],
            [['Can\'t edit last year\'s data'], ['Past years are read-only on purpose. Switch the year filter back to the current year.']],
            [['Didn\'t get an email'], ['Check spam. If it still doesn\'t arrive, raise a ticket.']],
          ] },
        ],
      },
    ],
    related: ['login-help', 'offline-use', 'contact-support'],
  },
  {
    id: 'contact-support',
    collection: 'troubleshooting',
    title: 'Contact support',
    summary: 'Raise a ticket or email the WiSkul team.',
    roles: [...ALL_STAFF],
    route: '/support',
    routeLabel: 'Help Center',
    keywords: ['ticket', 'help', 'contact', 'email', 'support'],
    sections: [
      {
        id: 'ticket',
        heading: 'Raise a ticket',
        blocks: [
          p(['From the ', link('Help Center home', '/support'), ', choose New Ticket, pick a category and priority, and describe the issue. You can attach screenshots. Track replies under "Your support tickets".']),
          p([`You can also email the team at `, { text: SUPPORT_EMAIL, to: `mailto:${SUPPORT_EMAIL}` }, '.']),
        ],
      },
    ],
    related: ['troubleshoot-common', 'login-help'],
  },
];
