/**
 * auditCapture: records who changed what for the school's main records.
 *
 * Mount once, before the routers (like liveSyncMiddleware). For a SUCCESSFUL
 * create / update / delete / action on the modules below it writes one audit
 * row before the response is flushed (on serverless, work after the response
 * may never run), with the extra wait capped so a slow database never delays
 * the user for long.
 *
 * What is stored: the actor, IP address, browser, the record's id and the NAMES
 * of the fields that were sent. Never the values: request bodies can carry
 * passwords, tokens and personal details.
 *
 * Not captured here (already audited in detail elsewhere, or too noisy):
 * finance and payments, sign-ins, ownership, school verification, attendance
 * marking, offline sync, notifications and public forms.
 */
import { Request, Response, NextFunction } from 'express';
import { recordAudit } from '../utils/auditTrail';
import { db } from '../utils/database';

/** URL prefix -> the kind of record it changes. */
const MODULES: Array<[prefix: string, entity: string, noun: string]> = [
  ['/api/v1/admissions/houses', 'house', 'house'],
  ['/api/v1/houses', 'house', 'house'],
  ['/api/v1/students', 'student', 'student'],
  ['/api/v1/guardians', 'guardian', 'guardian'],
  ['/api/v1/teachers', 'teacher', 'staff'],
  ['/api/v1/staff', 'support_staff', 'support_staff'],
  ['/api/v1/users', 'users', 'user'],
  ['/api/v1/classes', 'class', 'class'],
  ['/api/v1/subjects', 'subject', 'subject'],
  ['/api/v1/timetable', 'timetable', 'timetable'],
  ['/api/v1/schedules', 'schedule', 'schedule'],
  ['/api/v1/assignments', 'assignment', 'assignment'],
  ['/api/v1/examinations', 'examination', 'examination'],
  ['/api/v1/results', 'result', 'result'],
  ['/api/v1/grades', 'grade', 'grade'],
  ['/api/v1/report-cards', 'report_card', 'report_card'],
  ['/api/v1/promotions', 'promotion', 'promotion'],
  ['/api/v1/discipline', 'discipline', 'discipline'],
  ['/api/v1/admissions', 'admission', 'admission'],
  ['/api/v1/enrollments', 'enrollment', 'enrollment'],
  ['/api/v1/school-config', 'school_settings', 'school_settings'],
  ['/api/v1/announcements', 'announcement', 'announcement'],
  ['/api/v1/events', 'event', 'event'],
  ['/api/v1/identity', 'id_card', 'id_card'],
];

/** Sub-paths under a module that must not be captured here. */
const SKIP = [
  /\/ownership$/,            // ownership changes write their own detailed row
  /^\/api\/v1\/school-config\/monime/,   // payment settings write their own detailed row
  /^\/api\/v1\/school-config\/subscription/,
  /\/reset-password$/,       // would only add the same event twice (the user routes write it)
  /\/attendance/,            // daily marking is too noisy to be useful here
];

const MUTATING: Record<string, string> = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The verb for a request: a trailing word (…/publish) wins, else from the method. */
function verbFor(method: string, tail: string[]): string {
  const word = tail.filter((s) => s && !UUID_RE.test(s) && !/^\d+$/.test(s)).pop();
  if (word && method !== 'DELETE') {
    const v = word.replace(/-/g, '_').toLowerCase();
    // A nested resource (…/students/:id/guardians) reads better as an update.
    if (/^(publish|unpublish|approve|reject|import|export|assign|unassign|promote|activate|deactivate|reset|bulk|archive|restore|draw|submit|lock|unlock|send)/.test(v)) return v;
  }
  return MUTATING[method];
}

export function auditCapture(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (!MUTATING[method]) return next();
  const path = req.originalUrl.split('?')[0];
  const mod = MODULES.find(([p]) => path === p || path.startsWith(`${p}/`));
  if (!mod || SKIP.some((re) => re.test(path))) return next();

  const originalEnd = res.end.bind(res) as (...args: any[]) => Response;
  let done = false;

  (res as any).end = (...args: any[]) => {
    if (done) return originalEnd(...args);
    done = true;
    if (res.statusCode < 200 || res.statusCode >= 300) return originalEnd(...args);

    const [, entity, noun] = mod;
    const tail = path.slice(mod[0].length).split('/').filter(Boolean);
    const entityId = tail.find((s) => UUID_RE.test(s)) || null;
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? Object.keys(req.body) : [];

    // The actor is known by now (the route's own auth has run). Without one
    // (a public route) there is nothing worth recording.
    const actor = (req as any).user?.id || (req as any).auth?.userId;
    if (!actor) return originalEnd(...args);

    const write = recordAudit({
      req,
      userId: actor,
      action: `${noun}.${verbFor(method, tail)}`,
      entityType: entity,
      entityId,
      newValues: { path, fields: body.slice(0, 40) },
      source: 'api',
    }, db);
    const timeout = new Promise((r) => setTimeout(r, 1500));
    Promise.race([write, timeout]).finally(() => originalEnd(...args));
    return res;
  };

  next();
}

export default auditCapture;
