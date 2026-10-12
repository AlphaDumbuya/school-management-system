/**
 * Search Routes — /api/v1/search
 *
 * GET /api/v1/search?q=kamara&limit=5
 * One search for the header bar. Everything is scoped to the caller's school
 * and to what their role may see (see globalSearchService).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';
import { globalSearchService } from '../services/globalSearchService';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const q = String(req.query.q ?? '').trim();
    // One character is too broad to be useful; the page index covers short queries.
    if (q.length < 2) return res.json({ success: true, data: { query: q, sections: [], top: null, tookMs: 0 } });
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '5'), 10) || 5, 1), 10);
    const data = await globalSearchService.search(
      { id: user.id, role: user.role, staff_duties: user.staff_duties, tenant_id: user.tenant_id },
      q,
      limit,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
