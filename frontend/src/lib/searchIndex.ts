/**
 * searchIndex: the "pages and actions" half of the header search.
 *
 * Built from the sidebar's own menu (so it can only ever offer what the person
 * can open: same role rules, same plan locks, same hidden v2 pages) plus the
 * Settings tabs, the guide and a short list of everyday actions. Matching is
 * instant and happens in the browser: it understands synonyms ("arrears",
 * "who owes" → Arrears & Aging) and forgives small typos ("atendance").
 */
import type { AuthUser } from '@appTypes/index';
import { navItems } from '@components/layout/Sidebar';
import { getDashboardPath } from '@hooks/useAuth';
import { routeAccess } from '@lib/planFeatures';

export interface PageEntry {
  kind: 'page' | 'action';
  id: string;
  title: string;
  /** Short hint shown under the title (where it lives). */
  subtitle: string;
  path: string;
  keywords: string[];
  readOnly?: boolean;
}

/** Extra words people use for each page (path → words and phrases). */
const KEYWORDS: Record<string, string[]> = {
  '/academic/classes': ['class', 'classes', 'streams', 'form', 'grade', 'section', 'roster', 'class list'],
  '/academic/subjects': ['subject', 'subjects', 'course', 'curriculum', 'syllabus'],
  '/academic/timetables': ['timetable', 'time table', 'schedule', 'periods', 'lessons', 'class schedule'],
  '/academic/assignments': ['assignment', 'homework', 'coursework', 'task', 'classwork'],
  '/academic/exam-timetable': ['exam', 'exams', 'examination', 'test dates', 'exam schedule', 'exam dates'],
  '/academic/results': ['results', 'grades', 'marks', 'scores', 'gradebook', 'enter marks', 'wassce', 'bece', 'npse', 'test scores'],
  '/academic/report-cards': ['report card', 'report cards', 'report', 'transcript', 'term result', 'booklet', 'result sheet'],
  '/academic/promotions': ['promote', 'promotion', 'next class', 'year end', 'rollover', 'graduate', 'new academic year'],
  '/students/directory': ['students', 'pupils', 'directory', 'enrolled', 'student list', 'add student', 'new student', 'register student'],
  '/students/admissions': ['admission', 'admissions', 'apply', 'application', 'applicants', 'enrol', 'enroll', 'intake', 'new pupil'],
  '/students/profiles': ['student profile', 'profile', 'medical', 'guardian', 'parent info', 'parent account', 'student details'],
  '/students/attendance': ['attendance', 'absent', 'present', 'late', 'roll call', 'register', 'mark attendance', 'absence'],
  '/discipline': ['discipline', 'conduct', 'behaviour', 'behavior', 'incident', 'sanction', 'merit', 'demerit'],
  '/staff/teachers': ['teacher', 'teachers', 'staff', 'employee', 'hire', 'add teacher', 'bursar', 'accountant', 'admissions officer', 'add staff'],
  '/staff/members': ['support staff', 'security', 'cleaner', 'cook', 'driver', 'gardener', 'maintenance'],
  '/staff/attendance': ['staff attendance', 'sign in', 'sign out', 'clock in', 'clock out', 'teacher attendance'],
  '/finance/fees': ['fee', 'fees', 'tuition', 'fee structure', 'charges', 'school fees', 'set fees'],
  '/finance/invoices': ['invoice', 'invoices', 'bill', 'bills', 'generate invoices', 'billing'],
  '/finance/payments': ['payment', 'payments', 'pay', 'receipt', 'receipts', 'record payment', 'cash', 'collect fees', 'refund', 'mobile money', 'momo', 'take payment'],
  '/finance/aging': ['arrears', 'owing', 'debtors', 'overdue', 'outstanding', 'defaulters', 'aging', 'ageing', 'who owes', 'unpaid'],
  '/finance/discounts': ['discount', 'discounts', 'scholarship', 'scholarships', 'waiver', 'bursary', 'concession', 'sibling discount'],
  '/finance/expenses': ['expense', 'expenses', 'spending', 'purchase', 'cost', 'vendor', 'supplier'],
  '/finance/petty-cash': ['petty cash', 'float', 'cash box', 'small cash'],
  '/finance/budgets': ['budget', 'budgets', 'forecast', 'allocation'],
  '/finance/my-fees': ['my fees', 'pay fees', 'balance', 'school fees', 'fee balance', 'child fees', 'pay school fees', 'receipts'],
  '/finance/payroll': ['payroll', 'salary', 'salaries', 'wages', 'pay staff'],
  '/finance/reports': ['financial statements', 'income statement', 'balance sheet', 'profit', 'loss', 'trial balance', 'cash flow', 'finance report'],
  '/finance/journal': ['journal', 'ledger', 'entries', 'double entry', 'journal entry'],
  '/finance/accounts': ['chart of accounts', 'accounts', 'gl', 'general ledger'],
  '/finance/bank-reconciliation': ['bank', 'reconcile', 'reconciliation', 'bank statement'],
  '/finance/audit-log': ['audit', 'audit log', 'activity', 'history', 'who changed', 'finance log'],
  '/finance/my-payslips': ['payslip', 'payslips', 'salary slip', 'my salary', 'my pay'],
  '/communication/announcements': ['announcement', 'announcements', 'notice', 'news', 'broadcast', 'post', 'notices'],
  '/support': ['help', 'support', 'contact support', 'ticket', 'faq', 'how to', 'help centre', 'help center'],
  '/identity/cards': ['id card', 'id cards', 'identity', 'badge', 'print card', 'student card', 'staff card', 'qr'],
  '/identity/templates': ['card template', 'card templates', 'card design', 'id design'],
  '/events/school': ['event', 'events', 'meeting', 'sports day', 'graduation', 'ptc', 'parents meeting', 'school events'],
  '/events/calendar': ['calendar', 'dates', 'term dates', 'holidays', 'school calendar'],
  '/events/my-events': ['my events', 'registered events', 'rsvp'],
  '/events/analytics': ['event analytics', 'event stats'],
  '/reports/academic': ['academic archive', 'archive', 'past results', 'previous years', 'old results', 'history'],
  '/platform/tenants': ['schools', 'tenants', 'customers', 'school accounts'],
  '/platform/subscriptions': ['subscriptions', 'plans', 'billing', 'revenue'],
  '/platform/analytics': ['analytics', 'statistics', 'usage'],
  '/platform/communications': ['communications', 'broadcast', 'email schools', 'newsletter'],
  '/platform/demo-requests': ['demo', 'demo requests', 'leads'],
  '/platform/support': ['support', 'tickets', 'triage', 'help requests'],
  '/accountant/dashboard': ['home', 'finance overview', 'bursar dashboard'],
  '/teacher/dashboard': ['home', 'teaching overview', 'teacher dashboard'],
  '/admissions/dashboard': ['home', 'admissions overview', 'admissions dashboard'],
};

