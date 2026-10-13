/**
 * School audit log (read-only): who did what, when and from where.
 *
 *   GET /api/v1/school-audit             filtered, paged list (see the filters below)
 *   GET /api/v1/school-audit/summary     counts for the page header
 *   GET /api/v1/school-audit/export.csv  the same filters as a spreadsheet
 *
 * Scope: every query is tied to the caller's school (tenant_id) and, by default,
 * to the school's CURRENT academic year. `academicYear=<session id>` picks another
 * year (looked up inside the same school only), `academicYear=all` removes the
 * year limit. `month=YYYY-MM`, `year=YYYY` and `from` / `to` narrow it further.
 * Paging is on the server (at most 100 rows per page).
 *
 * For the school owner and principals. Always scoped to the caller's school.
 * Some rows (payment settings, ownership, billing, and what WiSkul support did
 * for the school) and every IP address / browser are the OWNER's to see: a
 * principal who is not the owner never receives them, whatever filter is sent.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext, authorize } from '../middleware/authMiddleware';
import { AppError } from '../middleware/errorHandler';
import { UserRole } from '../types/auth';
import { db } from '../utils/database';
import { isTenantOwner } from '../utils/tenantOwner';
import {
  AUDIT_CATEGORIES, categoryNames, categoryOf, describeAudit, excludeOwnerOnly, recordAudit, scrub, whereCategory,
} from '../utils/auditTrail';
import type { Knex } from 'knex';

const router = Router();
router.use(authenticate, attachUserContext, authorize(UserRole.PRINCIPAL));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function scopeOf(req: Request) {
  const u = req.user!;
  if (!u.tenant_id) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  const ownerView = await isTenantOwner({ id: u.id, role: u.primary_role || u.role, tenant_id: u.tenant_id, is_owner: u.is_owner });
  return { tenantId: u.tenant_id, ownerView, userId: u.id };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^\d{4}$/;

interface Period {
  /** The academic year in force (null = all years). */
  year: { id: string; name: string; start: string; end: string } | null;
  /** True when the requested year does not exist in this school. */
  unknown: boolean;
}

const ymd = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

/** Which academic year applies: the one asked for (this school's only), else the current one. */
async function periodOf(tenantId: string, q: Record<string, any>): Promise<Period> {
  const asked = q.academicYear === undefined ? '' : String(q.academicYear);
  if (asked === 'all') return { year: null, unknown: false };
  const row: any = asked && UUID_RE.test(asked)
    ? await db('academic_sessions').where({ id: asked, tenant_id: tenantId }).first('id', 'name', 'start_date', 'end_date')
    : asked
      ? null
      : await db('academic_sessions').where({ tenant_id: tenantId, is_active: true }).orderBy('start_date', 'desc').first('id', 'name', 'start_date', 'end_date');
  if (asked && !row) return { year: null, unknown: true };
  if (!row) return { year: null, unknown: false }; // a school with no academic year yet
  return { year: { id: row.id, name: row.name, start: ymd(row.start_date), end: ymd(row.end_date) }, unknown: false };
}

/** Limit created_at to the academic year (inclusive of its last day). */
function withinYear(b: Knex.QueryBuilder, p: Period) {
  if (p.unknown) return b.whereRaw('FALSE');
  if (p.year) b.where('a.created_at', '>=', `${p.year.start}T00:00:00`).where('a.created_at', '<', db.raw("?::date + interval '1 day'", [p.year.end]));
  return b;
}

