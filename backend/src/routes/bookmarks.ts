/**
 * Bookmarks Routes
 * Handles bookmarks for opportunities, hubs, and communities
 */

import { Router, Response } from 'express';
import { pool } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Valid entity types for bookmarking
type EntityType = 'opportunity' | 'hub' | 'community';
const VALID_ENTITY_TYPES: EntityType[] = ['opportunity', 'hub', 'community'];

// Map entity type to table and ID column
const ENTITY_CONFIG: Record<EntityType, { table: string; idColumn: string }> = {
  opportunity: { table: 'opportunities', idColumn: 'id' },
  hub: { table: 'hubs', idColumn: 'id' },
  community: { table: 'communities', idColumn: 'id' },
};

/**
 * Helper to get bookmark table name based on entity type
 */
const getBookmarkTable = (entityType: EntityType): string => {
  switch (entityType) {
    case 'opportunity': return 'opportunity_bookmarks';
    case 'hub': return 'hub_bookmarks';
    case 'community': return 'community_bookmarks';
    default: throw new Error(`Invalid entity type: ${entityType}`);
  }
};

/**
 * Helper to get entity ID column name in bookmark table
 */
const getEntityIdColumn = (entityType: EntityType): string => {
  switch (entityType) {
    case 'opportunity': return 'opportunity_id';
    case 'hub': return 'hub_id';
    case 'community': return 'community_id';
    default: throw new Error(`Invalid entity type: ${entityType}`);
  }
};

// ============================================================================
// OPPORTUNITY BOOKMARKS (using existing table)
// ============================================================================

/**
 * GET /api/bookmarks/opportunities
 * Get all bookmarked opportunities for the current user
 */
router.get('/opportunities', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;

    if (!talentId) {
      return res.status(401).json({ error: 'Profil talent requis' });
    }

    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT
        ob.created_at as bookmarked_at,
        ob.notes,
        o.*,
        COALESCE(
          (SELECT json_agg(json_build_object('id', org.id, 'name', org.name, 'logo_url', org.logo_url))
           FROM opportunity_posters op
           JOIN organizations org ON op.poster_organization_id = org.id
           WHERE op.opportunity_id = o.id),
          '[]'
        ) as organizations
      FROM opportunity_bookmarks ob
      JOIN opportunities o ON ob.opportunity_id = o.id
      WHERE ob.talent_id = $1 AND o.deleted_at IS NULL
      ORDER BY ob.created_at DESC
      LIMIT $2 OFFSET $3
    `, [talentId, Number(limit), Number(offset)]);

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM opportunity_bookmarks ob
      JOIN opportunities o ON ob.opportunity_id = o.id
      WHERE ob.talent_id = $1 AND o.deleted_at IS NULL
    `, [talentId]);

    res.json({
      data: result.rows,
      count: result.rowCount,
      total: parseInt(countResult.rows[0].total, 10)
    });
  } catch (error) {
    console.error('Error fetching opportunity bookmarks:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des favoris' });
  }
});

/**
 * GET /api/bookmarks/opportunities/ids
 * Get list of bookmarked opportunity IDs
 */
router.get('/opportunities/ids', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;

    if (!talentId) {
      return res.status(401).json({ error: 'Profil talent requis' });
    }

    const result = await pool.query(`
      SELECT opportunity_id
      FROM opportunity_bookmarks
      WHERE talent_id = $1
    `, [talentId]);

    const ids = result.rows.map(row => row.opportunity_id);

    res.json({ data: ids });
  } catch (error) {
    console.error('Error fetching opportunity bookmark IDs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des favoris' });
  }
});

/**
 * GET /api/bookmarks/opportunities/:id/status
 * Check if an opportunity is bookmarked
 */
router.get('/opportunities/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    if (!talentId) {
      return res.status(401).json({ error: 'Profil talent requis' });
    }

    const result = await pool.query(`
      SELECT 1 FROM opportunity_bookmarks
      WHERE talent_id = $1 AND opportunity_id = $2
    `, [talentId, id]);

    res.json({
      data: { isBookmarked: result.rows.length > 0 }
    });
  } catch (error) {
    console.error('Error checking opportunity bookmark status:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du favori' });
  }
});

