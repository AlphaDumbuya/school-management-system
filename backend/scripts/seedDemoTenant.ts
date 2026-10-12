/**
 * Public demo school: "WiSkul Demo Academy".
 *
 * Seeds a complete, realistic school year so every portal (principal, teacher,
 * student, parent, bursar, admissions officer) has real-looking data for the
 * marketing site's "Try the live demo". Dates are relative to today, so re-run
 * it every few weeks to keep it fresh; each run removes the previous demo
 * school first (only the tenant with slug `wiskul-demo` AND settings.demo).
 *
 *   npm run demo:seed               reset + seed
 *   npm run demo:seed -- --purge    only remove the demo school
 *
 * Money, billing, payroll and accounting go through the app's own services so
 * the numbers match what the app would have produced. The demo school is
 * read-only for visitors (middleware/demoReadOnly.ts) and no email is sent to
 * its @demo.wiskulsl.com addresses (utils/demo.ts).
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../src/utils/database';
import { PasswordService } from '../src/services/passwordService';
import { PlanCatalog } from '../src/services/planCatalogService';
import { DEMO_EMAIL_DOMAIN, DEMO_TENANT_SLUG } from '../src/utils/demo';
import { applyDemoExtras } from './lib/demoExtras';

/**
 * Shared password of the demo accounts (for the Android app; the website uses
 * personal emailed links). New on every run unless DEMO_PASSWORD is set, and
 * kept in tenants.settings.demo_password so the demo email can include it.
 */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || (() => {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const pickC = () => letters[crypto.randomInt(letters.length)];
  return `Demo-${pickC()}${pickC()}${pickC()}${pickC()}-${crypto.randomInt(10, 99)}`;
})();
const SCHOOL_NAME = 'WiSkul Demo Academy';
const mail = (local: string) => `${local}@${DEMO_EMAIL_DOMAIN}`;

// ── Small helpers ─────────────────────────────────────────────────────────────
let seed = 20260907;
/** Deterministic random (mulberry32) so every re-seed builds the same school. */
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
const chance = (p: number) => rnd() < p;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const uuid = () => crypto.randomUUID();
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => { const d = day(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const dow = (s: string) => day(s).getUTCDay();
const isWeekday = (s: string) => dow(s) >= 1 && dow(s) <= 5;
const mondayOnOrAfter = (s: string) => { let d = s; while (dow(d) !== 1) d = addDays(d, 1); return d; };
const fridayOnOrBefore = (s: string) => { let d = s; while (dow(d) !== 5) d = addDays(d, -1); return d; };
const at = (s: string, hhmm: string) => new Date(`${s}T${hhmm}:00Z`);
const log = (msg: string) => console.log(`  • ${msg}`);

async function insertMany(table: string, rows: any[], returning?: string): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    if (!chunk.length) continue;
    const r = returning ? await db(table).insert(chunk).returning(returning) : await db(table).insert(chunk);
    if (returning) out.push(...(r as any[]));
  }
  return out;
}

/** Standard competition ranking (ties share a rank), highest first. */
function rank<T>(items: T[], score: (t: T) => number): Map<T, number> {
  const sorted = [...items].sort((a, b) => score(b) - score(a));
  const out = new Map<T, number>();
  let r = 0; let prev: number | null = null;
  sorted.forEach((it, i) => { const s = score(it); if (prev === null || s !== prev) { r = i + 1; prev = s; } out.set(it, r); });
  return out;
}

// ── Removing the previous demo school ─────────────────────────────────────────
/**
 * Deletes the demo tenant and every row that belongs to it, whatever the app
 * (or a visitor's session) wrote: all tables with tenant_id, plus everything
 * that references those rows through a foreign key, followed transitively.
 */
async function purgeDemoTenant(): Promise<boolean> {
  const tenant = await db('tenants').where({ slug: DEMO_TENANT_SLUG }).first();
  if (!tenant) return false;
  const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings || '{}') : tenant.settings || {};
  if (settings.demo !== true) throw new Error(`Tenant "${DEMO_TENANT_SLUG}" exists but is not marked as the demo school. Refusing to delete it.`);
  const tid = tenant.id as string;

  const fks: Array<{ child: string; ccol: string; parent: string; pcol: string; nullable: boolean }> = (await db.raw(`
    SELECT c.conrelid::regclass::text AS child, a.attname AS ccol, c.confrelid::regclass::text AS parent, af.attname AS pcol, NOT a.attnotnull AS nullable
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace AND array_length(c.conkey, 1) = 1`)).rows;
  const pks = new Map<string, string>((await db.raw(`
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'p' AND c.connamespace = 'public'::regnamespace AND array_length(c.conkey, 1) = 1`)).rows.map((r: any) => [r.tbl, r.col]));
  const tenantTables: string[] = (await db.raw(`
    SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND c.column_name = 'tenant_id'`)).rows.map((r: any) => r.table_name);

  // Selection: table → column → values (rows where column::text is one of them).
  const sel = new Map<string, Map<string, Set<string>>>();
  const add = (t: string, col: string, vals: string[]) => {
    if (!sel.has(t)) sel.set(t, new Map());
    const m = sel.get(t)!;
    if (!m.has(col)) m.set(col, new Set());
    const s = m.get(col)!;
    let added = false;
    for (const v of vals) if (v != null && !s.has(v)) { s.add(v); added = true; }
    return added;
  };
  const where = (q: any, t: string) => q.where((w: any) => {
    for (const [col, vals] of sel.get(t)!) w.orWhereRaw(`??::text = ANY(?)`, [col, Array.from(vals)]);
  });
  add('tenants', 'id', [tid]);
  for (const t of tenantTables) if (t !== 'tenants') add(t, 'tenant_id', [tid]);

  let dirty = new Set(sel.keys());
  for (let pass = 0; dirty.size && pass < 20; pass++) {
    const next = new Set<string>();
    for (const fk of fks) {
      if (!dirty.has(fk.parent) || fk.child === fk.parent && fk.ccol === fk.pcol) continue;
      const vals = (await where(db(fk.parent), fk.parent).distinct(db.raw(`??::text as v`, [fk.pcol]))).map((r: any) => r.v).filter(Boolean);
      if (vals.length && add(fk.child, fk.ccol, vals)) next.add(fk.child);
    }
    dirty = next;
  }

  await db.transaction(async (trx) => {
    // Pin each table's rows by primary key (columns may be nulled below).
    const byPk = new Map<string, string[]>();
    for (const t of sel.keys()) {
      const pk = pks.get(t);
      if (!pk) continue;
      byPk.set(t, (await where(trx(t), t).select(trx.raw(`??::text as v`, [pk]))).map((r: any) => r.v));
    }
    const remaining = new Set(Array.from(sel.keys()).filter((t) => !byPk.has(t) || byPk.get(t)!.length));
    const delOne = async (t: string) => {
      const pk = pks.get(t);
      await trx.transaction(async (sp) => {
        if (pk) {
          const ids = byPk.get(t)!;
          for (let i = 0; i < ids.length; i += 5000) await sp(t).whereRaw('??::text = ANY(?)', [pk, ids.slice(i, i + 5000)]).del();
        } else {
          await where(sp(t), t).del();
        }
      });
    };
    let nulled = false;
    for (let pass = 0; remaining.size && pass < 60; pass++) {
      let progress = false;
      for (const t of Array.from(remaining)) {
        try { await delOne(t); remaining.delete(t); progress = true; } catch { /* a child still points here; next pass */ }
      }
      if (!progress) {
        if (nulled) break;
        // Break cycles: clear nullable references between rows being deleted.
        for (const fk of fks) {
          if (!fk.nullable || !remaining.has(fk.child) || !remaining.has(fk.parent) || !byPk.get(fk.child)?.length) continue;
          await trx(fk.child).whereRaw('??::text = ANY(?)', [pks.get(fk.child)!, byPk.get(fk.child)!]).whereNotNull(fk.ccol).update({ [fk.ccol]: null });
        }
        nulled = true;
      }
    }
    if (remaining.size) throw new Error(`Could not remove the old demo school (left: ${Array.from(remaining).join(', ')})`);
  });
  await fs.rm(path.join(process.env.LOCAL_STORAGE_PATH || './storage', 'uploads', 'cards', tid), { recursive: true, force: true }).catch(() => undefined);
  return true;
}

// ── People and school structure ───────────────────────────────────────────────
const BOYS = ['Mohamed', 'Ibrahim', 'Abdul', 'Alusine', 'Sorie', 'Foday', 'Musa', 'Osman', 'Samuel', 'Joseph', 'Emmanuel', 'David', 'Abu', 'Lansana', 'Sahr', 'Tamba', 'Komba', 'Brima', 'Alie', 'Hassan', 'Daniel', 'Michael', 'Unisa', 'Kabba', 'Santigie'];
const GIRLS = ['Aminata', 'Fatmata', 'Mariama', 'Isatu', 'Kadiatu', 'Hawa', 'Zainab', 'Adama', 'Christiana', 'Mary', 'Elizabeth', 'Haja', 'Jeneba', 'Salamatu', 'Memunatu', 'Tenneh', 'Finda', 'Sia', 'Kumba', 'Yeama', 'Ramatu', 'Agnes', 'Grace', 'Esther', 'Musu'];
const SURNAMES = ['Kamara', 'Sesay', 'Koroma', 'Bangura', 'Conteh', 'Turay', 'Jalloh', 'Kanu', 'Mansaray', 'Fofanah', 'Kargbo', 'Williams', 'Cole', 'Johnson', 'Thomas', 'Barrie', 'Bah', 'Kallon', 'Samura', 'Lahai', 'Gbla', 'Kabia', 'Sankoh', 'Dumbuya', 'Tarawally', 'Yansaneh', 'Massaquoi', 'Macauley', 'Davies', 'Swaray'];
const ADDRESSES = ['Wilkinson Road, Freetown', 'Lumley, Freetown', 'Kissy Road, Freetown', 'Hill Station, Freetown', 'Aberdeen, Freetown', 'Murray Town, Freetown', 'Wellington, Freetown', 'Goderich, Freetown', 'Congo Cross, Freetown', 'Tengbeh Town, Freetown'];
const OCCUPATIONS = ['Trader', 'Nurse', 'Civil servant', 'Engineer', 'Teacher', 'Driver', 'Banker', 'Farmer', 'Tailor', 'Accountant', 'Businessman', 'Pharmacist'];
const phone = () => `+232 ${pick(['76', '77', '78', '88', '30', '33'])} ${int(100, 999)} ${int(100, 999)}`;

type SubjectDef = { code: string; name: string; category: string };
const SUBJECTS: SubjectDef[] = [
  { code: 'ENG', name: 'English Language', category: 'core' },
  { code: 'MTH', name: 'Mathematics', category: 'core' },
  { code: 'ISC', name: 'Integrated Science', category: 'science' },
  { code: 'SST', name: 'Social Studies', category: 'arts' },
  { code: 'CVE', name: 'Civic Education', category: 'arts' },
  { code: 'FRE', name: 'French', category: 'arts' },
  { code: 'AGR', name: 'Agricultural Science', category: 'technical' },
  { code: 'PHE', name: 'Physical Health Education', category: 'core' },
  { code: 'BIO', name: 'Biology', category: 'science' },
  { code: 'CHE', name: 'Chemistry', category: 'science' },
  { code: 'PHY', name: 'Physics', category: 'science' },
  { code: 'ECO', name: 'Economics', category: 'commercial' },
  { code: 'LIT', name: 'Literature in English', category: 'arts' },
  { code: 'GEO', name: 'Geography', category: 'arts' },
];
// Timetable order: subjects sharing a teacher sit 4 apart, so rotating the
// order by one period per class never double-books a teacher.
const JSS_ORDER = ['MTH', 'ISC', 'SST', 'FRE', 'ENG', 'AGR', 'CVE', 'PHE'];
const SSS_ORDER = ['MTH', 'ENG', 'BIO', 'ECO', 'PHY', 'LIT', 'CHE', 'GEO'];
const JSS_TIMES = [['08:00', '08:40'], ['08:40', '09:20'], ['09:20', '10:00'], ['10:20', '11:00'], ['11:00', '11:40'], ['11:40', '12:20'], ['13:00', '13:40'], ['13:40', '14:20']];
const SSS_TIMES = [['08:00', '08:45'], ['08:45', '09:30'], ['09:30', '10:15'], ['10:15', '11:00'], ['11:15', '12:00'], ['12:00', '12:45'], ['13:30', '14:15'], ['14:15', '15:00']];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const CLASSES = [
  { name: 'JSS 1', level: 'JSS 1', age: 12, room: 'Room 101', form: 'cwilliams' },
  { name: 'JSS 2', level: 'JSS 2', age: 13, room: 'Room 102', form: 'teacher' },
  { name: 'JSS 3', level: 'JSS 3', age: 14, room: 'Room 103', form: 'aturay' },
  { name: 'SSS 1', level: 'SSS 1', age: 15, room: 'Room 201', form: 'imansaray' },
  { name: 'SSS 2', level: 'SSS 2', age: 16, room: 'Room 202', form: 'skanu' },
  { name: 'SSS 3', level: 'SSS 3', age: 17, room: 'Room 203', form: 'kfofanah' },
];