/** The shared WHERE for list, summary and export. */
function filtered(tenantId: string, ownerView: boolean, q: Record<string, any>, period: Period): Knex.QueryBuilder {
  const base = db('audit_logs as a').where('a.tenant_id', tenantId);
  if (!ownerView) excludeOwnerOnly(base);
  withinYear(base, period);
  const month = String(q.month || '');
  if (MONTH_RE.test(month)) {
    base.where('a.created_at', '>=', `${month}-01T00:00:00`).where('a.created_at', '<', db.raw("(?::date + interval '1 month')", [`${month}-01`]));
  }
  const year = String(q.year || '');
  if (YEAR_RE.test(year)) {
    base.where('a.created_at', '>=', `${year}-01-01T00:00:00`).where('a.created_at', '<', db.raw("(?::date + interval '1 year')", [`${year}-01-01`]));
  }
  const category = String(q.category || '');
  if (category && (category === 'Other' || AUDIT_CATEGORIES[category])) whereCategory(base, category);
  if (q.person && /^[0-9a-f-]{36}$/i.test(String(q.person))) base.where('a.performed_by', String(q.person));
  if (DATE_RE.test(String(q.from || ''))) base.where('a.created_at', '>=', `${q.from}T00:00:00`);
  if (DATE_RE.test(String(q.to || ''))) base.where('a.created_at', '<', db.raw("?::date + interval '1 day'", [q.to]));
  const t = String(q.search || '').trim().slice(0, 100);
  if (t) {
    const like = `%${t.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    base.where((w) => w.whereILike('a.action', like).orWhereILike('a.entity_type', like).orWhereILike('a.actor_name', like));
  }
  return base;
}

const asObject = (v: unknown) => {
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
  return v ?? null;
};

function shape(r: any, ownerView: boolean) {
  const actor = r.actor_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || null;
  return {
    id: r.id,
    at: r.created_at,
    actor: { id: r.performed_by || null, name: actor, role: r.performed_by_role || null },
    category: categoryOf(r),
    summary: describeAudit(r),
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id || null,
    reason: r.reason || null,
    source: r.source || null,
    before: scrub(asObject(r.old_values)),
    after: scrub(asObject(r.new_values)),
    ...(ownerView ? { ip: r.ip_address || null, userAgent: r.user_agent || null } : {}),
  };
}

const COLUMNS = [
  'a.id', 'a.created_at', 'a.action', 'a.entity_type', 'a.entity_id', 'a.performed_by', 'a.actor_name',
  'a.performed_by_role', 'a.old_values', 'a.new_values', 'a.reason', 'a.source', 'a.ip_address', 'a.user_agent',
];

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, ownerView } = await scopeOf(req);
    const page = Math.max(0, Math.floor(Number(req.query.page) || 0));
    const size = Math.min(100, Math.max(10, Math.floor(Number(req.query.size) || 25)));
    const period = await periodOf(tenantId, req.query as any);
    const base = filtered(tenantId, ownerView, req.query as any, period);

    const total = Number((await base.clone().count('* as n').first() as any)?.n || 0);
    const rows = await base.clone()
      .leftJoin('users as u', 'u.id', 'a.performed_by')
      .orderBy('a.created_at', 'desc').limit(size).offset(page * size)
      .select(...COLUMNS, 'u.first_name', 'u.last_name');

    const peopleBase = db('audit_logs as a').where('a.tenant_id', tenantId).whereNotNull('a.performed_by');
    if (!ownerView) excludeOwnerOnly(peopleBase);
    const people = await peopleBase
      .groupBy('a.performed_by', 'a.performed_by_role')
      .select('a.performed_by as id', db.raw('MAX(a.actor_name) as name'), 'a.performed_by_role as role')
      .orderBy('name').limit(200);

    // Facets for the period pickers: this school's academic years, and how busy each month was.
    const sessions = await db('academic_sessions').where({ tenant_id: tenantId }).orderBy('start_date', 'desc').limit(30)
      .select('id', 'name', 'start_date', 'end_date', 'is_active');
    const monthBase = db('audit_logs as a').where('a.tenant_id', tenantId);
    if (!ownerView) excludeOwnerOnly(monthBase);
    withinYear(monthBase, period);
    const months = await monthBase
      .select(db.raw("to_char(a.created_at, 'YYYY-MM') as month"))
      .count('* as count')
      .groupByRaw("to_char(a.created_at, 'YYYY-MM')")
      .orderBy('month', 'desc')
      .limit(60);

    res.json({
      success: true,
      data: {
        total, page, size,
        academicYear: period.year,
        academicYearUnknown: period.unknown,
        sessions: sessions.map((x: any) => ({ id: x.id, name: x.name, start: ymd(x.start_date), end: ymd(x.end_date), isActive: !!x.is_active })),
        months: (months as any[]).map((m) => ({ month: m.month, count: Number(m.count) })),
        rows: rows.map((r: any) => shape(r, ownerView)),
        categories: categoryNames(ownerView),
        people,
        canSeeAddresses: ownerView,
      },
    });
  } catch (error) { next(error); }
});

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, ownerView } = await scopeOf(req);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const scopeBase = () => {
      const b = db('audit_logs as a').where('a.tenant_id', tenantId);
      if (!ownerView) excludeOwnerOnly(b);
      return b;
    };
    const [last30, failed, actors, latest] = await Promise.all([
      scopeBase().where('a.created_at', '>=', since30).count('* as n').first(),
      scopeBase().where('a.created_at', '>=', since7).where('a.action', 'auth.login_failed').count('* as n').first(),
      scopeBase().where('a.created_at', '>=', since7).whereNotNull('a.performed_by').countDistinct('a.performed_by as n').first(),
      scopeBase().max('a.created_at as at').first(),
    ]);
    res.json({
      success: true,
      data: {
        changesLast30Days: Number((last30 as any)?.n || 0),
        failedSignInsLast7Days: Number((failed as any)?.n || 0),
        activePeopleLast7Days: Number((actors as any)?.n || 0),
        latestAt: (latest as any)?.at || null,
      },
    });
  } catch (error) { next(error); }
});

/** Stop spreadsheet programs from running a cell as a formula. */
const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

router.get('/export.csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, ownerView, userId } = await scopeOf(req);
    const period = await periodOf(tenantId, req.query as any);
    const rows = await filtered(tenantId, ownerView, req.query as any, period)
      .leftJoin('users as u', 'u.id', 'a.performed_by')
      .orderBy('a.created_at', 'desc').limit(5000)
      .select(...COLUMNS, 'u.first_name', 'u.last_name');

    const head = ['When', 'Who', 'Role', 'Category', 'What', 'Record type', 'Record ID', ...(ownerView ? ['IP address'] : [])];
    const lines = [head.map(csvCell).join(',')];
    for (const r of rows as any[]) {
      const s = shape(r, ownerView) as any;
      lines.push([
        new Date(s.at).toISOString(), s.actor.name, s.actor.role, s.category, s.summary, s.entityType, s.entityId,
        ...(ownerView ? [s.ip] : []),
      ].map(csvCell).join(','));
    }

    // The export is itself worth a line in the log.
    await recordAudit({ req, userId, action: 'audit.export', entityType: 'audit_log', newValues: { rows: rows.length } });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
  } catch (error) { next(error); }
});

export default router;