/**
 * POST /api/bookmarks/opportunities/:id
 * Add an opportunity to bookmarks
 */
router.post('/opportunities/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;
    const { notes } = req.body;

    if (!talentId) {
      return res.status(401).json({ error: 'Profil talent requis' });
    }

    // Check if opportunity exists
    const oppCheck = await pool.query(
      'SELECT id FROM opportunities WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (oppCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunité non trouvée' });
    }

    // Upsert bookmark (insert or update notes)
    await pool.query(`
      INSERT INTO opportunity_bookmarks (talent_id, opportunity_id, notes, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (talent_id, opportunity_id) DO UPDATE SET notes = EXCLUDED.notes
    `, [talentId, id, notes || null]);

    console.log(`✅ Opportunity bookmarked: talent ${talentId} -> opportunity ${id}`);

    res.status(201).json({
      success: true,
      message: 'Ajouté aux favoris',
      isBookmarked: true
    });
  } catch (error) {
    console.error('Error adding opportunity bookmark:', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout aux favoris' });
  }
});

/**
 * DELETE /api/bookmarks/opportunities/:id
 * Remove an opportunity from bookmarks
 */
router.delete('/opportunities/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;

    if (!talentId) {
      return res.status(401).json({ error: 'Profil talent requis' });
    }

    await pool.query(`
      DELETE FROM opportunity_bookmarks
      WHERE talent_id = $1 AND opportunity_id = $2
    `, [talentId, id]);

    console.log(`✅ Opportunity unbookmarked: talent ${talentId} -> opportunity ${id}`);

    res.json({
      success: true,
      message: 'Retiré des favoris',
      isBookmarked: false
    });
  } catch (error) {
    console.error('Error removing opportunity bookmark:', error);
    res.status(500).json({ error: 'Erreur lors du retrait des favoris' });
  }
});

// ============================================================================
// GENERIC BOOKMARKS (hubs, communities)
// These use a generic bookmarks table created on the fly
// ============================================================================

/**
 * Helper to ensure bookmark table exists for entity type
 */