/** Staff with logins. `key` is the email local part. */
const STAFF = [
  { key: 'teacher', first: 'Ibrahim', last: 'Sesay', gender: 'male', designation: 'form_teacher', department: 'Mathematics', spec: 'Mathematics', quals: 'B.Sc. Mathematics (FBC), TC', years: 9, salary: 4200, teaches: { MTH: ['JSS 1', 'JSS 2', 'JSS 3'] } },
  { key: 'cwilliams', first: 'Christiana', last: 'Williams', gender: 'female', designation: 'form_teacher', department: 'Languages', spec: 'English Language', quals: 'B.A. English (Njala), PGDE', years: 12, salary: 4400, teaches: { ENG: ['JSS 1', 'JSS 2', 'JSS 3'] } },
  { key: 'aturay', first: 'Alusine', last: 'Turay', gender: 'male', designation: 'form_teacher', department: 'Sciences', spec: 'Integrated Science', quals: 'B.Sc. Ed. Science (EBKU)', years: 7, salary: 3900, teaches: { ISC: ['JSS 1', 'JSS 2', 'JSS 3'], AGR: ['JSS 1', 'JSS 2', 'JSS 3'] } },
  { key: 'hjalloh', first: 'Hawa', last: 'Jalloh', gender: 'female', designation: 'subject_teacher', department: 'Social Sciences', spec: 'Social Studies', quals: 'B.A. History (FBC), HTC', years: 6, salary: 3700, teaches: { SST: ['JSS 1', 'JSS 2', 'JSS 3'], CVE: ['JSS 1', 'JSS 2', 'JSS 3'] } },
  { key: 'ecole', first: 'Emmanuel', last: 'Cole', gender: 'male', designation: 'subject_teacher', department: 'Languages', spec: 'French', quals: 'B.A. French (FBC)', years: 5, salary: 3600, teaches: { FRE: ['JSS 1', 'JSS 2', 'JSS 3'], PHE: ['JSS 1', 'JSS 2', 'JSS 3'] } },
  { key: 'imansaray', first: 'Isata', last: 'Mansaray', gender: 'female', designation: 'hod', department: 'Languages', spec: 'Literature in English', quals: 'M.A. Literature (FBC)', years: 14, salary: 4800, teaches: { ENG: ['SSS 1', 'SSS 2', 'SSS 3'], LIT: ['SSS 1', 'SSS 2', 'SSS 3'] } },
  { key: 'skanu', first: 'Sorie', last: 'Kanu', gender: 'male', designation: 'form_teacher', department: 'Sciences', spec: 'Physics', quals: 'B.Sc. Physics (Njala), PGDE', years: 10, salary: 4500, teaches: { MTH: ['SSS 1', 'SSS 2', 'SSS 3'], PHY: ['SSS 1', 'SSS 2', 'SSS 3'] } },
  { key: 'kfofanah', first: 'Kadiatu', last: 'Fofanah', gender: 'female', designation: 'form_teacher', department: 'Sciences', spec: 'Biology', quals: 'B.Sc. Biology (FBC)', years: 8, salary: 4300, teaches: { BIO: ['SSS 1', 'SSS 2', 'SSS 3'], CHE: ['SSS 1', 'SSS 2', 'SSS 3'] } },
  { key: 'jthomas', first: 'Joseph', last: 'Thomas', gender: 'male', designation: 'subject_teacher', department: 'Social Sciences', spec: 'Economics', quals: 'B.Sc. Economics (FBC)', years: 4, salary: 3800, teaches: { ECO: ['SSS 1', 'SSS 2', 'SSS 3'], GEO: ['SSS 1', 'SSS 2', 'SSS 3'] } },
] as const;

const SUPPORT = [
  { first: 'Lamin', last: 'Kabia', job_type: 'security', job_title: 'Head of Security', gender: 'male', salary: 1800 },
  { first: 'Yeama', last: 'Samura', job_type: 'cleaner', job_title: 'Cleaner', gender: 'female', salary: 1300 },
  { first: 'Fatu', last: 'Lahai', job_type: 'cook', job_title: 'Canteen Cook', gender: 'female', salary: 1500 },
  { first: 'Abu', last: 'Gbla', job_type: 'driver', job_title: 'School Bus Driver', gender: 'male', salary: 1700 },
];

// ── The school calendar, relative to today ────────────────────────────────────
function calendar() {
  const today = ymd(new Date());
  const now = day(today);
  const sy = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const year = `${sy}/${sy + 1}`;
  const sessionStart = `${sy}-09-01`, sessionEnd = `${sy + 1}-07-31`;
  // Same thirds the report cards use (slReportCardService.getTermDateWindows).
  const s0 = day(sessionStart).getTime(), third = (day(sessionEnd).getTime() - s0) / 3;
  const w1 = ymd(new Date(s0 + third)), w2 = ymd(new Date(s0 + 2 * third));
  const termStart = [mondayOnOrAfter(`${sy}-09-07`), mondayOnOrAfter(addDays(w1, 14)), mondayOnOrAfter(addDays(w2, 7))];
  const termEnd = [fridayOnOrBefore(w1), fridayOnOrBefore(w2), fridayOnOrBefore(`${sy + 1}-07-17`)];
  const cur = today <= w1 ? 0 : today <= w2 ? 1 : 2;
  const progress = clamp((day(today).getTime() - day(termStart[cur]).getTime()) / (day(termEnd[cur]).getTime() - day(termStart[cur]).getTime()), 0, 1);
  // Every school day so far (last 100), skipping the holidays between terms.
  const schoolDays: string[] = [];
  for (let d = termStart[0]; d <= today; d = addDays(d, 1)) {
    if (!isWeekday(d)) continue;
    if ([0, 1, 2].some((t) => d >= termStart[t] && d <= termEnd[t])) schoolDays.push(d);
  }
  return { today, sy, year, sessionStart, sessionEnd, termStart, termEnd, cur, progress, schoolDays: schoolDays.slice(-100) };
}
const TERM_KEYS = ['first_term', 'second_term', 'third_term'] as const;
const TERM_LABELS = ['First Term', 'Second Term', 'Third Term'] as const;

// ── Seed ──────────────────────────────────────────────────────────────────────
type Student = {
  id: string; sid: string; first: string; last: string; gender: 'male' | 'female'; cls: string; dob: string;
  ability: number; reliability: number; userId: string; family: string; email: string;
};
type Family = { key: string; first: string; last: string; relationship: string; email: string; phone: string; occupation: string; address: string; userId: string };

