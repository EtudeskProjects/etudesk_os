import express, { Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { communityNotificationService } from '../services/community-notification.service';

import { logger } from '../utils';
const router = express.Router();

/**
 * GET /api/community-notifications
 * Get notifications for the current user
 */
router.get('/', authMiddleware, async (req: any, res: Response) => {
    try {
        const talentId = req.talentId || req.userId;
        const { community_id, type, unread_only, limit, offset } = req.query;

        const result = await communityNotificationService.getNotifications({
            talent_id: talentId,
            community_id: community_id as string,
            type: type as any,
            unread_only: unread_only === 'true',
            limit: limit ? parseInt(limit as string) : 20,
            offset: offset ? parseInt(offset as string) : 0
        });

        res.json(result);
    } catch (error: any) {
        logger.error('Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/community-notifications/unread-counts
 * Get unread notification counts grouped by community
 */
router.get('/unread-counts', authMiddleware, async (req: any, res: Response) => {
    try {
        const talentId = req.talentId || req.userId;
        const counts = await communityNotificationService.getUnreadCounts(talentId);

        res.json({ data: counts });
    } catch (error: any) {
        logger.error('Error fetching unread counts:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/community-notifications/read
 * Mark notifications as read
 */
router.post('/read', authMiddleware, async (req: any, res: Response) => {
    try {
        const talentId = req.talentId || req.userId;
        const { notification_ids, community_id, all } = req.body;

        let count: number;

        if (all) {
            count = await communityNotificationService.markAsRead(talentId);
        } else if (notification_ids && Array.isArray(notification_ids)) {
            count = await communityNotificationService.markAsRead(talentId, notification_ids);
        } else if (community_id) {
            count = await communityNotificationService.markAsRead(talentId, undefined, community_id);
        } else {
            return res.status(400).json({
                error: 'Provide notification_ids, community_id, or set all to true'
            });
        }

        res.json({
            success: true,
            marked_read: count
        });
    } catch (error: any) {
        logger.error('Error marking notifications as read:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/community-notifications/:communityId/read-all
 * Mark all notifications for a community as read
 */
router.post('/:communityId/read-all', authMiddleware, async (req: any, res: Response) => {
    try {
        const talentId = req.talentId || req.userId;
        const { communityId } = req.params;

        const count = await communityNotificationService.markAsRead(talentId, undefined, communityId);

        res.json({
            success: true,
            marked_read: count
        });
    } catch (error: any) {
        logger.error('Error marking community notifications as read:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