const ensureBookmarkTable = async (entityType: EntityType): Promise<void> => {
  if (entityType === 'opportunity') return; // Already exists

  const tableName = getBookmarkTable(entityType);
  const entityIdColumn = getEntityIdColumn(entityType);
  const entityTable = ENTITY_CONFIG[entityType].table;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      talent_id UUID REFERENCES talents(id) ON DELETE CASCADE,
      ${entityIdColumn} UUID REFERENCES ${entityTable}(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      PRIMARY KEY (talent_id, ${entityIdColumn})
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_${tableName}_${entityIdColumn} ON ${tableName}(${entityIdColumn})
  `);
};

/**
 * GET /api/bookmarks/hubs
 */
router.get('/hubs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) return res.status(401).json({ error: 'Profil talent requis' });

    await ensureBookmarkTable('hub');

    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT
        b.created_at as bookmarked_at,
        b.notes,
        h.*
      FROM hub_bookmarks b
      JOIN hubs h ON b.hub_id = h.id
      WHERE b.talent_id = $1 AND h.deleted_at IS NULL
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3
    `, [talentId, Number(limit), Number(offset)]);

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Error fetching hub bookmarks:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

/**
 * GET /api/bookmarks/hubs/ids
 */
router.get('/hubs/ids', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) return res.status(401).json({ error: 'Profil talent requis' });

    await ensureBookmarkTable('hub');

    const result = await pool.query(`
      SELECT hub_id FROM hub_bookmarks WHERE talent_id = $1
    `, [talentId]);

    res.json({ data: result.rows.map(r => r.hub_id) });
  } catch (error) {
    console.error('Error fetching hub bookmark IDs:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

/**
 * POST /api/bookmarks/hubs/:id
 */
router.post('/hubs/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;
    if (!talentId) return res.status(401).json({ error: 'Profil talent requis' });

    await ensureBookmarkTable('hub');

    const check = await pool.query('SELECT id FROM hubs WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Hub non trouvé' });
    }

    await pool.query(`
      INSERT INTO hub_bookmarks (talent_id, hub_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT DO NOTHING
    `, [talentId, id]);

    res.status(201).json({ success: true, isBookmarked: true });
  } catch (error) {
    console.error('Error adding hub bookmark:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

/**
 * DELETE /api/bookmarks/hubs/:id
 */
router.delete('/hubs/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;
    if (!talentId) return res.status(401).json({ error: 'Profil talent requis' });

    await ensureBookmarkTable('hub');

    await pool.query(`
      DELETE FROM hub_bookmarks WHERE talent_id = $1 AND hub_id = $2
    `, [talentId, id]);

    res.json({ success: true, isBookmarked: false });
  } catch (error) {
    console.error('Error removing hub bookmark:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

/**
 * GET /api/bookmarks/communities
 */
router.get('/communities', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) return res.status(401).json({ error: 'Profil talent requis' });

    await ensureBookmarkTable('community');

    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT
        b.created_at as bookmarked_at,
        b.notes,
        c.*
      FROM community_bookmarks b
      JOIN communities c ON b.community_id = c.id
      WHERE b.talent_id = $1 AND c.deleted_at IS NULL
      ORDER BY b.created_at DESC
      LIMIT $2 OFFSET $3
    `, [talentId, Number(limit), Number(offset)]);

    res.json({ data: result.rows, count: result.rowCount });
  } catch (error) {
    console.error('Error fetching community bookmarks:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

/**
 * GET /api/bookmarks/communities/ids
 */
router.get('/communities/ids', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) return res.status(401).json({ error: 'Profil talent requis' });

    await ensureBookmarkTable('community');

    const result = await pool.query(`
      SELECT community_id FROM community_bookmarks WHERE talent_id = $1
    `, [talentId]);

    res.json({ data: result.rows.map(r => r.community_id) });
  } catch (error) {
    console.error('Error fetching community bookmark IDs:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

/**
 * POST /api/bookmarks/communities/:id
 */
router.post('/communities/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;
    if (!talentId) return res.status(401).json({ error: 'Profil talent requis' });

    await ensureBookmarkTable('community');

    const check = await pool.query('SELECT id FROM communities WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Communauté non trouvée' });
    }

    await pool.query(`
      INSERT INTO community_bookmarks (talent_id, community_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT DO NOTHING
    `, [talentId, id]);

    res.status(201).json({ success: true, isBookmarked: true });
  } catch (error) {
    console.error('Error adding community bookmark:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

/**
 * DELETE /api/bookmarks/communities/:id
 */
router.delete('/communities/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { id } = req.params;
    if (!talentId) return res.status(401).json({ error: 'Profil talent requis' });

    await ensureBookmarkTable('community');

    await pool.query(`
      DELETE FROM community_bookmarks WHERE talent_id = $1 AND community_id = $2
    `, [talentId, id]);

    res.json({ success: true, isBookmarked: false });
  } catch (error) {
    console.error('Error removing community bookmark:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ============================================================================
// ALL BOOKMARKS (aggregated)
// ============================================================================

/**
 * GET /api/bookmarks/all/ids
 * Get all bookmark IDs grouped by entity type
 */
router.get('/all/ids', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    if (!talentId) return res.status(401).json({ error: 'Profil talent requis' });

    // Ensure all tables exist
    await Promise.all([
      ensureBookmarkTable('hub'),
      ensureBookmarkTable('community'),
    ]);

    const [opportunities, hubs, communities] = await Promise.all([
      pool.query('SELECT opportunity_id as id FROM opportunity_bookmarks WHERE talent_id = $1', [talentId]),
      pool.query('SELECT hub_id as id FROM hub_bookmarks WHERE talent_id = $1', [talentId]),
      pool.query('SELECT community_id as id FROM community_bookmarks WHERE talent_id = $1', [talentId]),
    ]);

    res.json({
      data: {
        opportunities: opportunities.rows.map(r => r.id),
        hubs: hubs.rows.map(r => r.id),
        communities: communities.rows.map(r => r.id),
      }
    });
  } catch (error) {
    console.error('Error fetching all bookmark IDs:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;
