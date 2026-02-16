/**
 * Bootstrap Route
 * Single endpoint to load all data needed at app startup.
 * Replaces 4+ sequential API calls with 1 parallel call.
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import * as notificationService from '../services/notification.service';
import { copilotService } from '../services/copilot';
import { logger } from '../utils';

const router = Router();

/**
 * GET /api/v1/bootstrap
 * Returns: { profile, sessions, notifications, ecosystem, wallet }
 * All queries run in parallel via Promise.all.
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const [profileRes, sessionsRes, notificationsRes, ecosystemRes, walletRes] = await Promise.all([
      // 1. Profile (simplified — just key fields)
      pool.query(
        `SELECT t.id, t.first_name, t.last_name, t.email, t.phone, t.avatar_url, t.bio,
          t.city, t.country, t.remote_ready, t.learning_preferences, t.goals, t.sectors,
          (SELECT COUNT(*) FROM talent_skills WHERE talent_id = t.id)::int as skill_count,
          CASE WHEN EXISTS (SELECT 1 FROM kyc_verifications WHERE talent_id = t.id AND status = 'VERIFIED')
            THEN 'VERIFIED' ELSE 'UNVERIFIED' END as verification_status
         FROM talents t WHERE t.id = $1 AND t.deleted_at IS NULL`,
        [talentId]
      ).then(r => r.rows[0] || null),

      // 2. Recent copilot sessions (last 10)
      copilotService.listSessions(talentId, 10).catch(() => []),

      // 3. Notifications (last 10 + unread count)
      notificationService.getAll(talentId, { limit: 10, offset: 0, unreadOnly: false }).catch(() => ({
        notifications: [],
        total: 0,
        unreadCount: 0,
      })),

      // 4. Ecosystem stats (counts only — lightweight)
      Promise.all([
        pool.query(
          `SELECT COUNT(*)::int as count FROM opportunity_applications
           WHERE talent_id = $1 AND deleted_at IS NULL`,
          [talentId]
        ),
        pool.query(
          `SELECT COUNT(*)::int as count FROM community_members
           WHERE talent_id = $1 AND status = 'ACTIVE'`,
          [talentId]
        ),
        pool.query(
          `SELECT COUNT(*)::int as count FROM space_bookings
           WHERE talent_id = $1`,
          [talentId]
        ),
      ]).then(([apps, comms, spaces]) => ({
        applicationsCount: apps.rows[0]?.count || 0,
        communitiesCount: comms.rows[0]?.count || 0,
        spacesCount: spaces.rows[0]?.count || 0,
      })).catch(() => ({ applicationsCount: 0, communitiesCount: 0, spacesCount: 0 })),

      // 5. Wallet balance
      pool.query(
        `SELECT balance FROM wallets WHERE owner_id = $1 AND scope = 'TALENT' LIMIT 1`,
        [talentId]
      ).then(r => ({ balance: r.rows[0]?.balance || 0 })).catch(() => ({ balance: 0 })),
    ]);

    res.json({
      success: true,
      data: {
        profile: profileRes,
        sessions: sessionsRes,
        notifications: {
          items: notificationsRes.notifications,
          unreadCount: notificationsRes.unreadCount,
        },
        ecosystem: ecosystemRes,
        wallet: walletRes,
      },
    });
  } catch (error) {
    logger.error('Error in bootstrap:', error);
    res.status(500).json({ error: 'Failed to load bootstrap data' });
  }
});

export default router;
