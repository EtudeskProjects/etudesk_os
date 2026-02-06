/**
 * Spaces Write Routes
 * POST, PUT, DELETE operations for spaces
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  handleRouteError,
  createNotFoundError,
  createForbiddenError,
  logger,
} from '../../utils';
import {
  CreateSpaceInput,
  UpdateSpaceInput,
  SPACE_TYPES,
  calculateCapacity,
} from '../../types/space.types';
import { generateSpaceSuggestion } from '../../services/space-generation.service';

const router = Router();

/**
 * POST /api/spaces/generate - Generate space suggestions using AI
 */
router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { name, type, organization_id, existing_data } = req.body;

    if (!name || name.length < 3) {
      return res.status(400).json({
        error: req.t('spaces:nameMinChars'),
        canGenerate: false,
      });
    }

    if (!type || !Object.values(SPACE_TYPES).includes(type)) {
      return res.status(400).json({
        error: req.t('spaces:validSpaceTypeRequired'),
        canGenerate: false,
      });
    }

    if (!organization_id) {
      return res.status(400).json({
        error: req.t('spaces:organizationIdRequired'),
        canGenerate: false,
      });
    }

    // Verify user is a member of the organization
    const memberCheck = await pool.query(
      `SELECT 1 FROM organization_members
       WHERE organization_id = $1 AND talent_id = $2`,
      [organization_id, talentId]
    );

    if (memberCheck.rows.length === 0) {
      throw createForbiddenError(req.t('spaces:notOrgMember'));
    }

    const input = { name, type, organization_id, existing_data };
    const result = await generateSpaceSuggestion(input);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || req.t('spaces:generationFailed'),
      });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    handleRouteError(res, error, 'Error generating space suggestions');
  }
});

