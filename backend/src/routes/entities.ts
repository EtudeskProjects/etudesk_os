/**
 * Entities Batch Route
 * Single endpoint to fetch multiple entities by type+id in one request.
 * Used by mobile EntityCard to avoid N+1 individual API calls.
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils';

const router = Router();

/**
 * GET /api/v1/entities/batch?items=opportunity:uuid1,community:uuid2,talent:uuid3
 * Returns: { data: { "opportunity:uuid1": {...}, "community:uuid2": {...}, ... } }
 * Max 20 items per request.
 */
router.get('/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const itemsParam = req.query.items as string;
    if (!itemsParam) {
      return res.status(400).json({ error: req.t('common:itemsRequired') });
    }

    const items = itemsParam.split(',').slice(0, 20); // Max 20
    const grouped: Record<string, string[]> = {};

    for (const item of items) {
      const [type, id] = item.split(':');
      if (!type || !id) continue;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(id);
    }

    const results: Record<string, any> = {};
    const queries: Promise<void>[] = [];

    // Opportunities
    if (grouped.opportunity?.length) {
      queries.push(
        pool.query(
          `SELECT o.id, o.title, o.type,
            o.cover_image_url,
            o.locations->0->>'city' as city,
            (SELECT org.name FROM opportunity_posters op
             JOIN organizations org ON op.poster_organization_id = org.id
             WHERE op.opportunity_id = o.id LIMIT 1) as organization_name
           FROM opportunities o WHERE o.id = ANY($1)`,
          [grouped.opportunity]
        ).then(r => {
          for (const row of r.rows) {
            results[`opportunity:${row.id}`] = {
              ...row,
              subtitle: row.organization_name,
              location: row.city,
              metaType: row.type,
              imageUrl: row.cover_image_url,
            };
          }
        })
      );
    }

    // Communities
    if (grouped.community?.length) {
      queries.push(
        pool.query(
          `SELECT c.id, c.name, c.type, c.city, c.cover_image_url, c.description,
            (SELECT COUNT(*) FROM community_members WHERE community_id = c.id AND status = 'ACTIVE') as members_count,
            (SELECT org.name FROM organizations org WHERE org.id = c.organization_id) as organization_name
           FROM communities c WHERE c.id = ANY($1)`,
          [grouped.community]
        ).then(r => {
          for (const row of r.rows) {
            results[`community:${row.id}`] = {
              ...row,
              title: row.name,
              subtitle: row.organization_name || row.description?.slice(0, 80),
              location: row.city,
              memberCount: parseInt(row.members_count) || 0,
              metaType: row.type,
              imageUrl: row.cover_image_url,
            };
          }
        })
      );
    }

    // Organizations
    if (grouped.organization?.length) {
      queries.push(
        pool.query(
          `SELECT id, name, logo_url, description, headquarters_city, type
           FROM organizations WHERE id = ANY($1)`,
          [grouped.organization]
        ).then(r => {
          for (const row of r.rows) {
            results[`organization:${row.id}`] = {
              ...row,
              title: row.name,
              subtitle: row.description?.slice(0, 80),
              location: row.headquarters_city,
              metaType: row.type,
              imageUrl: row.logo_url,
            };
          }
        })
      );
    }

    // Talents
    if (grouped.talent?.length) {
      queries.push(
        pool.query(
          `SELECT t.id, t.first_name, t.last_name, t.avatar_url, t.bio, t.city,
            COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name
           FROM talents t WHERE t.id = ANY($1) AND t.deleted_at IS NULL`,
          [grouped.talent]
        ).then(r => {
          for (const row of r.rows) {
            results[`talent:${row.id}`] = {
              ...row,
              title: row.display_name,
              subtitle: row.bio?.slice(0, 80),
              location: row.city,
              imageUrl: row.avatar_url,
            };
          }
        })
      );
    }

    // Spaces
    if (grouped.space?.length) {
      queries.push(
        pool.query(
          `SELECT s.id, s.name, s.type, s.city, s.cover_image_url, s.capacity, s.hourly_rate,
            (SELECT org.name FROM organizations org WHERE org.id = s.organization_id) as organization_name
           FROM spaces s WHERE s.id = ANY($1)`,
          [grouped.space]
        ).then(r => {
          for (const row of r.rows) {
            results[`space:${row.id}`] = {
              ...row,
              title: row.name,
              subtitle: row.organization_name,
              location: row.city,
              metaType: row.type,
              imageUrl: row.cover_image_url,
              hourlyRate: row.hourly_rate ? `${row.hourly_rate} FCFA/h` : undefined,
            };
          }
        })
      );
    }

    // Documents (talent_documents + organization_documents)
    if (grouped.document?.length) {
      queries.push(
        (async () => {
          // 1. Try talent_documents first
          const talentDocs = await pool.query(
            `SELECT id, title, original_filename, document_type, file_url, category, mime_type
             FROM talent_documents WHERE id = ANY($1) AND talent_id = $2`,
            [grouped.document, req.talentId]
          );
          for (const row of talentDocs.rows) {
            results[`document:${row.id}`] = {
              ...row,
              title: row.title || row.original_filename,
              subtitle: row.document_type || row.category,
            };
          }

          // 2. Check organization_documents for any IDs not found in talent_documents
          const foundIds = new Set(talentDocs.rows.map((r: any) => r.id));
          const missingIds = grouped.document!.filter(id => !foundIds.has(id));
          if (missingIds.length > 0) {
            const orgDocs = await pool.query(
              `SELECT od.id, od.title, od.original_filename, od.document_type, od.file_url, od.category, od.mime_type
               FROM organization_documents od
               JOIN organization_members om ON om.organization_id = od.organization_id AND om.talent_id = $2
               WHERE od.id = ANY($1) AND od.deleted_at IS NULL`,
              [missingIds, req.talentId]
            );
            for (const row of orgDocs.rows) {
              results[`document:${row.id}`] = {
                ...row,
                title: row.title || row.original_filename,
                subtitle: row.document_type || row.category,
              };
            }
          }
        })()
      );
    }

    await Promise.all(queries);

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Error in batch entity fetch:', error);
    res.status(500).json({ error: req.t('common:fetchFailed') });
  }
});

export default router;
