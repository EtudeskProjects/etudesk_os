/**
 * Communities Write Routes
 * POST, PUT, DELETE operations for communities
 */

import { Router, Response } from 'express';
import { pool, generateSlug } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  generateCommunitySuggestion,
  canGenerate,
  GenerationInput,
} from '../../services/community-generation.service';
import { handleRouteError, createNotFoundError, createForbiddenError, logger } from '../../utils';

const router = Router();

/**
 * POST /api/communities/generate - Generate community suggestions using AI
 */
router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { name, organization_id, existing_data } = req.body;

    if (!canGenerate(name)) {
      return res.status(400).json({
        error: req.t('common:nameMinCharsRequired'),
        canGenerate: false,
      });
    }

    if (!organization_id) {
      return res.status(400).json({
        error: req.t('common:organizationIdRequired'),
        canGenerate: false,
      });
    }

    // Verify membership
    const memberCheck = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [organization_id, talentId]
    );

    if (memberCheck.rows.length === 0) {
      throw createForbiddenError(req.t('communities:notOrgMember'));
    }

    const input: GenerationInput = { name, organization_id, existing_data };
    const result = await generateCommunitySuggestion(input);

    if (!result.success) {
      return res.status(500).json({ error: result.error || req.t('communities:generationFailed') });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    handleRouteError(res, error, 'Error generating community suggestions');
  }
});

/**
 * POST /api/communities - Create a new community
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const {
      name,
      organization_id,
      type,
      description,
      rules,
      application_questions,
      access_type = 'PUBLIC',
      visibility = 'PUBLIC',
      tags,
      sectors,
      city,
      region,
      country,
      cover_image_url,
      images,
    } = req.body;

    if (!name || !organization_id) {
      return res.status(400).json({ error: req.t('common:nameAndOrgIdRequired') });
    }

    // Verify organization membership
    const memberCheck = await pool.query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND talent_id = $2 AND status = 'ACTIVE'`,
      [organization_id, talentId]
    );

    if (memberCheck.rows.length === 0) {
      throw createForbiddenError(req.t('common:mustBeOrgMember'));
    }

    // Generate unique slug
    const baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await pool.query('SELECT id FROM communities WHERE slug = $1', [slug]);
      if (existing.rows.length === 0) break;
      slug = `${baseSlug}-${counter++}`;
    }

    // Create community
    const result = await pool.query(`
      INSERT INTO communities (
        name, slug, organization_id, type, description, rules,
        application_questions, access_type, visibility, tags, sectors,
        city, region, country, cover_image_url, images,
        created_by, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'ACTIVE')
      RETURNING *
    `, [
      name, slug, organization_id, type, description, rules,
      application_questions, access_type, visibility,
      tags ? JSON.stringify(tags) : null,
      sectors ? JSON.stringify(sectors) : null,
      city, region, country, cover_image_url,
      images || [],
      talentId
    ]);

    const community = result.rows[0];

    // Add creator as admin member
    await pool.query(`
      INSERT INTO community_members (community_id, talent_id, role, status, accepted_rules, joined_at)
      VALUES ($1, $2, 'ADMIN', 'ACTIVE', true, CURRENT_DATE)
    `, [community.id, talentId]);

    res.status(201).json({ data: community });
  } catch (error) {
    handleRouteError(res, error, 'Error creating community');
  }
});

/**
 * PUT /api/communities/:id - Update a community
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Check admin permission
    const adminCheck = await pool.query(`
      SELECT 1 FROM community_members
      WHERE community_id = $1 AND talent_id = $2 AND role = 'ADMIN' AND (status IS NULL OR status = 'ACTIVE')
    `, [id, talentId]);

    if (adminCheck.rows.length === 0) {
      throw createForbiddenError(req.t('common:onlyAdminsCanUpdate'));
    }

    const {
      name, type, description, rules, application_questions,
      access_type, visibility, tags, sectors,
      city, region, country, cover_image_url, images, status
    } = req.body;

    const result = await pool.query(`
      UPDATE communities SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        description = COALESCE($3, description),
        rules = COALESCE($4, rules),
        application_questions = COALESCE($5, application_questions),
        access_type = COALESCE($6, access_type),
        visibility = COALESCE($7, visibility),
        tags = COALESCE($8, tags),
        sectors = COALESCE($9, sectors),
        city = COALESCE($10, city),
        region = COALESCE($11, region),
        country = COALESCE($12, country),
        cover_image_url = COALESCE($13, cover_image_url),
        images = COALESCE($14, images),
        status = COALESCE($15, status),
        updated_at = NOW()
      WHERE id = $16 AND deleted_at IS NULL
      RETURNING *
    `, [
      name, type, description, rules, application_questions,
      access_type, visibility,
      tags ? JSON.stringify(tags) : null,
      sectors ? JSON.stringify(sectors) : null,
      city, region, country, cover_image_url, images, status,
      id
    ]);

    if (result.rows.length === 0) {
      throw createNotFoundError('Community');
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating community');
  }
});

/**
 * DELETE /api/communities/:id - Soft delete a community
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Check admin permission
    const adminCheck = await pool.query(`
      SELECT 1 FROM community_members
      WHERE community_id = $1 AND talent_id = $2 AND role = 'ADMIN' AND (status IS NULL OR status = 'ACTIVE')
    `, [id, talentId]);

    if (adminCheck.rows.length === 0) {
      throw createForbiddenError(req.t('common:onlyAdminsCanDelete'));
    }

    await pool.query(
      `UPDATE communities SET deleted_at = NOW(), status = 'DELETED' WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: req.t('communities:deleted') });
  } catch (error) {
    handleRouteError(res, error, 'Error deleting community');
  }
});

export default router;
