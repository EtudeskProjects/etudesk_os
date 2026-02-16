/**
 * Ecosystem Routes
 * Agrégation des données utilisateur (opportunités, communautés, espaces)
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils';

const router = Router();

/**
 * GET /api/v1/ecosystem/me
 * Données agrégées pour la vue écosystème (opportunités, communautés, espaces)
 */
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) {
      return res.status(401).json({ error: req.t('common:authRequired') });
    }

    const [opportunitiesRes, communitiesRes, spacesRes] = await Promise.all([
      pool.query(
        `SELECT a.id, o.title, a.status, a.applied_at,
          COALESCE(
            (SELECT org.name FROM opportunity_posters op
             JOIN organizations org ON op.poster_organization_id = org.id
             WHERE op.opportunity_id = o.id LIMIT 1),
            (SELECT org.name FROM organizations org WHERE org.id = o.organization_id)
          ) as organization_name
         FROM opportunity_applications a
         JOIN opportunities o ON a.opportunity_id = o.id
         WHERE a.talent_id = $1 AND a.deleted_at IS NULL AND o.deleted_at IS NULL
         ORDER BY a.applied_at DESC
         LIMIT 50`,
        [talentId]
      ),
      pool.query(
        `SELECT c.id, c.name, cm.role, cm.status,
          (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'ACTIVE')::int as members_count
         FROM community_members cm
         JOIN communities c ON cm.community_id = c.id
         WHERE cm.talent_id = $1 AND cm.status = 'ACTIVE' AND c.deleted_at IS NULL
         ORDER BY cm.created_at DESC
         LIMIT 50`,
        [talentId]
      ),
      pool.query(
        `SELECT sb.id, s.name, s.city, sb.status, sb.start_datetime as reservation_date
         FROM space_bookings sb
         JOIN spaces s ON sb.space_id = s.id
         WHERE sb.talent_id = $1 AND s.deleted_at IS NULL
         ORDER BY sb.start_datetime DESC
         LIMIT 50`,
        [talentId]
      ),
    ]);

    const opportunities = {
      count: opportunitiesRes.rows.length,
      items: opportunitiesRes.rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        organization_name: r.organization_name || '',
        status: r.status,
        applied_at: r.applied_at?.toISOString?.(),
      })),
    };

    const communities = {
      count: communitiesRes.rows.length,
      items: communitiesRes.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        role: r.role || 'MEMBER',
        status: r.status || 'ACTIVE',
        members_count: r.members_count || 0,
      })),
    };

    const spaces = {
      count: spacesRes.rows.length,
      items: spacesRes.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        city: r.city || '',
        status: r.status || 'PENDING',
        reservation_date: r.reservation_date?.toISOString?.(),
      })),
    };

    res.json({
      opportunities,
      communities,
      spaces,
    });
  } catch (error: any) {
    logger.error('Error fetching ecosystem data:', error);
    res.status(500).json({ error: error.message || req.t('common:serverError') });
  }
});

export default router;
