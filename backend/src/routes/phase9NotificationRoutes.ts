import express, { Request, Response, Router } from 'express';
import notificationService, { CreateNotificationRequest } from '@services/notificationService';
import inAppNotificationService from '@services/inAppNotificationService';
import notificationPreferenceService from '@services/notificationPreferenceService';
import emailService from '@services/emailService';
import smsService from '@services/smsService';
import { logger } from '@utils/logger';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';

const router: Router = express.Router();

// Every route in this module relies on `req.user` (id, role, tenant). The
// inline `authenticate` only sets `req.auth`, so we attach the full DB-backed
// user context here — without it, `req.user` is undefined and the handlers
// 500 with "Cannot read properties of undefined (reading 'id')".
router.use(authenticate, attachUserContext);

// ============================================================================
// NOTIFICATION ENDPOINTS
// ============================================================================

/**
 * @route   POST /notifications
 * @access  Private
 * @desc    Create a new notification
 */
router.post('/notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const { notificationType, recipientId, subject, message, data, channels, sourceType, sourceId } = req.body;

    // Validation
    if (!notificationType || !recipientId || !message) {
      return res.status(400).json({
        error: 'Missing required fields: notificationType, recipientId, message',
      });
    }

    const notification = await notificationService.createNotification({
      notificationType,
      recipientId,
      subject,
      message,
      data,
      channels,
      sourceType,
      sourceId,
      createdBy: (req as any).user.id,
    });

    res.status(201).json({
      message: 'Notification created successfully',
      data: notification,
    });
  } catch (error) {
    logger.error(`Error creating notification: ${error}`);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

/**
 * @route   GET /notifications/:notificationId
 * @access  Private
 * @desc    Get notification details
 */
router.get('/notifications/:notificationId', authenticate, async (req: Request, res: Response) => {
  try {
    const notification = await notificationService.getNotificationById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check authorization
    if (notification.recipientId !== (req as any).user.id && (req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      message: 'Notification retrieved successfully',
      data: notification,
    });
  } catch (error) {
    logger.error(`Error fetching notification: ${error}`);
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
});

/**
 * @route   GET /notifications
 * @access  Private
 * @desc    Get user notifications with filtering
 */
router.get('/notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const { notificationType, status, isRead, limit = 20, offset = 0 } = req.query;

    const result = await notificationService.getUserNotifications((req as any).user.id, {
      notificationType: notificationType as string,
      status: status as string,
      isRead: isRead === 'true',
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      message: 'Notifications retrieved successfully',
      data: result.notifications,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    logger.error(`Error fetching notifications: ${error}`);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * @route   PATCH /notifications/:notificationId/read
 * @access  Private
 * @desc    Mark notification as read
 */
router.patch('/notifications/:notificationId/read', authenticate, async (req: Request, res: Response) => {
  try {
    const notification = await notificationService.markAsRead(req.params.notificationId);

    // Check authorization
    if (notification.recipientId !== (req as any).user.id && (req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    logger.error(`Error marking notification as read: ${error}`);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * @route   PATCH /notifications/mark-all-read
 * @access  Private
 * @desc    Mark all notifications as read
 */
router.patch('/notifications/mark-all-read', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await notificationService.markAllAsRead((req as any).user.id);

    res.json({
      message: 'All notifications marked as read',
      markedCount: count,
    });
  } catch (error) {
    logger.error(`Error marking all notifications as read: ${error}`);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * @route   DELETE /notifications/:notificationId
 * @access  Private
 * @desc    Delete notification
 */
router.delete('/notifications/:notificationId', authenticate, async (req: Request, res: Response) => {
  try {
    const notification = await notificationService.getNotificationById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check authorization
    if (notification.recipientId !== (req as any).user.id && (req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await notificationService.deleteNotification(req.params.notificationId);

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting notification: ${error}`);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * @route   GET /notifications/unread/count
 * @access  Private
 * @desc    Get unread notification count
 */
router.get('/notifications/unread/count', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await notificationService.getUnreadCount((req as any).user.id);

    res.json({
      message: 'Unread count retrieved',
      unreadCount: count,
    });
  } catch (error) {
    logger.error(`Error fetching unread count: ${error}`);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * @route   GET /notifications/statistics
 * @access  Private
 * @desc    Get notification statistics
 */
router.get('/notifications/statistics', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = await notificationService.getNotificationStats((req as any).user.id);

    res.json({
      message: 'Notification statistics retrieved',
      data: stats,
    });
  } catch (error) {
    logger.error(`Error fetching notification stats: ${error}`);
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

// ============================================================================
// IN-APP NOTIFICATION ENDPOINTS
// ============================================================================

/**
 * @route   GET /in-app-notifications
 * @access  Private
 * @desc    Get user in-app notifications
 */
router.get('/in-app-notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0, includeRead = false } = req.query;

    const result = await inAppNotificationService.getUserInAppNotifications((req as any).user.id, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      includeRead: includeRead === 'true',
    });

    res.json({
      message: 'In-app notifications retrieved successfully',
      data: result.notifications,
      total: result.total,
      unread: result.unread,
    });
  } catch (error) {
    logger.error(`Error fetching in-app notifications: ${error}`);
    res.status(500).json({ error: 'Failed to fetch in-app notifications' });
  }
});

/**
 * @route   PATCH /in-app-notifications/:notificationId/read
 * @access  Private
 * @desc    Mark in-app notification as read
 */
router.patch('/in-app-notifications/:notificationId/read', authenticate, async (req: Request, res: Response) => {
  try {
    const notification = await inAppNotificationService.markAsRead(
      req.params.notificationId,
      (req as any).user.id
    );

    res.json({
      message: 'In-app notification marked as read',
      data: notification,
    });
  } catch (error) {
    logger.error(`Error marking in-app notification as read: ${error}`);
    res.status(500).json({ error: 'Failed to mark in-app notification as read' });
  }
});

/**
 * @route   PATCH /in-app-notifications/mark-all-read
 * @access  Private
 * @desc    Mark all in-app notifications as read
 */
router.patch('/in-app-notifications/mark-all-read', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await inAppNotificationService.markAllAsRead((req as any).user.id);

    res.json({
      message: 'All in-app notifications marked as read',
      markedCount: count,
    });
  } catch (error) {
    logger.error(`Error marking all in-app notifications as read: ${error}`);
    res.status(500).json({ error: 'Failed to mark all in-app notifications as read' });
  }
});

/**
 * @route   DELETE /in-app-notifications/:notificationId
 * @access  Private
 * @desc    Delete in-app notification
 */
router.delete('/in-app-notifications/:notificationId', authenticate, async (req: Request, res: Response) => {
  try {
    await inAppNotificationService.deleteInAppNotification(req.params.notificationId, (req as any).user.id);

    res.json({ message: 'In-app notification deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting in-app notification: ${error}`);
    res.status(500).json({ error: 'Failed to delete in-app notification' });
  }
});

/**
 * @route   GET /in-app-notifications/high-priority
 * @access  Private
 * @desc    Get high priority in-app notifications
 */
router.get('/in-app-notifications/high-priority', authenticate, async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const notifications = await inAppNotificationService.getHighPriorityNotifications(
      (req as any).user.id,
      parseInt(limit as string)
    );

    res.json({
      message: 'High priority notifications retrieved',
      data: notifications,
    });
  } catch (error) {
    logger.error(`Error fetching high priority notifications: ${error}`);
    res.status(500).json({ error: 'Failed to fetch high priority notifications' });
  }
});

/**
 * @route   GET /in-app-notifications/statistics
 * @access  Private
 * @desc    Get in-app notification statistics
 */
router.get('/in-app-notifications/statistics', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = await inAppNotificationService.getNotificationStats((req as any).user.id);

    res.json({
      message: 'In-app notification statistics retrieved',
      data: stats,
    });
  } catch (error) {
    logger.error(`Error fetching in-app notification stats: ${error}`);
    res.status(500).json({ error: 'Failed to fetch in-app notification stats' });
  }
});

// ============================================================================
// NOTIFICATION PREFERENCES ENDPOINTS
// ============================================================================

/**
 * @route   GET /notification-preferences
 * @access  Private
 * @desc    Get user notification preferences
 */
router.get('/notification-preferences', authenticate, async (req: Request, res: Response) => {
  try {
    const preferences = await notificationPreferenceService.getPreferences((req as any).user.id);

    res.json({
      message: 'Notification preferences retrieved successfully',
      data: preferences,
    });
  } catch (error) {
    logger.error(`Error fetching notification preferences: ${error}`);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

/**
 * @route   PATCH /notification-preferences
 * @access  Private
 * @desc    Update user notification preferences
 */
router.patch('/notification-preferences', authenticate, async (req: Request, res: Response) => {
  try {
    const preferences = await notificationPreferenceService.updatePreferences((req as any).user.id, req.body);

    res.json({
      message: 'Notification preferences updated successfully',
      data: preferences,
    });
  } catch (error) {
    logger.error(`Error updating notification preferences: ${error}`);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

/**
 * @route   POST /notification-preferences/reset
 * @access  Private
 * @desc    Reset notification preferences to default
 */
router.post('/notification-preferences/reset', authenticate, async (req: Request, res: Response) => {
  try {
    const preferences = await notificationPreferenceService.resetPreferences((req as any).user.id);

    res.json({
      message: 'Notification preferences reset to default',
      data: preferences,
    });
  } catch (error) {
    logger.error(`Error resetting notification preferences: ${error}`);
    res.status(500).json({ error: 'Failed to reset notification preferences' });
  }
});

/**
 * @route   PATCH /notification-preferences/notification-type
 * @access  Private
 * @desc    Set specific notification type preference
 */
router.patch('/notification-preferences/notification-type', authenticate, async (req: Request, res: Response) => {
  try {
    const { notificationType, enabled } = req.body;

    if (!notificationType || enabled === undefined) {
      return res.status(400).json({ error: 'Missing required fields: notificationType, enabled' });
    }

    const preferences = await notificationPreferenceService.setNotificationTypePreference(
      (req as any).user.id,
      notificationType,
      enabled
    );

    res.json({
      message: 'Notification type preference updated',
      data: preferences,
    });
  } catch (error) {
    logger.error(`Error setting notification type preference: ${error}`);
    res.status(500).json({ error: 'Failed to set notification type preference' });
  }
});

/**
 * @route   PATCH /notification-preferences/channel
 * @access  Private
 * @desc    Set specific channel preference
 */
router.patch('/notification-preferences/channel', authenticate, async (req: Request, res: Response) => {
  try {
    const { channel, enabled } = req.body;

    if (!channel || enabled === undefined) {
      return res.status(400).json({ error: 'Missing required fields: channel, enabled' });
    }

    const preferences = await notificationPreferenceService.setChannelPreference(
      (req as any).user.id,
      channel,
      enabled
    );

    res.json({
      message: 'Channel preference updated',
      data: preferences,
    });
  } catch (error) {
    logger.error(`Error setting channel preference: ${error}`);
    res.status(500).json({ error: 'Failed to set channel preference' });
  }
});

/**
 * @route   PATCH /notification-preferences/frequency
 * @access  Private
 * @desc    Set frequency preference
 */
router.patch('/notification-preferences/frequency', authenticate, async (req: Request, res: Response) => {
  try {
    const { frequency } = req.body;

    if (!frequency) {
      return res.status(400).json({ error: 'Missing required field: frequency' });
    }

    const preferences = await notificationPreferenceService.setFrequencyPreference(
      (req as any).user.id,
      frequency
    );

    res.json({
      message: 'Frequency preference updated',
      data: preferences,
    });
  } catch (error) {
    logger.error(`Error setting frequency preference: ${error}`);
    res.status(500).json({ error: 'Failed to set frequency preference' });
  }
});

/**
 * @route   POST /notification-preferences/unsubscribe
 * @access  Private
 * @desc    Unsubscribe from all notifications
 */
router.post('/notification-preferences/unsubscribe', authenticate, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    const preferences = await notificationPreferenceService.unsubscribeAll((req as any).user.id, reason);

    res.json({
      message: 'Successfully unsubscribed from all notifications',
      data: preferences,
    });
  } catch (error) {
    logger.error(`Error unsubscribing user: ${error}`);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * @route   POST /notification-preferences/resubscribe
 * @access  Private
 * @desc    Resubscribe to notifications
 */
router.post('/notification-preferences/resubscribe', authenticate, async (req: Request, res: Response) => {
  try {
    const preferences = await notificationPreferenceService.resubscribe((req as any).user.id);

    res.json({
      message: 'Successfully resubscribed to notifications',
      data: preferences,
    });
  } catch (error) {
    logger.error(`Error resubscribing user: ${error}`);
    res.status(500).json({ error: 'Failed to resubscribe' });
  }
});

/**
 * @route   GET /notification-preferences/summary
 * @access  Private (Admin only)
 * @desc    Get preferences summary (admin endpoint)
 */
router.get('/notification-preferences/summary', authenticate, async (req: Request, res: Response) => {
  try {
    // Check authorization
    if ((req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized - Principal access required' });
    }

    const summary = await notificationPreferenceService.getPreferencesSummary();

    res.json({
      message: 'Notification preferences summary retrieved',
      data: summary,
    });
  } catch (error) {
    logger.error(`Error fetching preferences summary: ${error}`);
    res.status(500).json({ error: 'Failed to fetch preferences summary' });
  }
});

// ============================================================================
// EMAIL TEMPLATE ENDPOINTS
// ============================================================================

/**
 * @route   GET /email-templates
 * @access  Private (Admin)
 * @desc    List all email templates
 */
router.get('/email-templates', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { notificationType } = req.query;
    const templates = await emailService.listTemplates(notificationType as string);

    res.json({
      message: 'Email templates retrieved successfully',
      data: templates,
    });
  } catch (error) {
    logger.error(`Error fetching email templates: ${error}`);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

/**
 * @route   POST /email-templates
 * @access  Private (Admin)
 * @desc    Create email template
 */
router.post('/email-templates', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const template = await emailService.createTemplate({
      ...req.body,
      createdBy: (req as any).user.id,
    });

    res.status(201).json({
      message: 'Email template created successfully',
      data: template,
    });
  } catch (error) {
    logger.error(`Error creating email template: ${error}`);
    res.status(500).json({ error: 'Failed to create email template' });
  }
});

/**
 * @route   PATCH /email-templates/:templateId
 * @access  Private (Admin)
 * @desc    Update email template
 */
router.patch('/email-templates/:templateId', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const template = await emailService.updateTemplate(req.params.templateId, req.body);

    res.json({
      message: 'Email template updated successfully',
      data: template,
    });
  } catch (error) {
    logger.error(`Error updating email template: ${error}`);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

/**
 * @route   DELETE /email-templates/:templateId
 * @access  Private (Admin)
 * @desc    Delete email template
 */
router.delete('/email-templates/:templateId', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await emailService.deleteTemplate(req.params.templateId);

    res.json({ message: 'Email template deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting email template: ${error}`);
    res.status(500).json({ error: 'Failed to delete email template' });
  }
});

// ============================================================================
// SMS TEMPLATE ENDPOINTS
// ============================================================================

/**
 * @route   GET /sms-templates
 * @access  Private (Admin)
 * @desc    List all SMS templates
 */
router.get('/sms-templates', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { notificationType } = req.query;
    const templates = await smsService.listTemplates(notificationType as string);

    res.json({
      message: 'SMS templates retrieved successfully',
      data: templates,
    });
  } catch (error) {
    logger.error(`Error fetching SMS templates: ${error}`);
    res.status(500).json({ error: 'Failed to fetch SMS templates' });
  }
});

/**
 * @route   POST /sms-templates
 * @access  Private (Admin)
 * @desc    Create SMS template
 */
router.post('/sms-templates', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const template = await smsService.createTemplate({
      ...req.body,
      createdBy: (req as any).user.id,
    });

    res.status(201).json({
      message: 'SMS template created successfully',
      data: template,
    });
  } catch (error) {
    logger.error(`Error creating SMS template: ${error}`);
    res.status(500).json({ error: 'Failed to create SMS template' });
  }
});

/**
 * @route   PATCH /sms-templates/:templateId
 * @access  Private (Admin)
 * @desc    Update SMS template
 */
router.patch('/sms-templates/:templateId', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const template = await smsService.updateTemplate(req.params.templateId, req.body);

    res.json({
      message: 'SMS template updated successfully',
      data: template,
    });
  } catch (error) {
    logger.error(`Error updating SMS template: ${error}`);
    res.status(500).json({ error: 'Failed to update SMS template' });
  }
});

/**
 * @route   DELETE /sms-templates/:templateId
 * @access  Private (Admin)
 * @desc    Delete SMS template
 */
router.delete('/sms-templates/:templateId', authenticate, async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'principal') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await smsService.deleteTemplate(req.params.templateId);

    res.json({ message: 'SMS template deleted successfully' });
  } catch (error) {
    logger.error(`Error deleting SMS template: ${error}`);
    res.status(500).json({ error: 'Failed to delete SMS template' });
  }
});

export default router;