async function seedDemo() {
  const cal = calendar();
  const { today, year } = cal;
  console.log(`Seeding ${SCHOOL_NAME} for ${year} (term ${cal.cur + 1}, ${Math.round(cal.progress * 100)}% through, ${cal.schoolDays.length} school days so far)`);
  const hash = await PasswordService.hashPassword(DEMO_PASSWORD);
  const now = new Date();

  // ── School, plan and principal ──
  const [tenant] = await db('tenants').insert({
    name: SCHOOL_NAME, slug: DEMO_TENANT_SLUG, status: 'active',
    description: 'Public demo school for the WiSkul marketing site. Read-only.',
    contact_email: mail('office'), contact_phone: '+232 76 000 000', address: '12 Wilkinson Road, Freetown',
    timezone: 'Africa/Freetown', currency: 'SLE', language: 'en', max_users: 100000,
    settings: JSON.stringify({ demo: true, demo_password: DEMO_PASSWORD }),
  }).returning('*');
  const tid: string = tenant.id;

  const plan = await PlanCatalog.get('bintumani');
  const features = await PlanCatalog.featuresFor('bintumani');
  const [sub] = await db('subscriptions').insert({
    tenant_id: tid, plan_type: 'bintumani', status: 'active', is_trial: false, is_comp: true, comp_reason: 'Public demo school',
    start_date: addDays(today, -60), end_date: addDays(today, 365 * 5),
    monthly_price: (plan as any).monthly_price ?? 0, max_users: (plan as any).max_users ?? 100000,
    max_students: (plan as any).max_students ?? 100000, max_storage_gb: (plan as any).max_storage_gb ?? 100,
    features: JSON.stringify(features),
  }).returning('*');
  await db('tenants').where({ id: tid }).update({ subscription_id: sub.id });

  const [principal] = await db('users').insert({
    tenant_id: tid, email: mail('principal'), password_hash: hash, temp_password: null,
    first_name: 'Mariama', last_name: 'Kamara', role: 'principal', status: 'active',
    verification_status: 'verified', verified_at: now, onboarded_at: now,
  }).returning('*');
  const P = principal.id as string;

  const [school] = await db('schools').insert({
    tenant_id: tid, name: SCHOOL_NAME, short_name: 'WDA', email: mail('office'), phone: '+232 76 000 000',
    website: 'https://wiskulsl.com', address: '12 Wilkinson Road', city: 'Freetown', state: 'Western Area', country: 'Sierra Leone',
    founded_year: 2004, principal_name: 'Mariama Kamara', principal_email: mail('principal'), accreditation_status: 'accredited',
    timezone: 'Africa/Freetown', motto: 'Knowledge, Discipline and Service', created_by: P,
  }).returning('*');
  const config: Array<[string, string, string, boolean]> = [
    ['id_student_prefix', 'DEMO', 'string', false], ['id_staff_prefix', 'DEMOT', 'string', false],
    ['id_admission_prefix', 'DEMOA', 'string', false], ['id_separator', '-', 'string', false],
    ['id_year_format', 'none', 'string', false], ['id_padding', '4', 'number', false],
    ['school_type', 'Mixed', 'string', true], ['fin_email_manual_receipts', 'false', 'boolean', false],
  ];
  await insertMany('school_config_settings', config.map(([k, v, t, pub]) => ({
    school_id: school.school_id, tenant_id: tid, setting_key: k, setting_value: v, data_type: t, is_public: pub, created_by: P,
  })));

  const [session] = await db('academic_sessions').insert({
    tenant_id: tid, name: `${year} Academic Year`, start_date: cal.sessionStart, end_date: cal.sessionEnd, is_active: true,
  }).returning('*');
  await db('sl_report_settings').insert({ tenant_id: tid, allow_teacher_view_results: true, updated_by: P });
  log('school, Bintumani plan, principal, academic year');

  // ── Staff ──
  const staffUsers = await insertMany('users', [
    ...STAFF.map((s) => ({ tenant_id: tid, email: s.key === 'teacher' ? mail('teacher') : mail(`${s.first}.${s.last}`.toLowerCase()), password_hash: hash, temp_password: DEMO_PASSWORD, first_name: s.first, last_name: s.last, role: 'teacher', status: 'active', onboarded_at: now })),
    { tenant_id: tid, email: mail('bursar'), password_hash: hash, temp_password: DEMO_PASSWORD, first_name: 'Fatmata', last_name: 'Conteh', role: 'accountant', status: 'active', onboarded_at: now },
    { tenant_id: tid, email: mail('admissions'), password_hash: hash, temp_password: DEMO_PASSWORD, first_name: 'Abdul', last_name: 'Koroma', role: 'admissions_officer', status: 'active', onboarded_at: now },
  ], '*');
  const bursarUser = staffUsers[STAFF.length], admissionsUser = staffUsers[STAFF.length + 1];
  const teacherRows = await insertMany('teachers', staffUsers.map((u, i) => {
    const s: any = STAFF[i];
    return {
      user_id: u.id, teacher_id: `DEMOT-${String(i + 1).padStart(4, '0')}`,
      qualifications: s?.quals ?? (i === STAFF.length ? 'ACCA Level 2, B.Sc. Accounting (IPAM)' : 'B.A. Public Administration (FBC)'),
      experience_years: s?.years ?? (i === STAFF.length ? 11 : 6), specialization: s?.spec ?? null, phone: phone(),
      office_location: s ? null : i === STAFF.length ? 'Bursary' : 'Admissions Office', status: 'active',
      hire_date: `${cal.sy - (s?.years ?? 5) + 2}-09-01`, designation: s?.designation ?? (i === STAFF.length ? 'bursar' : 'administrator'),
      department: s?.department ?? (i === STAFF.length ? 'Finance' : 'Administration'), employment_type: 'full_time',
    };
  }), '*');
  const teacherByKey = new Map<string, { teacherId: string; userId: string; name: string }>();
  STAFF.forEach((s, i) => teacherByKey.set(s.key, { teacherId: teacherRows[i].id, userId: staffUsers[i].id, name: `${s.first} ${s.last}` }));
  const supportRows = await insertMany('support_staff', SUPPORT.map((s, i) => ({
    tenant_id: tid, staff_id: `SUP-${String(i + 1).padStart(4, '0')}`, first_name: s.first, last_name: s.last, job_type: s.job_type,
    job_title: s.job_title, gender: s.gender, phone: phone(), hire_date: `${cal.sy - int(2, 8)}-01-10`, employment_type: 'full_time', status: 'active', created_by: P,
  })), '*');
  log(`${staffUsers.length} staff with logins, ${supportRows.length} support staff`);

  // ── Subjects, classes, assignments, timetable ──
  const subjectRows = await insertMany('subjects', SUBJECTS.map((s) => ({
    tenant_id: tid, code: s.code, name: s.name, category: s.category, department: s.category, status: 'active', max_marks: 100, pass_marks: 40, created_by: P,
  })), '*');
  const subjectId = new Map<string, string>(subjectRows.map((r: any) => [r.code, r.id]));
  const classRows = await insertMany('classes', CLASSES.map((c) => ({
    name: c.name, level: c.level, section: 'A', capacity: 40, academic_session_id: session.id,
    class_teacher_id: teacherByKey.get(c.form)!.teacherId, room_number: c.room, building: c.name.startsWith('JSS') ? 'Junior Block' : 'Senior Block',
    status: 'active', created_by: P, is_final_year: c.name === 'SSS 3',
  })), '*');
  const classId = new Map<string, string>(classRows.map((r: any) => [r.name, r.id]));
  for (let i = 0; i < CLASSES.length - 1; i++) {
    if (CLASSES[i].name === 'JSS 3') continue; // JSS 3 sits the BECE, then SSS 1 (set by the school)
    await db('classes').where({ id: classRows[i].id }).update({ next_class_id: classRows[i + 1].id });
  }
  const orderOf = (cls: string) => (cls.startsWith('JSS') ? JSS_ORDER : SSS_ORDER);
  await insertMany('class_subjects', CLASSES.flatMap((c) => orderOf(c.name).map((code) => ({ class_id: classId.get(c.name), subject_id: subjectId.get(code) }))));
  const teacherFor = new Map<string, string>(); // `${class}|${code}` → teachers.id
  const assignments: any[] = [];
  for (const s of STAFF) {
    for (const [code, classes] of Object.entries(s.teaches)) {
      for (const cls of classes as readonly string[]) {
        teacherFor.set(`${cls}|${code}`, teacherByKey.get(s.key)!.teacherId);
        assignments.push({ teacher_id: teacherByKey.get(s.key)!.teacherId, subject_id: subjectId.get(code), class_id: classId.get(cls), start_date: cal.termStart[0] });
      }
    }
  }
  await insertMany('teacher_assignments', assignments);
  const schedules: any[] = [];
  CLASSES.forEach((c, ci) => {
    const order = orderOf(c.name), times = c.name.startsWith('JSS') ? JSS_TIMES : SSS_TIMES;
    WEEKDAYS.forEach((dayName, d) => {
      for (let p = 0; p < 8; p++) {
        const code = order[(d * 8 + p + (ci % 3)) % 8];
        schedules.push({
          class_id: classId.get(c.name), subject_id: subjectId.get(code), teacher_id: teacherFor.get(`${c.name}|${code}`),
          day_of_week: dayName, start_time: times[p][0], end_time: times[p][1], room_number: c.room,
          academic_session_id: session.id, is_published: true, published_by: P, published_at: now, created_by: P,
        });
      }
    });
  });
  await insertMany('schedules', schedules);
  log(`${subjectRows.length} subjects, ${classRows.length} classes, ${schedules.length} timetable periods`);

  // ── Students, families and logins ──
  const usedNames = new Set<string>();
  const families: Family[] = [];
  const students: Student[] = [];
  const newFamily = (last: string, demo = false): Family => {
    const mother = chance(0.55) || demo;
    const f: Family = {
      key: `F${families.length + 1}`, first: demo ? 'Aminata' : pick(mother ? GIRLS : BOYS), last,
      relationship: mother ? 'Mother' : pick(['Father', 'Father', 'Guardian', 'Uncle']),
      email: demo ? mail('parent') : mail(`parent${families.length + 1}`), phone: phone(), occupation: pick(OCCUPATIONS),
      address: pick(ADDRESSES), userId: uuid(),
    };
    families.push(f);
    return f;
  };
  const addStudent = (cls: string, first: string, last: string, gender: 'male' | 'female', fam: Family, ability?: number, reliability?: number) => {
    const n = students.length + 1;
    const age = CLASSES.find((c) => c.name === cls)!.age;
    const sid = `DEMO-${String(n).padStart(4, '0')}`;
    usedNames.add(`${first} ${last}`);
    students.push({
      id: uuid(), sid, first, last, gender, cls, dob: `${cal.sy - age}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`,
      ability: ability ?? clamp(Math.round(48 + rnd() * 40 + (rnd() - 0.5) * 10), 38, 92),
      reliability: reliability ?? (chance(0.08) ? 0.74 + rnd() * 0.08 : 0.9 + rnd() * 0.09),
      userId: uuid(), family: fam.key, email: mail(sid.toLowerCase()),
    });
  };
  // The demo family: Mohamed (JSS 2, the demo student) and his sister Isatu (SSS 1).
  const demoFamily = newFamily('Bangura', true);
  addStudent('JSS 2', 'Mohamed', 'Bangura', 'male', demoFamily, 74, 0.96);
  addStudent('SSS 1', 'Isatu', 'Bangura', 'female', demoFamily, 86, 0.98);
  // Two more sibling pairs (they get the sibling discount).
  const kamara = newFamily('Kamara'), koroma = newFamily('Koroma');
  addStudent('JSS 1', 'Fatmata', 'Kamara', 'female', kamara);
  addStudent('JSS 3', 'Alie', 'Kamara', 'male', kamara);
  addStudent('JSS 3', 'Zainab', 'Koroma', 'female', koroma);
  addStudent('SSS 2', 'Santigie', 'Koroma', 'male', koroma);
  for (const c of CLASSES) {
    while (students.filter((s) => s.cls === c.name).length < 12) {
      const gender: 'male' | 'female' = chance(0.5) ? 'male' : 'female';
      const first = pick(gender === 'male' ? BOYS : GIRLS), last = pick(SURNAMES);
      if (usedNames.has(`${first} ${last}`)) continue;
      addStudent(c.name, first, last, gender, newFamily(last));
    }
  }
  const familyOf = new Map(families.map((f) => [f.key, f]));
  await insertMany('users', [
    ...students.map((s) => ({ id: s.userId, tenant_id: tid, email: s.email, username: s.sid, password_hash: hash, temp_password: DEMO_PASSWORD, first_name: s.first, last_name: s.last, role: 'student', status: 'active', onboarded_at: now })),
    ...families.map((f) => ({ id: f.userId, tenant_id: tid, email: f.email, password_hash: hash, temp_password: DEMO_PASSWORD, first_name: f.first, last_name: f.last, role: 'parent', status: 'active', onboarded_at: now })),
  ]);
  await insertMany('students', students.map((s) => {
    const f = familyOf.get(s.family)!;
    const yearsIn = CLASSES.findIndex((c) => c.name === s.cls);
    return {
      id: s.id, tenant_id: tid, user_id: s.userId, student_id: s.sid, first_name: s.first, last_name: s.last, email: s.email,
      date_of_birth: s.dob, gender: s.gender, phone: f.phone, address: f.address, city: 'Freetown', state: 'Western Area', country: 'Sierra Leone',
      nationality: 'Sierra Leonean', religion: pick(['Islam', 'Christianity']), place_of_birth: pick(['Freetown', 'Bo', 'Makeni', 'Kenema', 'Freetown']),
      guardian_name: `${f.first} ${f.last}`, guardian_phone: f.phone, guardian_relationship: f.relationship, guardian_occupation: f.occupation,
      emergency_contact: f.phone, previous_school: yearsIn === 0 || yearsIn === 3 ? pick(['Model Primary School', 'Holy Trinity Primary', 'Freetown Secondary', 'Ahmadiyya Primary']) : null,
      enrollment_date: yearsIn === 0 ? cal.termStart[0] : `${cal.sy - (yearsIn % 3)}-09-0${int(7, 9)}`, status: 'active',
    };
  }));
  await insertMany('guardians', students.map((s) => {
    const f = familyOf.get(s.family)!;
    return { student_id: s.id, first_name: f.first, last_name: f.last, relationship: f.relationship, email: f.email, phone_number: f.phone, occupation: f.occupation, address: f.address, is_primary_guardian: true, user_id: f.userId };
  }));
  await insertMany('enrollments', students.map((s, i) => ({
    student_id: s.id, class_id: classId.get(s.cls), academic_session_id: session.id, enrollment_date: cal.termStart[0], status: 'active', roll_number: String((i % 12) + 1),
  })));
  log(`${students.length} students, ${families.length} parent accounts`);

  // ── Attendance (students + staff) ──
  const formTeacherUser = (cls: string) => teacherByKey.get(CLASSES.find((c) => c.name === cls)!.form)!.userId;
  const att: any[] = [];
  for (const d of cal.schoolDays) {
    for (const s of students) {
      const r = rnd();
      const status = r < s.reliability ? (chance(0.06) ? 'late' : 'present') : chance(0.15) ? 'excused' : 'absent';
      att.push({
        student_id: s.id, class_id: classId.get(s.cls), attendance_date: d, status, marked_by: formTeacherUser(s.cls),
        remarks: status === 'excused' ? pick(['Sick, note from parent', 'Family event', 'Hospital appointment']) : status === 'late' ? 'Arrived after assembly' : null,
        session_type: 'full_day', check_in_time: status === 'present' ? `07:${int(35, 59)}` : status === 'late' ? `08:${String(int(10, 40))}` : null,
        marked_at: at(d, '08:20'), created_at: at(d, '08:20'), updated_at: at(d, '08:20'),
      });
    }
  }
  await insertMany('attendance', att);
  const tatt: any[] = [];
  for (const d of cal.schoolDays.slice(-30)) {
    for (const [i, t] of teacherRows.entries()) {
      const late = chance(0.07), absent = chance(0.03);
      const status = absent ? 'absent' : late ? 'late' : 'present';
      const signIn = absent ? null : at(d, late ? `08:${String(int(5, 25)).padStart(2, '0')}` : `07:${int(25, 55)}`);
      tatt.push({
        tenant_id: tid, teacher_id: t.id, attendance_date: d, status, marked_by: staffUsers[i].id, marked_at: signIn || at(d, '09:00'),
        signed_in_at: signIn, signed_out_at: absent || d === today ? null : at(d, `15:${int(10, 55)}`),
        remarks: absent ? 'Called in sick' : null,
      });
    }
  }
  await insertMany('teacher_attendance', tatt);
  log(`${att.length} attendance marks, ${tatt.length} staff sign-ins`);

  return { cal, tid, P, session, students, families, familyOf, classId, subjectId, teacherFor, teacherByKey, teacherRows, staffUsers, bursarUser, admissionsUser, supportRows };
}

