/**
 * globalSearchService: one search across the whole school for the header bar.
 *
 * Every section is scoped to the signed-in person's school AND to what their
 * role may see (a teacher only finds their own classes' pupils, a parent only
 * their own children and receipts, a bursar finds invoices and receipts, and
 * so on). Sections run in parallel; one failing never breaks the others.
 *
 * Matching: every word you type must match somewhere on the record (so
 * "kamara js2" finds Kamara in JS 2). Results are then ranked in code: exact
 * ids and names first, then names that start with what you typed, then the
 * rest. When nothing matches a person's name, near misses ("Mohamad" for
 * "Mohamed") are offered instead.
 */
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { effectiveDuties, holdsJob } from '@utils/staffDuties';
import { teacherClassIdsFor } from '@utils/teacherScope';

export type SearchType =
  | 'student' | 'staff' | 'support_staff' | 'guardian' | 'class' | 'subject' | 'admission'
  | 'invoice' | 'receipt' | 'announcement' | 'event' | 'assignment' | 'tenant';

export interface SearchItem {
  type: SearchType;
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  photo?: string | null;
  score: number;
  /** Anything the page needs to open the record (e.g. a student id for a parent). */
  extra?: Record<string, any>;
}

export interface SearchSection {
  type: SearchType;
  label: string;
  items: SearchItem[];
}

export interface SearchViewer {
  id: string;
  role: string;
  staff_duties?: unknown;
  tenant_id?: string | null;
}

const SECTION_LABELS: Record<SearchType, string> = {
  student: 'Students', staff: 'Staff', support_staff: 'Support staff', guardian: 'Parents & guardians',
  class: 'Classes', subject: 'Subjects', admission: 'Admissions', invoice: 'Invoices', receipt: 'Receipts & payments',
  announcement: 'Announcements', event: 'Events', assignment: 'Assignments', tenant: 'Schools',
};

const esc = (t: string) => t.replace(/[%_\\]/g, (c) => `\\${c}`);
const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const LEFT_SCHOOL = ['inactive', 'withdrawn', 'transferred', 'graduated', 'expelled', 'deleted'];

