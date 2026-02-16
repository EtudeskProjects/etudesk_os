/**
 * Community Notifications Routes
 * Notifications spécifiques aux communautés (mentions, activités, événements)
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { communityNotificationService } from '../services/community-notification.service';
import { logger } from '../utils';

const router = Router();

/**
 * GET /api/v1/community-notifications
 * Liste des notifications communautaires pour l'utilisateur connecté
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('common:authRequired') });
    }

    const community_id = req.query.community_id as string | undefined;
    const type = req.query.type as string | undefined;
    const unread_only = req.query.unread_only === 'true';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await communityNotificationService.getNotifications({
      talent_id: talentId,
      community_id,
      type: type as any,
      unread_only,
      limit,
      offset,
    });

    // Map to frontend format: is_read from read_at
    const data = result.data.map((n: any) => ({
      ...n,
      is_read: !!n.read_at,
    }));

    res.json({
      data,
      total: result.total,
      unread_count: result.unread_count,
    });
  } catch (error: any) {
    logger.error('Error fetching community notifications:', error);
    res.status(500).json({ error: error.message || req.t('common:serverError') });
  }
});

/**
 * GET /api/v1/community-notifications/unread-counts
 * Compteurs de non-lus par communauté
 */
router.get('/unread-counts', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('common:authRequired') });
    }

    const rows = await communityNotificationService.getUnreadCounts(talentId);
    res.json({ data: rows });
  } catch (error: any) {
    logger.error('Error fetching unread counts:', error);
    res.status(500).json({ error: error.message || req.t('common:serverError') });
  }
});

/**
 * POST /api/v1/community-notifications/read
 * Marquer des notifications comme lues
 * Body: { notification_ids?: string[], community_id?: string, all?: boolean }
 */
router.post('/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('common:authRequired') });
    }

    const { notification_ids, community_id, all } = req.body;

    let marked = 0;
    if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
      marked = await communityNotificationService.markAsRead(talentId, notification_ids);
    } else if (community_id) {
      marked = await communityNotificationService.markAsRead(talentId, undefined, community_id);
    } else if (all) {
      marked = await communityNotificationService.markAsRead(talentId);
    } else {
      return res.status(400).json({ error: 'notification_ids, community_id ou all requis' });
    }

    res.json({ success: true, marked_read: marked });
  } catch (error: any) {
    logger.error('Error marking community notifications as read:', error);
    res.status(500).json({ error: error.message || req.t('common:serverError') });
  }
});

/**
 * POST /api/v1/community-notifications/:communityId/read-all
 * Marquer toutes les notifications d'une communauté comme lues
 */
router.post('/:communityId/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { communityId } = req.params;
    if (!talentId) {
      return res.status(401).json({ error: req.t('common:authRequired') });
    }

    const marked = await communityNotificationService.markAsRead(talentId, undefined, communityId);
    res.json({ success: true, marked_read: marked });
  } catch (error: any) {
    logger.error('Error marking community notifications as read:', error);
    res.status(500).json({ error: error.message || req.t('common:serverError') });
  }
});

export default router;