/** Settings tabs: id → label, who may open it, and the words people use. */
const SETTINGS_TABS: Array<{ id: string; label: string; who: 'all' | 'admin' | 'teacher' | 'bursar' | 'office'; words: string[] }> = [
  { id: 'profile', label: 'My Profile', who: 'all', words: ['my profile', 'name', 'photo', 'picture', 'phone number', 'change email', 'account'] },
  { id: 'security', label: 'Security', who: 'all', words: ['password', 'change password', '2fa', 'two factor', 'passkey', 'sign in', 'login', 'biometric', 'fingerprint', 'security'] },
  { id: 'offline', label: 'Offline & Storage', who: 'teacher', words: ['offline', 'storage', 'sync', 'downloaded data', 'no internet'] },
  { id: 'policy', label: 'Payment Policy', who: 'bursar', words: ['payment policy', 'minimum payment', 'instalments', 'installments', 'late fee'] },
  { id: 'admissions', label: 'Admissions & IDs', who: 'office', words: ['admissions settings', 'id numbers', 'admission number'] },
  { id: 'school', label: 'School Info', who: 'admin', words: ['school info', 'school name', 'logo', 'address', 'contact details', 'motto', 'branding', 'school profile'] },
  { id: 'academic', label: 'Academic Config', who: 'admin', words: ['academic year', 'terms', 'term dates', 'session', 'new term', 'term start'] },
  { id: 'id-format', label: 'ID Format', who: 'admin', words: ['id format', 'admission number format', 'student id', 'prefix', 'numbering'] },
  { id: 'grading', label: 'Grading & Results', who: 'admin', words: ['grading', 'grade scale', 'pass mark', 'grade boundaries', 'wassce', 'bece', 'npse', 'grading scale'] },
  { id: 'attendance', label: 'Attendance Rules', who: 'admin', words: ['attendance rules', 'attendance threshold', 'late cutoff', 'attendance emails', 'weekly digest', 'parent attendance', 'attendance notifications'] },
  { id: 'report-card', label: 'Report Card', who: 'admin', words: ['report card settings', 'remarks', 'signature', 'principal comment', 'report layout'] },
  { id: 'financial', label: 'Financial Info', who: 'admin', words: ['financial info', 'bank details', 'currency', 'payment details', 'email receipts', 'late fees', 'fee settings'] },
  { id: 'payments', label: 'Payments', who: 'admin', words: ['payments settings', 'monime', 'mobile money', 'online payments', 'payment gateway', 'pay online'] },
  { id: 'billing', label: 'Plan & Billing', who: 'admin', words: ['plan', 'billing', 'subscription', 'upgrade', 'renew', 'wiskul plan', 'pricing'] },
  { id: 'storage', label: 'File Storage', who: 'admin', words: ['file storage', 'uploads', 'storage space', 'disk'] },
];

