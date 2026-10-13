/**
 * School audit trail: one place to write and to describe audit rows.
 *
 * Writing:  recordAudit(...) never throws and never blocks the action it
 *           describes. The database fills in the school, the actor's name and
 *           role (trigger from migration 179), so callers only say what happened.
 * Reading:  AUDIT_CATEGORIES groups rows for the Audit Log page; describeAudit()
 *           turns a row into one readable sentence.
 */
import type { Request } from 'express';
import type { Knex } from 'knex';
import { db } from './database';
import { logger } from './logger';
import { isSecretColumn } from './redact';
import { clientIp } from '../middleware/rateLimit';
import { FINANCE_AUDIT_AREAS } from '../services/finance/financeAuditService';

// ── Writing ──────────────────────────────────────────────────────────────────

export interface AuditInput {
  /** The request (gives the actor, IP address and browser). */
  req?: Request;
  /** The actor, when there is no request (for example a sign-in attempt). */
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  reason?: string;
  source?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A copy of an object with secret-looking keys and long values removed. */
export function scrub(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value !== 'object') return value;
  if (depth > 3) return '…';
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSecretColumn(k) ? '[hidden]' : scrub(v, depth + 1);
  }
  return out;
}

export const requestMeta = (req?: Request) => ({
  ip: req ? clientIp(req).slice(0, 45) : null,
  userAgent: req ? String(req.headers['user-agent'] || '').slice(0, 300) || null : null,
});

/** The signed-in user's id for this request, if any. */
const actorOf = (req?: Request): string | null =>
  ((req as any)?.user?.id as string) || ((req as any)?.auth?.userId as string) || null;

export async function recordAudit(i: AuditInput, conn: Knex = db): Promise<void> {
  try {
    const actor = i.userId ?? actorOf(i.req);
    const meta = requestMeta(i.req);
    await conn('audit_logs').insert({
      user_id: actor,
      performed_by: actor,
      action: i.action.slice(0, 100),
      entity_type: i.entityType.slice(0, 100),
      entity_id: i.entityId && UUID_RE.test(i.entityId) ? i.entityId : null,
      old_values: i.oldValues === undefined ? null : JSON.stringify(scrub(i.oldValues)),
      new_values: i.newValues === undefined ? null : JSON.stringify(scrub(i.newValues)),
      reason: i.reason || null,
      source: i.source || 'api',
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      created_at: new Date(),
    });
  } catch (e: any) {
    logger.warn(`Could not record audit '${i.action}': ${e?.message || e}`);
  }
}

// ── Grouping ─────────────────────────────────────────────────────────────────

export interface AuditCategory {
  /** Rows whose entity_type is one of these. */
  entities?: string[];
  /** Rows whose action matches one of these SQL LIKE patterns. */
  actions?: string[];
  /** Rows written by this kind of account (for example platform staff). */
  role?: string;
  /** Only the school owner may see these rows. */
  ownerOnly?: boolean;
}

const FINANCE_ENTITIES = Array.from(new Set([...Object.values(FINANCE_AUDIT_AREAS).flat(), 'report']));

/** Listed in priority order: a row is shown under the first category it matches. */
export const AUDIT_CATEGORIES: Record<string, AuditCategory> = {
  'WiSkul support': { role: 'super_admin', ownerOnly: true },
  'Owner & billing': {
    entities: ['payment_settings', 'subscription', 'billing'],
    actions: ['ownership.%', 'payment_settings.%', 'school_verified%', 'verification.%', 'subscription.%'],
    ownerOnly: true,
  },
  'Sign-ins': { actions: ['auth.%'] },
  Finance: { entities: FINANCE_ENTITIES },
  'Accounts & staff': { entities: ['users', 'user', 'teacher', 'staff', 'support_staff', 'role'] },
  'Students & admissions': {
    entities: ['student', 'enrollment', 'enrollment_request', 'admission_application', 'admission', 'guardian', 'house'],
  },
  Academics: {
    entities: ['attendance', 'grade', 'result', 'examination', 'report_card', 'class', 'subject', 'timetable', 'assignment', 'promotion', 'discipline', 'schedule'],
  },
  'School settings': { entities: ['school_settings', 'settings', 'announcement', 'event', 'id_card', 'academic_year', 'audit_log'] },
};

/** SQL condition for one category on audit_logs aliased as `a`. */
function categorySql(cat: AuditCategory): { sql: string; bindings: unknown[] } {
  const parts: string[] = [];
  const bindings: unknown[] = [];
  if (cat.entities?.length) {
    parts.push(`a.entity_type IN (${cat.entities.map(() => '?').join(', ')})`);
    bindings.push(...cat.entities);
  }
  for (const like of cat.actions || []) {
    parts.push('a.action ILIKE ?');
    bindings.push(like);
  }
  if (cat.role) {
    parts.push('a.performed_by_role = ?');
    bindings.push(cat.role);
  }
  return { sql: parts.length ? `(${parts.join(' OR ')})` : 'FALSE', bindings };
}