type Ctx = Awaited<ReturnType<typeof seedDemo>>;

const CONDUCT_COMMENTS: Array<[number, string]> = [
  [80, 'An outstanding term. Keep up the excellent work and continue to lead by example.'],
  [70, 'A very good term. With a little more effort in weaker subjects, distinction is within reach.'],
  [60, 'Good progress this term. More revision at home will raise these results further.'],
  [50, 'A fair term. Needs to concentrate more in class and complete all homework.'],
  [0, 'Below expectations this term. Extra lessons and close support from home are recommended.'],
];
const commentFor = (pct: number) => CONDUCT_COMMENTS.find(([min]) => pct >= min)![1];

async function seedAcademics(c: Ctx) {
  const { cal, tid, P, students, classId, subjectId, teacherFor, teacherByKey } = c;
  const year = cal.year;
  const subjOffset = new Map<string, number>();
  for (const s of students) for (const code of SUBJECTS.map((x) => x.code)) subjOffset.set(`${s.id}|${code}`, (rnd() - 0.5) * 18);

  // Which tests exist: every finished term, and the current term so far.
  const terms: Array<{ t: number; tests: 1 | 2 }> = [];
  for (let t = 0; t <= cal.cur; t++) terms.push({ t, tests: t < cal.cur || cal.progress >= 0.7 ? 2 : 1 });
  const published = terms.filter((x) => x.t < cal.cur).map((x) => x.t);
  if (!published.length && terms.length) published.push(cal.cur); // first term: release the mid-term (Test 1) results

  const results: any[] = [], summaries: any[] = [], ratings: any[] = [];
  for (const cls of CLASSES) {
    const roster = students.filter((s) => s.cls === cls.name);
    const order = cls.name.startsWith('JSS') ? JSS_ORDER : SSS_ORDER;
    const formUser = teacherByKey.get(cls.form)!.userId;
    for (const { t, tests } of terms) {
      const rows: any[] = [];
      for (const s of roster) {
        for (const code of order) {
          const base = s.ability + subjOffset.get(`${s.id}|${code}`)! + (t * 1.5);
          const t1 = Math.round(clamp(base + (rnd() - 0.5) * 14, 22, 99));
          const t2 = tests === 2 ? Math.round(clamp(base + 2 + (rnd() - 0.5) * 14, 22, 99)) : null;
          const teacherUser = Array.from(teacherByKey.values()).find((x) => x.teacherId === teacherFor.get(`${cls.name}|${code}`))!.userId;
          rows.push({
            id: uuid(), tenant_id: tid, student_id: s.id, subject_id: subjectId.get(code), class_id: classId.get(cls.name), academic_year: year,
            term: TERM_KEYS[t], test1: t1, test2: t2, mean: t2 == null ? round1(t1) : round1((t1 + t2) / 2), entered_by: teacherUser,
            is_locked: published.includes(t), locked_at: published.includes(t) ? new Date() : null, locked_by: published.includes(t) ? P : null,
            _code: code,
          });
        }
      }
      for (const code of order) {
        const group = rows.filter((r) => r._code === code);
        const ranks = rank(group, (r) => Number(r.mean));
        group.forEach((r) => { r.subject_rank = ranks.get(r); });
      }
      const per = roster.map((s) => {
        const mine = rows.filter((r) => r.student_id === s.id);
        const total = mine.reduce((a, r) => a + Number(r.mean), 0);
        return { s, combined: round1(total), pct: round1(total / mine.length) };
      });
      const pos = rank(per, (p) => p.combined);
      for (const p of per) {
        const pub = published.includes(t);
        summaries.push({
          tenant_id: tid, student_id: p.s.id, class_id: classId.get(cls.name), academic_year: year, term: TERM_KEYS[t],
          combined_score: p.combined, percentage: p.pct, position: pos.get(p), class_size: roster.length,
          conduct: pub ? (p.s.reliability < 0.85 ? 'S' : p.pct >= 70 ? 'V.G' : 'G') : null,
          teacher_comment: pub ? commentFor(p.pct) : null, teacher_signed_by: pub ? formUser : null,
        });
        if (pub) {
          for (const domain of ['affective', 'psychomotor']) {
            for (let k = 1; k <= 12; k++) {
              const baseR = p.pct >= 70 ? 4 : p.pct >= 55 ? 3 : 3;
              ratings.push({
                tenant_id: tid, student_id: p.s.id, class_id: classId.get(cls.name), academic_year: year, term: TERM_KEYS[t], domain, trait_index: k,
                rating1: clamp(baseR + int(-1, 1), 1, 5), rating2: clamp(baseR + int(-1, 1), 1, 5), entered_by: formUser,
              });
            }
          }
        }
      }
      results.push(...rows.map(({ _code, ...r }) => r));
    }
  }
  await insertMany('sl_subject_results', results);
  await insertMany('sl_term_summaries', summaries);
  await insertMany('sl_domain_ratings', ratings);
  await insertMany('sl_report_card_meta', students.map((s) => {
    const latest = summaries.filter((x) => x.student_id === s.id && x.teacher_comment).pop();
    return {
      tenant_id: tid, student_id: s.id, class_id: classId.get(s.cls), academic_year: year, principal_signed_by: P,
      principal_comment: latest ? (latest.percentage >= 70 ? 'Excellent performance. Well done.' : latest.percentage >= 55 ? 'Good work. Aim higher next term.' : 'Can do better. The school expects more effort.') : null,
      average_age: String(CLASSES.find((x) => x.name === s.cls)!.age),
    };
  }));
  const pubRows: any[] = [];
  for (const cls of CLASSES) for (const t of published) {
    pubRows.push({ tenant_id: tid, class_id: classId.get(cls.name), academic_year: year, term: TERM_KEYS[t], is_published: true, published_at: at(t < cal.cur ? cal.termEnd[t] : cal.today, '12:00'), published_by: P });
  }
  await insertMany('sl_report_publications', pubRows);
  log(`${results.length} subject scores, report cards released for ${published.map((t) => TERM_LABELS[t]).join(', ')}`);

  // ── Homework and assignments ──
  const ASSIGN = [
    ['Algebraic expressions worksheet', 'Simplify the 20 expressions on page 34 and show every step.', 'homework'],
    ['Reading comprehension: "The Harmattan"', 'Read the passage and answer questions 1 to 10 in full sentences.', 'homework'],
    ['Plant parts project', 'Collect and label five local plants. Present them on a chart.', 'project'],
    ['Map of Sierra Leone', 'Draw the map and mark the 16 districts and their headquarter towns.', 'classwork'],
    ['Essay: My community', 'Write a 300-word essay about a person who helps your community.', 'homework'],
    ['Quadratic equations practice', 'Solve exercises 4A, questions 1 to 15.', 'homework'],
    ['Cell structure diagram', 'Draw and label an animal cell and a plant cell. List three differences.', 'classwork'],
    ['Market survey', 'Visit a local market and record the prices of five goods over a week.', 'project'],
  ] as const;
  const assignments: any[] = [], subs: any[] = [];
  for (const cls of CLASSES) {
    const order = cls.name.startsWith('JSS') ? JSS_ORDER : SSS_ORDER;
    const roster = students.filter((s) => s.cls === cls.name);
    const plan = [-21, -12, -5, 3, 9]; // due dates relative to today
    plan.forEach((offset, i) => {
      const [title, description, type] = ASSIGN[(CLASSES.indexOf(cls) + i) % ASSIGN.length];
      const code = order[(i * 3 + CLASSES.indexOf(cls)) % order.length];
      const due = addDays(cal.today, offset);
      if (due < cal.termStart[0]) return;
      const tId = teacherFor.get(`${cls.name}|${code}`)!;
      const tUser = Array.from(teacherByKey.values()).find((x) => x.teacherId === tId)!.userId;
      const id = uuid();
      assignments.push({
        id, title, description, class_id: classId.get(cls.name), subject_id: subjectId.get(code), teacher_id: tId, type,
        assigned_date: addDays(due, -7) > cal.today ? cal.today : addDays(due, -7), due_date: due, max_marks: type === 'project' ? 50 : 20, status: 'active',
        instructions: 'Submit before the due date. Late work loses marks.', created_by: tUser,
        created_at: at(addDays(due, -7) > cal.today ? cal.today : addDays(due, -7), '09:00'),
      });
      for (const s of roster) {
        const max = type === 'project' ? 50 : 20;
        if (offset < 0) {
          const handedIn = chance(s.reliability);
          if (!handedIn) { subs.push({ assignment_id: id, student_id: s.id, status: 'pending' }); continue; }
          const late = chance(0.1);
          const graded = offset <= -12 || chance(0.5);
          subs.push({
            assignment_id: id, student_id: s.id, status: graded ? 'graded' : late ? 'late' : 'submitted',
            submission_text: 'Completed in my exercise book and handed to the teacher.', submitted_at: at(addDays(due, late ? 1 : -1), '16:30'),
            marks_obtained: graded ? Math.round(clamp((s.ability / 100) * max + (rnd() - 0.5) * max * 0.25, 2, max)) : null,
            teacher_feedback: graded ? pick(['Good work.', 'Neat and correct.', 'Show your working.', 'Well done, keep it up.', 'Revise this topic.']) : null,
            graded_by: graded ? tUser : null, graded_at: graded ? at(addDays(due, 3), '14:00') : null,
          });
        } else if (offset <= 3 && chance(0.35)) {
          subs.push({ assignment_id: id, student_id: s.id, status: 'submitted', submission_text: 'Done.', submitted_at: at(addDays(cal.today, -1), '18:00') });
        }
      }
    });
  }
  await insertMany('assignments', assignments);
  await insertMany('assignment_submissions', subs);
  log(`${assignments.length} assignments, ${subs.length} submissions`);
}

