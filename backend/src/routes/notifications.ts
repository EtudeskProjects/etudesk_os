/**
 * Notifications Routes
 * Handles push tokens, notifications, and preferences
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import * as pushService from '../services/push-notification.service';

import { logger } from '../utils';
const router = Router();

// ═══════════════════════════════════════════════════════════════
// PUSH TOKENS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/notifications/push-token
 * Register a push token for the current user
 */
router.post('/push-token', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId!;
    const { token, platform, deviceName } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ error: req.t('common:tokenAndPlatformRequired') });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({ error: req.t('common:invalidPlatform') });
    }

    const result = await pushService.registerPushToken(talentId, token, platform, deviceName);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: req.t('common:pushTokenRegistered') });
  } catch (error) {
    logger.error('Error registering push token:', error);
    res.status(500).json({ error: req.t('notifications:registerError') });
  }
});

/**
 * DELETE /api/notifications/push-token
 * Deactivate a push token (on logout)
 */
router.delete('/push-token', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId!;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: req.t('common:tokenRequired') });
    }

    await pushService.deactivatePushToken(talentId, token);
    res.json({ success: true, message: req.t('common:pushTokenDeactivated') });
  } catch (error) {
    logger.error('Error deactivating push token:', error);
    res.status(500).json({ error: req.t('notifications:deactivateError') });
  }
});

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId!;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread === 'true';

    const result = await pushService.getNotifications(talentId, { limit, offset, unreadOnly });

    res.json({
      success: true,
      data: result.notifications,
      total: result.total,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ error: req.t('notifications:fetchError') });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId!;
    const { id } = req.params;

    const success = await pushService.markAsRead(id, talentId);

    if (!success) {
      return res.status(404).json({ error: req.t('common:notificationNotFound') });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ error: req.t('notifications:markReadError') });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId!;
    const count = await pushService.markAllAsRead(talentId);
    res.json({ success: true, count });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: req.t('notifications:markAllReadError') });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId!;
    const { id } = req.params;

    const success = await pushService.deleteNotification(id, talentId);

    if (!success) {
      return res.status(404).json({ error: req.t('common:notificationNotFound') });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ error: req.t('notifications:deleteError') });
  }
});

// ═══════════════════════════════════════════════════════════════
// PREFERENCES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/notifications/preferences
 * Get notification preferences
 */
router.get('/preferences', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId!;
    const preferences = await pushService.getPreferences(talentId);
    res.json({ success: true, data: preferences });
  } catch (error) {
    logger.error('Error fetching preferences:', error);
    res.status(500).json({ error: req.t('notifications:fetchPreferencesError') });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
router.put('/preferences', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId!;
    const {
      push_enabled,
      email_enabled,
      sms_enabled,
      notify_opportunities,
      notify_messages,
      notify_applications,
      notify_reminders,
    } = req.body;

    const preferences = await pushService.updatePreferences(talentId, {
      ...(push_enabled !== undefined && { push_enabled }),
      ...(email_enabled !== undefined && { email_enabled }),
      ...(sms_enabled !== undefined && { sms_enabled }),
      ...(notify_opportunities !== undefined && { notify_opportunities }),
      ...(notify_messages !== undefined && { notify_messages }),
      ...(notify_applications !== undefined && { notify_applications }),
      ...(notify_reminders !== undefined && { notify_reminders }),
    });

    res.json({ success: true, data: preferences });
  } catch (error) {
    logger.error('Error updating preferences:', error);
    res.status(500).json({ error: req.t('notifications:updatePreferencesError') });
  }
});

export default router;