/** Split what was typed into at most 5 words. */
export function tokenize(raw: string): string[] {
  return String(raw || '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
}

/**
 * Rank one record against what was typed. Each word scores by its best field
 * (exact 100, starts-with 85, starts a word 70, contained 45); the average is
 * the score, with a bonus when a whole field equals the whole query.
 */
export function scoreRecord(query: string, fields: Array<string | null | undefined>): number {
  const words = tokenize(norm(query));
  const hay = fields.map(norm).filter(Boolean);
  if (!words.length || !hay.length) return 0;
  const full = words.join(' ');
  let total = 0;
  for (const w of words) {
    let best = 0;
    for (const f of hay) {
      if (f === w) { best = 100; break; }
      if (f.startsWith(w)) best = Math.max(best, 85);
      // A whole word of the field equals / starts with what was typed
      // ("davies" in "kabba davies").
      const parts = f.split(/[\s\-_.,@/]+/);
      if (parts.includes(w)) best = Math.max(best, 92);
      else if (parts.some((p) => p.startsWith(w))) best = Math.max(best, 78);
      else if (f.includes(w)) best = Math.max(best, 45);
    }
    // The database matched on a field we don't show (e.g. a guardian's phone).
    total += best || 30;
  }
  let score = total / words.length;
  if (hay.some((f) => f === full)) score += 20;
  return Math.round(score);
}

/** Every typed word must match at least one of the columns. */
function matchWords(qb: any, words: string[], cols: string[], extra?: (x: any, like: string, digits: string) => void) {
  for (const w of words) {
    const like = `%${esc(w)}%`;
    const digits = w.replace(/\D/g, '');
    qb.where((x: any) => {
      cols.forEach((c, i) => (i === 0 ? x.whereILike(c, like) : x.orWhereILike(c, like)));
      extra?.(x, like, digits);
    });
  }
}

/** Put names that start with the first word ahead of mere contains-matches. */
function prefixOrder(qb: any, expr: string, firstWord: string) {
  const w = esc(firstWord.toLowerCase());
  qb.orderByRaw(`CASE WHEN LOWER(${expr}) LIKE ? THEN 0 WHEN LOWER(${expr}) LIKE ? THEN 1 ELSE 2 END`, [`${w}%`, `% ${w}%`]);
}

/** Edit distance (insert, delete, replace, swap) between two short words, or max+1 once it exceeds max. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, (prev2[j - 2] ?? 99) + 1);
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev = cur;
  }
  return prev[b.length];
}

/**
 * "Did you mean": records whose name words are within a couple of typos of
 * every long word typed ("jenaba" finds "Jeneba"). Closest first.
 */
export function nearMisses<T>(query: string, rows: T[], nameOf: (r: T) => string): T[] {
  const qw = tokenize(norm(query)).filter((w) => w.length >= 4);
  if (!qw.length) return [];
  const scored: Array<{ r: T; d: number }> = [];
  for (const r of rows) {
    const nameWords = norm(nameOf(r)).split(/\s+/).filter(Boolean);
    let total = 0;
    let ok = true;
    for (const w of qw) {
      const max = w.length >= 7 ? 2 : 1;
      let best = max + 1;
      for (const nw of nameWords) {
        // Compare with the whole word and with its first letters (a half-typed, misspelt name).
        best = Math.min(best, editDistance(w, nw, max), editDistance(w, nw.slice(0, w.length), max));
      }
      if (best > max) { ok = false; break; }
      total += best;
    }
    if (ok) scored.push({ r, d: total });
  }
  return scored.sort((x, y) => x.d - y.d).map((x) => x.r);
}

const fullName = (a: string, b: string) => `TRIM(CONCAT_WS(' ', ${a}, ${b}))`;
const studentName = fullName('COALESCE(u.first_name, s.first_name)', 'COALESCE(u.last_name, s.last_name)');

async function featureOn(tenantId: string, key: string): Promise<boolean> {
  try {
    const { EntitlementService } = await import('./entitlementService');
    const { access } = await EntitlementService.access(tenantId, key);
    return access !== 'locked';
  } catch { return true; }
}

export const globalSearchService = {
  async search(viewer: SearchViewer, rawQuery: string, perSection = 5): Promise<{ query: string; sections: SearchSection[]; top: SearchItem | null; tookMs: number }> {
    const started = Date.now();
    const query = String(rawQuery || '').trim().slice(0, 100);
    const words = tokenize(query);
    const empty = { query, sections: [] as SearchSection[], top: null as SearchItem | null, tookMs: 0 };
    if (!query) return empty;
    const limit = Math.min(Math.max(perSection, 1), 10);
    const role = String(viewer.role || '');
    const tid = viewer.tenant_id || null;

    // ── Platform operator: schools only ────────────────────────────────
    if (role === 'super_admin' && !tid) {
      const items = await section('tenant', async () => {
        const q = db('tenants');
        matchWords(q, words, ['name', 'slug', 'domain', 'contact_email']);
        prefixOrder(q, 'name', words[0]);
        const rows = await q.limit(limit + 5).select('id', 'name', 'slug', 'status', 'contact_email');
        return rows.map((r: any): SearchItem => ({
          type: 'tenant', id: String(r.id), title: r.name, subtitle: [r.slug, r.contact_email].filter(Boolean).join(' · '),
          badge: r.status, score: scoreRecord(query, [r.name, r.slug, r.contact_email]),
        }));
      });
      return finish(query, [['tenant', items]], limit, started);
    }
    if (!tid) return { ...empty, tookMs: Date.now() - started };

    // ── What this person is allowed to search ──────────────────────────
    const isParent = role === 'parent' || role === 'guardian';
    const isStudent = role === 'student';
    const isPrincipal = role === 'principal' || role === 'super_admin';
    const isBursar = isPrincipal || holdsJob(role, viewer.staff_duties, 'accountant');
    const isAdmissions = isPrincipal || holdsJob(role, viewer.staff_duties, 'admissions_officer');
    const isTeacher = role === 'teacher' || effectiveDuties(role, viewer.staff_duties).includes('teacher');
    const wholeSchool = isPrincipal || isBursar || isAdmissions;
    const teacherClasses = !wholeSchool && isTeacher ? await teacherClassIdsFor(viewer.id, tid).catch(() => [] as string[]) : [];

    /** Class ids a student/parent belongs to (for assignments). */
    const myClassIds = async (): Promise<string[]> => {
      const q = db('enrollments as e').join('students as s', 's.id', 'e.student_id').where('s.tenant_id', tid).whereIn('e.status', ['enrolled', 'active']);
      if (isStudent) q.where('s.user_id', viewer.id);
      else q.whereExists(db('guardians as g').whereRaw('g.student_id = s.id').where('g.user_id', viewer.id));
      return (await q.distinct('e.class_id')).map((r: any) => String(r.class_id));
    };

    /** Students this person may see, with the same scope everywhere. */
    const scopedStudents = () => {
      const q = db('students as s').leftJoin('users as u', 'u.id', 's.user_id').where('s.tenant_id', tid);
      if (wholeSchool) return q;
      if (isParent) return q.whereExists(db('guardians as g').whereRaw('g.student_id = s.id').where('g.user_id', viewer.id));
      if (isStudent) return q.where('s.user_id', viewer.id);
      if (isTeacher) {
        return q.whereExists(db('enrollments as e').whereRaw('e.student_id = s.id').whereIn('e.class_id', teacherClasses.length ? teacherClasses : [UUID_NONE]));
      }
      return q.whereRaw('1 = 0');
    };

    const studentSelect = [
      's.id', 's.student_id as admission_no', 's.status', 's.photo_url',
      db.raw(`${studentName} as name`),
      db.raw(`(SELECT c.name FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE e.student_id = s.id ORDER BY CASE WHEN e.status IN ('enrolled','active') THEN 0 ELSE 1 END, e.created_at DESC LIMIT 1) as class_name`),
      ...(isBursar
        ? [db.raw("(SELECT COALESCE(SUM(COALESCE(f.balance, f.amount)), 0) FROM fees f WHERE f.student_id = s.id AND f.tenant_id = s.tenant_id AND f.status <> 'deleted') as outstanding")]
        : []),
    ];

    const toStudent = (r: any, fuzzy = false): SearchItem => {
      const left = LEFT_SCHOOL.includes(String(r.status || '').toLowerCase());
      const owes = Number(r.outstanding || 0);
      return {
        type: 'student', id: String(r.id), title: r.name, photo: r.photo_url || null,
        subtitle: [r.admission_no, r.class_name].filter(Boolean).join(' · '),
        badge: left ? String(r.status) : fuzzy ? 'Similar name' : owes > 0.005 ? `Owes Le ${owes.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : undefined,
        // Near misses rank below real matches and never become the top hit.
        score: fuzzy ? 55 : scoreRecord(query, [r.name, r.admission_no, r.class_name]) - (left ? 12 : 0),
        extra: { admission_no: r.admission_no, name: r.name },
      };
    };

    // A receipt or invoice number can only be a receipt or an invoice: skip the rest.
    const only: SearchType[] | null = /^rcp[-\s]?\d/i.test(query) ? ['receipt'] : /^inv[-\s]?\d/i.test(query) ? ['invoice'] : null;
    const sec = (type: SearchType, fn: () => Promise<SearchItem[]>): Promise<SearchItem[]> =>
      only && !only.includes(type) ? Promise.resolve([]) : section(type, fn);

    const sections = await Promise.all([
      // ── Students ──────────────────────────────────────────────────
      sec('student', async () => {
        if (isStudent) return [];
        const q = scopedStudents();
        matchWords(q, words, ['s.first_name', 's.last_name', 'u.first_name', 'u.last_name', 's.student_id', 's.email', 'u.email'], (x, like, digits) => {
          x.orWhereExists(db('enrollments as e').join('classes as c', 'c.id', 'e.class_id').whereRaw('e.student_id = s.id').whereILike('c.name', like));
          if (wholeSchool) {
            x.orWhereILike('s.guardian_name', like);
            x.orWhereExists(db('guardians as g').whereRaw('g.student_id = s.id').where((gq: any) => {
              gq.whereILike('g.first_name', like).orWhereILike('g.last_name', like).orWhereILike('g.email', like);
              if (digits.length >= 4) gq.orWhereRaw("regexp_replace(COALESCE(g.phone_number, ''), '\\D', '', 'g') LIKE ?", [`%${digits}%`]);
            }));
            if (digits.length >= 4) x.orWhereRaw("regexp_replace(COALESCE(s.guardian_phone, ''), '\\D', '', 'g') LIKE ?", [`%${digits}%`]);
          }
        });
        prefixOrder(q, studentName, words[0]);
        const rows = await q.limit(limit + 6).select(studentSelect);
        if (rows.length) return rows.map((r: any) => toStudent(r));
        // Nothing matched: offer near misses (a misspelt name).
        const pool = await scopedStudents().limit(2500).select(studentSelect);
        return nearMisses(query, pool as any[], (r: any) => r.name).slice(0, 4).map((r: any) => toStudent(r, true));
      }),

      // ── Teachers and other professional staff ─────────────────────
      sec('staff', async () => {
        if (!isPrincipal) return [];
        const base = () => db('teachers as t').join('users as u', 'u.id', 't.user_id').where('u.tenant_id', tid);
        const name = fullName('u.first_name', 'u.last_name');
        const map = (r: any, fuzzy = false): SearchItem => ({
          type: 'staff', id: String(r.id), title: r.name,
          subtitle: [r.teacher_id, ROLE_LABEL[r.role] || r.role, r.designation || r.department || r.specialization].filter(Boolean).join(' · '),
          badge: fuzzy ? 'Similar name' : r.status && r.status !== 'active' ? String(r.status) : undefined,
          score: fuzzy ? 55 : scoreRecord(query, [r.name, r.teacher_id, r.email]),
          extra: { name: r.name, teacher_id: r.teacher_id },
        });
        const cols = [db.raw(`${name} as name`), 't.id', 't.teacher_id', 'u.role', 'u.email', 't.status', 't.designation', 't.department', 't.specialization'];
        const q = base();
        matchWords(q, words, ['u.first_name', 'u.last_name', 'u.email', 't.teacher_id', 't.specialization', 't.department', 't.designation']);
        prefixOrder(q, name, words[0]);
        const rows = await q.limit(limit + 4).select(cols);
        if (rows.length) return rows.map((r: any) => map(r));
        const pool = await base().limit(1000).select(cols);
        return nearMisses(query, pool as any[], (r: any) => r.name).slice(0, 3).map((r: any) => map(r, true));
      }),

      // ── Support staff (security, cleaners, drivers…) ─────────────
      sec('support_staff', async () => {
        if (!isPrincipal) return [];
        const q = db('support_staff').where({ tenant_id: tid });
        matchWords(q, words, ['first_name', 'last_name', 'staff_id', 'phone', 'job_title'], (x, _like, digits) => {
          if (digits.length >= 4) x.orWhereRaw("regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE ?", [`%${digits}%`]);
        });
        prefixOrder(q, fullName('first_name', 'last_name'), words[0]);
        const rows = await q.limit(limit).select('id', 'first_name', 'last_name', 'staff_id', 'job_type', 'job_title', 'phone', 'status');
        return rows.map((r: any): SearchItem => {
          const name = [r.first_name, r.last_name].filter(Boolean).join(' ');
          return {
            type: 'support_staff', id: String(r.id), title: name,
            subtitle: [r.staff_id, r.job_title || String(r.job_type || '').replace(/_/g, ' '), r.phone].filter(Boolean).join(' · '),
            badge: r.status && r.status !== 'active' ? String(r.status) : undefined,
            score: scoreRecord(query, [name, r.staff_id, r.phone]), extra: { name },
          };
        });
      }),

      // ── Parents and guardians ─────────────────────────────────────
      sec('guardian', async () => {
        if (!wholeSchool) return [];
        const q = db('guardians as g').join('students as s', 's.id', 'g.student_id').leftJoin('users as u', 'u.id', 's.user_id').where('s.tenant_id', tid);
        matchWords(q, words, ['g.first_name', 'g.last_name', 'g.email'], (x, _like, digits) => {
          if (digits.length >= 4) x.orWhereRaw("regexp_replace(COALESCE(g.phone_number, ''), '\\D', '', 'g') LIKE ?", [`%${digits}%`]);
        });
        prefixOrder(q, fullName('g.first_name', 'g.last_name'), words[0]);
        const rows = await q.limit(limit * 2).select(
          'g.id', 'g.first_name', 'g.last_name', 'g.relationship', 'g.phone_number', 'g.email',
          's.id as student_id', 's.student_id as admission_no', db.raw(`${studentName} as student_name`),
        );
        return rows.map((r: any): SearchItem => {
          const name = [r.first_name, r.last_name].filter(Boolean).join(' ');
          return {
            type: 'guardian', id: String(r.id), title: name,
            subtitle: [`${r.relationship || 'Guardian'} of ${r.student_name}`, r.phone_number].filter(Boolean).join(' · '),
            score: scoreRecord(query, [name, r.email, r.phone_number]),
            extra: { student_id: String(r.student_id), admission_no: r.admission_no, student_name: r.student_name },
          };
        });
      }),

      // ── Classes ───────────────────────────────────────────────────
      sec('class', async () => {
        if (isStudent || isParent) return [];
        if (!wholeSchool && !teacherClasses.length) return [];
        const q = db('classes as c').join('academic_sessions as a', 'a.id', 'c.academic_session_id').where('a.tenant_id', tid).where('a.is_active', true);
        if (!wholeSchool) q.whereIn('c.id', teacherClasses);
        matchWords(q, words, ['c.name', 'c.room_number', 'c.section', 'c.building']);
        prefixOrder(q, 'c.name', words[0]);
        const rows = await q.limit(limit).select('c.id', 'c.name', 'c.level', 'c.room_number',
          db.raw("(SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.status IN ('enrolled','active')) as enrolled"));
        return rows.map((r: any): SearchItem => ({
          type: 'class', id: String(r.id), title: r.name,
          subtitle: [`${Number(r.enrolled || 0)} students`, r.room_number ? String(r.room_number) : null].filter(Boolean).join(' · '),
          score: scoreRecord(query, [r.name, r.room_number]), extra: { name: r.name },
        }));
      }),

      // ── Subjects ──────────────────────────────────────────────────
      sec('subject', async () => {
        const q = db('subjects').leftJoin('users as cu', 'subjects.created_by', 'cu.id').where(function (this: any) {
          this.where('subjects.tenant_id', tid).orWhere(function (this: any) { this.whereNull('subjects.tenant_id').where('cu.tenant_id', tid); });
        });
        matchWords(q, words, ['subjects.name', 'subjects.code', 'subjects.department']);
        prefixOrder(q, 'subjects.name', words[0]);
        const rows = await q.limit(limit).select('subjects.id', 'subjects.name', 'subjects.code', 'subjects.department', 'subjects.category');
        return rows.map((r: any): SearchItem => ({
          type: 'subject', id: String(r.id), title: r.name,
          subtitle: [r.code, r.department || r.category].filter(Boolean).join(' · '),
          score: scoreRecord(query, [r.name, r.code]), extra: { name: r.name },
        }));
      }),

      // ── Admission applications ────────────────────────────────────
      sec('admission', async () => {
        if (!isAdmissions || !(await featureOn(tid, 'admissions'))) return [];
        const child = fullName('child_first_name', 'child_last_name');
        const q = db('admission_applications').where({ tenant_id: tid });
        matchWords(q, words, ['application_number', 'child_first_name', 'child_last_name', 'first_name', 'last_name', 'guardian_first_name', 'guardian_last_name', 'guardian_email', 'parent_name'], (x, _like, digits) => {
          if (digits.length >= 4) x.orWhereRaw("regexp_replace(COALESCE(guardian_phone, ''), '\\D', '', 'g') LIKE ?", [`%${digits}%`]);
        });
        prefixOrder(q, `COALESCE(NULLIF(${child}, ''), ${fullName('first_name', 'last_name')})`, words[0]);
        const rows = await q.limit(limit).select('id', 'application_number', 'status', 'academic_year',
          db.raw(`COALESCE(NULLIF(${child}, ''), ${fullName('first_name', 'last_name')}) as name`),
          db.raw(`NULLIF(${fullName('guardian_first_name', 'guardian_last_name')}, '') as guardian`));
        return rows.map((r: any): SearchItem => ({
          type: 'admission', id: String(r.id), title: r.name || r.application_number,
          subtitle: [r.application_number, r.guardian ? `Guardian: ${r.guardian}` : null, r.academic_year].filter(Boolean).join(' · '),
          badge: String(r.status || '').replace(/_/g, ' '),
          score: scoreRecord(query, [r.name, r.application_number, r.guardian]), extra: { application_number: r.application_number },
        }));
      }),

      // ── Invoices ──────────────────────────────────────────────────
      sec('invoice', async () => {
        if (!isBursar) return [];
        const q = db('invoices as i').join('students as s', 's.id', 'i.student_id').leftJoin('users as u', 'u.id', 's.user_id').where('s.tenant_id', tid);
        matchWords(q, words, ['i.invoice_number', 's.first_name', 's.last_name', 'u.first_name', 'u.last_name', 's.student_id']);
        q.orderBy('i.created_at', 'desc');
        const rows = await q.limit(limit).select('i.id', 'i.invoice_number', 'i.status', 'i.balance', 'i.total_amount', 'i.due_date', db.raw(`${studentName} as student_name`), 's.student_id as admission_no');
        return rows.map((r: any): SearchItem => ({
          type: 'invoice', id: String(r.id), title: r.invoice_number || 'Invoice',
          subtitle: [r.student_name, `Le ${Number(r.total_amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`].filter(Boolean).join(' · '),
          badge: String(r.status || '').replace(/_/g, ' '),
          score: scoreRecord(query, [r.invoice_number, r.student_name, r.admission_no]), extra: { invoice_number: r.invoice_number },
        }));
      }),

      // ── Receipts and payments ─────────────────────────────────────
      sec('receipt', async () => {
        if (!isBursar && !isParent && !isStudent) return [];
        const q = db('payments as p').join('students as s', 's.id', 'p.student_id').leftJoin('users as u', 'u.id', 's.user_id')
          .where('p.tenant_id', tid).whereNotNull('p.receipt_number');
        if (isParent) q.whereExists(db('guardians as g').whereRaw('g.student_id = s.id').where('g.user_id', viewer.id));
        else if (isStudent) q.where('s.user_id', viewer.id);
        matchWords(q, words, ['p.receipt_number', 'p.transaction_reference', 's.first_name', 's.last_name', 'u.first_name', 'u.last_name', 's.student_id']);
        q.groupBy('p.receipt_number', 's.id', 'u.first_name', 'u.last_name', 's.first_name', 's.last_name', 's.student_id')
          .orderByRaw('MAX(p.payment_date) DESC');
        const rows = await q.limit(limit).select('p.receipt_number', 's.id as student_id', 's.student_id as admission_no',
          db.raw(`${studentName} as student_name`), db.raw('SUM(p.amount) as amount'), db.raw('MAX(p.payment_date) as paid_on'),
          db.raw("BOOL_AND(p.status = 'refunded') as refunded"));
        return rows.map((r: any): SearchItem => ({
          type: 'receipt', id: String(r.receipt_number), title: r.receipt_number,
          subtitle: [r.student_name, `Le ${Number(r.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`].filter(Boolean).join(' · '),
          badge: r.refunded ? 'refunded' : undefined,
          score: scoreRecord(query, [r.receipt_number, r.student_name, r.admission_no]),
          extra: { receipt_number: r.receipt_number, student_id: String(r.student_id) },
        }));
      }),

      // ── Announcements ─────────────────────────────────────────────
      sec('announcement', async () => {
        const { default: announcements } = await import('./announcementService');
        const { items } = await announcements.list(tid, { viewerRole: role, viewerId: viewer.id, limit, offset: 0, search: query });
        return (items as any[]).map((a): SearchItem => ({
          type: 'announcement', id: String(a.id), title: a.title,
          subtitle: [a.author_display || a.author_name, new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean).join(' · '),
          badge: a.priority === 'high' ? 'important' : undefined,
          score: scoreRecord(query, [a.title]), extra: { title: a.title },
        }));
      }),

      // ── Events ────────────────────────────────────────────────────
      sec('event', async () => {
        if (!(await featureOn(tid, 'events'))) return [];
        const { default: events } = await import('./eventService');
        const all = await events.searchEvents(tid, query, limit + 5);
        const me = String(viewer.id);
        const out: SearchItem[] = [];
        for (const ev of all as any[]) {
          const mine = String(ev.organizer_id ?? '') === me || String(ev.created_by ?? '') === me;
          if (!(isPrincipal || mine || (ev.status !== 'draft' && (await events.viewerMaySee(ev, role, me))))) continue;
          out.push({
            type: 'event', id: String(ev.event_id), title: ev.title,
            subtitle: [new Date(ev.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), ev.location].filter(Boolean).join(' · '),
            badge: ev.status === 'draft' ? 'draft' : undefined, score: scoreRecord(query, [ev.title, ev.location]),
          });
          if (out.length >= limit) break;
        }
        return out;
      }),

      // ── Assignments ───────────────────────────────────────────────
      sec('assignment', async () => {
        let classIds: string[] | null = null;
        if (isStudent || isParent) classIds = await myClassIds();
        else if (!wholeSchool) classIds = teacherClasses;
        if (classIds && !classIds.length) return [];
        const q = db('assignments as a').join('classes as c', 'c.id', 'a.class_id').join('academic_sessions as ses', 'ses.id', 'c.academic_session_id').where('ses.tenant_id', tid);
        if (classIds) q.whereIn('a.class_id', classIds);
        matchWords(q, words, ['a.title', 'c.name']);
        prefixOrder(q, 'a.title', words[0]);
        const rows = await q.orderBy('a.due_date', 'desc').limit(limit).select('a.id', 'a.title', 'a.due_date', 'a.status', 'c.name as class_name');
        return rows.map((r: any): SearchItem => ({
          type: 'assignment', id: String(r.id), title: r.title,
          subtitle: [r.class_name, r.due_date ? `Due ${new Date(r.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : null].filter(Boolean).join(' · '),
          score: scoreRecord(query, [r.title, r.class_name]), extra: { title: r.title },
        }));
      }),
    ]);

    const order: SearchType[] = ['student', 'staff', 'support_staff', 'guardian', 'class', 'subject', 'admission', 'invoice', 'receipt', 'announcement', 'event', 'assignment'];
    return finish(query, order.map((t, i) => [t, sections[i] ?? []] as [SearchType, SearchItem[]]).filter(([t]) => t), limit, started);
  },
};

// A uuid that matches nothing, so `IN ()` never reaches Postgres empty.
const UUID_NONE = '00000000-0000-0000-0000-000000000000';

const ROLE_LABEL: Record<string, string> = {
  teacher: 'Teacher', accountant: 'Bursar', admissions_officer: 'Admissions officer', principal: 'Principal',
};

/** Run one section; a failing section yields nothing instead of breaking the search. */
async function section(type: SearchType, fn: () => Promise<SearchItem[]>): Promise<SearchItem[]> {
  try { return await fn(); } catch (e: any) {
    logger.warn(`Global search section "${type}" failed: ${e?.message || e}`);
    return [];
  }
}

/** Sort each section by score, trim it, and pick the best single match overall. */
function finish(query: string, parts: Array<[SearchType, SearchItem[]]>, limit: number, started: number) {
  const sections: SearchSection[] = [];
  let top: SearchItem | null = null;
  for (const [type, items] of parts) {
    const sorted = items.filter((i) => i.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
    if (!sorted.length) continue;
    sections.push({ type, label: SECTION_LABELS[type], items: sorted });
    // Records people look up by name or number can be the "top hit".
    if (!['announcement', 'event', 'subject', 'assignment'].includes(type) && (!top || sorted[0].score > top.score)) top = sorted[0];
  }
  // Put the section with the strongest match first.
  sections.sort((a, b) => b.items[0].score - a.items[0].score);
  return { query, sections, top: top && top.score >= 70 ? top : null, tookMs: Date.now() - started };
}

export default globalSearchService;
