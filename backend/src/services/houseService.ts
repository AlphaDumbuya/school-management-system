/**
 * Houses and the house ballot.
 *
 * A school has a few houses (sports teams). Every new student is given one,
 * once, by ballot: a random draw among the houses that currently have the
 * FEWEST students, so the houses stay level. Optionally the draw is balanced
 * by gender, kept per class, and siblings follow their brother or sister.
 *
 * - The draw runs in a transaction under a per-school advisory lock, so two
 *   officers drawing at the same time can't unbalance the houses.
 * - A student who already has a house is never re-drawn. Changing a house is a
 *   deliberate manual move that needs a reason.
 * - Everything (ballot, auto, sibling, manual, removal) is written to
 *   house_draws as the audit trail.
 */
import { randomInt } from 'crypto';
import type { Knex } from 'knex';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { resolveActiveYear } from '@utils/academicYear';

export type DrawMethod = 'ballot' | 'auto' | 'sibling' | 'manual' | 'removed';

export interface HouseSettings {
  balance_scope: 'school' | 'class';
  balance_gender: boolean;
  keep_siblings: boolean;
  auto_assign_on_enrol: boolean;
  /** A sibling may follow a brother or sister only if the house stays within this many students of the smallest house. */
  level_gap: number;
}

export const DEFAULT_SETTINGS: HouseSettings = {
  balance_scope: 'school',
  balance_gender: true,
  keep_siblings: true,
  auto_assign_on_enrol: false,
  level_gap: 2,
};

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_DRAW_ALL = 1000;

const genderOf = (g: unknown): 'male' | 'female' | 'other' => {
  const s = String(g || '').trim().toLowerCase();
  if (s.startsWith('m')) return 'male';
  if (s.startsWith('f')) return 'female';
  return 'other';
};

/** LEFT JOIN LATERAL that finds a student's current-year class (alias `cl`). */
function classLateral(sessionId: string | null): { sql: string; bindings: any[] } {
  return {
    sql: `LEFT JOIN LATERAL (
      SELECT c.id, c.name FROM enrollments e JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = s.id AND e.status IN ('active','enrolled')
      ${sessionId ? 'AND c.academic_session_id = ?' : ''}
      ORDER BY e.created_at DESC LIMIT 1
    ) cl ON true`,
    bindings: sessionId ? [sessionId] : [],
  };
}

function cleanName(v: unknown): string {
  const n = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!n) throw new AppError('Give the house a name.', 400, 'VALIDATION_ERROR');
  if (n.length > 60) throw new AppError('A house name can be at most 60 characters.', 400, 'VALIDATION_ERROR');
  return n;
}
function cleanColor(v: unknown): string {
  const c = String(v ?? '').trim();
  if (!COLOR_RE.test(c)) throw new AppError('Choose the house colour as a hex value like #dc2626.', 400, 'VALIDATION_ERROR');
  return c.toLowerCase();
}