interface ActionDef {
  id: string;
  title: string;
  path: string;
  /** Who gets it: a role list checked like the sidebar (canAccess). */
  roles: string[];
  words: string[];
}

/** Everyday jobs: typing the job takes you straight to where it is done. */
const ACTIONS: ActionDef[] = [
  { id: 'record-payment', title: 'Record a payment', path: '/finance/payments', roles: ['principal', 'accountant'], words: ['collect fees', 'receive money', 'take payment', 'cash payment', 'new payment', 'pay'] },
  { id: 'generate-invoices', title: 'Generate invoices', path: '/finance/invoices', roles: ['principal', 'accountant'], words: ['bill students', 'create invoice', 'bill a class'] },
  { id: 'see-arrears', title: 'See who owes fees', path: '/finance/aging', roles: ['principal', 'accountant'], words: ['arrears', 'debtors', 'unpaid', 'outstanding', 'defaulters'] },
  { id: 'give-discount', title: 'Give a discount or scholarship', path: '/finance/discounts', roles: ['principal', 'accountant'], words: ['waiver', 'bursary', 'sibling'] },
  { id: 'pay-my-fees', title: 'Pay school fees', path: '/finance/my-fees', roles: ['parent', 'student', 'guardian'], words: ['balance', 'owe', 'mobile money', 'receipt', 'fees'] },
  { id: 'take-attendance', title: 'Take attendance', path: '/students/attendance', roles: ['principal', 'teacher'], words: ['mark attendance', 'roll call', 'register', 'absent', 'present'] },
  { id: 'enter-results', title: 'Enter results', path: '/academic/results', roles: ['principal', 'teacher'], words: ['marks', 'scores', 'grades', 'exam results'] },
  { id: 'print-report-cards', title: 'Print report cards', path: '/academic/report-cards', roles: ['principal', 'teacher'], words: ['download report', 'transcript', 'term results'] },
  { id: 'add-student', title: 'Add a student', path: '/students/directory', roles: ['principal', 'admissions_officer'], words: ['new student', 'register student', 'enrol student', 'enroll student', 'new pupil'] },
  { id: 'new-admission', title: 'Review admission applications', path: '/students/admissions', roles: ['principal', 'admissions_officer'], words: ['applicants', 'new application', 'applications'] },
  { id: 'add-teacher', title: 'Add a teacher or staff member', path: '/staff/teachers', roles: ['principal'], words: ['new teacher', 'hire', 'new staff', 'add bursar', 'add accountant', 'add admissions officer'] },
  { id: 'post-announcement', title: 'Post an announcement', path: '/communication/announcements', roles: ['principal', 'teacher'], words: ['new announcement', 'notice', 'send message', 'broadcast'] },
  { id: 'print-id-cards', title: 'Print ID cards', path: '/identity/cards', roles: ['principal', 'admissions_officer'], words: ['id card', 'student card', 'badge', 'generate cards'] },
  { id: 'change-password', title: 'Change my password', path: '/settings?tab=security', roles: [], words: ['password', 'reset password', 'security', 'passkey', '2fa'] },
  { id: 'upgrade-plan', title: 'Upgrade or renew the school plan', path: '/settings?tab=billing', roles: ['principal'], words: ['plan', 'subscription', 'billing', 'pricing', 'renew', 'upgrade'] },
  { id: 'attendance-emails', title: 'Choose how parents hear about attendance', path: '/settings?tab=attendance', roles: ['principal'], words: ['weekly digest', 'attendance emails', 'parent notifications', 'attendance notifications'] },
];

