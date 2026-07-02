/**
 * Organizations Write Routes
 * POST, PUT, DELETE operations for organizations
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../../services/database';
import { authMiddleware, isAdmin, AuthRequest } from '../../middleware/auth.middleware';
import { validate, createOrganizationSchema, updateOrganizationSchema, uuidParamSchema } from '../../middleware/validation.middleware';
import { autoModerationService } from '../../services/auto-moderation.service';
import { normalizeCountryCode } from '../../constants/countries';
import { creditWallet, getOnboardingWelcomeBonusCredits, WELCOME_TOTAL_CREDITS } from '../../services/billing/credit.service';
import {
  handleRouteError,
  createNotFoundError,
  createForbiddenError,
  logger,
} from '../../utils';

const router = Router();

type QueryParam = string | number | boolean | null | Date;

/**
 * POST /api/organizations - Create a new organization
 */
router.post('/', authMiddleware, validate(createOrganizationSchema), async (req: AuthRequest, res: Response) => {
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

    if (!isAdmin(req.userEmail) && identityCheck.rows.length === 0) {
      return res.status(403).json({
        error: req.t('organizations:verifiedIdentityRequired'),
        code: 'IDENTITY_REQUIRED',
        message: req.t('organizations:identityVerificationMessage')
      });
    }

    const {
      name, types, description, logo_url, website_url,
      contact_email, contact_phone,
      headquarters_city, headquarters_region, headquarters_country, headquarters_coordinates,
      sectors, goals,
    } = req.body;

    // Normalize country code
    const normalizedCountry = headquarters_country ? normalizeCountryCode(headquarters_country) : null;
    if (headquarters_country && !normalizedCountry) {
      return res.status(400).json({
        error: req.t('organizations:countryMustBeIsoCode'),
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

      // Grant the onboarding remainder so the default welcome total is 30 credits.
      const welcomeBonusCredits = getOnboardingWelcomeBonusCredits();
      if (welcomeBonusCredits > 0) {
        await creditWallet({
          scope: 'ORGANIZATION',
          ownerId: id,
          credits: welcomeBonusCredits,
          sourceType: 'ADJUSTMENT',
          idempotencyKey: `welcome_bonus_org_${id}`,
          metadata: { reason: 'welcome_bonus', welcomeTotalCredits: WELCOME_TOTAL_CREDITS },
        }, client);
      }

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
router.put('/:id', authMiddleware, validate(updateOrganizationSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!req.talentId) {
      throw createForbiddenError('Authentication required');
    }

    // Check permissions — only OWNER or ADMIN can edit organization details
    const memberCheck = await pool.query(`
      SELECT role FROM organization_members
      WHERE organization_id = $1 AND talent_id = $2 AND role IN ('OWNER', 'ADMIN')
    `, [id, req.talentId]);

    if (memberCheck.rows.length === 0) {
      throw createForbiddenError('You do not have permission to edit this organization');
    }

    const {
      name, types, description, logo_url, website_url,
      contact_email, contact_phone,
      headquarters_city, headquarters_region, headquarters_country, headquarters_coordinates,
      sectors, goals,
    } = req.body;

    // Normalize country code
    const normalizedCountry = headquarters_country ? normalizeCountryCode(headquarters_country) : undefined;
    if (headquarters_country && !normalizedCountry) {
      return res.status(400).json({
        error: req.t('organizations:countryMustBeIsoCode'),
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
      return res.status(400).json({ error: req.t('organizations:noFieldsToUpdate') });
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
router.delete('/:id', authMiddleware, validate(uuidParamSchema, 'params'), async (req: AuthRequest, res: Response) => {
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

    res.json({ success: true, message: req.t('organizations:deleted') });
  } catch (error) {
    handleRouteError(res, error, 'Error deleting organization');
  }
});

export default router;