/** Restrict an audit query to one category (or to "Other" = none of them). */
export function whereCategory(q: Knex.QueryBuilder, name: string): Knex.QueryBuilder {
  if (name === 'Other') {
    for (const cat of Object.values(AUDIT_CATEGORIES)) {
      const { sql, bindings } = categorySql(cat);
      q.whereRaw(`NOT ${sql}`, bindings as any);
    }
    return q;
  }
  const cat = AUDIT_CATEGORIES[name];
  if (!cat) return q.whereRaw('FALSE');
  const { sql, bindings } = categorySql(cat);
  return q.whereRaw(sql, bindings as any);
}

/** Hide the owner-only categories (for principals who are not the owner). */
export function excludeOwnerOnly(q: Knex.QueryBuilder): Knex.QueryBuilder {
  for (const cat of Object.values(AUDIT_CATEGORIES)) {
    if (!cat.ownerOnly) continue;
    const { sql, bindings } = categorySql(cat);
    q.whereRaw(`NOT COALESCE(${sql}, FALSE)`, bindings as any);
  }
  return q;
}

export const categoryNames = (ownerView: boolean): string[] => [
  ...Object.entries(AUDIT_CATEGORIES).filter(([, c]) => ownerView || !c.ownerOnly).map(([n]) => n),
  'Other',
];

/** The category a row is shown under. */
export function categoryOf(row: { entity_type?: string | null; action?: string | null; performed_by_role?: string | null }): string {
  const action = String(row.action || '').toLowerCase();
  const entity = String(row.entity_type || '');
  for (const [name, c] of Object.entries(AUDIT_CATEGORIES)) {
    if (c.role && row.performed_by_role === c.role) return name;
    if (c.entities?.includes(entity)) return name;
    if (c.actions?.some((p) => {
      const lp = p.toLowerCase();
      return lp.endsWith('%') ? action.startsWith(lp.slice(0, -1)) : action === lp;
    })) return name;
  }
  return 'Other';
}

// ── Describing ───────────────────────────────────────────────────────────────

const PAST: Record<string, string> = {
  create: 'Created', add: 'Added', update: 'Updated', edit: 'Edited', delete: 'Deleted', remove: 'Removed',
  publish: 'Published', unpublish: 'Unpublished', approve: 'Approved', reject: 'Rejected', void: 'Voided',
  import: 'Imported', export: 'Exported', assign: 'Assigned', unassign: 'Unassigned', draw: 'Ran a draw for',
  promote: 'Promoted', reset: 'Reset', activate: 'Activated', deactivate: 'Deactivated', suspend: 'Suspended',
  grant: 'Granted', revoke: 'Revoked', login: 'Signed in', login_failed: 'Failed sign-in',
};

const ACTION_TEXT: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in attempt (wrong password)',
  'auth.password_changed': 'Changed their password',
  'payment_settings.update': 'Changed the school payment settings',
  'payment_settings.disable': 'Turned off online fee payments',
  'payment_settings.stepup_failed': 'Wrong password while changing payment settings',
  'ownership.grant': 'Named a school owner',
  'ownership.revoke': 'Removed a school owner',
  'audit.export': 'Downloaded the audit log',
  create_user: 'Created a user account',
  update_user: 'Updated a user account',
  deactivate_user: 'Deactivated a user account',
  reactivate_user: 'Reactivated a user account',
};

const words = (s: string) => s.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** One readable line for an audit row. */
export function describeAudit(row: { action?: string | null; entity_type?: string | null }): string {
  const action = String(row.action || '');
  const known = ACTION_TEXT[action.toLowerCase()];
  if (known) return known;
  const entity = words(String(row.entity_type || '')).replace(/^unknown$/, '');
  const dot = action.indexOf('.');
  if (dot > 0) {
    const noun = words(action.slice(0, dot));
    const verb = action.slice(dot + 1).toLowerCase();
    const past = PAST[verb];
    return past ? `${past} ${noun}` : `${noun.charAt(0).toUpperCase()}${noun.slice(1)}: ${words(verb)}`;
  }
  const w = words(action);
  const first = w.split(' ')[0];
  const past = PAST[first];
  if (past) return `${past}${w.slice(first.length)}${entity && !w.includes(entity) ? ` (${entity})` : ''}`;
  const text = w ? w.charAt(0).toUpperCase() + w.slice(1) : 'Activity';
  return entity && !w.includes(entity) ? `${text} (${entity})` : text;
}