/**
 * POST /api/spaces - Create space
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const input: CreateSpaceInput = req.body;

    // Validation
    if (!input.name || input.name.length < 3) {
      return res.status(400).json({ error: req.t('spaces:nameMustBe3Chars') });
    }
    if (!input.type || !Object.values(SPACE_TYPES).includes(input.type)) {
      return res.status(400).json({ error: req.t('spaces:invalidSpaceType') });
    }
    if (!input.surface_m2 || input.surface_m2 <= 0) {
      return res.status(400).json({ error: req.t('spaces:surfaceAreaRequired') });
    }
    if (!input.organization_id) {
      return res.status(400).json({ error: req.t('spaces:organizationIdRequired') });
    }

    // Check organization exists and user is member (OWNER/ADMIN)
    const orgCheck = await pool.query(
      `SELECT o.id FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id
       WHERE o.id = $1 AND o.deleted_at IS NULL
       AND om.talent_id = $2 AND om.role IN ('OWNER', 'ADMIN')`,
      [input.organization_id, talentId]
    );
    if (orgCheck.rows.length === 0) {
      throw createForbiddenError(req.t('spaces:notAuthorized'));
    }

    const id = uuidv4();
    const slug = generateSlug(input.name) + '-' + id.slice(0, 8);

    // Auto-calculate capacity if not provided
    const capacity = input.capacity || calculateCapacity(input.surface_m2, input.type);

    // Parse coordinates
    let coordsString: string | null = null;
    if (input.coordinates) {
      const coords = input.coordinates as { lat?: number; lng?: number; x?: number; y?: number };
      if (coords.lat !== undefined && coords.lng !== undefined) {
        coordsString = `(${coords.lat}, ${coords.lng})`;
      } else if (coords.x !== undefined && coords.y !== undefined) {
        coordsString = `(${coords.x}, ${coords.y})`;
      }
    }

    const result = await pool.query(
      `
      INSERT INTO spaces (
        id, name, slug, description, type, surface_m2, capacity,
        address, city, region, country, coordinates,
        equipment, amenities, sectors, is_accessible, accessibility_features, accessibility_notes,
        cover_image_url, gallery_images,
        hourly_rate, daily_rate, weekly_rate, monthly_rate,
        is_bookable, min_booking_hours, max_booking_hours, advance_booking_days, cancellation_hours,
        contact_name, contact_phone, contact_email,
        booking_rules, questions, requires_approval, visibility,
        payment_collection_info,
        organization_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20,
        $21, $22, $23, $24,
        $25, $26, $27, $28, $29,
        $30, $31, $32,
        $33, $34, $35, $36,
        $37,
        $38, $39
      ) RETURNING *
    `,
      [
        id,
        input.name,
        slug,
        input.description || null,
        input.type,
        input.surface_m2,
        capacity,
        input.address || null,
        input.city || null,
        input.region || null,
        input.country || 'CI',
        coordsString,
        input.equipment || [],
        input.amenities || [],
        (input.sectors || []).slice(0, 5),
        input.is_accessible || false,
        input.accessibility_features || [],
        input.accessibility_notes || null,
        input.cover_image_url || null,
        input.gallery_images || [],
        input.hourly_rate || null,
        input.daily_rate || null,
        input.weekly_rate || null,
        input.monthly_rate || null,
        input.is_bookable !== false,
        input.min_booking_hours || 1,
        input.max_booking_hours || 24,
        input.advance_booking_days || 30,
        input.cancellation_hours || 24,
        input.contact_name || null,
        input.contact_phone || null,
        input.contact_email || null,
        input.booking_rules || null,
        input.questions || null,
        input.requires_approval || false,
        input.visibility || 'PUBLIC',
        input.payment_collection_info || null,
        input.organization_id,
        talentId,
      ]
    );

    const space = result.rows[0];

    // Insert availabilities if provided
    if (input.availabilities && input.availabilities.length > 0) {
      for (const avail of input.availabilities) {
        await pool.query(
          `
          INSERT INTO space_availabilities (id, space_id, day_of_week, start_time, end_time, valid_from, valid_until)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [
            uuidv4(),
            id,
            avail.day_of_week,
            avail.start_time,
            avail.end_time,
            avail.valid_from || new Date().toISOString().split('T')[0],
            avail.valid_until || null,
          ]
        );
      }
    }

    res.status(201).json({ data: space });
  } catch (error) {
    handleRouteError(res, error, 'Error creating space');
  }
});

/**
 * PUT /api/spaces/:id - Update space
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const input: UpdateSpaceInput = req.body;

    // Check space exists
    const existing = await pool.query(
      `SELECT * FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (existing.rows.length === 0) {
      throw createNotFoundError('Space');
    }

    // Authorization: must be org member (OWNER/ADMIN)
    const space = existing.rows[0];
    if (space.organization_id) {
      const memberCheck = await pool.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND talent_id = $2 AND role IN ('OWNER', 'ADMIN')`,
        [space.organization_id, req.talentId]
      );
      if (memberCheck.rows.length === 0) {
        throw createForbiddenError(req.t('spaces:notAuthorized'));
      }
    }

    // Recalculate capacity if surface or type changed
    let capacity = input.capacity;
    if (input.surface_m2 || input.type) {
      const surfaceM2 = input.surface_m2 || existing.rows[0].surface_m2;
      const spaceType = input.type || existing.rows[0].type;
      capacity = input.capacity || calculateCapacity(surfaceM2, spaceType);
    }

    // Parse coordinates
    let coordsString: string | null = null;
    if (input.coordinates) {
      const coords = input.coordinates as { lat?: number; lng?: number; x?: number; y?: number };
      if (coords.lat !== undefined && coords.lng !== undefined) {
        coordsString = `(${coords.lat}, ${coords.lng})`;
      } else if (coords.x !== undefined && coords.y !== undefined) {
        coordsString = `(${coords.x}, ${coords.y})`;
      }
    }

    const result = await pool.query(
      `
      UPDATE spaces SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        type = COALESCE($3, type),
        surface_m2 = COALESCE($4, surface_m2),
        capacity = COALESCE($5, capacity),
        address = COALESCE($6, address),
        city = COALESCE($7, city),
        region = COALESCE($8, region),
        country = COALESCE($9, country),
        coordinates = COALESCE($10, coordinates),
        equipment = COALESCE($11, equipment),
        amenities = COALESCE($12, amenities),
        sectors = COALESCE($13, sectors),
        is_accessible = COALESCE($14, is_accessible),
        accessibility_features = COALESCE($15, accessibility_features),
        accessibility_notes = COALESCE($16, accessibility_notes),
        cover_image_url = COALESCE($17, cover_image_url),
        gallery_images = COALESCE($18, gallery_images),
        hourly_rate = COALESCE($19, hourly_rate),
        daily_rate = COALESCE($20, daily_rate),
        weekly_rate = COALESCE($21, weekly_rate),
        monthly_rate = COALESCE($22, monthly_rate),
        is_bookable = COALESCE($23, is_bookable),
        min_booking_hours = COALESCE($24, min_booking_hours),
        max_booking_hours = COALESCE($25, max_booking_hours),
        advance_booking_days = COALESCE($26, advance_booking_days),
        cancellation_hours = COALESCE($27, cancellation_hours),
        contact_name = COALESCE($28, contact_name),
        contact_phone = COALESCE($29, contact_phone),
        contact_email = COALESCE($30, contact_email),
        booking_rules = COALESCE($31, booking_rules),
        questions = COALESCE($32, questions),
        requires_approval = COALESCE($33, requires_approval),
        visibility = COALESCE($34, visibility),
        status = COALESCE($35, status),
        payment_collection_info = COALESCE($36, payment_collection_info),
        updated_at = NOW()
      WHERE id = $37 AND deleted_at IS NULL
      RETURNING *
    `,
      [
        input.name,
        input.description,
        input.type,
        input.surface_m2,
        capacity,
        input.address,
        input.city,
        input.region,
        input.country,
        coordsString,
        input.equipment,
        input.amenities,
        input.sectors ? (input.sectors as string[]).slice(0, 5) : null,
        input.is_accessible,
        input.accessibility_features,
        input.accessibility_notes,
        input.cover_image_url,
        input.gallery_images,
        input.hourly_rate,
        input.daily_rate,
        input.weekly_rate,
        input.monthly_rate,
        input.is_bookable,
        input.min_booking_hours,
        input.max_booking_hours,
        input.advance_booking_days,
        input.cancellation_hours,
        input.contact_name,
        input.contact_phone,
        input.contact_email,
        input.booking_rules,
        input.questions,
        input.requires_approval,
        input.visibility,
        (input as { status?: string }).status,
        input.payment_collection_info,
        id,
      ]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating space');
  }
});

/**
 * PUT /api/spaces/:id/availabilities - Set availabilities (replace all)
 */