// ── Finance (through the app's own services) ─────────────────────────────────
async function seedFinance(c: Ctx) {
  const { cal, tid, P, students, classId, bursarUser, teacherByKey, teacherRows, staffUsers, supportRows } = c;
  const B = bursarUser.id as string;
  const year = cal.year;
  const { discountService } = await import('../src/services/finance/discountService');
  const { planService } = await import('../src/services/finance/planService');
  const { expenseService } = await import('../src/services/finance/expenseService');
  const { budgetService } = await import('../src/services/finance/budgetService');
  const { pettyCashService } = await import('../src/services/finance/pettyCashService');
  const { payrollService } = await import('../src/services/finance/payrollService');
  const { glService } = await import('../src/services/finance/glService');

  // Fee structures: tuition per term + year charges billed with Term 1.
  const structures = new Map<string, any>();
  const structureCharges = new Map<string, Array<{ label: string; amount: number; required: boolean }>>();
  for (const cls of CLASSES) {
    const jss = cls.name.startsWith('JSS');
    const [s] = await db('fee_structures').insert({
      tenant_id: tid, class_id: classId.get(cls.name), academic_year: year,
      term1_tuition: jss ? 1500 : 2000, term2_tuition: jss ? 1200 : 1700, term3_tuition: jss ? 1200 : 1700,
      min_percent_new: 50, min_percent_continuing: 30, min_percent_term: 25, allow_installments: true,
      charges_compulsory_first_term: true, late_fee_percent: null,
      policy_notes: 'At least 30% of the term fees is due by the first week. Balances can be paid in instalments agreed with the bursary.',
      created_by: P, created_at: new Date(), updated_at: new Date(),
    }).returning('*');
    const expenses = [
      { label: 'Uniform & badge', amount: 350, required: true },
      { label: 'PTA levy', amount: 100, required: true },
      ...(jss ? [{ label: 'Exercise books', amount: 150, required: true }] : [{ label: 'Laboratory fee', amount: 200, required: true }]),
      { label: 'Sports & clubs', amount: 75, required: false },
      ...(cls.name === 'SSS 3' ? [{ label: 'WASSCE registration', amount: 600, required: true }] : []),
    ];
    await db('fee_structure_expenses').insert(expenses.map((e) => ({ structure_id: s.id, ...e, created_at: new Date() })));
    structures.set(cls.name, s);
    structureCharges.set(cls.name, expenses);
  }

  // Discounts: sibling, scholarship and staff child (principal-approved).
  const sibling = await discountService.createRule(tid, P, { name: 'Sibling discount', kind: 'sibling', basis: 'percent', value: 10, applies_to: 'tuition', description: '10% off tuition for the second and later children of a family.' });
  const scholarship = await discountService.createRule(tid, P, { name: 'Academic merit scholarship', kind: 'scholarship', basis: 'percent', value: 50, applies_to: 'tuition', description: 'Half tuition for the top performers of the previous year.' });
  const staffChild = await discountService.createRule(tid, P, { name: 'Staff child', kind: 'staff_child', basis: 'percent', value: 25, applies_to: 'tuition', description: '25% off tuition for children of staff.' });
  const byName = (first: string, last: string) => students.find((s) => s.first === first && s.last === last)!;
  const scholars = students.filter((s) => s.cls.startsWith('SSS') && s.last !== 'Bangura').sort((a, b) => b.ability - a.ability).slice(0, 2);
  const staffKid = students.find((s) => s.cls === 'JSS 1' && s.last !== 'Kamara')!;
  const grants: Array<{ s: any; rule: any; reason: string }> = [
    { s: byName('Isatu', 'Bangura'), rule: sibling, reason: 'Second child; brother Mohamed is in JSS 2' },
    { s: byName('Alie', 'Kamara'), rule: sibling, reason: 'Sister Fatmata is in JSS 1' },
    { s: byName('Santigie', 'Koroma'), rule: sibling, reason: 'Sister Zainab is in JSS 3' },
    ...scholars.map((s) => ({ s, rule: scholarship, reason: 'Top 3 in the end-of-year examinations' })),
    { s: staffKid, rule: staffChild, reason: 'Parent works at the school' },
  ];
  const grantRows = await insertMany('discount_grants', grants.map((g) => ({
    tenant_id: tid, student_id: g.s.id, rule_id: g.rule.id, label: g.rule.name, academic_year: year, term: null,
    basis: g.rule.basis, value: g.rule.value, applies_to: g.rule.applies_to, reason: g.reason, status: 'approved',
    requested_by: B, decided_by: P, decided_at: new Date(), decision_reason: 'Approved by the principal',
  })), '*');

  // Billing, discounts, invoices and payments are worked out in memory and
  // written in bulk: the same rows billOneTerm, discountService.applyGrant,
  // InvoiceService.generateInvoice and PaymentService.recordAcrossFees write,
  // in a handful of queries instead of thousands (a remote database drops
  // connections on long runs).
  const statusFor = (amount: number, balance: number) => (balance <= 0.005 ? 'paid' : balance < round2(amount) - 0.005 ? 'partial' : 'pending');
  const fees: any[] = [];
  for (let t = 0; t <= cal.cur; t++) {
    const due = addDays(cal.termStart[t], 21);
    const billedAt = at(addDays(cal.termStart[t], -7), '09:00');
    for (const s of students) {
      const st = structures.get(s.cls);
      const tuition = Number(st[`term${t + 1}_tuition`]) || 0;
      const base = { tenant_id: tid, student_id: s.id, class_id: classId.get(s.cls), source: 'structure', term: TERM_LABELS[t], academic_year: year, due_date: due, status: 'pending', created_at: billedAt, updated_at: billedAt };
      if (tuition > 0) fees.push({ ...base, id: uuid(), type: 'Tuition', amount: tuition, balance: tuition });
      if (t === 0) for (const e of structureCharges.get(s.cls)!) fees.push({ ...base, id: uuid(), type: e.label, description: 'Academic year expense', amount: e.amount, balance: e.amount, required: e.required });
    }
  }
  const adjustments: any[] = [];
  for (const g of grantRows) {
    const covered = fees.filter((f) => f.student_id === g.student_id && (g.applies_to !== 'tuition' || f.type === 'Tuition')).sort((a, b) => a.due_date.localeCompare(b.due_date));
    for (const f of covered) {
      const apply = round2(Math.min(f.balance, g.basis === 'percent' ? (f.amount * Number(g.value)) / 100 : Number(g.value)));
      if (apply <= 0) continue;
      adjustments.push({ tenant_id: tid, fee_id: f.id, student_id: f.student_id, kind: 'discount', amount: apply, reason: `${g.label}${g.reason ? `: ${g.reason}` : ''}`, discount_grant_id: g.id, created_by: null, created_at: f.created_at });
      f.balance = round2(f.balance - apply);
      f.status = statusFor(f.amount, f.balance);
    }
  }
  await insertMany('fees', fees);
  await insertMany('fee_adjustments', adjustments);
  log(`fee structures, ${grantRows.length} discounts, terms billed: ${TERM_LABELS.slice(0, cal.cur + 1).join(', ')}`);

  // One invoice per student per term (before payments, like a real bursary).
  const invoiceRows: any[] = [], invoiceItems: any[] = [];
  for (const s of students) {
    for (let t = 0; t <= cal.cur; t++) {
      const mine = fees.filter((f) => f.student_id === s.id && f.term === TERM_LABELS[t] && f.status !== 'paid');
      if (!mine.length) continue;
      const total = round2(mine.reduce((a, f) => a + f.amount, 0)), bal = round2(mine.reduce((a, f) => a + f.balance, 0));
      const id = uuid(), issued = at(addDays(cal.termStart[t], -7), '10:00');
      invoiceRows.push({
        id, tenant_id: tid, academic_year: year, term: TERM_LABELS[t], student_id: s.id,
        invoice_number: `INV-${issued.getTime() + invoiceRows.length}-${crypto.randomBytes(5).toString('hex').slice(0, 9)}`,
        total_amount: total, total_paid: round2(total - bal), balance: bal, status: bal === 0 ? 'paid' : 'pending',
        due_date: addDays(cal.termStart[t], 21), notes: `${TERM_LABELS[t]} fees, ${year}`, generated_by: B, generated_at: issued, created_at: issued,
      });
      for (const f of mine) invoiceItems.push({ id: uuid(), invoice_id: id, fee_id: f.id, created_at: issued });
    }
  }

  // Payments: most families pay in full, some part, a few not yet.
  const methods = ['cash', 'cash', 'cash', 'mobile_money', 'mobile_money', 'mobile_money', 'bank_transfer', 'bank_transfer'];
  const partialThisTerm: string[] = [];
  const events: Array<{ s: Student; t: number; amount: number; date: string; method: string; ref: string | null; notes: string | null }> = [];
  const rankFee = (f: any) => (f.type === 'Tuition' ? 0 : f.required === false ? 2 : 1);
  for (const s of students) {
    for (let t = 0; t <= cal.cur; t++) {
      const termFees = fees.filter((f) => f.student_id === s.id && f.term === TERM_LABELS[t]);
      const owed = round2(termFees.reduce((a: number, f: any) => a + Number(f.balance || 0), 0));
      if (owed <= 0) continue;
      const current = t === cal.cur;
      let share: number;
      if (s.first === 'Mohamed' && s.last === 'Bangura' && current) share = 0.6;
      else if (s.first === 'Isatu' && s.last === 'Bangura') share = 1;
      else {
        const r = rnd();
        const pFull = current ? 0.3 + 0.45 * cal.progress : 0.8;
        share = r < pFull ? 1 : r < pFull + (current ? 0.4 : 0.15) ? 0.35 + rnd() * 0.5 : 0;
      }
      if (share <= 0) continue;
      const total = share >= 1 ? owed : Math.round(owed * share / 50) * 50 || 50;
      const parts = share >= 1 && chance(0.4) ? [Math.round(total * 0.6 / 50) * 50, 0] : [total];
      if (parts.length === 2) parts[1] = round2(total - parts[0]);
      const from = addDays(cal.termStart[t], -10);
      const to = [cal.today, addDays(cal.termStart[t], 50)].sort()[0];
      const span = Math.max(0, Math.round((day(to).getTime() - day(from).getTime()) / 86400000));
      const dates = parts.map((_, i) => addDays(from, Math.floor(span * (parts.length === 1 ? rnd() : i === 0 ? rnd() * 0.4 : 0.5 + rnd() * 0.5)))).sort();
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] <= 0) continue;
        const method = pick(methods);
        events.push({
          s, t, amount: parts[i], date: dates[i] > cal.today ? cal.today : dates[i], method,
          ref: method === 'mobile_money' ? `OM${int(10000000, 99999999)}` : method === 'bank_transfer' ? `RCB-${int(100000, 999999)}` : null,
          notes: method === 'cash' ? 'Paid at the bursary' : null,
        });
      }
      if (current && share < 1) partialThisTerm.push(s.id);
    }
  }
  // Settle in date order, oldest charge first, with sequential receipt numbers per year.
  events.sort((a, b) => a.date.localeCompare(b.date));
  const seq = new Map<number, number>();
  const paymentRows: any[] = [];
  for (const e of events) {
    const open = fees.filter((f) => f.student_id === e.s.id && f.term === TERM_LABELS[e.t] && f.balance > 0.005).sort((a, b) => rankFee(a) - rankFee(b));
    let remaining = round2(Math.min(e.amount, open.reduce((a, f) => a + f.balance, 0)));
    if (remaining <= 0) continue;
    const y = Number(e.date.slice(0, 4));
    seq.set(y, (seq.get(y) || 0) + 1);
    const receipt = `RCP-${y}-${String(seq.get(y)).padStart(6, '0')}`;
    const when = at(e.date, `${String(int(8, 15)).padStart(2, '0')}:${int(10, 59)}`);
    const mine: any[] = [];
    for (const f of open) {
      if (remaining <= 0.005) break;
      const pay = round2(Math.min(f.balance, remaining));
      f.balance = round2(f.balance - pay) <= 0.005 ? 0 : round2(f.balance - pay);
      f.status = f.balance === 0 ? 'paid' : 'partial';
      remaining = round2(remaining - pay);
      mine.push({
        id: uuid(), tenant_id: tid, fee_id: f.id, student_id: f.student_id, amount: pay, method: e.method, payment_method: e.method,
        transaction_reference: e.ref, notes: e.notes, payment_date: e.date, status: 'completed', created_by: B, recorded_by: B,
        idempotency_key: null, receipt_number: receipt, created_at: when, updated_at: when,
      });
    }
    const after = round2(fees.filter((f) => f.student_id === e.s.id).reduce((a, f) => a + f.balance, 0));
    for (const p of mine) p.balance_after = after;
    paymentRows.push(...mine);
  }
  // Fees now carry their final balance; invoices follow the ledger.
  for (const inv of invoiceRows) {
    const bal = round2(invoiceItems.filter((it) => it.invoice_id === inv.id).reduce((a, it) => a + fees.find((f) => f.id === it.fee_id)!.balance, 0));
    const paid = round2(inv.total_amount - bal);
    inv.balance = bal; inv.total_paid = paid;
    inv.status = bal <= 0 ? 'paid' : paid > 0 ? 'partial' : inv.due_date < cal.today ? 'overdue' : 'pending';
  }
  await db.transaction(async (trx) => {
    for (let i = 0; i < fees.length; i += 500) {
      const chunk = fees.slice(i, i + 500);
      await trx.raw(
        `UPDATE fees f SET balance = v.b::numeric, status = v.s, updated_at = NOW() FROM (VALUES ${chunk.map(() => '(?::uuid, ?, ?)').join(', ')}) AS v(id, b, s) WHERE f.id = v.id`,
        chunk.flatMap((f) => [f.id, String(f.balance), f.status]),
      );
    }
    for (let i = 0; i < paymentRows.length; i += 500) await trx('payments').insert(paymentRows.slice(i, i + 500));
    for (let i = 0; i < invoiceRows.length; i += 500) await trx('invoices').insert(invoiceRows.slice(i, i + 500));
    for (let i = 0; i < invoiceItems.length; i += 500) await trx('invoice_items').insert(invoiceItems.slice(i, i + 500));
    for (const [y, n] of seq) {
      await trx.raw(
        `INSERT INTO finance_sequences (tenant_id, key, value) VALUES (?, ?, ?)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = finance_sequences.value + EXCLUDED.value`,
        [tid, `receipt:${y}`, n],
      );
    }
  });
  log(`${invoiceRows.length} invoices, ${new Set(paymentRows.map((p) => p.receipt_number)).size} receipts`);

  // Payment plans for a few families paying the rest in instalments.
  const demoKid = byName('Mohamed', 'Bangura');
  const planFor = [demoKid.id, ...partialThisTerm.filter((id) => id !== demoKid.id).slice(0, 2)];
  for (const sid of planFor) {
    try {
      await planService.create(tid, B, { student_id: sid, academic_year: year, term: TERM_LABELS[cal.cur], count: 3, first_due_date: addDays(cal.today, 7), months_apart: 1, notes: 'Agreed with the parent at the bursary.' });
    } catch (e: any) { log(`payment plan skipped: ${e?.message || e}`); }
  }

  // Running costs: monthly bills and one-off purchases (never in the future).
  const termKeyOf = (d: string) => (d <= cal.termEnd[0] || d < cal.termStart[1] ? 'first_term' : d < cal.termStart[2] ? 'second_term' : 'third_term');
  const expenses: any[] = [];
  for (let m = 0; m < 11; m++) {
    const mStart = new Date(Date.UTC(cal.sy, 8 + m, 1));
    const ym = ymd(mStart).slice(0, 7);
    const monthly = [
      [5, 'Utilities', 1350, 'EDSA', 'bank_transfer', `Electricity bill for ${ym}`],
      [8, 'Administration', 950, 'Africell Business', 'mobile_money', `Office internet for ${ym}`],
      [12, 'Utilities', 280, 'Guma Valley Water', 'cash', `Water bill for ${ym}`],
      [15, 'Transport', 2600, 'NP Fuel Station, Wilkinson Road', 'cash', `School bus fuel for ${ym}`],
      [22, 'Utilities', 1800, 'TotalEnergies', 'cash', `Generator diesel for ${ym}`],
    ] as const;
    for (const [d, category, amount, vendor, method, description] of monthly) {
      expenses.push({ date: `${ym}-${String(d).padStart(2, '0')}`, category, amount: amount + int(-2, 2) * 25, vendor, payment_method: method, description });
    }
  }
  const oneOff = [
    [cal.termStart[0], -5, 'Supplies', 6500, 'Freetown Bookshop', 'bank_transfer', 'Teachers\u2019 textbooks and guides'],
    [cal.termStart[0], -3, 'Supplies', 420, 'Ola During Stationers', 'cash', 'Chalk, markers and dusters'],
    [cal.termStart[0], 0, 'Events', 1500, 'Hill Station Caterers', 'cash', 'Opening ceremony refreshments and PA hire'],
    [cal.termStart[0], 18, 'Maintenance', 1950, 'Kissy Power Services', 'cash', 'Generator servicing and new filters'],
    [cal.termStart[0], 24, 'Supplies', 2300, 'Lab Scientific SL', 'bank_transfer', 'Chemistry and biology lab reagents'],
    [cal.termStart[0], 45, 'Maintenance', 3200, 'Bai Bureh Roofing', 'cash', 'Roof repair, Junior Block'],
    [cal.termStart[0], 60, 'Events', 2800, 'Various vendors', 'cash', 'Inter-house sports: medals, water and canopies'],
    [cal.termStart[1], 5, 'Administration', 1400, 'Print Express', 'cash', 'Printing of mid-term examination papers'],
    [cal.termStart[1], 30, 'Maintenance', 900, 'Freetown Plumbers', 'cash', 'Plumbing, girls\u2019 washrooms'],
    [cal.termStart[2], 10, 'Events', 2500, 'Various vendors', 'cash', 'Prize-giving day'],
  ] as const;
  for (const [base, offset, category, amount, vendor, method, description] of oneOff) {
    expenses.push({ date: addDays(base, offset), category, amount, vendor, payment_method: method, description });
  }
  let expenseCount = 0;
  for (const e of expenses.filter((x) => x.date >= cal.sessionStart && x.date <= cal.today).sort((a, b) => a.date.localeCompare(b.date))) {
    await expenseService.create(tid, B, {
      category: e.category, amount: e.amount, expense_date: e.date, payment_method: e.payment_method, term: termKeyOf(e.date),
      description: e.description, vendor: e.vendor, reference: e.payment_method === 'bank_transfer' ? `CHQ-${int(1000, 9999)}` : null,
    });
    expenseCount++;
  }
  await budgetService.save(tid, B, year, {
    notes: `Operating budget for ${year}, approved by the board.`,
    lines: [
      { category: 'Salaries', amount: 520000 }, { category: 'Statutory (PAYE/NASSIT)', amount: 52000 }, { category: 'Utilities', amount: 42000 },
      { category: 'Supplies', amount: 24000 }, { category: 'Maintenance', amount: 15000 }, { category: 'Transport', amount: 30000 },
      { category: 'Events', amount: 12000 }, { category: 'Administration', amount: 16000 },
    ],
  });
  await budgetService.approve(tid, P, year);
  const fund = await pettyCashService.saveFund(tid, B, { name: 'Office float', float_amount: 2000, custodian_user_id: B });
  await pettyCashService.addEntry(tid, B, fund.id, { kind: 'top_up', amount: 2000, entry_date: cal.termStart[0], money_account: 'bank', description: 'Opening float' });
  const spends = [
    [3, 120, 'Transport', 'Taxi to the bank with fee deposits'], [9, 260, 'Supplies', 'Cleaning supplies'], [16, 340, 'Supplies', 'First aid kit refill'],
    [23, 450, 'Food & Catering', 'Refreshments for the PTA executive meeting'], [27, 180, 'Administration', 'Photocopying of class registers'],
  ] as const;
  for (const [offset, amount, category, description] of spends) {
    const d = addDays(cal.termStart[0], offset);
    if (d <= cal.today) await pettyCashService.addEntry(tid, B, fund.id, { kind: 'spend', amount, entry_date: d, category, description });
  }
  log(`${expenseCount} expenses, approved budget, petty cash`);

  // Payroll: every finished month paid; this month waiting for approval.
  const banks = ['Rokel Commercial Bank', 'Sierra Leone Commercial Bank', 'Ecobank', 'UBA'];
  for (const [i, t] of teacherRows.entries()) {
    const s: any = STAFF[i];
    const salary = s?.salary ?? (i === STAFF.length ? 4200 : 3600);
    await payrollService.saveProfile(tid, P, {
      staff_kind: 'staff', staff_ref_id: t.id, basic_salary: salary,
      allowances: [{ name: 'Transport', amount: 300, taxable: true }, ...(salary >= 4300 ? [{ name: 'Responsibility', amount: 400, taxable: true }] : [])],
      deductions: chance(0.3) ? [{ name: 'Staff welfare', amount: 50 }] : [], paye_applies: true, nassit_applies: true,
      payment_method: 'bank', bank_name: pick(banks), account_number: `00${int(10000000, 99999999)}`,
    }, 'principal');
  }
  for (const [i, s] of supportRows.entries()) {
    await payrollService.saveProfile(tid, P, {
      staff_kind: 'support', staff_ref_id: s.id, basic_salary: SUPPORT[i].salary, allowances: [{ name: 'Transport', amount: 200, taxable: true }],
      deductions: [], paye_applies: true, nassit_applies: true, payment_method: 'mobile_money', bank_name: 'Orange Money', account_number: `076${int(100000, 999999)}`,
    }, 'principal');
  }
  const thisMonth = cal.today.slice(0, 7);
  let runs = 0;
  for (let m = 0; m < 11; m++) {
    const period = ymd(new Date(Date.UTC(cal.sy, 8 + m, 1))).slice(0, 7);
    if (period > thisMonth) break;
    const run: any = await payrollService.generate(tid, B, period);
    runs++;
    if (period === thisMonth) break; // draft, waiting for the principal
    const runId = run?.run?.id || run?.id;
    await payrollService.approve(tid, P, runId);
    let payDay = fridayOnOrBefore(addDays(ymd(new Date(Date.UTC(cal.sy, 9 + m, 1))), -1));
    if (payDay > cal.today) payDay = cal.today;
    await payrollService.markPaid(tid, B, runId, payDay, 'bank');
  }
  log(`${teacherRows.length + supportRows.length} pay profiles, ${runs} pay runs`);

  await glService.sync(tid);
  log('accounting books posted');
  void staffUsers; void teacherByKey;
}

