/**
 * Demo access.
 *  Public  (mounted at /api/v1/public/demo):
 *    POST /request   the "Book a live demo" form → emails personal links
 *    POST /session   an emailed link → a session in the read-only demo school
 *  Platform (mounted at /api/v1/platform/demo-requests, super admin only):
 *    GET /, GET /export.csv, GET /:id, POST /follow-up, POST /:id/resend,
 *    PUT /:id/notes, DELETE /:id
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { demoRequestLimiter, demoSessionLimiter, clientIp } from '@middleware/rateLimit';
import { UserRole } from '../types/auth';
import { demoAccessService, ROLES, STUDENT_COUNTS, DEMO_PORTALS } from '@services/demoAccessService';

export const publicDemoRouter = Router();

publicDemoRouter.get('/options', (_req: Request, res: Response) => {
  res.json({ success: true, data: { roles: ROLES, student_counts: STUDENT_COUNTS, portals: DEMO_PORTALS.map(({ key, portal, person }) => ({ key, portal, person })) } });
});

publicDemoRouter.post('/request', demoRequestLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await demoAccessService.request(req.body, { ip: clientIp(req), userAgent: String(req.headers['user-agent'] || '') });
    res.json({ success: true, data: r });
  } catch (e) { next(e); }
});

publicDemoRouter.post('/session', demoSessionLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await demoAccessService.startSession(String(req.body?.token || ''), String(req.body?.portal || ''));
    res.json({ success: true, data: { accessToken: r.access_token, refreshToken: r.refresh_token, expiresIn: 1800, tokenType: 'Bearer', user: r.user, demo: r.demo } });
  } catch (e) { next(e); }
});

export const platformDemoRouter = Router();
platformDemoRouter.use(authenticate, authorize(UserRole.SUPER_ADMIN));

platformDemoRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await demoAccessService.list({ search: req.query.search as string, filter: req.query.filter as string, page: Number(req.query.page), limit: Number(req.query.limit) });
    res.json({ success: true, ...r });
  } catch (e) { next(e); }
});

platformDemoRouter.get('/export.csv', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const csv = await demoAccessService.csv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wiskul-demo-requests-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (e) { next(e); }
});

platformDemoRouter.post('/follow-up', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await demoAccessService.followUp(req.body?.ids, req.body?.subject, req.body?.message, req.auth!.userId) });
  } catch (e) { next(e); }
});

platformDemoRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await demoAccessService.get(req.params.id) }); } catch (e) { next(e); }
});

platformDemoRouter.post('/:id/resend', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await demoAccessService.resend(req.params.id, req.auth!.userId) }); } catch (e) { next(e); }
});

platformDemoRouter.put('/:id/notes', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await demoAccessService.saveNotes(req.params.id, req.body?.notes, req.auth!.userId) }); } catch (e) { next(e); }
});

platformDemoRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await demoAccessService.remove(req.params.id) }); } catch (e) { next(e); }
});
