/**
 * Space Routes
 * Bookable spaces directly linked to Organizations
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../services/database';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth.middleware';
import {
  Space,
  SpaceAvailability,
  SpaceBooking,
  CreateSpaceInput,
  UpdateSpaceInput,
  CreateBookingInput,
  SpaceFilters,
  BookingFilters,
  SPACE_TYPES,
  SPACE_TYPE_DENSITY,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  calculateCapacity,
  calculateBookingPrice,
} from '../types/space.types';
import { generateSpaceSuggestion } from '../services/space-generation.service';

import { logger } from '../utils';
type QueryParam = string | number | boolean | null | Date;

const router = Router();

// ═══════════════════════════════════════════════════════════════
// SPACE CRUD
// ═══════════════════════════════════════════════════════════════

// GET /api/spaces - List spaces with filters (visibility filtering)
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      organization_id,
      type,
      city,
      country,
      min_capacity,
      max_capacity,
      is_bookable,
      is_accessible,
      limit = 50,
      offset = 0,
    } = req.query as unknown as SpaceFilters;
    const talentId = req.talentId;

    // Check if visibility column exists
    let hasVisibilityColumn = false;
    try {
      const columnCheck = await pool.query(
        `SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'spaces' AND column_name = 'visibility'`
      );
      hasVisibilityColumn = columnCheck.rows.length > 0;
    } catch (checkError) {
      // If check fails, assume column doesn't exist
      logger.warn('Failed to check visibility column', { error: String(checkError) });
    }

    // Check if space_invitations table exists
    let hasSpaceInvitationsTable = false;
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_name = 'space_invitations'`
      );
      hasSpaceInvitationsTable = tableCheck.rows.length > 0;
    } catch (checkError) {
      // If check fails, assume table doesn't exist
      logger.warn('Failed to check space_invitations table', { error: String(checkError) });
    }

    // Get user email for invitation check
    let userEmail: string | null = null;
    if (talentId) {
      try {
        const userResult = await pool.query('SELECT email FROM talents WHERE id = $1', [talentId]);
        if (userResult.rows.length > 0) {
          userEmail = userResult.rows[0].email;
        }
      } catch (emailError) {
        // If email lookup fails, continue without email-based invitation check
        logger.warn('Failed to fetch user email for invitation check', { error: String(emailError) });
      }
    }

    // Base query: only PUBLIC spaces OR those where user is invited
    let query = `
      SELECT s.*,
        o.name as organization_name,
        o.logo_url as organization_logo,
        (SELECT COUNT(*) FROM space_bookings sb
         WHERE sb.space_id = s.id AND sb.status = 'CONFIRMED'
         AND sb.end_datetime > NOW()) as active_bookings_count
      FROM spaces s
      LEFT JOIN organizations o ON s.organization_id = o.id
      WHERE s.deleted_at IS NULL AND s.status = 'ACTIVE'
      AND (
        ${hasVisibilityColumn 
          ? `COALESCE(s.visibility, 'PUBLIC') = 'PUBLIC'`
          : `TRUE`}
    `;

    const params: QueryParam[] = [];
    let paramIndex = 1;

    // If user is authenticated, also show spaces they're invited to or own
    if (talentId) {
      const authClauses: string[] = [];

      if (hasSpaceInvitationsTable && userEmail) {
        authClauses.push(`
          EXISTS (
            SELECT 1 FROM space_invitations si
            WHERE si.space_id = s.id
            AND (si.invitee_talent_id = $${paramIndex} OR LOWER(si.invitee_email) = LOWER($${paramIndex + 1}))
          )
        `);
        params.push(talentId, userEmail);
        paramIndex += 2;
      }

      authClauses.push(`
        EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = s.organization_id
          AND om.talent_id = $${paramIndex}
        )
      `);
      params.push(talentId);
      paramIndex += 1;

      if (authClauses.length > 0) {
        query += ` OR ${authClauses.join(' OR ')}`;
      }
    }

    query += `)`;  // Close the visibility OR block

    if (organization_id) {
      query += ` AND s.organization_id = $${paramIndex++}`;
      params.push(organization_id);
    }
    if (type) {
      query += ` AND s.type = $${paramIndex++}`;
      params.push(type);
    }
    if (city) {
      query += ` AND s.city = $${paramIndex++}`;
      params.push(city);
    }
    if (country) {
      query += ` AND s.country = $${paramIndex++}`;
      params.push(country);
    }
    if (min_capacity) {
      query += ` AND s.capacity >= $${paramIndex++}`;
      params.push(Number(min_capacity));
    }
    if (max_capacity) {
      query += ` AND s.capacity <= $${paramIndex++}`;
      params.push(Number(max_capacity));
    }
    if (is_bookable !== undefined) {
      query += ` AND s.is_bookable = $${paramIndex++}`;
      params.push(String(is_bookable) === 'true');
    }
    if (is_accessible !== undefined) {
      query += ` AND s.is_accessible = $${paramIndex++}`;
      params.push(String(is_accessible) === 'true');
    }

    query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Format response
    const spaces = result.rows.map((row) => ({
      ...row,
      organization: row.organization_name
        ? {
            id: row.organization_id,
            name: row.organization_name,
            logo_url: row.organization_logo,
          }
        : undefined,
    }));

    res.json({ data: spaces, count: result.rowCount });
  } catch (error) {
    logger.error('Error fetching spaces:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Error details:', { errorMessage, errorStack });
    res.status(500).json({ 
      error: 'Failed to fetch spaces',
      message: errorMessage 
    });
  }
});

// GET /api/spaces/organization/:orgId - Get spaces by organization
router.get('/organization/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { limit = 50, offset = 0, include_inactive } = req.query;

    let statusFilter = `AND s.status = 'ACTIVE'`;
    if (include_inactive === 'true') {
      statusFilter = '';
    }

    // Get total count first
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM spaces s
       WHERE s.organization_id = $1 AND s.deleted_at IS NULL ${statusFilter}`,
      [orgId]
    );
    const totalCount = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `
      SELECT s.*,
        (SELECT COUNT(*) FROM space_bookings sb
         WHERE sb.space_id = s.id AND sb.status = 'CONFIRMED'
         AND sb.end_datetime > NOW()) as active_bookings_count,
        (SELECT json_agg(sa.*) FROM space_availabilities sa
         WHERE sa.space_id = s.id AND sa.is_active = true) as availabilities
      FROM spaces s
      WHERE s.organization_id = $1 AND s.deleted_at IS NULL ${statusFilter}
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [orgId, Number(limit), Number(offset)]
    );

    res.json({ data: result.rows, count: totalCount });
  } catch (error) {
    logger.error('Error fetching organization spaces:', error);
    res.status(500).json({ error: 'Failed to fetch spaces' });
  }
});

// GET /api/spaces/:id - Get single space with availabilities
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT s.*,
        o.name as organization_name,
        o.logo_url as organization_logo,
        o.headquarters_city as organization_city,
        (SELECT json_agg(sa.* ORDER BY sa.day_of_week, sa.start_time)
         FROM space_availabilities sa
         WHERE sa.space_id = s.id AND sa.is_active = true) as availabilities
      FROM spaces s
      LEFT JOIN organizations o ON s.organization_id = o.id
      WHERE s.id = $1 AND s.deleted_at IS NULL
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Space not found' });
    }

    const space = result.rows[0];
    res.json({
      data: {
        ...space,
        organization: space.organization_name
          ? {
              id: space.organization_id,
              name: space.organization_name,
              logo_url: space.organization_logo,
              city: space.organization_city,
            }
          : undefined,
      },
    });
  } catch (error) {
    logger.error('Error fetching space:', error);
    res.status(500).json({ error: 'Failed to fetch space' });
  }
});

// POST /api/spaces - Create space (requires authentication)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const input: CreateSpaceInput = req.body;

    // Validation
    if (!input.name || input.name.length < 3) {
      return res.status(400).json({ error: 'Name must be at least 3 characters' });
    }
    if (!input.type || !Object.values(SPACE_TYPES).includes(input.type)) {
      return res.status(400).json({ error: 'Invalid space type' });
    }
    if (!input.surface_m2 || input.surface_m2 <= 0) {
      return res.status(400).json({ error: 'Surface area is required and must be positive' });
    }
    if (!input.organization_id) {
      return res.status(400).json({ error: 'Organization ID is required' });
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
      return res.status(403).json({ error: 'Non autorisé à créer un espace pour cette organisation' });
    }

    const id = uuidv4();
    const slug = generateSlug(input.name) + '-' + id.slice(0, 8);

    // Auto-calculate capacity if not provided
    const capacity = input.capacity || calculateCapacity(input.surface_m2, input.type);

    // Parse coordinates - handle both {lat, lng} and {x, y} formats
    let coordsString: string | null = null;
    if (input.coordinates) {
      const coords = input.coordinates as any;
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
        $37, $38
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
        (input.sectors || []).slice(0, 5), // Max 5 sectors
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
    logger.error('Error creating space:', error);
    res.status(500).json({ error: 'Failed to create space' });
  }
});

// PUT /api/spaces/:id - Update space
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const input: UpdateSpaceInput = req.body;

    // Check space exists
    const existing = await pool.query(`SELECT * FROM spaces WHERE id = $1 AND deleted_at IS NULL`, [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Space not found' });
    }

    // Authorization: must be org member (OWNER/ADMIN)
    const space = existing.rows[0];
    if (space.organization_id) {
      const memberCheck = await pool.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND talent_id = $2 AND role IN ('OWNER', 'ADMIN')`,
        [space.organization_id, req.talentId]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Non autorisé à modifier cet espace' });
      }
    }

    // Recalculate capacity if surface or type changed
    let capacity = input.capacity;
    if (input.surface_m2 || input.type) {
      const surfaceM2 = input.surface_m2 || existing.rows[0].surface_m2;
      const spaceType = input.type || existing.rows[0].type;
      capacity = input.capacity || calculateCapacity(surfaceM2, spaceType);
    }

    // Parse coordinates - handle both {lat, lng} and {x, y} formats
    let coordsString: string | null = null;
    if (input.coordinates) {
      const coords = input.coordinates as any;
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
        updated_at = NOW()
      WHERE id = $36 AND deleted_at IS NULL
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
        input.sectors ? (input.sectors as string[]).slice(0, 5) : null, // Max 5 sectors
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
        (input as any).status,
        id,
      ]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating space:', error);
    res.status(500).json({ error: 'Failed to update space' });
  }
});

// DELETE /api/spaces/:id - Soft delete space
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Authorization: must be org member (OWNER/ADMIN)
    const spaceCheck = await pool.query(`SELECT organization_id FROM spaces WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (spaceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Space not found' });
    }
    if (spaceCheck.rows[0].organization_id) {
      const memberCheck = await pool.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND talent_id = $2 AND role IN ('OWNER', 'ADMIN')`,
        [spaceCheck.rows[0].organization_id, req.talentId]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Non autorisé à supprimer cet espace' });
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
        error: 'Cannot delete space with active bookings. Cancel bookings first.',
      });
    }

    const result = await pool.query(
      `UPDATE spaces SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Space not found' });
    }

    res.json({ success: true, message: 'Space deleted' });
  } catch (error) {
    logger.error('Error deleting space:', error);
    res.status(500).json({ error: 'Failed to delete space' });
  }
});

// ═══════════════════════════════════════════════════════════════
// VIEW COUNT
// ═══════════════════════════════════════════════════════════════

// POST /api/spaces/:id/views - Increment view count
router.post('/:id/views', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE spaces
       SET views_count = COALESCE(views_count, 0) + 1, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, views_count`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Space not found' });
    }

    res.json({ data: { views_count: result.rows[0].views_count } });
  } catch (error) {
    logger.error('Error incrementing space views:', error);
    res.status(500).json({ error: 'Failed to increment views' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AVAILABILITY MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/spaces/:id/availabilities - Get space availabilities
router.get('/:id/availabilities', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if space exists
    const spaceCheck = await pool.query(
      `SELECT id FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (spaceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Space not found' });
    }

    const result = await pool.query(
      `SELECT * FROM space_availabilities
       WHERE space_id = $1 AND is_active = true
       ORDER BY day_of_week, start_time`,
      [id]
    );

    res.json({ data: result.rows });
  } catch (error) {
    logger.error('Error fetching availabilities:', error);
    res.status(500).json({ error: 'Failed to fetch availabilities' });
  }
});

// PUT /api/spaces/:id/availabilities - Set availabilities (replace all)
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
    logger.error('Error updating availabilities:', error);
    res.status(500).json({ error: 'Failed to update availabilities' });
  }
});

// POST /api/spaces/:id/unavailabilities - Add blocked period
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
    logger.error('Error creating unavailability:', error);
    res.status(500).json({ error: 'Failed to create unavailability' });
  }
});

// ═══════════════════════════════════════════════════════════════
// BOOKING MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// GET /api/spaces/:id/availability-check - Check if slot is available
router.get('/:id/availability-check', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { start_datetime, end_datetime } = req.query;

    if (!start_datetime || !end_datetime) {
      return res.status(400).json({ error: 'start_datetime and end_datetime are required' });
    }

    // Check for conflicting bookings
    const conflicts = await pool.query(
      `
      SELECT id, start_datetime, end_datetime
      FROM space_bookings
      WHERE space_id = $1
        AND status IN ('PENDING', 'CONFIRMED')
        AND (
          (start_datetime <= $2 AND end_datetime > $2) OR
          (start_datetime < $3 AND end_datetime >= $3) OR
          (start_datetime >= $2 AND end_datetime <= $3)
        )
    `,
      [id, start_datetime, end_datetime]
    );

    // Check for unavailability blocks
    const unavailable = await pool.query(
      `
      SELECT id, start_datetime, end_datetime, reason
      FROM space_unavailabilities
      WHERE space_id = $1
        AND (
          (start_datetime <= $2 AND end_datetime > $2) OR
          (start_datetime < $3 AND end_datetime >= $3) OR
          (start_datetime >= $2 AND end_datetime <= $3)
        )
    `,
      [id, start_datetime, end_datetime]
    );

    const isAvailable = conflicts.rows.length === 0 && unavailable.rows.length === 0;

    res.json({
      data: {
        is_available: isAvailable,
        conflicts: conflicts.rows,
        unavailabilities: unavailable.rows,
      },
    });
  } catch (error) {
    logger.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// GET /api/spaces/:id/bookings - Get bookings for a space
router.get('/:id/bookings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, from_date, to_date, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT sb.*,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        t.first_name as talent_first_name,
        t.last_name as talent_last_name,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_display_name,
        t.avatar_url as talent_avatar,
        t.email as talent_email,
        t.phone as talent_phone,
        t.bio as talent_bio,
        t.city as talent_city,
        t.country as talent_country
      FROM space_bookings sb
      LEFT JOIN talents t ON sb.talent_id = t.id
      WHERE sb.space_id = $1
    `;
    const params: QueryParam[] = [id];
    let paramIndex = 2;

    if (status) {
      query += ` AND sb.status = $${paramIndex++}`;
      params.push(status as string);
    }
    if (from_date) {
      query += ` AND sb.start_datetime >= $${paramIndex++}`;
      params.push(from_date as string);
    }
    if (to_date) {
      query += ` AND sb.end_datetime <= $${paramIndex++}`;
      params.push(to_date as string);
    }

    query += ` ORDER BY sb.start_datetime DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Transform rows to include talent object
    const bookings = result.rows.map(row => ({
      ...row,
      talent: row.talent_id ? {
        id: row.talent_id,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        display_name: row.talent_display_name,
        full_name: row.talent_name,
        avatar_url: row.talent_avatar,
        email: row.talent_email,
        phone: row.talent_phone,
        bio: row.talent_bio,
        city: row.talent_city,
        country: row.talent_country,
      } : null,
    }));

    res.json({ data: bookings, count: result.rowCount });
  } catch (error) {
    logger.error('Error fetching space bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST /api/spaces/:id/book - Create booking
router.post('/:id/book', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id: spaceId } = req.params;
    const talentId = req.talentId;
    const input: CreateBookingInput = req.body;

    // Get space
    const spaceResult = await pool.query(
      `SELECT * FROM spaces WHERE id = $1 AND deleted_at IS NULL AND is_bookable = true`,
      [spaceId]
    );
    if (spaceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Space not found or not bookable' });
    }
    const space = spaceResult.rows[0];

    // Check availability
    const conflicts = await pool.query(
      `
      SELECT COUNT(*) FROM space_bookings
      WHERE space_id = $1
        AND status IN ('PENDING', 'CONFIRMED')
        AND (
          (start_datetime <= $2 AND end_datetime > $2) OR
          (start_datetime < $3 AND end_datetime >= $3) OR
          (start_datetime >= $2 AND end_datetime <= $3)
        )
    `,
      [spaceId, input.start_datetime, input.end_datetime]
    );

    if (parseInt(conflicts.rows[0].count) > 0) {
      return res.status(400).json({ error: 'This time slot is not available' });
    }

    // Calculate pricing
    const pricing = calculateBookingPrice(
      space,
      new Date(input.start_datetime),
      new Date(input.end_datetime)
    );

    const bookingId = uuidv4();
    const result = await pool.query(
      `
      INSERT INTO space_bookings (
        id, space_id, organization_id, talent_id,
        start_datetime, end_datetime,
        purpose, attendees_count, special_requests,
        pricing_type, unit_price, units_count, subtotal, deposit_amount, total_amount,
        payment_method, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'PENDING'
      ) RETURNING *
    `,
      [
        bookingId,
        spaceId,
        space.organization_id,
        talentId,
        input.start_datetime,
        input.end_datetime,
        input.purpose || null,
        input.attendees_count || null,
        input.special_requests || null,
        pricing.pricingType,
        pricing.unitPrice,
        pricing.unitsCount,
        pricing.subtotal,
        pricing.deposit,
        pricing.total,
        input.payment_method || null,
      ]
    );

    // Notify organization about new booking
    const pushService = await import('../services/push-notification.service');
    pushService.notifyNewBooking(bookingId).catch(err => logger.error('Booking notification error:', err));

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ═══════════════════════════════════════════════════════════════
// BOOKING STATUS UPDATES
// ═══════════════════════════════════════════════════════════════

// POST /api/bookings/:id/confirm - Confirm booking (org admin)
router.post('/bookings/:id/confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    const result = await pool.query(
      `
      UPDATE space_bookings
      SET status = 'CONFIRMED', confirmed_at = NOW(), confirmed_by = $2, updated_at = NOW()
      WHERE id = $1 AND status = 'PENDING'
      RETURNING *
    `,
      [id, talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already processed' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error confirming booking:', error);
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// POST /api/bookings/:id/cancel - Cancel booking
router.post('/bookings/:id/cancel', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const { reason } = req.body;

    const result = await pool.query(
      `
      UPDATE space_bookings
      SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_by = $2,
          cancellation_reason = $3, updated_at = NOW()
      WHERE id = $1 AND status IN ('PENDING', 'CONFIRMED')
      RETURNING *
    `,
      [id, talentId, reason || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or cannot be cancelled' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// POST /api/bookings/:id/complete - Mark as completed
router.post('/bookings/:id/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    const result = await pool.query(
      `
      UPDATE space_bookings
      SET status = 'COMPLETED', completed_at = NOW(), rating = $2, review = $3, updated_at = NOW()
      WHERE id = $1 AND status = 'CONFIRMED'
      RETURNING *
    `,
      [id, rating || null, review || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or not confirmed' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error completing booking:', error);
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

// GET /api/bookings/my - Get current user's bookings
router.get('/bookings/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { status, limit = 50, offset = 0 } = req.query;

    // Build count query
    let countQuery = `SELECT COUNT(*) as total FROM space_bookings sb WHERE sb.talent_id = $1`;
    const countParams: QueryParam[] = [talentId!];
    let countParamIndex = 2;

    if (status) {
      countQuery += ` AND sb.status = $${countParamIndex++}`;
      countParams.push(status as string);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Build data query
    let query = `
      SELECT sb.*,
        s.name as space_name,
        s.type as space_type,
        s.cover_image_url as space_image,
        s.address as space_address,
        o.name as organization_name
      FROM space_bookings sb
      LEFT JOIN spaces s ON sb.space_id = s.id
      LEFT JOIN organizations o ON sb.organization_id = o.id
      WHERE sb.talent_id = $1
    `;
    const params: QueryParam[] = [talentId!];
    let paramIndex = 2;

    if (status) {
      query += ` AND sb.status = $${paramIndex++}`;
      params.push(status as string);
    }

    query += ` ORDER BY sb.start_datetime DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Transform to include nested space object with organization inside
    const bookings = result.rows.map(row => ({
      ...row,
      space: {
        id: row.space_id,
        name: row.space_name,
        type: row.space_type,
        cover_image_url: row.space_image,
        address: row.space_address,
        organization: {
          id: row.organization_id,
          name: row.organization_name,
        },
      },
    }));

    res.json({ data: bookings, count: totalCount });
  } catch (error) {
    logger.error('Error fetching user bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/spaces/bookings/organization/:orgId - Get bookings for an organization
router.get('/bookings/organization/:orgId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const { status, space_id, limit = 50, offset = 0 } = req.query;

    // Build count query
    let countQuery = `SELECT COUNT(*) as total FROM space_bookings sb WHERE sb.organization_id = $1`;
    const countParams: QueryParam[] = [orgId];
    let countParamIndex = 2;

    if (status) {
      countQuery += ` AND sb.status = $${countParamIndex++}`;
      countParams.push(status as string);
    }
    if (space_id) {
      countQuery += ` AND sb.space_id = $${countParamIndex++}`;
      countParams.push(space_id as string);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    // Build data query
    let query = `
      SELECT sb.*,
        s.name as space_name,
        s.type as space_type,
        s.cover_image_url as space_image,
        s.address as space_address,
        o.name as organization_name,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        t.first_name as talent_first_name,
        t.last_name as talent_last_name,
        t.avatar_url as talent_avatar,
        t.email as talent_email,
        t.phone as talent_phone
      FROM space_bookings sb
      LEFT JOIN spaces s ON sb.space_id = s.id
      LEFT JOIN organizations o ON sb.organization_id = o.id
      LEFT JOIN talents t ON sb.talent_id = t.id
      WHERE sb.organization_id = $1
    `;
    const params: QueryParam[] = [orgId];
    let paramIndex = 2;

    if (status) {
      query += ` AND sb.status = $${paramIndex++}`;
      params.push(status as string);
    }
    if (space_id) {
      query += ` AND sb.space_id = $${paramIndex++}`;
      params.push(space_id as string);
    }

    query += ` ORDER BY sb.start_datetime DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    // Transform to include space and talent objects
    const bookings = result.rows.map(row => ({
      ...row,
      space: {
        id: row.space_id,
        name: row.space_name,
        type: row.space_type,
        cover_image_url: row.space_image,
        address: row.space_address,
        organization: {
          id: row.organization_id,
          name: row.organization_name,
        },
      },
      talent: row.talent_id ? {
        id: row.talent_id,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        full_name: row.talent_name,
        avatar_url: row.talent_avatar,
        email: row.talent_email,
        phone: row.talent_phone,
      } : null,
    }));

    res.json({ data: bookings, count: totalCount });
  } catch (error) {
    logger.error('Error fetching organization bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/spaces/bookings/:id - Get single booking details
router.get('/bookings/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT sb.*,
        s.name as space_name,
        s.type as space_type,
        s.cover_image_url as space_image,
        s.address as space_address,
        s.city as space_city,
        o.name as organization_name,
        o.logo_url as organization_logo,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        t.first_name as talent_first_name,
        t.last_name as talent_last_name,
        t.avatar_url as talent_avatar,
        t.email as talent_email,
        t.phone as talent_phone,
        t.bio as talent_bio,
        t.city as talent_city,
        t.country as talent_country
      FROM space_bookings sb
      LEFT JOIN spaces s ON sb.space_id = s.id
      LEFT JOIN organizations o ON sb.organization_id = o.id
      LEFT JOIN talents t ON sb.talent_id = t.id
      WHERE sb.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const row = result.rows[0];
    const booking = {
      ...row,
      space: {
        id: row.space_id,
        name: row.space_name,
        type: row.space_type,
        cover_image_url: row.space_image,
        address: row.space_address,
        city: row.space_city,
        organization: {
          id: row.organization_id,
          name: row.organization_name,
          logo_url: row.organization_logo,
        },
      },
      talent: row.talent_id ? {
        id: row.talent_id,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        full_name: row.talent_name,
        avatar_url: row.talent_avatar,
        email: row.talent_email,
        phone: row.talent_phone,
        bio: row.talent_bio,
        city: row.talent_city,
        country: row.talent_country,
      } : null,
    };

    res.json({ data: booking });
  } catch (error) {
    logger.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// PUT /api/spaces/bookings/:id/status - Update booking status
router.put('/bookings/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const result = await pool.query(`
      UPDATE space_bookings
      SET status = $2, cancellation_reason = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, status, reason || null]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// PUT /api/spaces/bookings/:id/notes - Update internal notes
router.put('/bookings/:id/notes', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { internal_notes } = req.body;

    const result = await pool.query(`
      UPDATE space_bookings
      SET internal_notes = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, internal_notes]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating booking notes:', error);
    res.status(500).json({ error: 'Failed to update booking notes' });
  }
});

// POST /api/spaces/bookings/:id/no-show - Mark booking as no-show
router.post('/bookings/:id/no-show', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE space_bookings
      SET status = 'NO_SHOW', updated_at = NOW()
      WHERE id = $1 AND status = 'CONFIRMED'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or not confirmed' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error marking booking as no-show:', error);
    res.status(500).json({ error: 'Failed to mark booking as no-show' });
  }
});

// DELETE /api/spaces/bookings/:id - Delete a booking
router.delete('/bookings/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM space_bookings WHERE id = $1 RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ success: true, message: 'Booking deleted' });
  } catch (error) {
    logger.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// ═══════════════════════════════════════════════════════════════
// BOOKING MESSAGES
// ═══════════════════════════════════════════════════════════════

// GET /api/spaces/bookings/:id/messages - Get messages for a booking
router.get('/bookings/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, before } = req.query;
    const talentId = req.talentId;

    // Verify user has access to this booking
    const bookingCheck = await pool.query(
      `SELECT id, talent_id, organization_id FROM space_bookings WHERE id = $1`,
      [id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Check if user is the talent or a member of the organization
    const isOrgMember = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [booking.organization_id, talentId]
    );

    if (booking.talent_id !== talentId && isOrgMember.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = `
      SELECT bm.*,
        CASE
          WHEN bm.sender_type = 'TALENT' THEN COALESCE(t.first_name || ' ' || t.last_name, t.email)
          ELSE o.name
        END as sender_name,
        CASE
          WHEN bm.sender_type = 'TALENT' THEN t.avatar_url
          ELSE o.logo_url
        END as sender_avatar
      FROM space_booking_messages bm
      LEFT JOIN talents t ON bm.sender_type = 'TALENT' AND bm.sender_id = t.id
      LEFT JOIN organizations o ON bm.sender_type = 'ORGANIZATION' AND bm.sender_id = o.id
      WHERE bm.booking_id = $1
    `;
    const params: QueryParam[] = [id];
    let paramIndex = 2;

    if (before) {
      query += ` AND bm.created_at < (SELECT created_at FROM space_booking_messages WHERE id = $${paramIndex++})`;
      params.push(before as string);
    }

    query += ` ORDER BY bm.created_at ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    res.json({ data: result.rows });
  } catch (error) {
    logger.error('Error fetching booking messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/spaces/bookings/:id/messages - Send a message
router.post('/bookings/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const { content, attachments, proposed_datetime, datetime_type } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Get booking and verify access
    const bookingCheck = await pool.query(
      `SELECT id, talent_id, organization_id FROM space_bookings WHERE id = $1`,
      [id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Determine sender type and ID
    let senderType = 'TALENT';
    let senderId = talentId;

    // Check if user is org member
    const isOrgMember = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [booking.organization_id, talentId]
    );

    if (isOrgMember.rows.length > 0 && booking.talent_id !== talentId) {
      senderType = 'ORGANIZATION';
      senderId = booking.organization_id;
    } else if (booking.talent_id !== talentId && isOrgMember.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messageId = uuidv4();
    const result = await pool.query(`
      INSERT INTO space_booking_messages (
        id, booking_id, sender_type, sender_id, content, attachments, proposed_datetime, datetime_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      messageId,
      id,
      senderType,
      senderId,
      content.trim(),
      attachments ? JSON.stringify(attachments) : null,
      proposed_datetime || null,
      datetime_type || null,
    ]);

    // Get sender info for response
    let senderName = null;
    let senderAvatar = null;

    if (senderType === 'TALENT') {
      const talentInfo = await pool.query(
        `SELECT COALESCE(first_name || ' ' || last_name, email) as name, avatar_url FROM talents WHERE id = $1`,
        [senderId]
      );
      if (talentInfo.rows.length > 0) {
        senderName = talentInfo.rows[0].name;
        senderAvatar = talentInfo.rows[0].avatar_url;
      }
    } else {
      const orgInfo = await pool.query(
        `SELECT name, logo_url FROM organizations WHERE id = $1`,
        [senderId]
      );
      if (orgInfo.rows.length > 0) {
        senderName = orgInfo.rows[0].name;
        senderAvatar = orgInfo.rows[0].logo_url;
      }
    }

    res.status(201).json({
      data: {
        ...result.rows[0],
        sender_name: senderName,
        sender_avatar: senderAvatar,
      }
    });
  } catch (error) {
    logger.error('Error sending booking message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/spaces/bookings/:id/messages/read-all - Mark all messages as read
router.put('/bookings/:id/messages/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    // Get booking to determine which messages to mark as read
    const bookingCheck = await pool.query(
      `SELECT talent_id, organization_id FROM space_bookings WHERE id = $1`,
      [id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Determine which messages to mark as read based on who's reading
    let senderTypeToMark: string;

    const isOrgMember = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [booking.organization_id, talentId]
    );

    if (booking.talent_id === talentId) {
      // Talent is reading - mark organization messages as read
      senderTypeToMark = 'ORGANIZATION';
    } else if (isOrgMember.rows.length > 0) {
      // Org member is reading - mark talent messages as read
      senderTypeToMark = 'TALENT';
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      UPDATE space_booking_messages
      SET is_read = true, read_at = NOW()
      WHERE booking_id = $1 AND sender_type = $2 AND is_read = false
    `, [id, senderTypeToMark]);

    res.json({ data: { marked: result.rowCount } });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// GET /api/spaces/bookings/:id/messages/unread-count - Get unread count
router.get('/bookings/:id/messages/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    const bookingCheck = await pool.query(
      `SELECT talent_id, organization_id FROM space_bookings WHERE id = $1`,
      [id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    let senderTypeToCount: string;

    const isOrgMember = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [booking.organization_id, talentId]
    );

    if (booking.talent_id === talentId) {
      senderTypeToCount = 'ORGANIZATION';
    } else if (isOrgMember.rows.length > 0) {
      senderTypeToCount = 'TALENT';
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT COUNT(*) as count FROM space_booking_messages
      WHERE booking_id = $1 AND sender_type = $2 AND is_read = false
    `, [id, senderTypeToCount]);

    res.json({ data: { count: parseInt(result.rows[0].count) } });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AI GENERATION ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/spaces/generate - Generate space suggestions using AI
 * Requires: Auth + organization_id, name, type
 * Returns: Structured suggestions to prefill the form
 */
