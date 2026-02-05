/**
 * Organizations Write Routes
 * POST, PUT, DELETE operations for organizations
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { autoModerationService } from '../../services/auto-moderation.service';
import { normalizeCountryCode } from '../../constants/countries';
import {
  handleRouteError,
  createNotFoundError,
  createForbiddenError,
  logger,
} from '../../utils';

const router = Router();

type QueryParam = string | number | boolean | null | Date;

// Valid organization types
const VALID_ORG_TYPES = [
  'COMPANY', 'STARTUP', 'NGO', 'ASSOCIATION',
  'EDUCATIONAL_INSTITUTION', 'PUBLIC_ADMINISTRATION',
  'TRAINING_CENTER', 'CONSULTING_FIRM', 'RECRUITMENT_AGENCY',
  'FINANCIAL_INSTITUTION', 'RESEARCH_CENTER',
  'COOPERATIVE', 'SOCIAL_ENTERPRISE'
];

const MAX_ORG_TYPES = 3;

/**
 * POST /api/organizations - Create a new organization
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.talentId) {
      throw createForbiddenError('You must complete your profile to create an organization');
    }

    // Check if user has verified identity
    const identityCheck = await pool.query(`
      SELECT id FROM kyc_verifications
      WHERE talent_id = $1 AND status = 'VERIFIED'
      LIMIT 1
    `, [req.talentId]);

    // Admin email check (move to a utility if reused)
    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@etudesk.com').split(',').map(e => e.trim().toLowerCase());
    const isAdmin = req.userEmail && ADMIN_EMAILS.includes(req.userEmail.toLowerCase());

    if (!isAdmin && identityCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Verified identity required',
        code: 'IDENTITY_REQUIRED',
        message: 'Vous devez vérifier votre identité avant de créer une organisation.'
      });
    }

    const {
      name, types, description, logo_url, website_url,
      contact_email, contact_phone,
      headquarters_city, headquarters_region, headquarters_country, headquarters_coordinates,
      sectors, goals,
    } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Organization name must be at least 2 characters' });
    }

    if (types) {
      if (!Array.isArray(types) || types.length > MAX_ORG_TYPES) {
        return res.status(400).json({ error: `types must be an array of max ${MAX_ORG_TYPES} items`, validTypes: VALID_ORG_TYPES });
      }
      if (types.some((t: string) => !VALID_ORG_TYPES.includes(t))) {
        return res.status(400).json({ error: 'Invalid organization type', validTypes: VALID_ORG_TYPES });
      }
    }

    // Normalize country code
    const normalizedCountry = headquarters_country ? normalizeCountryCode(headquarters_country) : null;
    if (headquarters_country && !normalizedCountry) {
      return res.status(400).json({
        error: 'Country must be a 2-letter ISO code or a recognized country name',
        provided: headquarters_country,
      });
    }

    // Content moderation
    try {
      await autoModerationService.assertContentApproved({ name, description });
    } catch (moderationError: unknown) {
      const err = moderationError as { message: string; flaggedField?: string };
      logger.info(`[Moderation] Organization creation rejected: ${err.message}`);
      return res.status(400).json({
        error: err.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: err.flaggedField,
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Generate unique slug
      let slug = generateSlug(name);
      let slugSuffix = 1;
      let finalSlug = slug;

      while (true) {
        const existingSlug = await client.query(
          `SELECT id FROM organizations WHERE slug = $1`,
          [finalSlug]
        );
        if (existingSlug.rows.length === 0) break;
        finalSlug = `${slug}-${slugSuffix}`;
        slugSuffix++;
      }

      // Create organization
      const id = uuidv4();
      const coordsValue = headquarters_coordinates
        ? `(${Number(headquarters_coordinates.longitude)},${Number(headquarters_coordinates.latitude)})`
        : null;

      const result = await client.query(`
        INSERT INTO organizations (
          id, name, slug, types, description, logo_url, website_url,
          contact_email, contact_phone,
          headquarters_city, headquarters_region, headquarters_country,
          headquarters_coordinates,
          sectors, goals, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
        ) RETURNING *
      `, [
        id, name.trim(), finalSlug, types?.length > 0 ? types : null, description?.trim() || null,
        logo_url || null, website_url || null, contact_email || null, contact_phone || null,
        headquarters_city?.trim() || null, headquarters_region?.trim() || null,
        normalizedCountry, coordsValue,
        sectors || [], goals || [], req.talentId
      ]);

      // Add creator as owner
      await client.query(`
        INSERT INTO organization_members (
          id, organization_id, talent_id, role, permissions, joined_at, created_at
        ) VALUES ($1, $2, $3, 'OWNER', $4, NOW(), NOW())
      `, [
        uuidv4(), id, req.talentId,
        ['organization:*', 'members:*', 'opportunities:*', 'billing:*']
      ]);

      await client.query('COMMIT');

      res.status(201).json({ data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleRouteError(res, error, 'Error creating organization');
  }
});

/**
 * PUT /api/organizations/:id - Update an organization
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.talentId) {
      throw createForbiddenError('Authentication required');
    }

    // Check permissions
    const memberCheck = await pool.query(`
      SELECT role, permissions FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2
    `, [id, req.talentId]);

    const ownerCheck = await pool.query(`
      SELECT id FROM organizations
      WHERE id = $1 AND created_by = $2 AND deleted_at IS NULL
    `, [id, req.talentId]);

    const hasEditPermission = memberCheck.rows.length > 0 && (
      memberCheck.rows[0].role === 'OWNER' ||
      memberCheck.rows[0].role === 'ADMIN' ||
      memberCheck.rows[0].permissions?.includes('organization:edit')
    );

    if (ownerCheck.rows.length === 0 && !hasEditPermission) {
      throw createForbiddenError('You do not have permission to edit this organization');
    }

    const {
      name, types, description, logo_url, website_url,
      contact_email, contact_phone,
      headquarters_city, headquarters_region, headquarters_country, headquarters_coordinates,
      sectors, goals,
    } = req.body;

    // Validation
    if (types !== undefined) {
      if (types !== null && (!Array.isArray(types) || types.length > MAX_ORG_TYPES)) {
        return res.status(400).json({ error: `types must be an array of max ${MAX_ORG_TYPES} items` });
      }
      if (types && types.some((t: string) => !VALID_ORG_TYPES.includes(t))) {
        return res.status(400).json({ error: 'Invalid organization type', validTypes: VALID_ORG_TYPES });
      }
    }

    // Normalize country code
    const normalizedCountry = headquarters_country ? normalizeCountryCode(headquarters_country) : undefined;
    if (headquarters_country && !normalizedCountry) {
      return res.status(400).json({
        error: 'Country must be a 2-letter ISO code or a recognized country name',
        provided: headquarters_country,
      });
    }

    // Content moderation
    try {
      await autoModerationService.assertContentApproved({ name, description });
    } catch (moderationError: unknown) {
      const err = moderationError as { message: string; flaggedField?: string };
      return res.status(400).json({
        error: err.message,
        code: 'CONTENT_MODERATION_FAILED',
        field: err.flaggedField,
      });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Name must be at least 2 characters' });
      }
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }

    if (types !== undefined) {
      updates.push(`types = $${paramIndex++}`);
      params.push(types?.length > 0 ? types : null);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description?.trim() || null);
    }

    if (logo_url !== undefined) {
      updates.push(`logo_url = $${paramIndex++}`);
      params.push(logo_url || null);
    }

    if (website_url !== undefined) {
      updates.push(`website_url = $${paramIndex++}`);
      params.push(website_url || null);
    }

    if (contact_email !== undefined) {
      updates.push(`contact_email = $${paramIndex++}`);
      params.push(contact_email || null);
    }

    if (contact_phone !== undefined) {
      updates.push(`contact_phone = $${paramIndex++}`);
      params.push(contact_phone || null);
    }

    if (headquarters_city !== undefined) {
      updates.push(`headquarters_city = $${paramIndex++}`);
      params.push(headquarters_city?.trim() || null);
    }

    if (headquarters_region !== undefined) {
      updates.push(`headquarters_region = $${paramIndex++}`);
      params.push(headquarters_region?.trim() || null);
    }

    if (headquarters_country !== undefined) {
      updates.push(`headquarters_country = $${paramIndex++}`);
      params.push(normalizedCountry || null);
    }

    if (headquarters_coordinates !== undefined) {
      const coordsValue = headquarters_coordinates
        ? `(${Number(headquarters_coordinates.longitude)},${Number(headquarters_coordinates.latitude)})`
        : null;
      updates.push(`headquarters_coordinates = $${paramIndex++}`);
      params.push(coordsValue);
    }

    if (sectors !== undefined) {
      updates.push(`sectors = $${paramIndex++}`);
      params.push(sectors || []);
    }

    if (goals !== undefined) {
      updates.push(`goals = $${paramIndex++}`);
      params.push(goals || []);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    const result = await pool.query(`
      UPDATE organizations SET
        ${updates.join(', ')},
        updated_at = NOW()
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      throw createNotFoundError('Organization');
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating organization');
  }
});

/**
 * DELETE /api/organizations/:id - Soft delete an organization
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.talentId) {
      throw createForbiddenError('Authentication required');
    }

    // Only owner can delete
    const ownerCheck = await pool.query(`
      SELECT id FROM organizations
      WHERE id = $1 AND created_by = $2 AND deleted_at IS NULL
    `, [id, req.talentId]);

    if (ownerCheck.rows.length === 0) {
      throw createForbiddenError('Only the owner can delete this organization');
    }

    const result = await pool.query(`
      UPDATE organizations SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      throw createNotFoundError('Organization');
    }

    res.json({ success: true, message: 'Organization deleted' });
  } catch (error) {
    handleRouteError(res, error, 'Error deleting organization');
  }
});

export default router;
