/**
 * Public plan catalog (UNAUTHENTICATED): the marketing pricing page and the
 * in-app billing tab render plans from here, so prices, limits and feature
 * lists always match what billing charges and the guards enforce.
 *
 * Mounted at /api/v1/public/plans, before any blanket /api/v1 auth router.
 */
import express, { Request, Response, NextFunction } from 'express';
import { PlanCatalog, FEATURES, UNLIMITED } from '../services/planCatalogService';

const router = express.Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await PlanCatalog.list({ publicOnly: true });
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ success: true, data: { plans, features: FEATURES, unlimited: UNLIMITED, currency: 'NLe' } });
  } catch (error) {
    next(error);
  }
});

export default router;
