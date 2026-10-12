/**
 * Demo school extras: everything that makes the public demo look finished.
 *
 *  - profile pictures for every student, teacher, parent and staff member
 *    (frontend/public/demo-avatars/*.svg, drawn by frontend/scripts/generate-demo-avatars.cjs)
 *  - the exam timetable (mid-term tests next week, end-of-term exams)
 *  - help-desk tickets with replies
 *  - a bank statement, partly matched against the books
 *
 * Safe to run any number of times and on a school that already exists: it only
 * ADDS what is missing and only touches the demo tenant (it refuses any other).
 * It never deletes anything. Used by the demo seed and by `npm run demo:topup`.
 */
import { db } from '../../src/utils/database';
import { resolveActiveYear } from '../../src/utils/academicYear';
import { resolveTermWindows, TERM_KEYS } from '../../src/utils/termWindows';
import { tenantToday } from '../../src/utils/schoolDate';
import { DEMO_TENANT_SLUG } from '../../src/utils/demo';

type Log = (msg: string) => void;
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const mondayOnOrAfter = (s: string) => { let d = s; while (day(d).getUTCDay() !== 1) d = addDays(d, 1); return d; };

const FEMALE_FIRST = new Set([
  'Aminata', 'Fatmata', 'Mariama', 'Isatu', 'Kadiatu', 'Hawa', 'Zainab', 'Adama', 'Christiana', 'Mary', 'Elizabeth', 'Haja', 'Jeneba',
  'Salamatu', 'Memunatu', 'Tenneh', 'Finda', 'Sia', 'Kumba', 'Yeama', 'Ramatu', 'Agnes', 'Grace', 'Esther', 'Musu', 'Isata', 'Fatu',
  'Marie', 'Rose', 'Sarah', 'Hannah', 'Ruth', 'Mabinty', 'Aisha', 'Nenneh', 'Sento',
]);