// ── Admissions, discipline, events, communication, ID cards ──────────────────
async function seedCommunity(c: Ctx) {
  const { cal, tid, P, students, families, classId, teacherByKey, admissionsUser, bursarUser, staffUsers } = c;
  const A = admissionsUser.id as string;
  const year = cal.year;
  const ago = (days: number, hhmm = '10:00') => at(addDays(cal.today, -days), hhmm);
  const ahead = (days: number, hhmm = '10:00') => at(addDays(cal.today, days), hhmm);
  const teacherUser = teacherByKey.get('teacher')!.userId;

  // ── Admissions pipeline (next intake) ──
  const APPS: Array<{ status: string; cls: string; days: number; online: boolean; score?: number; note?: string; interviewIn?: number }> = [
    { status: 'pending', cls: 'JSS 1', days: 1, online: true }, { status: 'pending', cls: 'SSS 1', days: 2, online: true },
    { status: 'pending', cls: 'JSS 2', days: 3, online: false }, { status: 'pending', cls: 'JSS 1', days: 4, online: true },
    { status: 'under_review', cls: 'JSS 1', days: 6, online: true, note: 'Documents received, checking previous report.' },
    { status: 'under_review', cls: 'SSS 1', days: 8, online: false, note: 'BECE results requested from previous school.' },
    { status: 'under_review', cls: 'JSS 3', days: 9, online: true },
    { status: 'interview_scheduled', cls: 'JSS 1', days: 10, online: true, interviewIn: 2 },
    { status: 'interview_scheduled', cls: 'SSS 2', days: 12, online: false, interviewIn: 4 },
    { status: 'interview_scheduled', cls: 'JSS 2', days: 13, online: true, interviewIn: 6 },
    { status: 'approved', cls: 'JSS 1', days: 18, online: true, score: 78, note: 'Strong entrance test and interview.' },
    { status: 'approved', cls: 'SSS 1', days: 20, online: false, score: 71, note: 'Good BECE results.' },
    { status: 'waitlist', cls: 'SSS 1', days: 22, online: true, score: 58, note: 'SSS 1 science stream is full for now.' },
    { status: 'rejected', cls: 'SSS 2', days: 25, online: false, score: 34, note: 'Did not meet the entrance test standard.' },
    { status: 'withdrawn', cls: 'JSS 2', days: 27, online: true, note: 'Family relocated to Bo.' },
    { status: 'enrolled', cls: 'JSS 1', days: 30, online: false, score: 82, note: 'Accepted at the office.' },
  ];
  const enrolledStudent = students.filter((s) => s.cls === 'JSS 1' && s.last !== 'Kamara').pop()!;
  const PREV = ['Model Primary School', 'Holy Trinity Primary', 'St. Joseph\u2019s Primary', 'Ahmadiyya Primary', 'Freetown Secondary', 'Albert Academy'];
  let appNo = 0;
  for (const a of APPS) {
    appNo++;
    const enrolled = a.status === 'enrolled';
    const gender: 'male' | 'female' = enrolled ? enrolledStudent.gender : chance(0.5) ? 'male' : 'female';
    const first = enrolled ? enrolledStudent.first : pick(gender === 'male' ? BOYS : GIRLS);
    const last = enrolled ? enrolledStudent.last : pick(SURNAMES);
    const gFirst = pick(chance(0.5) ? GIRLS : BOYS);
    const age = CLASSES.find((x) => x.name === a.cls)!.age;
    const created = ago(a.days, `${String(int(8, 16)).padStart(2, '0')}:${int(10, 59)}`);
    const dob = `${cal.sy - age + 1}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`;
    const gPhone = phone();
    const decided = ['approved', 'rejected', 'waitlist', 'enrolled'].includes(a.status);
    const [app] = await db('admission_applications').insert({
      tenant_id: tid, application_number: `DEMOA-${String(appNo).padStart(4, '0')}`, academic_year: year, status: a.status,
      application_source: a.online ? 'online' : 'office', referral_source: pick(['Friend or family', 'Church / mosque', 'Radio', 'Facebook', 'Walked past the school']),
      child_first_name: first, child_last_name: last, child_dob: dob, child_gender: gender, child_nationality: 'Sierra Leonean',
      child_religion: pick(['Islam', 'Christianity']), child_place_of_birth: 'Freetown', class_applying_for: classId.get(a.cls),
      child_address: pick(ADDRESSES), previous_school: pick(PREV), last_grade_attained: a.cls.startsWith('JSS 1') ? 'Class 6' : a.cls === 'SSS 1' ? 'JSS 3' : 'Previous class',
      guardian_first_name: gFirst, guardian_last_name: last, guardian_relationship: pick(['Mother', 'Father', 'Guardian']),
      guardian_phone: gPhone, guardian_email: mail(`applicant${appNo}`), guardian_occupation: pick(OCCUPATIONS), guardian_address: pick(ADDRESSES),
      allow_first_aid: true, emergency_contact_name: `${pick(BOYS)} ${last}`, emergency_contact_relationship: 'Uncle', emergency_contact_phone: phone(),
      first_name: first, last_name: last, date_of_birth: dob, gender, parent_name: `${gFirst} ${last}`, parent_phone: gPhone, parent_email: mail(`applicant${appNo}`),
      documents: JSON.stringify({ birth_certificate: true, passport_photo: true, ...(a.days > 5 ? { previous_report: true } : {}), ...(decided ? { guardian_id: true, medical_record: true } : {}) }),
      assessment_score: a.score ?? null, decision_notes: decided ? a.note ?? null : null, decided_by: decided ? P : null, decided_at: decided ? ago(Math.max(0, a.days - 6)) : null,
      interview_date: a.interviewIn ? ahead(a.interviewIn, '10:30') : null, interview_location: a.interviewIn ? "Principal's office" : null,
      withdrawn_reason: a.status === 'withdrawn' ? a.note : null,
      student_id: enrolled ? enrolledStudent.id : null, enrolled_class_id: enrolled ? classId.get(a.cls) : null, enrolled_at: enrolled ? ago(a.days - 8) : null,
      emailed_decisions: JSON.stringify(decided ? [a.status === 'enrolled' ? 'approved' : a.status] : []),
      created_by: a.online ? null : A, application_date: created, created_at: created, updated_at: created,
    }).returning('*');
    const ev = (kind: string, from: string | null, to: string | null, note: string | null, when: Date, by: string | null = A) =>
      ({ tenant_id: tid, application_id: app.id, kind, from_status: from, to_status: to, note, created_by: by, created_at: when });
    const timeline = [ev('created', null, 'pending', a.online ? 'Submitted on the school website' : 'Entered at the school office', created, a.online ? null : A)];
    const path: Record<string, string[]> = {
      under_review: ['under_review'], interview_scheduled: ['under_review', 'interview_scheduled'], approved: ['under_review', 'interview_scheduled', 'approved'],
      waitlist: ['under_review', 'waitlist'], rejected: ['under_review', 'interview_scheduled', 'rejected'], withdrawn: ['under_review', 'withdrawn'],
      enrolled: ['under_review', 'approved', 'enrolled'],
    };
    let prev = 'pending';
    (path[a.status] || []).forEach((to, i, arr) => {
      const when = ago(Math.max(0, a.days - 2 * (i + 1)), '11:00');
      const last = i === arr.length - 1;
      const note = to === 'interview_scheduled' && a.interviewIn ? `Interview ${addDays(cal.today, a.interviewIn)} 10:30 at Principal's office`
        : to === 'enrolled' ? `Student ${enrolledStudent.sid} · ${a.cls} (${year})` : last ? a.note ?? null : null;
      timeline.push(ev(to === 'enrolled' ? 'enrolled' : 'status', prev, to, note, when, ['approved', 'rejected', 'waitlist'].includes(to) ? P : A));
      if (last && ['approved', 'rejected', 'waitlist', 'interview_scheduled'].includes(to) && a.status !== 'enrolled') {
        timeline.push(ev('email', null, to, `Email sent to ${mail(`applicant${appNo}`)}`, when, A));
      }
      prev = to;
    });
    if (a.days > 5) timeline.push(ev('documents', null, null, 'Documents checklist updated', ago(a.days - 1, '12:00')));
    await insertMany('admission_application_events', timeline);
  }
  log(`${APPS.length} admission applications`);

  // ── Discipline and conduct ──
  const rules = await insertMany('conduct_rules', [
    { tenant_id: tid, name: 'Punctuality', description: 'Be in school before assembly at 07:50.', category: 'attendance', severity_level: 'minor', points_value: 2, consequences: 'Warning, then detention after three late arrivals in a term.', created_by: P },
    { tenant_id: tid, name: 'Uniform and appearance', description: 'Full school uniform and badge every day.', category: 'behavior', severity_level: 'minor', points_value: 2, consequences: 'Warning and a note to parents.', created_by: P },
    { tenant_id: tid, name: 'Classroom conduct', description: 'No disruption of lessons. Phones stay switched off.', category: 'behavior', severity_level: 'moderate', points_value: 10, consequences: 'Detention and parent contact.', created_by: P },
    { tenant_id: tid, name: 'Respect for others', description: 'No bullying, fighting or abusive language.', category: 'respect', severity_level: 'serious', points_value: 25, consequences: 'Suspension may follow.', created_by: P },
    { tenant_id: tid, name: 'Academic honesty', description: 'No copying in tests or examinations.', category: 'academic', severity_level: 'serious', points_value: 25, consequences: 'Score cancelled and parent meeting.', created_by: P },
  ], '*');
  const rule = (name: string) => rules.find((r: any) => r.name === name).rule_id;
  const types = await insertMany('infraction_types', [
    { tenant_id: tid, rule_id: rule('Punctuality'), name: 'Late to school', code: 'LATE', default_points: 2 },
    { tenant_id: tid, rule_id: rule('Uniform and appearance'), name: 'Incomplete uniform', code: 'UNIF', default_points: 2 },
    { tenant_id: tid, rule_id: rule('Classroom conduct'), name: 'Disrupting a lesson', code: 'DISR', default_points: 10 },
    { tenant_id: tid, rule_id: rule('Classroom conduct'), name: 'Phone in class', code: 'PHON', default_points: 10 },
    { tenant_id: tid, rule_id: rule('Respect for others'), name: 'Fighting', code: 'FIGHT', default_points: 30 },
    { tenant_id: tid, rule_id: rule('Academic honesty'), name: 'Copying in a test', code: 'COPY', default_points: 25 },
  ], '*');
  const type = (code: string) => types.find((t: any) => t.code === code).infraction_type_id;
  const pickStudent = (cls?: string) => pick(students.filter((s) => (!cls || s.cls === cls) && !(s.first === 'Mohamed' && s.last === 'Bangura')));
  const INF = [
    ['LATE', 2, 'JSS 2', 'Arrived at 08:25 after assembly.', 'Main gate', 'resolved'],
    ['UNIF', 4, 'JSS 1', 'No tie or badge.', 'Assembly ground', 'acknowledged'],
    ['PHON', 6, 'SSS 2', 'Using a phone during the Physics lesson. Phone kept until the end of the day.', 'Room 202', 'resolved'],
    ['DISR', 8, 'JSS 3', 'Repeatedly talking and distracting others during Mathematics.', 'Room 103', 'acknowledged'],
    ['LATE', 9, 'SSS 1', 'Third late arrival this term.', 'Main gate', 'recorded'],
    ['FIGHT', 12, 'JSS 3', 'Fight with another student at break. Both separated by the duty teacher.', 'Playground', 'resolved'],
    ['COPY', 15, 'SSS 3', 'Copying from notes during the Economics class test.', 'Room 203', 'resolved'],
    ['UNIF', 17, 'JSS 2', 'Wrong shoes.', 'Assembly ground', 'resolved'],
    ['LATE', 20, 'JSS 1', 'Arrived at 08:15.', 'Main gate', 'resolved'],
    ['DISR', 23, 'SSS 1', 'Shouting in the corridor during lessons.', 'Senior Block', 'recorded'],
  ] as const;
  const infRows: any[] = [];
  for (const [code, daysAgo, cls, desc, loc, status] of INF) {
    const d = addDays(cal.today, -daysAgo);
    if (d < cal.termStart[0]) continue;
    const s = pickStudent(cls);
    const recorder = teacherByKey.get(CLASSES.find((x) => x.name === cls)!.form)!.userId;
    infRows.push({ tenant_id: tid, student_id: s.userId, infraction_type_id: type(code), recorded_by: recorder, incident_date: at(d, '10:15'), incident_description: desc, incident_location: loc, status, class_id: classId.get(cls), parent_notified: ['FIGHT', 'COPY', 'PHON'].includes(code), parent_notification_date: ['FIGHT', 'COPY', 'PHON'].includes(code) ? at(d, '15:00') : null, created_at: at(d, '10:30') });
  }
  const infs = await insertMany('student_infractions', infRows, '*');
  const fight = infs.find((i: any) => i.infraction_type_id === type('FIGHT'));
  if (fight) {
    const [act] = await db('discipline_actions').insert({
      tenant_id: tid, student_id: fight.student_id, infraction_id: fight.infraction_id, action_type: 'detention', assigned_by: P,
      action_description: 'Two after-school detentions and a meeting with the parent.', action_date: fight.incident_date, status: 'completed', parent_notified: true, parent_notification_date: fight.incident_date,
    }).returning('*');
    await db('detention_records').insert({
      tenant_id: tid, action_id: act.action_id, student_id: fight.student_id, detention_type: 'after_school', scheduled_date: at(addDays(ymd(new Date(fight.incident_date)), 1), '15:00'),
      start_time: '15:00', end_time: '16:00', location: 'Library', supervised_by: teacherUser, status: 'attended', attended_date: at(addDays(ymd(new Date(fight.incident_date)), 1), '15:00'),
      supervisor_notes: 'Completed the reflection sheet and apologised.', parent_notified: true,
    });
  }
  const NOTES = [
    ['commendation', 'academic', 'Came first in the inter-class Mathematics quiz.'], ['positive', 'social', 'Helped a new student settle in and find their classes.'],
    ['commendation', 'behavioral', 'Returned a lost wallet to the school office.'], ['positive', 'academic', 'Big improvement in English essays this term.'],
    ['observation', 'emotional', 'Seems tired in morning lessons. Spoke to the parent, who is following up.'], ['positive', 'social', 'Led the class clean-up day very well.'],
    ['commendation', 'academic', 'Represented the school at the district spelling bee.'], ['concern', 'academic', 'Homework often incomplete. Agreed a weekly check with the parent.'],
  ] as const;
  await insertMany('behavioral_notes', NOTES.map(([note_type, category, content], i) => {
    const s = i === 0 ? students.find((x) => x.first === 'Mohamed' && x.last === 'Bangura')! : pickStudent();
    return {
      tenant_id: tid, student_id: s.userId, recorded_by: teacherByKey.get(CLASSES.find((x) => x.name === s.cls)!.form)!.userId, note_type, category, content,
      rating: note_type === 'concern' ? 2 : 4 + (i % 2), class_id: classId.get(s.cls), note_date: ago(2 + i * 3), is_shared_with_student: note_type !== 'observation',
      parent_notified: note_type === 'concern', created_at: ago(2 + i * 3),
    };
  }));
  log(`${infRows.length} conduct incidents, ${NOTES.length} behaviour notes`);

  // ── Events ──
  const { default: eventCategoryService } = await import('../src/services/eventCategoryService');
  await eventCategoryService.initializeSystemCategories(tid);
  const cats = new Map<string, string>((await db('event_categories').where({ tenant_id: tid })).map((r: any) => [r.name, r.category_id]));
  const EVENTS = [
    { title: 'Opening ceremony & orientation', cat: 'Academic', start: at(cal.termStart[0], '09:00'), hours: 3, loc: 'School hall', desc: 'Welcome back for the new academic year. New students and parents meet the staff.' },
    { title: 'Inter-house athletics trials', cat: 'Sports', start: ago(10, '14:00'), hours: 3, loc: 'School field', desc: 'Trials for the inter-house sports team. All houses take part.' },
    { title: 'PTA general meeting', cat: 'Administrative', start: ahead(6, '10:00'), hours: 2, loc: 'School hall', desc: 'Termly meeting of parents and teachers: fees update, the new science lab, and questions from parents.', reg: true, roles: null },
    { title: 'Science & innovation fair', cat: 'Academic', start: ahead(20, '09:30'), hours: 5, loc: 'Senior Block', desc: 'Students present projects in science, agriculture and technology. Parents are welcome.' },
    { title: 'Cultural day', cat: 'Cultural', start: ahead(34, '10:00'), hours: 6, loc: 'School field', desc: 'Traditional dress, food and dance from every district of Sierra Leone.' },
    { title: 'Staff professional development', cat: 'Administrative', start: ahead(13, '14:30'), hours: 2, loc: 'Staff room', desc: 'Training on continuous assessment and using WiSkul for score entry.', roles: ['teacher', 'principal', 'accountant', 'admissions_officer'] },
    { title: 'Prize-giving day', cat: 'Social', start: at(cal.termEnd[cal.cur], '10:00'), hours: 4, loc: 'School hall', desc: 'Awards for the best students of the term. Draft: guest of honour to be confirmed.', draft: true },
  ];
  const nowMs = Date.now();
  for (const e of EVENTS) {
    const end = new Date(e.start.getTime() + e.hours * 3600_000);
    const status = (e as any).draft ? 'draft' : end.getTime() < nowMs ? 'completed' : 'published';
    const [row] = await db('events').insert({
      tenant_id: tid, title: e.title, description: e.desc, event_type: 'single', start_date: e.start, end_date: end, all_day: false,
      location: e.loc, location_type: 'on_campus', capacity: (e as any).reg ? 300 : null, organizer_id: P, status,
      visibility: (e as any).roles ? 'role_specific' : 'public', visible_to_roles: (e as any).roles ? JSON.stringify((e as any).roles) : null,
      registration_required: !!(e as any).reg, registration_deadline: (e as any).reg ? new Date(e.start.getTime() - 86400_000) : null,
      reminder_enabled: false, reminder_intervals: JSON.stringify([24, 1]), created_by: P, created_at: ago(14),
    }).returning('*');
    if (cats.get(e.cat)) await db('event_category_mappings').insert({ event_id: row.event_id, category_id: cats.get(e.cat) });
    if ((e as any).reg) {
      const going = families.slice(0, 28);
      await insertMany('event_registrations', going.map((f, i) => ({ event_id: row.event_id, user_id: f.userId, status: 'confirmed', rsvp_status: i % 7 === 0 ? 'maybe' : 'going', guests_count: i % 4 === 0 ? 1 : 0, created_at: ago(3 - (i % 3)) })));
    }
    if (e.title.startsWith('Opening')) {
      await insertMany('event_attendance', staffUsers.slice(0, 9).map((u: any) => ({ event_id: row.event_id, user_id: u.id, check_in_time: e.start, attendance_method: 'manual', marked_by: P, status: 'present' })));
    }
  }
  log(`${EVENTS.length} events`);

  // ── Announcements ──
  const demoClass = classId.get('JSS 2');
  const ANN = [
    { title: 'Welcome to the new academic year', audience: 'all', priority: 'normal', days: Math.max(1, Math.round((day(cal.today).getTime() - day(cal.termStart[0]).getTime()) / 86400000)), body: `Dear parents, students and staff,\n\nWelcome to ${year}. Classes run from 08:00 each day and assembly starts at 07:50. Please make sure every student wears the full uniform with the school badge.\n\nWe look forward to a successful year together.\n\nMrs Mariama Kamara\nPrincipal` },
    { title: 'First term fees reminder', audience: 'parent', priority: 'high', days: 12, body: 'This is a reminder that first term fees are due. You can pay at the bursary, by bank transfer, or online by mobile money from Fees & Payments in the parent portal. Speak to the bursar if you need a payment plan.' },
    { title: 'PTA general meeting', audience: 'parent', priority: 'normal', days: 5, body: 'All parents are invited to the PTA general meeting in the school hall. We will share the fees update and plans for the new science laboratory. Please confirm on the Events page.' },
    { title: 'Mid-term tests timetable', audience: 'student', priority: 'high', days: 4, body: 'Mid-term tests start next week. The timetable is on the notice board and in the Timetable page. Revise all topics covered so far and bring your mathematical set.' },
    { title: 'Score entry deadline', audience: 'teacher', priority: 'high', days: 3, body: 'Please enter all Test 1 scores in WiSkul by Friday so form teachers can complete term records. Contact the principal if a class is missing from your list.' },
    { title: 'JSS 2: Science trip consent forms', audience: 'parent', priority: 'normal', days: 2, classId: demoClass, body: 'JSS 2 will visit the Sierra Leone Botanical Garden for their Integrated Science topic. Please return the signed consent form by Wednesday.' },
    { title: 'Inter-house sports: house captains', audience: 'student', priority: 'normal', days: 1, body: 'Congratulations to the new house captains. Trials results are on the sports notice board. Training continues every Wednesday after school.' },
  ];
  const annRows = await insertMany('announcements', ANN.map((a) => ({
    tenant_id: tid, author_id: a.audience === 'teacher' ? P : a.classId ? teacherUser : P, title: a.title, body: a.body, audience: a.audience, priority: a.priority,
    email_sent: true, class_id: a.classId ?? null, created_at: ago(a.days, '08:30'), updated_at: ago(a.days, '08:30'),
  })), '*');
  // Most of the older ones have been read.
  const reads: any[] = [];
  for (const a of annRows) {
    const audience = a.audience === 'parent' ? families.map((f) => f.userId) : a.audience === 'student' ? students.map((s) => s.userId) : a.audience === 'teacher' ? staffUsers.map((u: any) => u.id) : [...families.map((f) => f.userId), ...students.map((s) => s.userId)];
    for (const uid of audience) if (chance(0.55)) reads.push({ announcement_id: a.id, user_id: uid, read_at: new Date(new Date(a.created_at).getTime() + int(1, 48) * 3600_000) });
  }
  await insertMany('announcement_reads', reads);
  log(`${annRows.length} announcements`);

  // ── Bell notifications for the demo accounts ──
  const demoParent = families.find((f) => f.email === mail('parent'))!;
  const demoStudent = students.find((s) => s.first === 'Mohamed' && s.last === 'Bangura')!;
  const NOTIFY: Array<[string, string, string, string, string, number, boolean]> = [
    [P, 'enrollment', 'New online application', `A new application for JSS 1 arrived from the school website.`, '/admissions/dashboard', 1, false],
    [P, 'payment', 'Payment received', 'The bursary recorded 6 payments today.', '/finance/payments', 0, false],
    [P, 'event', 'PTA general meeting', '28 parents have confirmed for the PTA meeting.', '/events', 2, true],
    [teacherUser, 'announcement', 'Score entry deadline', 'Please enter all Test 1 scores by Friday.', '/announcements', 3, false],
    [teacherUser, 'payment', 'Salary paid', 'Your salary for last month was paid. Your payslip is under My Payslips.', '/finance/my-payslips', 6, true],
    [demoParent.userId, 'grade', 'Results released', `${demoStudent.first}'s report card is ready to view.`, '/academic/report-cards', 1, false],
    [demoParent.userId, 'payment', 'Payment received', `We received a payment for ${demoStudent.first}. Thank you.`, '/finance/my-fees', 4, true],
    [demoParent.userId, 'announcement', 'JSS 2: Science trip consent forms', 'Please return the signed consent form by Wednesday.', '/announcements', 2, false],
    [demoStudent.userId, 'assignment', 'New assignment', 'A new Mathematics assignment has been set.', '/academic/assignments', 1, false],
    [demoStudent.userId, 'grade', 'Results released', 'Your report card is ready to view.', '/academic/report-cards', 1, true],
    [bursarUser.id, 'payment', 'Discount approved', 'The principal approved 6 discounts and scholarships.', '/finance/discounts', 9, true],
    [bursarUser.id, 'payment', 'Payment plan due', 'An instalment is due this week for 3 families on payment plans.', '/finance/payment-plans', 0, false],
    [A, 'enrollment', 'Interview today', 'You have admission interviews scheduled this week.', '/admissions/dashboard', 0, false],
    [A, 'enrollment', 'New online application', 'Two new applications arrived from the school website.', '/admissions/dashboard', 1, false],
  ];
  await insertMany('notifications', NOTIFY.map(([user_id, type, subject, message, url, daysAgo, read]) => ({
    user_id, type, subject, message, data: JSON.stringify({ url }), channels: JSON.stringify(['in_app']), status: 'pending',
    read_at: read ? ago(daysAgo, '18:00') : null, created_at: ago(daysAgo, `${String(int(8, 15)).padStart(2, '0')}:${int(10, 59)}`), updated_at: ago(daysAgo, '18:00'),
  })));
  log(`${NOTIFY.length} notifications`);

  // ── ID cards (the app's own generator) ──
  try {
    const { TemplateService } = await import('../src/services/templateService');
    const { IdCardService } = await import('../src/services/idCardService');
    await new TemplateService(db).ensureDefaultTemplates(tid, P);
    const cards = new IdCardService(db);
    const holders: string[] = [...students.filter((s) => s.cls === 'JSS 2').map((s) => s.userId), ...staffUsers.slice(0, 4).map((u: any) => u.id)];
    let issued = 0;
    for (const uid of holders) {
      try { await cards.generateCard(uid, tid, { format: 'pvc', issuedBy: P } as any); issued++; } catch (e: any) { if (issued === 0) log(`ID card skipped: ${e?.message || e}`); }
    }
    log(`${issued} ID cards`);
  } catch (e: any) { log(`ID cards skipped: ${e?.message || e}`); }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const purgeOnly = process.argv.includes('--purge');
  const started = Date.now();
  // A dropped connection to the remote database aborts a run part-way. Each
  // attempt starts by removing whatever the last one wrote, so just retry.
  const transient = (e: any) => /connection|terminated|ECONNRESET|ETIMEDOUT|EPIPE|timeout|not queryable|socket/i.test(String(e?.message || e));
  for (let attempt = 1; ; attempt++) {
    try {
      console.log('Removing the previous demo school (if any)…');
      const removed = await purgeDemoTenant();
      console.log(removed ? '  • removed' : '  • none found');
      if (purgeOnly) return;
      seed = 20260907; // same school every attempt
      const ctx = await seedDemo();
      await seedAcademics(ctx);
      await seedFinance(ctx);
      await seedCommunity(ctx);
      // Profile pictures, exam timetable, help-desk tickets and a bank statement.
      await applyDemoExtras(ctx.tid);
      break;
    } catch (e: any) {
      if (attempt >= 4 || !transient(e)) throw e;
      console.warn(`\nThe database connection dropped (${String(e?.message || e).slice(0, 120)}). Retrying in ${attempt * 10}s (attempt ${attempt + 1} of 4)…`);
      await new Promise((r) => setTimeout(r, attempt * 10_000));
    }
  }
  console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s. Demo sign-ins for the app (password ${DEMO_PASSWORD}, also in every demo email):`);
  console.log(`  Principal   ${mail('principal')}\n  Teacher     ${mail('teacher')}\n  Bursar      ${mail('bursar')}\n  Admissions  ${mail('admissions')}\n  Parent      ${mail('parent')}\n  Student     DEMO-0001`);
}

main()
  .then(() => db.destroy())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error('\nDemo seed failed:', e?.stack || e);
    await db.destroy().catch(() => undefined);
    process.exit(1);
  });