// ── Matching ─────────────────────────────────────────────────────────────────

const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s#&/.-]/g, ' ').replace(/\s+/g, ' ').trim();

/** Edit distance (insert, delete, replace, swap) with an early exit past `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, (prev2[j - 2] ?? 99) + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** How well one typed word matches a list of target phrases (0 = not at all). */
function wordScore(word: string, targets: Array<{ text: string; weight: number }>): number {
  let best = 0;
  for (const { text, weight } of targets) {
    if (!text) continue;
    const words = text.split(' ');
    let s = 0;
    if (text === word) s = 100;
    else if (words.includes(word)) s = 92;
    else if (text.startsWith(word) || words.some((w) => w.startsWith(word))) s = 80;
    else if (word.length >= 3 && text.includes(word)) s = 55;
    else if (word.length >= 4) {
      // Typos: one slip allowed for a 4-6 letter word, two for longer.
      const max = word.length >= 7 ? 2 : 1;
      // A typo rarely changes the first letter, which keeps unrelated words apart (upgrade vs grade).
      if (words.some((w) => w[0] === word[0] && (editDistance(word, w, max) <= max || editDistance(word, w.slice(0, word.length), max) <= max))) s = 58;
    }
    best = Math.max(best, Math.round((s * weight) / 100));
  }
  return best;
}

export interface ScoredPage { entry: PageEntry; score: number }