export const houseService = {
  // ── Settings ───────────────────────────────────────────────────────────
  async getSettings(tenantId: string, conn: Knex | Knex.Transaction = db): Promise<HouseSettings> {
    const row = await conn('house_settings').where({ tenant_id: tenantId }).first();
    if (!row) return { ...DEFAULT_SETTINGS };
    return {
      balance_scope: row.balance_scope === 'class' ? 'class' : 'school',
      balance_gender: !!row.balance_gender,
      keep_siblings: !!row.keep_siblings,
      auto_assign_on_enrol: !!row.auto_assign_on_enrol,
      level_gap: Math.min(10, Math.max(1, Number(row.level_gap) || DEFAULT_SETTINGS.level_gap)),
    };
  },

  async updateSettings(tenantId: string, userId: string, body: Partial<HouseSettings>): Promise<HouseSettings> {
    const cur = await this.getSettings(tenantId);
    const next: HouseSettings = {
      balance_scope: body.balance_scope === 'class' || body.balance_scope === 'school' ? body.balance_scope : cur.balance_scope,
      balance_gender: typeof body.balance_gender === 'boolean' ? body.balance_gender : cur.balance_gender,
      keep_siblings: typeof body.keep_siblings === 'boolean' ? body.keep_siblings : cur.keep_siblings,
      auto_assign_on_enrol: typeof body.auto_assign_on_enrol === 'boolean' ? body.auto_assign_on_enrol : cur.auto_assign_on_enrol,
      level_gap: Number.isInteger(body.level_gap) ? Math.min(10, Math.max(1, body.level_gap as number)) : cur.level_gap,
    };
    await db('house_settings')
      .insert({ tenant_id: tenantId, ...next, updated_by: userId, updated_at: new Date() })
      .onConflict('tenant_id').merge();
    return next;
  },

  // ── Houses ─────────────────────────────────────────────────────────────
  /** Houses with their head-counts, the settings and how many students still have no house. */
  async overview(tenantId: string) {
    const houses = await db('houses').where({ tenant_id: tenantId }).orderBy([{ column: 'sort_order' }, { column: 'name' }]);
    const counts = await db('students')
      .where({ tenant_id: tenantId, status: 'active' }).whereNotNull('house_id')
      .select('house_id', 'gender').count('* as n').groupBy('house_id', 'gender');
    const by = new Map<string, { total: number; male: number; female: number; other: number }>();
    for (const r of counts as any[]) {
      const e = by.get(r.house_id) || { total: 0, male: 0, female: 0, other: 0 };
      const n = Number(r.n) || 0;
      e.total += n; e[genderOf(r.gender)] += n;
      by.set(r.house_id, e);
    }
    const [{ n: unassigned }] = (await db('students').where({ tenant_id: tenantId, status: 'active' }).whereNull('house_id').count('* as n')) as any[];
    const staffRows = await db('house_staff as hs').join('users as u', 'u.id', 'hs.user_id')
      .where('hs.tenant_id', tenantId)
      .select('hs.house_id', 'hs.user_id', 'hs.position', db.raw("TRIM(CONCAT(u.first_name, ' ', u.last_name)) as name"))
      .orderBy([{ column: 'hs.position' }, { column: 'u.first_name' }]);
    const staffBy = new Map<string, any[]>();
    for (const r of staffRows as any[]) {
      const list = staffBy.get(r.house_id) || [];
      list.push({ user_id: r.user_id, name: r.name, position: r.position });
      staffBy.set(r.house_id, list);
    }
    // How far apart the (active) houses are: the biggest minus the smallest.
    const activeTotals = houses.filter((h: any) => h.is_active).map((h: any) => by.get(h.id)?.total || 0);
    const spread = activeTotals.length ? Math.max(...activeTotals) - Math.min(...activeTotals) : 0;
    return {
      spread,
      houses: houses.map((h: any) => ({
        id: h.id, name: h.name, color: h.color, motto: h.motto, sort_order: h.sort_order, is_active: h.is_active,
        staff: staffBy.get(h.id) || [],
        ...(by.get(h.id) || { total: 0, male: 0, female: 0, other: 0 }),
      })),
      settings: await this.getSettings(tenantId),
      unassigned: Number(unassigned) || 0,
    };
  },

  async createHouse(tenantId: string, userId: string, body: any) {
    const name = cleanName(body?.name);
    const color = cleanColor(body?.color ?? '#2563eb');
    const motto = String(body?.motto ?? '').trim().slice(0, 160) || null;
    const dup = await db('houses').where({ tenant_id: tenantId }).whereRaw('LOWER(name) = ?', [name.toLowerCase()]).first('id');
    if (dup) throw new AppError(`A house called "${name}" already exists.`, 409, 'HOUSE_EXISTS');
    const [{ m }] = (await db('houses').where({ tenant_id: tenantId }).max('sort_order as m')) as any[];
    const [row] = await db('houses').insert({
      tenant_id: tenantId, name, color, motto, sort_order: (Number(m) || 0) + 1, created_by: userId,
    }).returning('*');
    return row;
  },

  async updateHouse(tenantId: string, id: string, body: any) {
    const house = await db('houses').where({ id, tenant_id: tenantId }).first();
    if (!house) throw new AppError('House not found.', 404, 'NOT_FOUND');
    const patch: any = { updated_at: new Date() };
    if (body?.name !== undefined) {
      patch.name = cleanName(body.name);
      const dup = await db('houses').where({ tenant_id: tenantId }).whereNot({ id }).whereRaw('LOWER(name) = ?', [patch.name.toLowerCase()]).first('id');
      if (dup) throw new AppError(`A house called "${patch.name}" already exists.`, 409, 'HOUSE_EXISTS');
    }
    if (body?.color !== undefined) patch.color = cleanColor(body.color);
    if (body?.motto !== undefined) patch.motto = String(body.motto ?? '').trim().slice(0, 160) || null;
    if (typeof body?.is_active === 'boolean') patch.is_active = body.is_active;
    if (Number.isInteger(body?.sort_order)) patch.sort_order = body.sort_order;
    const [row] = await db('houses').where({ id, tenant_id: tenantId }).update(patch).returning('*');
    return row;
  },

  async deleteHouse(tenantId: string, id: string) {
    const house = await db('houses').where({ id, tenant_id: tenantId }).first('id', 'name');
    if (!house) throw new AppError('House not found.', 404, 'NOT_FOUND');
    const [{ n }] = (await db('students').where({ tenant_id: tenantId, house_id: id }).count('* as n')) as any[];
    if (Number(n) > 0) {
      throw new AppError(`${house.name} has ${n} student${Number(n) === 1 ? '' : 's'}. Move them to another house first, or switch the house off so nobody new is drawn into it.`, 409, 'HOUSE_HAS_STUDENTS');
    }
    await db('houses').where({ id, tenant_id: tenantId }).delete();
  },

  // ── Lists ──────────────────────────────────────────────────────────────
  /** Students in the school (active), optionally by house / class / search. house = 'none' → no house yet. */
  async roster(tenantId: string, f: { house_id?: string; class_id?: string; search?: string; limit?: number; class_ids?: string[]; house_ids?: string[]; student_id?: string }) {
    const { sessionId } = await resolveActiveYear(tenantId);
    const lat = classLateral(sessionId);
    const q = db('students as s')
      .joinRaw(lat.sql, lat.bindings)
      .leftJoin('houses as h', 'h.id', 's.house_id')
      .where('s.tenant_id', tenantId).where('s.status', 'active');
    if (f.house_id === 'none') q.whereNull('s.house_id');
    else if (f.house_id) q.where('s.house_id', f.house_id);
    if (f.class_id) q.where('cl.id', f.class_id);
    if (f.class_ids) { if (!f.class_ids.length) return []; q.whereIn('cl.id', f.class_ids); }
    if (f.house_ids) { if (!f.house_ids.length) return []; q.whereIn('s.house_id', f.house_ids); }
    if (f.student_id) q.where('s.id', f.student_id);
    const term = String(f.search || '').trim();
    if (term) {
      const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      q.where((w) => w.whereRaw("s.first_name ILIKE ? ESCAPE '\\'", [like]).orWhereRaw("s.last_name ILIKE ? ESCAPE '\\'", [like]).orWhereRaw("s.student_id ILIKE ? ESCAPE '\\'", [like]));
    }
    const limit = Math.min(Math.max(Number(f.limit) || 500, 1), 5000);
    const rows = await q
      .select('s.id', 's.student_id as student_number', 's.first_name', 's.last_name', 's.gender', 's.house_id',
        'cl.id as class_id', 'cl.name as class_name', 'h.name as house_name', 'h.color as house_color')
      .orderBy([{ column: 'cl.name' }, { column: 's.last_name' }, { column: 's.first_name' }])
      .limit(limit);
    return rows;
  },

  /** Houses by gender and by class (for the summary tables). */
  async summary(tenantId: string) {
    const base = await this.overview(tenantId);
    const { sessionId } = await resolveActiveYear(tenantId);
    const lat = classLateral(sessionId);
    const rows = await db('students as s')
      .joinRaw(lat.sql, lat.bindings)
      .where('s.tenant_id', tenantId).where('s.status', 'active')
      .select('cl.id as class_id', 'cl.name as class_name', 's.house_id').count('* as n')
      .groupBy('cl.id', 'cl.name', 's.house_id');
    const classes = new Map<string, { class_id: string | null; class_name: string; total: number; unassigned: number; houses: Record<string, number> }>();
    for (const r of rows as any[]) {
      const key = r.class_id || 'none';
      const e = classes.get(key) || { class_id: r.class_id || null, class_name: r.class_name || 'No class', total: 0, unassigned: 0, houses: {} as Record<string, number> };
      const n = Number(r.n) || 0;
      e.total += n;
      if (r.house_id) e.houses[r.house_id] = (e.houses[r.house_id] || 0) + n; else e.unassigned += n;
      classes.set(key, e);
    }
    return { ...base, by_class: [...classes.values()].sort((a, b) => a.class_name.localeCompare(b.class_name, undefined, { numeric: true })) };
  },

  async recentDraws(tenantId: string, limit = 60) {
    return db('house_draws as d')
      .join('students as s', 's.id', 'd.student_id')
      .leftJoin('houses as h', 'h.id', 'd.house_id')
      .leftJoin('houses as ph', 'ph.id', 'd.previous_house_id')
      .leftJoin('users as u', 'u.id', 'd.drawn_by')
      .where('d.tenant_id', tenantId)
      .select('d.id', 'd.method', 'd.reason', 'd.created_at',
        's.id as student_pk', 's.student_id as student_number', 's.first_name', 's.last_name',
        'h.name as house_name', 'h.color as house_color', 'ph.name as previous_house_name',
        db.raw("TRIM(CONCAT(u.first_name, ' ', u.last_name)) as by_name"))
      .orderBy('d.created_at', 'desc')
      .limit(Math.min(Math.max(limit, 1), 200));
  },

  // ── The ballot ─────────────────────────────────────────────────────────
  /**
   * Draw a house for one student. Throws ALREADY_HAS_HOUSE if they have one.
   * `method` is 'ballot' (officer pressed Draw) or 'auto' (on enrolment); a
   * sibling match is recorded as 'sibling'.
   */
  async draw(tenantId: string, userId: string | null, studentId: string, method: 'ballot' | 'auto' = 'ballot', outer?: Knex.Transaction) {
    const { sessionId } = await resolveActiveYear(tenantId);
    // `outer` lets a caller run the draw inside a transaction it controls.
    const run = <T>(fn: (trx: Knex.Transaction) => Promise<T>): Promise<T> => (outer ? fn(outer) : db.transaction(fn));
    return run(async (trx) => {
      // One draw at a time per school, so the head-counts the draw reads are current.
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`house-draw:${tenantId}`]);

      const lat = classLateral(sessionId);
      const student: any = await trx('students as s')
        .joinRaw(lat.sql, lat.bindings)
        .where('s.id', studentId).where('s.tenant_id', tenantId)
        .first('s.id', 's.student_id as student_number', 's.first_name', 's.last_name', 's.gender', 's.status', 's.house_id', 's.photo_url', 'cl.id as class_id', 'cl.name as class_name');
      if (!student) throw new AppError('Student not found.', 404, 'NOT_FOUND');
      if (student.house_id) throw new AppError(`${student.first_name} ${student.last_name} already has a house.`, 409, 'ALREADY_HAS_HOUSE');
      if (student.status !== 'active') throw new AppError('Only active students can be given a house.', 400, 'STUDENT_NOT_ACTIVE');

      const houses: any[] = await trx('houses').where({ tenant_id: tenantId, is_active: true }).orderBy('sort_order');
      if (!houses.length) throw new AppError('Set up at least one house before drawing.', 400, 'NO_HOUSES');
      const settings = await this.getSettings(tenantId, trx);

      let chosen: any = null;
      let how: DrawMethod = method;

      // The houses must stay LEVEL: the number of students in each house (whole school) decides first.
      // Gender and class only break ties between equally small houses.
      const schoolCounts = await this.counts(trx, tenantId, sessionId, null);
      const totalOf = (h: any) => schoolCounts.get(h.id)?.total || 0;
      const minTotal = Math.min(...houses.map(totalOf));

      // 1) A brother or sister already in a house: same house, but only while that keeps the houses level.
      if (settings.keep_siblings) {
        const sib: any = await trx('students as s2')
          .join('guardians as g2', 'g2.student_id', 's2.id')
          .joinRaw('JOIN guardians g1 ON g1.student_id = ?', [studentId])
          .where('s2.tenant_id', tenantId).whereNot('s2.id', studentId).whereNotNull('s2.house_id').where('s2.status', 'active')
          .where((w) => {
            w.whereRaw('(g1.user_id IS NOT NULL AND g2.user_id = g1.user_id)')
              .orWhereRaw("(COALESCE(g1.email,'') <> '' AND LOWER(g2.email) = LOWER(g1.email))")
              .orWhereRaw("(COALESCE(g1.phone_number,'') <> '' AND g2.phone_number = g1.phone_number)");
          })
          .orderBy('s2.created_at', 'asc')
          .first('s2.house_id');
        const match = sib && houses.find((h) => h.id === sib.house_id);
        if (match && totalOf(match) + 1 - minTotal <= settings.level_gap) { chosen = match; how = 'sibling'; }
      }

      // 2) Random among the smallest houses (ties broken by class, then gender, so each class and sex stays mixed).
      if (!chosen) {
        const smallest = houses.filter((h) => totalOf(h) === minTotal);
        let pool = smallest;
        if (smallest.length > 1) {
          const g = genderOf(student.gender);
          const useGender = settings.balance_gender && g !== 'other';
          const useClass = settings.balance_scope === 'class' && !!student.class_id;
          const scope = useClass ? await this.counts(trx, tenantId, sessionId, student.class_id) : schoolCounts;
          const score = (h: any) => {
            const c = scope.get(h.id) || { total: 0, male: 0, female: 0, other: 0 };
            return [useClass ? c.total : 0, useGender ? c[g] : 0];
          };
          let bestScore = [Infinity, Infinity];
          pool = [];
          for (const h of smallest) {
            const sc = score(h);
            if (sc[0] < bestScore[0] || (sc[0] === bestScore[0] && sc[1] < bestScore[1])) { pool = [h]; bestScore = sc; }
            else if (sc[0] === bestScore[0] && sc[1] === bestScore[1]) pool.push(h);
          }
        }
        chosen = pool[randomInt(pool.length)];
      }

      const updated = await trx('students').where({ id: studentId, tenant_id: tenantId }).whereNull('house_id').update({ house_id: chosen.id, updated_at: new Date() });
      if (!updated) throw new AppError('This student was given a house a moment ago.', 409, 'ALREADY_HAS_HOUSE');
      await trx('house_draws').insert({
        tenant_id: tenantId, student_id: studentId, house_id: chosen.id, previous_house_id: null, method: how, drawn_by: userId, created_at: new Date(),
      });
      return {
        student: { id: student.id, student_number: student.student_number, first_name: student.first_name, last_name: student.last_name, class_name: student.class_name, photo_url: student.photo_url || null },
        house: { id: chosen.id, name: chosen.name, color: chosen.color, motto: chosen.motto },
        method: how,
      };
    });
  },

  /** Draw for many students (a class, or everyone without a house). Order is shuffled. */
  async drawMany(tenantId: string, userId: string, f: { student_ids?: string[]; class_id?: string; class_ids?: string[]; search?: string }) {
    let ids: string[];
    let more = false; // more students match than one batch can take
    if (Array.isArray(f.student_ids) && f.student_ids.length) {
      ids = [...new Set(f.student_ids.map(String))];
    } else {
      ids = (await this.roster(tenantId, { house_id: 'none', class_id: f.class_id, class_ids: f.class_ids, search: f.search, limit: MAX_DRAW_ALL + 1 })).map((r: any) => r.id);
      if (ids.length > MAX_DRAW_ALL) { more = true; ids = ids.slice(0, MAX_DRAW_ALL); }
    }
    if (ids.length > MAX_DRAW_ALL) throw new AppError(`Draw at most ${MAX_DRAW_ALL} students at a time.`, 400, 'TOO_MANY');
    for (let i = ids.length - 1; i > 0; i--) { const j = randomInt(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const results: any[] = [];
    const failed: { student_id: string; error: string }[] = [];
    for (const id of ids) {
      try {
        const r = await this.draw(tenantId, userId, id, 'ballot');
        r.student.photo_url = null; // a bulk result doesn't need (large) photos
        results.push(r);
      }
      catch (e: any) {
        if (e?.code === 'NO_HOUSES') throw e;
        failed.push({ student_id: id, error: e?.message || 'Could not draw' });
      }
    }
    return { drawn: results.length, results, failed, more };
  },

  /**
   * Bring in house lists a school already has (for example last year's, or a paper list):
   * rows of { student_number, house }. Houses are matched by name (any case); with
   * create_missing, unknown house names are added. A student who already has a house is
   * skipped unless overwrite is on. Everything is applied together and logged.
   */
  async importAssignments(
    tenantId: string,
    userId: string,
    rows: { student_number?: unknown; house?: unknown }[],
    opts: { overwrite?: boolean; create_missing?: boolean },
    outer?: Knex.Transaction,
  ) {
    if (!Array.isArray(rows) || !rows.length) throw new AppError('The file has no rows to import.', 400, 'VALIDATION_ERROR');
    if (rows.length > 5000) throw new AppError('Import at most 5,000 rows at a time.', 400, 'TOO_MANY');
    const PALETTE = ['#dc2626', '#2563eb', '#16a34a', '#eab308', '#7c3aed', '#ea580c', '#0d9488', '#db2777'];
    const run = <T>(fn: (trx: Knex.Transaction) => Promise<T>): Promise<T> => (outer ? fn(outer) : db.transaction(fn));
    return run(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`house-draw:${tenantId}`]);
      const houses = new Map<string, any>();
      for (const h of await trx('houses').where({ tenant_id: tenantId })) houses.set(String(h.name).trim().toLowerCase(), h);
      const students = new Map<string, { id: string; house_id: string | null }>();
      for (const st of await trx('students').where({ tenant_id: tenantId }).whereNot('status', 'deleted').select('id', 'student_id', 'house_id')) {
        students.set(String(st.student_id).trim().toLowerCase(), { id: st.id, house_id: st.house_id });
      }
      const problems: { row: number; student_number: string; reason: string }[] = [];
      const created: string[] = [];
      let unchanged = 0; let skipped = 0; let blank = 0;
      const moves = new Map<string, string[]>(); // house id -> student ids
      const log: any[] = [];
      let sortOrder = houses.size;
      const seen = new Set<string>();
      for (let i = 0; i < rows.length; i++) {
        const num = String(rows[i].student_number ?? '').trim();
        const hn = String(rows[i].house ?? '').trim().replace(/\s+/g, ' ');
        const lineNo = i + 2; // header is line 1
        if (!num && !hn) { blank++; continue; }
        if (!hn || /^no house( yet)?$/i.test(hn) || hn === '-') { blank++; continue; }
        if (!num) { problems.push({ row: lineNo, student_number: '', reason: 'No student number' }); continue; }
        const st = students.get(num.toLowerCase());
        if (!st) { problems.push({ row: lineNo, student_number: num, reason: 'No student with this number' }); continue; }
        if (seen.has(st.id)) { problems.push({ row: lineNo, student_number: num, reason: 'Listed twice (the first row is used)' }); continue; }
        seen.add(st.id);
        let house = houses.get(hn.toLowerCase());
        if (!house) {
          if (!opts.create_missing) { problems.push({ row: lineNo, student_number: num, reason: `No house called "${hn}"` }); continue; }
          if (hn.length > 60) { problems.push({ row: lineNo, student_number: num, reason: 'House name is too long' }); continue; }
          [house] = await trx('houses').insert({ tenant_id: tenantId, name: hn, color: PALETTE[houses.size % PALETTE.length], sort_order: ++sortOrder, created_by: userId }).returning('*');
          houses.set(hn.toLowerCase(), house);
          created.push(house.name);
        }
        if (st.house_id === house.id) { unchanged++; continue; }
        if (st.house_id && !opts.overwrite) { skipped++; continue; }
        const list = moves.get(house.id) || [];
        list.push(st.id);
        moves.set(house.id, list);
        log.push({ tenant_id: tenantId, student_id: st.id, house_id: house.id, previous_house_id: st.house_id, method: 'manual', reason: 'Imported from the school\'s existing house list', drawn_by: userId, created_at: new Date() });
      }
      let assigned = 0;
      for (const [houseId, ids] of moves) {
        for (let k = 0; k < ids.length; k += 500) {
          const chunk = ids.slice(k, k + 500);
          assigned += await trx('students').where({ tenant_id: tenantId }).whereIn('id', chunk).update({ house_id: houseId, updated_at: new Date() });
        }
      }
      for (let k = 0; k < log.length; k += 500) await trx('house_draws').insert(log.slice(k, k + 500));
      return { assigned, unchanged, skipped_has_house: skipped, blank, created_houses: created, problems: problems.slice(0, 100), problem_count: problems.length };
    });
  },

  /** Head-counts per house in the scope (whole school, or one class). */
  async counts(conn: Knex | Knex.Transaction, tenantId: string, sessionId: string | null, classId: string | null) {
    const lat = classLateral(sessionId);
    const q = conn('students as s').joinRaw(lat.sql, lat.bindings)
      .where('s.tenant_id', tenantId).where('s.status', 'active').whereNotNull('s.house_id');
    if (classId) q.where('cl.id', classId);
    const rows = await q.select('s.house_id', 's.gender').count('* as n').groupBy('s.house_id', 's.gender');
    const map = new Map<string, { total: number; male: number; female: number; other: number }>();
    for (const r of rows as any[]) {
      const e = map.get(r.house_id) || { total: 0, male: 0, female: 0, other: 0 };
      const n = Number(r.n) || 0;
      e.total += n; e[genderOf(r.gender)] += n;
      map.set(r.house_id, e);
    }
    return map;
  },

  /** Move a student to a house (or remove it with houseId = null). A change needs a reason. */
  async assign(tenantId: string, userId: string, studentId: string, houseId: string | null, reason?: string, outer?: Knex.Transaction) {
    const run = <T>(fn: (trx: Knex.Transaction) => Promise<T>): Promise<T> => (outer ? fn(outer) : db.transaction(fn));
    return run(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`house-draw:${tenantId}`]);
      const student: any = await trx('students').where({ id: studentId, tenant_id: tenantId }).first('id', 'first_name', 'last_name', 'house_id');
      if (!student) throw new AppError('Student not found.', 404, 'NOT_FOUND');
      let house: any = null;
      if (houseId) {
        house = await trx('houses').where({ id: houseId, tenant_id: tenantId }).first();
        if (!house) throw new AppError('House not found.', 404, 'NOT_FOUND');
      }
      if ((student.house_id || null) === (houseId || null)) return { unchanged: true };
      const why = String(reason || '').trim().slice(0, 300);
      if (student.house_id && why.length < 3) throw new AppError('Give a short reason for changing a student\'s house.', 400, 'REASON_REQUIRED');
      await trx('students').where({ id: studentId, tenant_id: tenantId }).update({ house_id: houseId, updated_at: new Date() });
      await trx('house_draws').insert({
        tenant_id: tenantId, student_id: studentId, house_id: houseId, previous_house_id: student.house_id || null,
        method: houseId ? 'manual' : 'removed', reason: why || null, drawn_by: userId, created_at: new Date(),
      });
      return { unchanged: false, house: house ? { id: house.id, name: house.name, color: house.color } : null };
    });
  },

  // ── Teachers ───────────────────────────────────────────────────────────
  async assertTeacher(tenantId: string, userId: string) {
    const t = await db('teachers as t').join('users as u', 'u.id', 't.user_id')
      .where({ 'u.id': userId, 'u.tenant_id': tenantId }).first('u.id', 'u.status');
    if (!t) throw new AppError('Teacher not found.', 404, 'NOT_FOUND');
    if (t.status !== 'active') throw new AppError('This teacher\'s account is not active.', 400, 'TEACHER_NOT_ACTIVE');
    return t;
  },

  /** Active teachers with whether they are allowed to run the ballot for their own classes. */
  async teacherOptions(tenantId: string) {
    const teachers = await db('teachers as t').join('users as u', 'u.id', 't.user_id')
      .where('u.tenant_id', tenantId).where('u.status', 'active')
      .select('u.id as user_id', db.raw("TRIM(CONCAT(u.first_name, ' ', u.last_name)) as name"))
      .orderBy('u.first_name');
    const perms = new Set((await db('house_ballot_permissions').where({ tenant_id: tenantId }).select('user_id')).map((r: any) => r.user_id));
    return (teachers as any[]).map((t) => ({ user_id: t.user_id, name: t.name, can_draw: perms.has(t.user_id) }));
  },

  /** Put a teacher on a house. 'master' replaces the house's current master / mistress (who stays as staff). */
  async assignStaff(tenantId: string, actorId: string, houseId: string, teacherUserId: string, position: unknown) {
    const pos = position === 'master' ? 'master' : 'staff';
    const house = await db('houses').where({ id: houseId, tenant_id: tenantId }).first('id');
    if (!house) throw new AppError('House not found.', 404, 'NOT_FOUND');
    await this.assertTeacher(tenantId, teacherUserId);
    await db.transaction(async (trx) => {
      if (pos === 'master') {
        await trx('house_staff').where({ house_id: houseId, position: 'master' }).whereNot({ user_id: teacherUserId }).update({ position: 'staff' });
      }
      await trx('house_staff')
        .insert({ tenant_id: tenantId, house_id: houseId, user_id: teacherUserId, position: pos, created_by: actorId })
        .onConflict(['house_id', 'user_id']).merge({ position: pos });
    });
  },

  async removeStaff(tenantId: string, houseId: string, teacherUserId: string) {
    await db('house_staff').where({ tenant_id: tenantId, house_id: houseId, user_id: teacherUserId }).delete();
  },

  /** Allow (or stop allowing) a teacher to draw houses for the students of their own classes. */
  async setBallotPermission(tenantId: string, actorId: string, teacherUserId: string, allowed: boolean) {
    if (allowed) {
      await this.assertTeacher(tenantId, teacherUserId);
      await db('house_ballot_permissions')
        .insert({ tenant_id: tenantId, user_id: teacherUserId, granted_by: actorId })
        .onConflict(['tenant_id', 'user_id']).ignore();
    } else {
      await db('house_ballot_permissions').where({ tenant_id: tenantId, user_id: teacherUserId }).delete();
    }
  },

  /**
   * The sport-house badges that belong to a person, for their profile:
   *  - a student: their own house;
   *  - a parent / guardian: each child's house;
   *  - anyone put on a house by the school (house master / mistress, house teacher): that house and their post.
   */
  async badgesFor(tenantId: string, userId: string, role: string) {
    const out: any[] = [];
    const fields = ['h.id as house_id', 'h.name as house_name', 'h.color as house_color', 'h.motto as house_motto'];
    const house = (r: any) => ({ id: r.house_id, name: r.house_name, color: r.house_color, motto: r.house_motto });
    if (role === 'student') {
      const rows = await db('students as s').join('houses as h', 'h.id', 's.house_id')
        .where({ 's.user_id': userId, 's.tenant_id': tenantId }).select(...fields);
      for (const r of rows as any[]) out.push({ kind: 'student', house: house(r) });
    }
    if (role === 'parent' || role === 'guardian') {
      const rows = await db('guardians as g').join('students as s', 's.id', 'g.student_id').join('houses as h', 'h.id', 's.house_id')
        .where('g.user_id', userId).where('s.tenant_id', tenantId)
        .select(...fields, 's.id as student_pk', 's.first_name', 's.last_name').orderBy('s.first_name');
      const seen = new Set<string>();
      for (const r of rows as any[]) {
        if (seen.has(r.student_pk)) continue;
        seen.add(r.student_pk);
        out.push({ kind: 'child', student_id: r.student_pk, student_name: `${r.first_name} ${r.last_name}`.trim(), house: house(r) });
      }
    }
    const staff = await db('house_staff as hs').join('houses as h', 'h.id', 'hs.house_id')
      .where({ 'hs.user_id': userId, 'hs.tenant_id': tenantId }).select(...fields, 'hs.position').orderBy('hs.position').orderBy('h.name');
    for (const r of staff as any[]) out.push({ kind: 'staff', position: r.position, house: house(r) });
    return out;
  },

  /** What a teacher may see or do here: their houses, and whether they may draw. */
  async teacherAccess(tenantId: string, userId: string) {
    const houses = await db('house_staff as hs').join('houses as h', 'h.id', 'hs.house_id')
      .where({ 'hs.tenant_id': tenantId, 'hs.user_id': userId })
      .select('h.id', 'h.name', 'h.color', 'h.motto', 'hs.position').orderBy('h.name');
    const canDraw = !!(await db('house_ballot_permissions').where({ tenant_id: tenantId, user_id: userId }).first('id'));
    // The registered houses, so the draw screen can show them (only for a teacher who may draw).
    const drawHouses = canDraw ? await db('houses').where({ tenant_id: tenantId, is_active: true }).orderBy('sort_order').select('id', 'name', 'color', 'motto') : [];
    return { houses, can_draw: canDraw, draw_houses: drawHouses, has_access: houses.length > 0 || canDraw };
  },

  /** Students of the houses a teacher is attached to (read only). */
  async teacherStudents(tenantId: string, userId: string, f: { house_id?: string; search?: string }) {
    const mine = (await db('house_staff').where({ tenant_id: tenantId, user_id: userId }).select('house_id')).map((r: any) => r.house_id as string);
    const ids = f.house_id ? mine.filter((x) => x === f.house_id) : mine;
    return this.roster(tenantId, { house_ids: ids, search: f.search, limit: 1000 });
  },

  async requireBallotPermission(tenantId: string, userId: string) {
    const ok = await db('house_ballot_permissions').where({ tenant_id: tenantId, user_id: userId }).first('id');
    if (!ok) throw new AppError('You have not been given permission to draw houses. Ask the principal or the admissions officer.', 403, 'HOUSE_BALLOT_NOT_ALLOWED');
  },

  /** Students in the teacher's classes who are still waiting for a house (only if permitted). */
  async teacherWaiting(tenantId: string, userId: string, search?: string) {
    await this.requireBallotPermission(tenantId, userId);
    const { teacherClassIdsFor } = await import('@utils/teacherScope');
    const classIds = await teacherClassIdsFor(userId, tenantId);
    return this.roster(tenantId, { house_id: 'none', class_ids: classIds, search, limit: 500 });
  },

  /** A permitted teacher draws for one student of their own classes. */
  async teacherDraw(tenantId: string, userId: string, studentId: string) {
    await this.requireBallotPermission(tenantId, userId);
    const { teacherClassIdsFor } = await import('@utils/teacherScope');
    const classIds = await teacherClassIdsFor(userId, tenantId);
    const ok = await this.roster(tenantId, { house_id: 'none', class_ids: classIds, student_id: studentId, limit: 1 });
    if (!ok.length) throw new AppError('You can only draw for students in your own classes who are still waiting for a house.', 403, 'HOUSE_STUDENT_NOT_YOURS');
    return this.draw(tenantId, userId, studentId, 'ballot');
  },

  /**
   * Called when a student is enrolled: draws a house if the school switched
   * "draw automatically on enrolment" on. Never throws (enrolment must not fail
   * because of a house); returns the house, or null.
   */
  async autoAssignOnEnrol(tenantId: string, userId: string | null, studentId: string, outer?: Knex.Transaction) {
    try {
      const settings = await this.getSettings(tenantId, outer || db);
      if (!settings.auto_assign_on_enrol) return null;
      const r = await this.draw(tenantId, userId, studentId, 'auto', outer);
      return r.house;
    } catch (e: any) {
      if (e?.code !== 'NO_HOUSES' && e?.code !== 'ALREADY_HAS_HOUSE') logger.warn(`Automatic house draw failed: ${e?.message || e}`);
      return null;
    }
  },
};

export default houseService;
