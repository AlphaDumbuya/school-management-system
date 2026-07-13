/**
 * Print Configuration API Routes
 * 
 * Endpoints for managing print configuration profiles
 * 
 * Requirements: 11.1, 11.2, 11.4, 11.5
 */

import express, { Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import printConfigService from '../services/printConfigService';
import { logger } from '../utils/logger';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/print-configs
 * Get all print configurations for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;

    const configs = await printConfigService.getConfigsByUser(userId, tenantId);

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    logger.error('Failed to get print configurations', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve print configurations'
    });
  }
});

/**
 * GET /api/v1/print-configs/default
 * Get default print configuration for current user
 */
router.get('/default', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;

    const config = await printConfigService.getDefaultConfig(userId, tenantId);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'No default configuration found'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get default print configuration', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve default configuration'
    });
  }
});

/**
 * GET /api/v1/print-configs/last-used
 * Get last used print configuration for current user
 */
router.get('/last-used', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;

    const config = await printConfigService.getLastUsedConfig(userId, tenantId);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'No configuration found'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get last used configuration', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve last used configuration'
    });
  }
});

/**
 * GET /api/v1/print-configs/default-template/:cardType
 * Get default template configuration for card type
 */
router.get('/default-template/:cardType', async (req: Request, res: Response) => {
  try {
    const { cardType } = req.params;

    if (cardType !== 'pvc' && cardType !== 'badge') {
      return res.status(400).json({
        success: false,
        error: 'Invalid card type. Must be "pvc" or "badge"'
      });
    }

    const config = printConfigService.getDefaultConfigForType(cardType);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get default template', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve default template'
    });
  }
});

/**
 * GET /api/v1/print-configs/:configId
 * Get specific print configuration by ID
 */
router.get('/:configId', async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const tenantId = (req as any).user.tenantId;

    const config = await printConfigService.getConfigById(configId, tenantId);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Failed to get print configuration', { error, configId: req.params.configId });
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Print configuration not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve print configuration'
    });
  }
});

/**
 * POST /api/v1/print-configs
 * Create new print configuration
 */
router.post('/', rbacMiddleware(['principal', 'admin_staff']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;
    const { name, config } = req.body;

    // Validate required fields
    if (!name || !config) {
      return res.status(400).json({
        success: false,
        error: 'Name and config are required'
      });
    }

    const newConfig = await printConfigService.createConfig(userId, tenantId, name, config);

    res.status(201).json({
      success: true,
      message: 'Print configuration created successfully',
      data: newConfig
    });
  } catch (error) {
    logger.error('Failed to create print configuration', { error });
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to create print configuration';
    const statusCode = errorMessage.includes('Invalid') || errorMessage.includes('must be') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * PUT /api/v1/print-configs/:configId
 * Update existing print configuration
 */
router.put('/:configId', rbacMiddleware(['principal', 'admin_staff']), async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;
    const updates = req.body;

    const updatedConfig = await printConfigService.updateConfig(configId, userId, tenantId, updates);

    res.json({
      success: true,
      message: 'Print configuration updated successfully',
      data: updatedConfig
    });
  } catch (error) {
    logger.error('Failed to update print configuration', { error, configId: req.params.configId });
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to update print configuration';
    
    if (errorMessage.includes('not found')) {
      return res.status(404).json({ success: false, error: errorMessage });
    }
    if (errorMessage.includes('Unauthorized')) {
      return res.status(403).json({ success: false, error: errorMessage });
    }
    if (errorMessage.includes('Invalid')) {
      return res.status(400).json({ success: false, error: errorMessage });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update print configuration'
    });
  }
});

/**
 * POST /api/v1/print-configs/:configId/set-default
 * Set configuration as default
 */
router.post('/:configId/set-default', rbacMiddleware(['principal', 'admin_staff']), async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;

    await printConfigService.setDefaultConfig(configId, userId, tenantId);

    res.json({
      success: true,
      message: 'Default configuration set successfully'
    });
  } catch (error) {
    logger.error('Failed to set default configuration', { error, configId: req.params.configId });
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to set default configuration';
    
    if (errorMessage.includes('not found') || errorMessage.includes('unauthorized')) {
      return res.status(404).json({ success: false, error: errorMessage });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to set default configuration'
    });
  }
});

/**
 * POST /api/v1/print-configs/:configId/update-last-used
 * Update last used timestamp
 */
router.post('/:configId/update-last-used', async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const tenantId = (req as any).user.tenantId;

    await printConfigService.updateLastUsed(configId, tenantId);

    res.json({
      success: true,
      message: 'Last used timestamp updated'
    });
  } catch (error) {
    logger.error('Failed to update last used timestamp', { error, configId: req.params.configId });
    res.status(500).json({
      success: false,
      error: 'Failed to update last used timestamp'
    });
  }
});

/**
 * POST /api/v1/print-configs/:configId/calculate-layout
 * Calculate print layout dimensions
 */
router.post('/:configId/calculate-layout', async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const tenantId = (req as any).user.tenantId;

    const config = await printConfigService.getConfigById(configId, tenantId);
    const layout = printConfigService.calculatePrintLayout(config.config);

    res.json({
      success: true,
      data: layout
    });
  } catch (error) {
    logger.error('Failed to calculate print layout', { error, configId: req.params.configId });
    res.status(500).json({
      success: false,
      error: 'Failed to calculate print layout'
    });
  }
});

/**
 * DELETE /api/v1/print-configs/:configId
 * Delete print configuration
 */
router.delete('/:configId', rbacMiddleware(['principal', 'admin_staff']), async (req: Request, res: Response) => {
  try {
    const { configId } = req.params;
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;

    await printConfigService.deleteConfig(configId, userId, tenantId);

    res.json({
      success: true,
      message: 'Print configuration deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete print configuration', { error, configId: req.params.configId });
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete print configuration';
    
    if (errorMessage.includes('not found')) {
      return res.status(404).json({ success: false, error: errorMessage });
    }
    if (errorMessage.includes('Unauthorized')) {
      return res.status(403).json({ success: false, error: errorMessage });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete print configuration'
    });
  }
});

export default router;
