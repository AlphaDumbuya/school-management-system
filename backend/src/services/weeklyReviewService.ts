/**
 * Weekly student reviews.
 *
 * A teacher rates each student in their class for the school week (Monday to
 * Friday) and may add a short plain-text comment. Parents see it in the weekly
 * attendance digest (see jobs/attendanceDigestJobs.ts) and under the student's
 * attendance page, so they can follow their child week by week.
 *
 * Every read and write is scoped to the tenant given by the caller (taken from
 * the signed-in user, never from the request). Reviews are written for the
 * ACTIVE academic year only, for the current or an earlier week; earlier years
 * stay as read-only history.
 *
 * Telling parents: a review written BEFORE the Friday digest is picked up by the
 * digest itself. One written AFTER (or when the school uses daily/no attendance
 * alerts) is announced with a single in-app notification. Both paths use the
 * `review-app:<week>:<student>` claim in finance_notices, so a family is told at
 * most once per student per week, and edits never re-notify.
 */
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { tenantToday } from '@utils/schoolDate';
import { isDemoTenant } from '@utils/demo';
import { AppError } from '@middleware/errorHandler';
import { claimNotice } from '@services/finance/core';
import { attendanceNotifyMode } from '@services/attendanceNotifications';
import { UserRole } from '../types/auth';
import { resolveActiveYear, normalizeAcademicYear } from '../utils/academicYear.js';
import { TERM_KEYS, normalizeTerm, resolveTermWindows, attendanceDateProblem, type DateWindow, type TermKey } from '../utils/termWindows.js';
import { teacherClassIdsFor, teacherCanAccessStudent } from '../utils/teacherScope.js';
import { weekStartFor, buildChildDigest, ratingLabel, reviewSnippet, type DigestChild } from '../jobs/attendanceDigestJobs.js';

export const MAX_COMMENT_LENGTH = 600;
const MAX_ITEMS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ReviewUser { id: string; role: string }

export interface SaveReviewItem {
  student_id: string;
  performance_rating?: number | string | null;
  behaviour_rating?: number | string | null;
  comment?: string | null;
  clear?: boolean;
}

const STAFF_ROLES: string[] = [UserRole.PRINCIPAL, UserRole.SUPER_ADMIN];
const isAdminRole = (role: string) => STAFF_ROLES.includes(role);

/** Students who are still at the school (same filter the attendance digest uses). */
const ACTIVE_STUDENT_SQL = "COALESCE(s.status, 'active') NOT IN ('withdrawn', 'graduated', 'deleted', 'transferred', 'inactive')";
/** The student's display name: their account name, else the record, else the admission number. */
const STUDENT_NAME_SQL =
  "COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), NULLIF(TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')), ''), s.student_id)";
const PERSON_NAME_SQL = (alias: string) => `NULLIF(TRIM(COALESCE(${alias}.first_name,'') || ' ' || COALESCE(${alias}.last_name,'')), '')`;

// ── small pure helpers ───────────────────────────────────────────────────────

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Which term (first_term ...) a date falls in, using the report-card term windows. */
export function termForDate(windows: Record<TermKey, DateWindow> | null | undefined, date: string): TermKey | null {
  if (!windows) return null;
  const d = String(date).slice(0, 10);
  for (const k of TERM_KEYS) {
    const { start, end } = windows[k];
    if ((!start || d >= start) && (!end || d < end)) return k;
  }
  return null;
}

/** Plain text only: no control or direction-override characters, line breaks kept, max 600 characters. */
export function cleanComment(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new AppError('Comment must be text.', 400, 'VALIDATION_ERROR');
  const t = v
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!t) return null;
  return Array.from(t).slice(0, MAX_COMMENT_LENGTH).join('');
}

function parseRating(v: unknown, field: string): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new AppError(`${field} must be a whole number from 1 to 5.`, 400, 'VALIDATION_ERROR');
  return n;
}

const dateOut = (v: any): string => (v instanceof Date ? v.toISOString() : v ? String(v) : '');