router.put('/:id/availabilities', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { availabilities } = req.body;

    // Delete existing and insert new
    await pool.query(`DELETE FROM space_availabilities WHERE space_id = $1`, [id]);

    if (availabilities && availabilities.length > 0) {
      for (const avail of availabilities) {
        await pool.query(
          `
          INSERT INTO space_availabilities (id, space_id, day_of_week, start_time, end_time, valid_from, valid_until, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        `,
          [
            uuidv4(),
            id,
            avail.day_of_week,
            avail.start_time,
            avail.end_time,
            avail.valid_from || new Date().toISOString().split('T')[0],
            avail.valid_until || null,
          ]
        );
      }
    }

    const result = await pool.query(
      `SELECT * FROM space_availabilities WHERE space_id = $1 AND is_active = true ORDER BY day_of_week, start_time`,
      [id]
    );

    res.json({ data: result.rows });
  } catch (error) {
    handleRouteError(res, error, 'Error updating availabilities');
  }
});

/**
 * POST /api/spaces/:id/unavailabilities - Add blocked period
 */
router.post('/:id/unavailabilities', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { start_datetime, end_datetime, reason, notes } = req.body;
    const talentId = req.talentId;

    const result = await pool.query(
      `
      INSERT INTO space_unavailabilities (id, space_id, start_datetime, end_datetime, reason, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [uuidv4(), id, start_datetime, end_datetime, reason || null, notes || null, talentId]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error creating unavailability');
  }
});

/**
 * DELETE /api/spaces/:id - Soft delete space
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Authorization: must be org member (OWNER/ADMIN)
    const spaceCheck = await pool.query(
      `SELECT organization_id FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (spaceCheck.rows.length === 0) {
      throw createNotFoundError('Space');
    }
    if (spaceCheck.rows[0].organization_id) {
      const memberCheck = await pool.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND talent_id = $2 AND role IN ('OWNER', 'ADMIN')`,
        [spaceCheck.rows[0].organization_id, req.talentId]
      );
      if (memberCheck.rows.length === 0) {
        throw createForbiddenError(req.t('spaces:notAuthorized'));
      }
    }

    // Check for active bookings
    const activeBookings = await pool.query(
      `SELECT COUNT(*) FROM space_bookings
       WHERE space_id = $1 AND status IN ('PENDING', 'CONFIRMED')
       AND end_datetime > NOW()`,
      [id]
    );

    if (parseInt(activeBookings.rows[0].count) > 0) {
      return res.status(400).json({
        error: req.t('spaces:cannotDeleteWithActiveBookings'),
      });
    }

    await pool.query(
      `UPDATE spaces SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    res.json({ success: true, message: req.t('spaces:deleted') });
  } catch (error) {
    handleRouteError(res, error, 'Error deleting space');
  }
});

export default router;
