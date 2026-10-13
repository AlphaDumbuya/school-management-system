/**
 * Owner area: a single read-only overview for the school owner.
 *
 * GET /api/v1/owner/overview
 *   plan and usage, payment-collection status, verification, the school's
 *   principals and owners, headcounts, and recent sensitive activity (payment
 *   settings, ownership, and principal account changes).
 *
 * Owner-only (requireOwner) and always scoped to the caller's own school.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '../middleware/authMiddleware';
import { AppError } from '../middleware/errorHandler';
import { requireOwner } from '../utils/tenantOwner';
import { SubscriptionService } from '../services/subscriptionService';
import { db } from '../utils/database';

const router = Router();
router.use(authenticate, attachUserContext, requireOwner);

/** Actions that matter to an owner. Anything else in the audit log is not shown here. */
const OWNER_ACTIONS = [
  'payment_settings.update',
  'payment_settings.disable',
  'payment_settings.stepup_failed',
  'ownership.grant',
  'ownership.revoke',
];

const count = async (q: PromiseLike<any>): Promise<number> => Number((await q)?.n) || 0;

router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');

    const [school, sub, studentsLimit, staffLimit, principals, activity] = await Promise.all([
      db('schools').where({ tenant_id: tenantId }).first('name', 'monime_configured').catch(() => null),
      SubscriptionService.getActiveSubscription(tenantId).catch(() => null),
      SubscriptionService.checkLimit(tenantId, 'students').catch(() => null),
      SubscriptionService.checkLimit(tenantId, 'staff').catch(() => null),
      db('users')
        .where({ tenant_id: tenantId, role: 'principal' })
        .select('id', 'first_name', 'last_name', 'email', 'status', 'is_owner', 'last_login')
        .orderBy([{ column: 'is_owner', order: 'desc' }, { column: 'created_at', order: 'asc' }]),
      db('audit_logs as a')
        .join('users as u', 'u.id', 'a.performed_by')
        .where('u.tenant_id', tenantId)
        .whereIn('a.action', OWNER_ACTIONS)
        .orderBy('a.created_at', 'desc')
        .limit(15)
        .select('a.id', 'a.action', 'a.created_at', 'u.first_name', 'u.last_name', 'u.email'),
    ]);

    const owner = principals.find((p: any) => p.is_owner) || principals[0];
    const verification = await db('users').where({ id: owner?.id }).first('verification_status', 'verified_at').catch(() => null);

    const [teachers, bursars, admissions, students] = await Promise.all([
      count(db('users').where({ tenant_id: tenantId, role: 'teacher', status: 'active' }).count({ n: '*' }).first()),
      count(db('users').where({ tenant_id: tenantId, role: 'accountant', status: 'active' }).count({ n: '*' }).first()),
      count(db('users').where({ tenant_id: tenantId, role: 'admissions_officer', status: 'active' }).count({ n: '*' }).first()),
      count(db('students').where({ tenant_id: tenantId }).whereNotIn('status', ['deleted', 'inactive', 'graduated']).count({ n: '*' }).first().catch(() => null as any)),
    ]);

    res.json({
      success: true,
      data: {
        schoolName: school?.name || null,
        hasNamedOwner: principals.some((p: any) => p.is_owner),
        plan: sub
          ? {
              planType: sub.plan_type,
              status: sub.status,
              isTrial: !!sub.is_trial,
              isComp: !!sub.is_comp,
              endsAt: sub.end_date,
            }
          : null,
        usage: {
          students: studentsLimit ? { current: studentsLimit.current, max: studentsLimit.max } : null,
          staff: staffLimit ? { current: staffLimit.current, max: staffLimit.max } : null,
        },
        payments: { feeCollectionConfigured: !!school?.monime_configured },
        verification: {
          status: verification?.verification_status === 'verified' ? 'verified' : 'unverified',
          verifiedAt: verification?.verified_at || null,
        },
        people: {
          principals: principals.map((p: any) => ({
            id: p.id,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email,
            email: p.email,
            status: p.status,
            isOwner: p.is_owner === true,
            lastLogin: p.last_login || null,
          })),
          counts: { teachers, bursars, admissionsOfficers: admissions, students },
        },
        activity: activity.map((a: any) => ({
          id: a.id,
          action: a.action,
          at: a.created_at,
          by: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