/** Validate a YYYY-MM-DD date and return the Monday of its school week (default: this week). */
export async function normalizeWeek(tenantId: string, input?: unknown): Promise<{ weekStart: string; weekEnd: string; today: string; currentWeekStart: string }> {
  const today = await tenantToday(tenantId);
  const currentWeekStart = weekStartFor(today);
  const raw = typeof input === 'string' ? input.trim() : '';
  let weekStart = currentWeekStart;
  if (raw) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime()) && new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) === raw;
    if (!valid) throw new AppError('week must be a date in the form YYYY-MM-DD.', 400, 'VALIDATION_ERROR');
    weekStart = weekStartFor(raw);
  }
  return { weekStart, weekEnd: addDays(weekStart, 4), today, currentWeekStart };
}

// ── class and permission checks ──────────────────────────────────────────────

async function loadClass(tenantId: string, classId: string): Promise<{ id: string; name: string; isCurrentYear: boolean }> {
  if (!UUID_RE.test(String(classId || ''))) throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
  const row = await db('classes as c')
    .leftJoin('academic_sessions as s', 'c.academic_session_id', 's.id')
    .leftJoin('users as cc', 'c.created_by', 'cc.id')
    .where('c.id', classId)
    .where(function () {
      this.where('s.tenant_id', tenantId)
        .orWhere(function () { this.whereNull('c.academic_session_id').where('cc.tenant_id', tenantId); });
    })
    .first('c.id', 'c.name', 's.id as session_id', 's.is_active');
  if (!row) throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
  return { id: row.id, name: row.name, isCurrentYear: !(row.session_id && row.is_active === false) };
}

/** Principal and super admin: any class of the school. Teacher: only classes they teach or lead. */
async function assertClassStaffAccess(tenantId: string, user: ReviewUser, classId: string): Promise<void> {
  if (isAdminRole(user.role)) return;
  if (user.role === UserRole.TEACHER && (await teacherClassIdsFor(user.id, tenantId)).includes(classId)) return;
  throw new AppError('You are not assigned to this class', 403, 'FORBIDDEN');
}

