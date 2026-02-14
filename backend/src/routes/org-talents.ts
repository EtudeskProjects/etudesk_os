/**
 * Organization Talent Routes (CRM "Mes Talents")
 * API endpoints for aggregated talent listing, favorites, and tags
 * Base: /api/v1/organizations/:orgId/talents
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { pool } from '../services/database';
import { logger } from '../utils';
import {
  getOrganizationTalents,
  getOrganizationTalentCount,
  favoriteOrgTalent,
  unfavoriteOrgTalent,
  getFavoriteIds,
  createTag,
  listTags,
  updateTag,
  deleteTag,
  assignTag,
  unassignTag,
  OrgTalentFilters,
} from '../services/org-talents/org-talent.service';

const router = Router({ mergeParams: true });

// --- Helper: check org membership ---

async function checkOrgMembership(orgId: string, talentId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT role FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
    [orgId, talentId]
  );
  return result.rows[0]?.role || null;
}

// --- Routes ---

/**
 * GET /api/v1/organizations/:orgId/talents
 * List aggregated talents (paginated, filterable)
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const { source, is_favorite, tag_id, search, limit, offset } = req.query;

    const filters: OrgTalentFilters = {
      source: source as OrgTalentFilters['source'],
      isFavorite: is_favorite === 'true' ? true : undefined,
      tagId: tag_id as string | undefined,
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    };

    const result = await getOrganizationTalents(orgId, filters);
    return res.json({ data: result });
  } catch (error) {
    logger.error('Error listing org talents:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des talents' });
  }
});

/**
 * GET /api/v1/organizations/:orgId/talents/count
 * Count unique talents (for dashboard badge)
 */
router.get('/count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const count = await getOrganizationTalentCount(orgId);
    return res.json({ data: { count } });
  } catch (error) {
    logger.error('Error getting org talent count:', error);
    return res.status(500).json({ error: 'Erreur lors du comptage des talents' });
  }
});

/**
 * GET /api/v1/organizations/:orgId/talents/favorites/ids
 * Get IDs of favorited talents
 */
router.get('/favorites/ids', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const ids = await getFavoriteIds(orgId);
    return res.json({ data: ids });
  } catch (error) {
    logger.error('Error getting favorite ids:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des favoris' });
  }
});

/**
 * POST /api/v1/organizations/:orgId/talents/:talentId/favorite
 */
router.post('/:talentId/favorite', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, talentId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const { notes } = req.body || {};
    await favoriteOrgTalent(orgId, talentId, req.talentId, notes);
    return res.json({ message: 'Talent ajouté aux favoris' });
  } catch (error) {
    logger.error('Error favoriting talent:', error);
    return res.status(500).json({ error: 'Erreur lors de l\'ajout aux favoris' });
  }
});

/**
 * DELETE /api/v1/organizations/:orgId/talents/:talentId/favorite
 */
router.delete('/:talentId/favorite', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, talentId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    await unfavoriteOrgTalent(orgId, talentId);
    return res.json({ message: 'Talent retiré des favoris' });
  } catch (error) {
    logger.error('Error unfavoriting talent:', error);
    return res.status(500).json({ error: 'Erreur lors du retrait des favoris' });
  }
});

/**
 * GET /api/v1/organizations/:orgId/talents/tags
 * List tag definitions
 */
router.get('/tags', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const tags = await listTags(orgId);
    return res.json({ data: tags });
  } catch (error) {
    logger.error('Error listing tags:', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération des tags' });
  }
});

/**
 * POST /api/v1/organizations/:orgId/talents/tags
 * Create a tag
 */
router.post('/tags', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom du tag est requis' });
    }

    const tag = await createTag(orgId, name, color || '#6B5E52', req.talentId);
    return res.status(201).json({ data: tag });
  } catch (error: any) {
    if (error?.constraint === 'organization_talent_tag_definitions_organization_id_name_key') {
      return res.status(409).json({ error: 'Un tag avec ce nom existe déjà' });
    }
    logger.error('Error creating tag:', error);
    return res.status(500).json({ error: 'Erreur lors de la création du tag' });
  }
});

/**
 * PATCH /api/v1/organizations/:orgId/talents/tags/:tagId
 */
router.patch('/tags/:tagId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, tagId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const { name, color } = req.body;
    const tag = await updateTag(tagId, orgId, { name, color });
    if (!tag) return res.status(404).json({ error: 'Tag non trouvé' });

    return res.json({ data: tag });
  } catch (error) {
    logger.error('Error updating tag:', error);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du tag' });
  }
});

/**
 * DELETE /api/v1/organizations/:orgId/talents/tags/:tagId
 */
router.delete('/tags/:tagId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, tagId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    const deleted = await deleteTag(tagId, orgId);
    if (!deleted) return res.status(404).json({ error: 'Tag non trouvé' });

    return res.json({ message: 'Tag supprimé' });
  } catch (error) {
    logger.error('Error deleting tag:', error);
    return res.status(500).json({ error: 'Erreur lors de la suppression du tag' });
  }
});

/**
 * POST /api/v1/organizations/:orgId/talents/:talentId/tags/:tagId
 * Assign a tag to a talent
 */
router.post('/:talentId/tags/:tagId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, talentId, tagId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    await assignTag(tagId, talentId, req.talentId);
    return res.json({ message: 'Tag assigné' });
  } catch (error) {
    logger.error('Error assigning tag:', error);
    return res.status(500).json({ error: 'Erreur lors de l\'assignation du tag' });
  }
});

/**
 * DELETE /api/v1/organizations/:orgId/talents/:talentId/tags/:tagId
 * Remove a tag from a talent
 */
router.delete('/:talentId/tags/:tagId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId, talentId, tagId } = req.params;
    if (!req.talentId) return res.status(403).json({ error: 'Auth required' });

    const role = await checkOrgMembership(orgId, req.talentId);
    if (!role) return res.status(403).json({ error: 'Vous n\'êtes pas membre de cette organisation' });

    await unassignTag(tagId, talentId);
    return res.json({ message: 'Tag retiré' });
  } catch (error) {
    logger.error('Error unassigning tag:', error);
    return res.status(500).json({ error: 'Erreur lors du retrait du tag' });
  }
});

export default router;