router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { name, type, organization_id, existing_data } = req.body;

    // Validate minimum required fields
    if (!name || name.length < 3) {
      return res.status(400).json({
        error: 'Name (min 3 chars) is required',
        canGenerate: false,
      });
    }

    if (!type || !Object.values(SPACE_TYPES).includes(type)) {
      return res.status(400).json({
        error: 'Valid space type is required',
        canGenerate: false,
      });
    }

    if (!organization_id) {
      return res.status(400).json({
        error: 'organization_id is required',
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
      return res.status(403).json({
        error: 'Vous n\'êtes pas membre de cette organisation',
      });
    }

    // Generate suggestions
    const input = {
      name,
      type,
      organization_id,
      existing_data,
    };

    const result = await generateSpaceSuggestion(input);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Échec de la génération',
      });
    }

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error generating space suggestions:', error);
    res.status(500).json({
      error: 'Erreur lors de la génération des suggestions',
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// GET /api/spaces/slug/:slug - Get space by slug
router.get('/slug/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `SELECT * FROM spaces WHERE slug = $1 AND deleted_at IS NULL`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Space not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching space by slug:', error);
    res.status(500).json({ error: 'Failed to fetch space' });
  }
});

// GET /api/spaces/:spaceId/bookings/counts - Get booking counts by status
router.get('/:spaceId/bookings/counts', async (req: Request, res: Response) => {
  try {
    const { spaceId } = req.params;

    const result = await pool.query(
      `SELECT status, COUNT(*) as count FROM space_bookings WHERE space_id = $1 GROUP BY status`,
      [spaceId]
    );

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of result.rows) {
      const count = parseInt(row.count);
      byStatus[row.status] = count;
      total += count;
    }

    res.json({ data: { total, byStatus } });
  } catch (error) {
    logger.error('Error fetching booking counts:', error);
    res.status(500).json({ error: 'Failed to fetch booking counts' });
  }
});

// PUT /api/spaces/bookings/:id/rating - Update booking rating
router.put('/bookings/:id/rating', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const talentId = req.talentId;

    const result = await pool.query(
      `UPDATE space_bookings SET rating = $1, review = $2, updated_at = NOW()
       WHERE id = $3 AND talent_id = $4
       RETURNING *`,
      [rating, review || null, id, talentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or access denied' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating booking rating:', error);
    res.status(500).json({ error: 'Failed to update booking rating' });
  }
});

export default router;