/** Active students of a class, sorted by name. */
async function loadRoster(tenantId: string, classId: string): Promise<Array<{ student_id: string; student_number: string | null; name: string }>> {
  const rows = await db('enrollments as e')
    .join('students as s', 's.id', 'e.student_id')
    .leftJoin('users as u', 'u.id', 's.user_id')
    .where('e.class_id', classId)
    .where('s.tenant_id', tenantId)
    .where(function () { this.whereIn('e.status', ['active', 'enrolled']).orWhereNull('e.status'); })
    .whereRaw(ACTIVE_STUDENT_SQL)
    .select('s.id as student_id', 's.student_id as student_number', db.raw(`${STUDENT_NAME_SQL} as name`)) as any[];
  const seen = new Map<string, { student_id: string; student_number: string | null; name: string }>();
  for (const r of rows) if (!seen.has(r.student_id)) seen.set(r.student_id, { student_id: r.student_id, student_number: r.student_number || null, name: r.name || '' });
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

/** Why reviews can't be written for this week right now (null = fine). */
async function writeProblem(tenantId: string, w: { weekStart: string; weekEnd: string; currentWeekStart: string }): Promise<{ status: number; code: string; message: string } | null> {
  if (w.weekStart > w.currentWeekStart) {
    return { status: 400, code: 'FUTURE_WEEK', message: "Reviews can't be written for a week that hasn't started yet." };
  }
  // A week is writable while any part of it is inside the active academic year.
  const last = await attendanceDateProblem(tenantId, w.weekEnd);
  if (last?.code === 'PAST_YEAR_READ_ONLY') {
    return { status: 409, code: 'PAST_YEAR_READ_ONLY', message: "That week belongs to a past academic year, so its reviews are read-only." };
  }
  const first = await attendanceDateProblem(tenantId, w.weekStart);
  if (first?.code === 'OUTSIDE_YEAR') {
    return { status: 400, code: 'OUTSIDE_YEAR', message: first.message };
  }
  return null;
}

// ── class week (read) ────────────────────────────────────────────────────────

export interface ClassWeekReview {
  performance_rating: number;
  behaviour_rating: number | null;
  comment: string | null;
  author_name: string | null;
  updated_at: string;
}

export interface ClassWeek {
  week_start: string;
  week_end: string;
  class: { id: string; name: string };
  can_edit: boolean;
  locked_reason: string | null;
  students: Array<{
    student_id: string;
    student_number: string | null;
    name: string;
    attendance: { days: DigestChild['days']; summary: DigestChild['summary'] };
    review: ClassWeekReview | null;
  }>;
}

export async function getClassWeek(tenantId: string, user: ReviewUser, classId: string, weekKey?: unknown): Promise<ClassWeek> {
  const week = await normalizeWeek(tenantId, weekKey);
  const cls = await loadClass(tenantId, classId);
  await assertClassStaffAccess(tenantId, user, cls.id);

  const roster = await loadRoster(tenantId, cls.id);
  const ids = roster.map((r) => r.student_id);

  const attendanceRows = ids.length
    ? await db('attendance as a')
        .whereIn('a.student_id', ids)
        .whereBetween('a.attendance_date', [week.weekStart, week.weekEnd])
        .select('a.student_id', db.raw("to_char(a.attendance_date, 'YYYY-MM-DD') as attendance_date"), 'a.status') as any[]
    : [];
  const reviewRows = ids.length
    ? await db('weekly_student_reviews as r')
        .leftJoin('users as au', 'au.id', 'r.author_user_id')
        .where('r.tenant_id', tenantId)
        .where('r.week_start', week.weekStart)
        .whereIn('r.student_id', ids)
        .select('r.student_id', 'r.performance_rating', 'r.behaviour_rating', 'r.comment', 'r.updated_at', db.raw(`${PERSON_NAME_SQL('au')} as author_name`)) as any[]
    : [];

  const attByStudent = new Map<string, any[]>();
  for (const r of attendanceRows) {
    const list = attByStudent.get(r.student_id) || [];
    list.push(r);
    attByStudent.set(r.student_id, list);
  }
  const reviewByStudent = new Map<string, any>(reviewRows.map((r) => [r.student_id, r]));

  let lockedReason: string | null = null;
  if (!cls.isCurrentYear) lockedReason = 'This class belongs to a past academic year, so its reviews are read-only.';
  else lockedReason = (await writeProblem(tenantId, week))?.message ?? null;

  return {
    week_start: week.weekStart,
    week_end: week.weekEnd,
    class: { id: cls.id, name: cls.name },
    can_edit: lockedReason === null,
    locked_reason: lockedReason,
    students: roster.map((s) => {
      const d = buildChildDigest(s.name, cls.name, week.weekStart, attByStudent.get(s.student_id) || []);
      const rv = reviewByStudent.get(s.student_id);
      return {
        student_id: s.student_id,
        student_number: s.student_number,
        name: s.name,
        attendance: { days: d.days, summary: d.summary },
        review: rv
          ? {
              performance_rating: Number(rv.performance_rating),
              behaviour_rating: rv.behaviour_rating == null ? null : Number(rv.behaviour_rating),
              comment: rv.comment || null,
              author_name: rv.author_name || null,
              updated_at: dateOut(rv.updated_at),
            }
          : null,
      };
    }),
  };
}

// ── class week (write) ───────────────────────────────────────────────────────

export interface SaveResult {
  saved: number;
  cleared: number;
  skipped: number;
  notified: number;
  skipped_details: Array<{ student_id: string; reason: string }>;
}

export async function saveClassWeek(tenantId: string, user: ReviewUser, classId: string, weekKey: unknown, items: unknown): Promise<SaveResult> {
  if (!Array.isArray(items)) throw new AppError('reviews must be a list.', 400, 'VALIDATION_ERROR');
  if (items.length > MAX_ITEMS) throw new AppError(`Too many reviews in one request (max ${MAX_ITEMS}).`, 400, 'VALIDATION_ERROR');

  const week = await normalizeWeek(tenantId, weekKey);
  const cls = await loadClass(tenantId, classId);
  await assertClassStaffAccess(tenantId, user, cls.id);

  const problem = await writeProblem(tenantId, week);
  if (problem) throw new AppError(problem.message, problem.status, problem.code);
  if (!cls.isCurrentYear) {
    throw new AppError('This class belongs to a past academic year, so its reviews are read-only.', 409, 'PAST_YEAR_READ_ONLY');
  }

  // Validate everything first, so a bad row fails the whole request before any write.
  type Upsert = { student_id: string; performance_rating: number; behaviour_rating: number | null; comment: string | null };
  const upserts = new Map<string, Upsert>();
  const clears = new Set<string>();
  const skippedDetails: Array<{ student_id: string; reason: string }> = [];
  for (const raw of items as SaveReviewItem[]) {
    if (!raw || typeof raw !== 'object') throw new AppError('Each review must be an object.', 400, 'VALIDATION_ERROR');
    const studentId = String(raw.student_id || '');
    if (!UUID_RE.test(studentId)) throw new AppError('Each review needs a valid student_id.', 400, 'VALIDATION_ERROR');
    const performance = parseRating(raw.performance_rating, 'performance_rating');
    const behaviour = parseRating(raw.behaviour_rating, 'behaviour_rating');
    const comment = cleanComment(raw.comment);
    if (raw.clear === true) {
      clears.add(studentId);
      upserts.delete(studentId);
    } else if (performance == null) {
      // The table needs a performance rating: a comment or behaviour rating alone can't be saved.
      upserts.delete(studentId);
      skippedDetails.push({ student_id: studentId, reason: behaviour != null || comment ? 'performance_rating_required' : 'empty' });
    } else {
      clears.delete(studentId);
      upserts.set(studentId, { student_id: studentId, performance_rating: performance, behaviour_rating: behaviour, comment });
    }
  }

  // Everyone touched must be an active student of THIS class (teachers and principals alike).
  const touched = [...upserts.keys(), ...clears];
  if (touched.length) {
    const roster = new Set((await loadRoster(tenantId, cls.id)).map((r) => r.student_id));
    const stranger = touched.find((id) => !roster.has(id));
    if (stranger) throw new AppError('Student is not enrolled in this class', 403, 'FORBIDDEN');
  }

  const year = (await resolveActiveYear(tenantId)).yearString;
  const windows = await resolveTermWindows(tenantId, year);
  const term = termForDate(windows, week.weekStart);

  let cleared = 0;
  const newStudents: Upsert[] = [];
  const now = new Date();
  await db.transaction(async (trx) => {
    const existing = touched.length
      ? await trx('weekly_student_reviews')
          .where({ tenant_id: tenantId, week_start: week.weekStart })
          .whereIn('student_id', touched)
          .select('student_id') as any[]
      : [];
    const had = new Set<string>(existing.map((r) => r.student_id));

    if (upserts.size) {
      const rows = Array.from(upserts.values()).map((u) => ({
        tenant_id: tenantId,
        student_id: u.student_id,
        class_id: cls.id,
        week_start: week.weekStart,
        academic_year: year,
        term,
        performance_rating: u.performance_rating,
        behaviour_rating: u.behaviour_rating,
        comment: u.comment,
        author_user_id: user.id,
        created_at: now,
        updated_at: now,
      }));
      await trx('weekly_student_reviews')
        .insert(rows)
        .onConflict(['tenant_id', 'student_id', 'week_start'])
        .merge(['class_id', 'academic_year', 'term', 'performance_rating', 'behaviour_rating', 'comment', 'author_user_id', 'updated_at']);
      for (const u of upserts.values()) if (!had.has(u.student_id)) newStudents.push(u);
    }
    if (clears.size) {
      cleared = await trx('weekly_student_reviews')
        .where({ tenant_id: tenantId, week_start: week.weekStart })
        .whereIn('student_id', Array.from(clears))
        .del();
    }
  });

  // Best effort, after the commit: the save has already succeeded.
  let notified = 0;
  try {
    notified = await notifyNewReviews(tenantId, week, newStudents);
  } catch (e: any) {
    logger.warn(`Weekly review notifications failed: ${e?.message || e}`);
  }

  return {
    saved: upserts.size,
    cleared,
    skipped: skippedDetails.length + (clears.size - cleared),
    notified,
    skipped_details: skippedDetails,
  };
}

/**
 * Tell a family about a review that is new. Skipped when the Friday digest is
 * still to come (it will include the review); otherwise one in-app notice per
 * student, claimed so later edits never notify again.
 */
async function notifyNewReviews(
  tenantId: string,
  week: { weekStart: string; weekEnd: string; currentWeekStart: string },
  fresh: Array<{ student_id: string; performance_rating: number; behaviour_rating: number | null; comment: string | null }>,
): Promise<number> {
  if (!fresh.length) return 0;
  if (await isDemoTenant(tenantId)) return 0;

  let candidates = fresh;
  const mode = await attendanceNotifyMode(tenantId);
  if (mode === 'weekly' && week.weekStart >= week.currentWeekStart) {
    // The digest for this week is still to come unless it has already claimed the child.
    const keys = fresh.map((f) => `attn-week-app:${week.weekStart}:${f.student_id}`);
    const sent = new Set<string>(await db('finance_notices').where('tenant_id', tenantId).whereIn('key', keys).pluck('key') as string[]);
    candidates = fresh.filter((f) => sent.has(`attn-week-app:${week.weekStart}:${f.student_id}`));
  }
  if (!candidates.length) return 0;

  const ids = candidates.map((c) => c.student_id);
  const students = await db('students as s')
    .leftJoin('users as u', 'u.id', 's.user_id')
    .where('s.tenant_id', tenantId)
    .whereIn('s.id', ids)
    .select('s.id', 's.user_id as own_user_id', db.raw(`${STUDENT_NAME_SQL} as name`)) as any[];
  const guardianLinks = await db('guardians as g')
    .join('students as s', 's.id', 'g.student_id')
    .where('s.tenant_id', tenantId)
    .whereIn('g.student_id', ids)
    .whereNotNull('g.user_id')
    .select('g.student_id', 'g.user_id') as any[];
  const info = new Map<string, { name: string; recipients: Set<string> }>();
  for (const s of students) info.set(s.id, { name: s.name, recipients: new Set(s.own_user_id ? [s.own_user_id] : []) });
  for (const g of guardianLinks) info.get(g.student_id)?.recipients.add(g.user_id);

  const { default: notificationService } = await import('@services/notificationService');
  const weekOf = new Date(`${week.weekStart}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  let notified = 0;
  for (const c of candidates) {
    const who = info.get(c.student_id);
    if (!who) continue;
    if (!(await claimNotice(tenantId, `review-app:${week.weekStart}:${c.student_id}`))) continue;
    const beh = c.behaviour_rating ? `, behaviour: ${ratingLabel(c.behaviour_rating)}` : '';
    const quote = reviewSnippet(c.comment);
    const message = `Teacher's review of ${who.name} for the week of ${weekOf}: ${ratingLabel(c.performance_rating)}${beh}.${quote ? ` "${quote}"` : ''}`;
    for (const recipientId of who.recipients) {
      await notificationService.createNotification({
        notificationType: 'attendance',
        recipientId,
        subject: `Weekly review: ${who.name}`,
        message,
        data: { kind: 'weekly_review', student_id: c.student_id, week_start: week.weekStart, url: '/students/attendance' },
        channels: ['in_app'],
        sourceType: 'attendance',
        sourceId: c.student_id,
      }).catch(() => {});
    }
    notified++;
  }
  return notified;
}

// ── history (parents, students, staff) ───────────────────────────────────────

export interface StudentReviewRow {
  week_start: string;
  week_end: string;
  term: string | null;
  academic_year: string | null;
  performance_rating: number;
  behaviour_rating: number | null;
  comment: string | null;
  teacher_name: string | null;
  updated_at: string;
}

/** The student record id for a signed-in student account (null if none). */
export async function studentIdForUser(tenantId: string, userId: string): Promise<string | null> {
  const row = await db('students').where({ tenant_id: tenantId, user_id: userId }).first('id');
  return row?.id ?? null;
}

/**
 * Who may read a student's reviews: the student themself, a linked parent,
 * principal / super admin, and a teacher of one of the student's classes.
 */
export async function assertCanViewStudent(tenantId: string, user: ReviewUser, studentId: string): Promise<void> {
  if (!UUID_RE.test(String(studentId || ''))) throw new AppError('Student not found', 404, 'NOT_FOUND');
  const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first('id', 'user_id');
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');

  if (isAdminRole(user.role)) return;
  if (user.role === UserRole.STUDENT) {
    if (student.user_id && student.user_id === user.id) return;
  } else if (user.role === UserRole.PARENT) {
    const link = await db('guardians as g')
      .join('students as s', 's.id', 'g.student_id')
      .where('g.user_id', user.id)
      .where('g.student_id', studentId)
      .where('s.tenant_id', tenantId)
      .first('g.id');
    if (link) return;
  } else if (user.role === UserRole.TEACHER) {
    if (await teacherCanAccessStudent(user.id, tenantId, studentId)) return;
  }
  throw new AppError('You do not have access to this student', 403, 'FORBIDDEN');
}

/**
 * A student's reviews, newest week first. Defaults to the active academic year;
 * pass academic_year 'all' for every year. The caller must have passed
 * assertCanViewStudent first.
 */
export async function getForStudent(
  tenantId: string,
  studentId: string,
  filters: { academic_year?: unknown; term?: unknown } = {},
): Promise<StudentReviewRow[]> {
  const q = db('weekly_student_reviews as r')
    .leftJoin('users as au', 'au.id', 'r.author_user_id')
    .where('r.tenant_id', tenantId)
    .where('r.student_id', studentId);

  const yearRaw = typeof filters.academic_year === 'string' ? filters.academic_year.trim() : '';
  if (yearRaw.toLowerCase() !== 'all') {
    const year = yearRaw ? normalizeAcademicYear(yearRaw) : (await resolveActiveYear(tenantId)).yearString;
    if (year) q.where('r.academic_year', year);
  }
  const term = normalizeTerm(filters.term);
  if (term) q.where('r.term', term);

  const rows = await q
    .orderBy('r.week_start', 'desc')
    .select(
      db.raw("to_char(r.week_start, 'YYYY-MM-DD') as week_start"),
      'r.term', 'r.academic_year', 'r.performance_rating', 'r.behaviour_rating', 'r.comment', 'r.updated_at',
      db.raw(`${PERSON_NAME_SQL('au')} as teacher_name`),
    ) as any[];
  return rows.map((r) => ({
    week_start: r.week_start,
    week_end: addDays(r.week_start, 4),
    term: r.term || null,
    academic_year: r.academic_year || null,
    performance_rating: Number(r.performance_rating),
    behaviour_rating: r.behaviour_rating == null ? null : Number(r.behaviour_rating),
    comment: r.comment || null,
    teacher_name: r.teacher_name || null,
    updated_at: dateOut(r.updated_at),
  }));
}

// ── progress ("12/30 reviewed") ──────────────────────────────────────────────

export interface ClassProgress { class_id: string; class_name: string; students: number; reviewed: number }

/** Current-year classes (the teacher's own, or all for principal / super admin) with review counts for a week. */
export async function getProgress(tenantId: string, user: ReviewUser, weekKey?: unknown): Promise<ClassProgress[]> {
  const week = await normalizeWeek(tenantId, weekKey);

  let allowed: string[] | null = null;
  if (!isAdminRole(user.role)) {
    if (user.role !== UserRole.TEACHER) throw new AppError('You do not have access to this', 403, 'FORBIDDEN');
    allowed = await teacherClassIdsFor(user.id, tenantId);
    if (!allowed.length) return [];
  }

  const classQ = db('classes as c')
    .leftJoin('academic_sessions as s', 'c.academic_session_id', 's.id')
    .leftJoin('users as cc', 'c.created_by', 'cc.id')
    .where(function () {
      this.where(function () { this.where('s.tenant_id', tenantId).where('s.is_active', true); })
        .orWhere(function () { this.whereNull('c.academic_session_id').where('cc.tenant_id', tenantId); });
    });
  if (allowed) classQ.whereIn('c.id', allowed);
  const classes = await classQ.select('c.id', 'c.name') as any[];
  if (!classes.length) return [];
  const classIds = classes.map((c) => c.id);

  const [enrolled, reviewed] = await Promise.all([
    db('enrollments as e')
      .join('students as s', 's.id', 'e.student_id')
      .whereIn('e.class_id', classIds)
      .where('s.tenant_id', tenantId)
      .where(function () { this.whereIn('e.status', ['active', 'enrolled']).orWhereNull('e.status'); })
      .whereRaw(ACTIVE_STUDENT_SQL)
      .select('e.class_id', 's.id as student_id') as Promise<any[]>,
    db('weekly_student_reviews').where({ tenant_id: tenantId, week_start: week.weekStart }).pluck('student_id') as Promise<string[]>,
  ]);
  const reviewedSet = new Set<string>(reviewed);

  const roster = new Map<string, Set<string>>();
  for (const e of enrolled) {
    const set = roster.get(e.class_id) || new Set<string>();
    set.add(e.student_id);
    roster.set(e.class_id, set);
  }
  return classes
    .map((c) => {
      const ids = roster.get(c.id) || new Set<string>();
      let done = 0;
      for (const id of ids) if (reviewedSet.has(id)) done++;
      return { class_id: c.id, class_name: c.name, students: ids.size, reviewed: done };
    })
    .sort((a, b) => a.class_name.localeCompare(b.class_name, undefined, { numeric: true, sensitivity: 'base' }));
}