/** Rank pages and actions for what was typed. Every word must match something. */
export function searchPages(index: PageEntry[], query: string, limit = 6): ScoredPage[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(' ').filter(Boolean).slice(0, 5);
  const out: ScoredPage[] = [];
  for (const entry of index) {
    const title = norm(entry.title);
    const targets = [
      { text: title, weight: 100 },
      ...entry.keywords.map((k) => ({ text: norm(k), weight: 88 })),
      { text: norm(entry.subtitle), weight: 45 },
    ];
    let total = 0;
    let ok = true;
    for (const w of words) {
      const s = wordScore(w, targets);
      if (!s) { ok = false; break; }
      total += s;
    }
    if (!ok) continue;
    let score = total / words.length;
    if (title === q) score += 25;
    else if (title.startsWith(q)) score += 10;
    // A job phrase ("record a payment") should beat the page it lives on only when it matches better.
    if (entry.kind === 'action') score -= 2;
    // Shorter titles win ties ("Attendance" before "Staff Attendance").
    out.push({ entry, score: Math.round(score) - title.length * 0.02 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ── Building the index ───────────────────────────────────────────────────────

type CanAccess = (roles: any[]) => boolean;

/** The person's pages, settings tabs and everyday actions, filtered like the sidebar. */
export function buildPageIndex(user: AuthUser | null | undefined, canAccess: CanAccess): PageEntry[] {
  if (!user) return [];
  const role = String(user.role);
  const duties = (((user as any).staffDuties ?? []) as string[]);
  const isSuper = role === 'super_admin';
  const holds = (job: string) => role === job || duties.includes(job);
  const entries: PageEntry[] = [];
  const seen = new Set<string>();
  const add = (e: PageEntry) => { const k = `${e.kind}:${e.path}:${e.title}`; if (!seen.has(k)) { seen.add(k); entries.push(e); } };

  // The sidebar menu, exactly as the sidebar filters it (v2 pages stay hidden).
  for (const item of navItems) {
    if (item.version === 'v2') continue;
    if (isSuper) { if (item.group !== 'Platform') continue; }
    else if (item.dutyOnly) {
      if (!(!item.roles.includes(role) && duties.some((d) => item.roles.includes(d)))) continue;
    } else if (!canAccess(item.roles as any[])) continue;
    const access = routeAccess(user, item.path);
    if (access === 'locked') continue;
    add({
      kind: 'page', id: `page:${item.path}`, title: item.label, subtitle: item.group || item.module || 'Page',
      path: item.path, keywords: KEYWORDS[item.path] || [], readOnly: access === 'read_only',
    });
  }

  // Home, guide and settings.
  const home = getDashboardPath(user.role as any);
  add({ kind: 'page', id: 'page:home', title: 'Dashboard', subtitle: 'Home', path: home, keywords: ['home', 'overview', 'start', 'main page'] });
  add({ kind: 'page', id: 'page:guide', title: 'Platform Guide', subtitle: 'Help', path: '/guide', keywords: ['guide', 'tutorial', 'how to', 'user guide', 'help', 'learn'] });
  add({ kind: 'page', id: 'page:settings', title: 'Settings', subtitle: 'Account', path: '/settings', keywords: ['settings', 'preferences', 'configuration', 'options'] });
  if (role === 'teacher') add({ kind: 'page', id: 'page:sync', title: 'Sync Issues', subtitle: 'Offline', path: '/sync-issues', keywords: ['sync', 'offline', 'failed uploads', 'pending'] });
  if (role === 'principal') add({ kind: 'page', id: 'page:verify', title: 'Verify your school', subtitle: 'Account', path: '/verify-school', keywords: ['verification', 'verify', 'school verification', 'documents'] });

  const tabAllowed = (who: string) =>
    who === 'all' ||
    (who === 'admin' && (role === 'principal' || isSuper)) ||
    (who === 'teacher' && holds('teacher')) ||
    (who === 'bursar' && holds('accountant')) ||
    (who === 'office' && holds('admissions_officer'));
  for (const t of SETTINGS_TABS) {
    if (isSuper && t.who !== 'all') continue;
    if (!tabAllowed(t.who)) continue;
    add({ kind: 'page', id: `settings:${t.id}`, title: `Settings: ${t.label}`, subtitle: 'Settings', path: `/settings?tab=${t.id}`, keywords: t.words });
  }

  // Everyday actions, only where the person could actually do the job.
  const pagePaths = new Set(entries.filter((e) => e.kind === 'page').map((e) => e.path.split('?')[0]));
  for (const a of ACTIONS) {
    const base = a.path.split('?')[0];
    const isSettings = base === '/settings';
    if (!isSettings && !pagePaths.has(base)) continue;
    if (a.roles.length && !a.roles.some((r) => holds(r)) && !(a.roles.includes('parent') && role === 'guardian')) continue;
    if (isSettings) {
      const tab = new URLSearchParams(a.path.split('?')[1]).get('tab') || '';
      if (!entries.some((e) => e.id === `settings:${tab}`)) continue;
    }
    add({ kind: 'action', id: `action:${a.id}`, title: a.title, subtitle: 'Quick action', path: a.path, keywords: a.words });
  }
  return entries;
}

/** A few good starting points shown before anything is typed. */
export function suggestedPages(index: PageEntry[], role: string): PageEntry[] {
  const wanted: Record<string, string[]> = {
    principal: ['/students/directory', '/finance/payments', '/students/attendance', '/communication/announcements', '/academic/results'],
    accountant: ['/finance/payments', '/finance/invoices', '/finance/aging', '/finance/fees', '/finance/reports'],
    admissions_officer: ['/students/admissions', '/students/directory', '/identity/cards', '/academic/classes'],
    teacher: ['/students/attendance', '/academic/results', '/academic/assignments', '/academic/timetables', '/communication/announcements'],
    student: ['/academic/results', '/academic/timetables', '/academic/assignments', '/finance/my-fees', '/students/attendance'],
    parent: ['/finance/my-fees', '/academic/results', '/students/attendance', '/academic/report-cards', '/communication/announcements'],
    guardian: ['/finance/my-fees', '/academic/results', '/students/attendance', '/academic/report-cards'],
    super_admin: ['/platform/tenants', '/platform/subscriptions', '/platform/support', '/platform/analytics'],
  };
  const order = wanted[role] || [];
  return order.map((p) => index.find((e) => e.kind === 'page' && e.path === p)).filter(Boolean) as PageEntry[];
}