async function inBatches<T>(items: T[], size: number, fn: (x: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/** Throws unless `tid` is the demo school. */
async function assertDemoTenant(tid: string) {
  const t = await db('tenants').where({ id: tid }).first('slug', 'settings');
  const settings = typeof t?.settings === 'string' ? JSON.parse(t.settings) : t?.settings;
  if (!t || t.slug !== DEMO_TENANT_SLUG || settings?.demo !== true) {
    throw new Error('Refusing to run: this is not the demo school.');
  }
}

// ── Profile pictures ──────────────────────────────────────────────────────────
async function avatars(tid: string, log: Log) {
  const mine = (url?: string | null) => !url || String(url).startsWith('/demo-avatars/');
  let changed = 0;

  const students = await db('students').where({ tenant_id: tid }).orderBy('student_id').select('id', 'gender', 'photo_url');
  let b = 0, g = 0;
  const sUpdates = students.map((s: any) => {
    const female = String(s.gender || '').toLowerCase() === 'female';
    const file = female ? `s-g${pad((g++ % 16) + 1)}` : `s-b${pad((b++ % 16) + 1)}`;
    return { id: s.id, url: `/demo-avatars/${file}.svg`, current: s.photo_url };
  }).filter((u) => mine(u.current) && u.current !== u.url);
  await inBatches(sUpdates, 10, (u) => db('students').where({ id: u.id }).update({ photo_url: u.url }));
  changed += sUpdates.length;

  // Parents: the guardian relationship tells us which picture suits.
  const rel = new Map<string, string>(
    (await db('guardians as g').join('students as s', 's.id', 'g.student_id').where('s.tenant_id', tid).whereNotNull('g.user_id')
      .select('g.user_id', 'g.relationship')).map((r: any) => [String(r.user_id), String(r.relationship || '')]),
  );
  const users = await db('users').where({ tenant_id: tid }).whereNot('role', 'student').orderBy('role').orderBy('last_name').orderBy('first_name')
    .select('id', 'first_name', 'role', 'photo_url');
  let m = 0, f = 0;
  const uUpdates = users.map((u: any) => {
    const r = rel.get(String(u.id)) || '';
    const female = /mother|aunt|sister|grandmother/i.test(r) ? true : /father|uncle|brother|grandfather/i.test(r) ? false : FEMALE_FIRST.has(u.first_name);
    const file = female ? `a-f${pad((f++ % 8) + 1)}` : `a-m${pad((m++ % 8) + 1)}`;
    return { id: u.id, url: `/demo-avatars/${file}.svg`, current: u.photo_url };
  }).filter((u) => mine(u.current) && u.current !== u.url);
  await inBatches(uUpdates, 10, (u) => db('users').where({ id: u.id }).update({ photo_url: u.url }));
  changed += uUpdates.length;

  const support = await db('support_staff').where({ tenant_id: tid }).orderBy('staff_id').select('id', 'gender', 'photo_url');
  const sup = support.map((s: any, i: number) => ({
    id: s.id, current: s.photo_url,
    url: `/demo-avatars/${String(s.gender).toLowerCase() === 'female' ? 'a-f' : 'a-m'}${pad(((i + 4) % 8) + 1)}.svg`,
  })).filter((u: any) => mine(u.current) && u.current !== u.url);
  await inBatches(sup, 10, (u: any) => db('support_staff').where({ id: u.id }).update({ photo_url: u.url }));
  changed += sup.length;

  log(changed ? `${changed} profile pictures set` : 'profile pictures already in place');
}

// ── Exam timetable ────────────────────────────────────────────────────────────
async function exams(tid: string, log: Log) {
  const existing = await db('examinations as e').join('users as u', 'u.id', 'e.created_by').where('u.tenant_id', tid).count('* as n').first();
  if (Number((existing as any)?.n) > 0) { log('exam timetable already in place'); return; }
  const principal = await db('users').where({ tenant_id: tid, role: 'principal' }).first('id');
  const year = (await resolveActiveYear(tid)).yearString;
  if (!principal || !year) { log('exam timetable skipped (no principal or active year)'); return; }
  const today = await tenantToday(tid);
  const win = await resolveTermWindows(tid, year);
  const cur = TERM_KEYS.find((k) => win?.[k]?.start && win?.[k]?.end && today >= win[k].start! && today < win[k].end!) || 'first_term';
  const termEnd = win?.[cur]?.end || addDays(today, 60);

  const classes = await db('classes as c').join('academic_sessions as a', 'a.id', 'c.academic_session_id')
    .where('a.tenant_id', tid).where('a.is_active', true).orderBy('c.name').select('c.id', 'c.name', 'c.room_number');
  const rows: any[] = [];
  const now = new Date();
  for (const c of classes) {
    const subjects = await db('class_subjects as cs').join('subjects as s', 's.id', 'cs.subject_id').where('cs.class_id', c.id).orderBy('s.code').select('s.id', 's.name');
    const midStart = mondayOnOrAfter(addDays(today, 5));
    const eotStart = mondayOnOrAfter(addDays(termEnd, -16));
    subjects.forEach((s: any, i: number) => {
      const slot = i % 2 === 0 ? 'Morning' : 'Afternoon';
      const base = {
        term: cur, academic_year: year, class_id: c.id, subject_id: s.id, venue: c.room_number || null,
        created_by: principal.id, created_at: now, updated_at: now, status: 'scheduled', pass_marks: 40,
      };
      rows.push({
        ...base, title: `${s.name}: Mid-term Test`, type: 'mid_term', start_date: addDays(midStart, Math.floor(i / 2) % 5),
        total_marks: 50, pass_marks: 20, duration_minutes: 60, description: `${slot} paper`,
        instructions: 'Bring a pen, pencil and ruler. No phones in the hall.',
      });
      rows.push({
        ...base, title: `${s.name}: End of Term Examination`, type: 'end_of_term', start_date: addDays(eotStart, Math.floor(i / 2) % 5 + (i >= 8 ? 7 : 0)),
        total_marks: 100, duration_minutes: 120, description: `${slot} paper`,
        instructions: 'Candidates must be seated 15 minutes before the start. Calculators allowed for Mathematics and the sciences.',
      });
    });
  }
  for (let i = 0; i < rows.length; i += 200) await db('examinations').insert(rows.slice(i, i + 200));
  log(`${rows.length} exam papers (${cur.replace('_', ' ')})`);
}

// ── Help desk ─────────────────────────────────────────────────────────────────
async function tickets(tid: string, log: Log) {
  const existing = await db('support_tickets').where({ tenant_id: tid }).count('* as n').first();
  if (Number((existing as any)?.n) > 0) { log('help-desk tickets already in place'); return; }
  const principal = await db('users').where({ tenant_id: tid, role: 'principal' }).first('id');
  const bursar = await db('users').where({ tenant_id: tid, role: 'accountant' }).first('id');
  const agent = (await db('users').where({ role: 'super_admin' }).first('id')) || principal;
  if (!principal || !agent) { log('help-desk tickets skipped (no users)'); return; }
  const now = Date.now();
  const ago = (days: number, hours = 0) => new Date(now - days * 86_400_000 - hours * 3_600_000);
  const items = [
    {
      user: principal.id, subject: 'How do we release report cards to parents?', category: 'Report cards', priority: 'medium', status: 'resolved',
      description: 'We finished entering Term 1 marks for all classes. Please explain how to publish the report cards so parents can see them in the app.',
      created: ago(9), resolved: ago(8, 3), resolution: 'Explained the Release step in Report Cards and confirmed parents can see the results.',
      replies: [
        { by: agent.id, at: ago(9, -2), msg: 'Hello, open Academic, then Report Cards, choose the class and term, and press Release. Parents are notified straight away and the cards appear in their app.' },
        { by: principal.id, at: ago(8, 5), msg: 'That worked. Thank you, parents can see them now.' },
      ],
    },
    {
      user: bursar?.id || principal.id, subject: 'Receipt email did not reach a parent', category: 'Fees and payments', priority: 'high', status: 'in-progress',
      description: 'A parent paid fees by mobile money but says no receipt arrived by email. Can you check the address on file and resend it?',
      created: ago(2), replies: [
        { by: agent.id, at: ago(1, 6), msg: 'We found a typo in the email address on the parent account. Please correct it under Student Profiles and we will resend the receipt.' },
      ],
    },
    {
      user: principal.id, subject: 'Can we add a second bursar account?', category: 'Account', priority: 'low', status: 'open',
      description: 'Our accounts office is growing. How many staff logins does our plan allow and how do we add another bursar?',
      created: ago(0, 4), replies: [],
    },
  ];
  for (const t of items) {
    const [row] = await db('support_tickets').insert({
      tenant_id: tid, user_id: t.user, subject: t.subject, description: t.description, priority: t.priority, status: t.status,
      category: t.category, resolution: (t as any).resolution || null, created_at: t.created, updated_at: t.created, resolved_at: (t as any).resolved || null,
    }).returning('id');
    for (const r of t.replies) {
      await db('support_responses').insert({ ticket_id: row.id, responder_id: r.by, message: r.msg, is_public: true, created_at: r.at });
    }
  }
  log(`${items.length} help-desk tickets`);
}

// ── Bank statement ────────────────────────────────────────────────────────────
async function bank(tid: string, log: Log) {
  const { glService } = await import('../../src/services/finance/glService');
  const { bankRecService } = await import('../../src/services/finance/bankRecService');
  const bursar = await db('users').where({ tenant_id: tid, role: 'accountant' }).first('id');
  if (!bursar) { log('bank statement skipped (no bursar)'); return; }
  await glService.ensureSynced(tid);
  const today = await tenantToday(tid);
  const accounts = await db('gl_accounts').where({ tenant_id: tid, subtype: 'cash', is_active: true }).whereIn('system_key', ['bank', 'mobile']).select('id', 'system_key', 'name');
  let total = 0;
  for (const acc of accounts) {
    const have = await db('bank_statement_lines').where({ tenant_id: tid, account_id: acc.id }).count('* as n').first();
    if (Number((have as any)?.n) > 0) continue;
    const book = await db('gl_lines as l').join('gl_entries as e', 'e.id', 'l.entry_id')
      .where({ 'l.tenant_id': tid, 'l.account_id': acc.id }).whereRaw('(l.debit - l.credit) <> 0')
      .orderBy('e.entry_date', 'desc').orderBy('e.entry_no', 'desc').limit(24)
      .select('e.entry_date', 'e.entry_no', 'e.memo', db.raw('(l.debit - l.credit) as amount'));
    if (!book.length) continue;
    const rows: any[] = [];
    book.forEach((b: any, i: number) => {
      if (i % 4 === 3) return; // the bank has not shown every book entry yet
      const d = String(b.entry_date instanceof Date ? b.entry_date.toISOString() : b.entry_date).slice(0, 10);
      const date = addDays(d, i % 3 === 0 ? 1 : 0);
      rows.push({
        date: date > today ? today : date, amount: Number(b.amount),
        description: Number(b.amount) > 0 ? `Deposit: ${String(b.memo || 'School fees').slice(0, 60)}` : `Payment: ${String(b.memo || 'Supplier').slice(0, 60)}`,
        reference: String(b.entry_no),
      });
    });
    // Things only the bank knows about.
    rows.push({ date: addDays(today, -3), amount: -25, description: 'Monthly account maintenance fee', reference: 'BANK-FEE' });
    rows.push({ date: addDays(today, -1), amount: 650, description: 'Cash deposit: unidentified', reference: 'CDM-4471' });
    const imp = await bankRecService.import(tid, bursar.id, acc.id, rows);
    const match = await bankRecService.autoMatch(tid, bursar.id, acc.id);
    total += imp.inserted;
    log(`${acc.name}: ${imp.inserted} statement lines, ${match.matched} matched`);
  }
  if (!total) log('bank statement already in place (or no money movements yet)');
}

export async function applyDemoExtras(tid: string, log: Log = (m) => console.log(`  • ${m}`)): Promise<void> {
  await assertDemoTenant(tid);
  await avatars(tid, log);
  await exams(tid, log);
  await tickets(tid, log);
  await bank(tid, log);
}
