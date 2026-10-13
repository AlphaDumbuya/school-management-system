/**
 * Sport-house badges for profiles: /api/v1/sport-badge
 * Any signed-in user gets the badges that belong to them (a student's own
 * house, a parent's children, a house master / teacher's post). The principal
 * and admissions officer can ask for another person with ?user_id=.
 * Not behind a plan gate: it only shows what already exists.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';
import { houseService as svc } from '../services/houseService.js';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const wrap = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

router.get('/', wrap(async (req, res) => {
  const tenantId = req.user?.tenant_id;
  const me = String(req.user?.id || req.auth?.userId || '');
  const role = String(req.user?.role || req.auth?.role || '');
  if (!tenantId || !me) return res.json({ success: true, data: [] }); // platform admins have no school
  let target = me;
  let targetRole = role;
  const asked = typeof req.query.user_id === 'string' ? req.query.user_id : '';
  if (asked && asked !== me) {
    // Someone else's badge: managers only, and only house posts (no children / student lookups).
    if (!['principal', 'admissions_officer'].includes(role) || !UUID_RE.test(asked)) return res.json({ success: true, data: [] });
    target = asked;
    targetRole = 'staff';
  }
  res.json({ success: true, data: await svc.badgesFor(tenantId, target, targetRole) });
}));

export default router;
