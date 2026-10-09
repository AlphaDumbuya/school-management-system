/**
 * Promotion Routes — /api/v1/promotions
 * Principal/super-admin end-of-year student promotion tools.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';
import promotionService from '../services/promotionService.js';

const router = Router();

// Handlers read req.user.tenant_id — load it here rather than relying on
// another router's blanket attachUserContext earlier in the chain.
router.use(authenticate, attachUserContext);

/**
 * GET /api/v1/promotions/candidates?class_id=&academic_year=
 * Compute promotion candidates (yearly outcome) for a class.
 */
router.get(
  '/candidates',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const classId = req.query.class_id as string;
      const academicYear = req.query.academic_year as string;
      if (!classId || !academicYear) {
        return res.status(400).json({ success: false, error: 'class_id and academic_year are required' });
      }
      const result = await promotionService.getClassPromotionCandidates(
        req.user!.tenant_id,
        classId,
        academicYear,
      );
      res.json({ success: true, ...result });
    } catch (error: any) {
      logger.error('Error getting promotion candidates:', error);
      if (error.message?.includes('not found')) {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  },
);

/**
 * POST /api/v1/promotions/execute
 * Execute bulk promotion decisions for a class.
 */
router.post(
  '/execute',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from_class_id, academic_year, to_class_id, graduate, decisions } = req.body;
      if (!from_class_id || !academic_year || !Array.isArray(decisions) || decisions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'from_class_id, academic_year and a non-empty decisions[] are required',
        });
      }
      const result = await promotionService.executePromotions(req.user!.tenant_id, req.user!.id, {
        from_class_id,
        academic_year,
        to_class_id,
        graduate,
        source: 'manual',
        decisions,
      });
      res.json({ success: true, result });
    } catch (error: any) {
      logger.error('Error executing promotions:', error);
      if (error.message?.includes('required') || error.message?.includes('not found')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  },
);

/**
 * GET /api/v1/promotions/history?class_id=&academic_year=
 * Promotion audit history.
 */
router.get(
  '/history',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await promotionService.getPromotionHistory(req.user!.tenant_id, {
        class_id: req.query.class_id as string | undefined,
        academic_year: req.query.academic_year as string | undefined,
      });
      res.json({ success: true, data: history });
    } catch (error) {
      logger.error('Error getting promotion history:', error);
      next(error);
    }
  },
);

export default router;
