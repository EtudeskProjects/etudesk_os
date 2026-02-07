/**
 * Space Bookings Routes
 * Booking management operations
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  getPaginationParams,
  handleRouteError,
  createNotFoundError,
  logger,
} from '../../utils';
import { CreateBookingInput, calculateBookingPrice } from '../../types/space.types';

const router = Router();

type QueryParam = string | number | boolean | null | Date;

/**
 * GET /api/spaces/:id/bookings - Get bookings for a space
 */
router.get('/:id/bookings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, from_date, to_date } = req.query;
    const pagination = getPaginationParams(req);

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
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

    // Transform rows to include talent object
    const bookings = result.rows.map(row => ({
      ...row,
      talent: row.talent_id ? {
        id: row.talent_id,
        first_name: row.talent_first_name,
        last_name: row.talent_last_name,
        display_name: row.talent_display_name || row.talent_name,
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
    handleRouteError(res, error, 'Error fetching space bookings');
  }
});

/**
 * POST /api/spaces/:id/book - Create booking
 */
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
      return res.status(404).json({ error: req.t('spaces:notBookable') });
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
      return res.status(400).json({ error: req.t('spaces:slotNotAvailable') });
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
    const { notifyNewBooking } = await import('../../services/notification.service');
    notifyNewBooking(bookingId).catch(err => logger.error('Booking notification error:', err));

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error creating booking');
  }
});

/**
 * GET /api/spaces/bookings/my - Get current user's bookings
 */
router.get('/bookings/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const talentId = req.talentId;
    const { status } = req.query;
    const pagination = getPaginationParams(req);

    // Build count query
    let countQuery = `SELECT COUNT(*) as total FROM space_bookings sb WHERE sb.talent_id = $1`;
    const countParams: QueryParam[] = [talentId!];
    let countParamIndex = 2;

    if (status) {
      countQuery += ` AND sb.status = $${countParamIndex++}`;
      countParams.push(status as string);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

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
    params.push(pagination.limit, pagination.offset);

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

    res.json({ data: bookings, count: total });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching user bookings');
  }
});

/**
 * GET /api/spaces/bookings/organization/:orgId - Get bookings for an organization
 */
router.get('/bookings/organization/:orgId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const { status, space_id } = req.query;
    const pagination = getPaginationParams(req);

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
    const total = parseInt(countResult.rows[0].total);

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
    params.push(pagination.limit, pagination.offset);

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
        display_name: row.talent_name,
        avatar_url: row.talent_avatar,
        email: row.talent_email,
        phone: row.talent_phone,
      } : null,
    }));

    res.json({ data: bookings, count: total });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching organization bookings');
  }
});

/**
 * GET /api/spaces/bookings/:id - Get single booking details
 */
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
      throw createNotFoundError('Booking');
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
        display_name: row.talent_name,
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
    handleRouteError(res, error, 'Error fetching booking');
  }
});

/**
 * POST /api/spaces/bookings/:id/confirm - Confirm booking (org admin)
 */
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
      return res.status(404).json({ error: req.t('spaces:bookingNotFoundOrProcessed') });
    }

    // Schedule booking reminders (J-1 and H-1)
    const { scheduleBookingReminders } = await import('../../services/notification.service');
    scheduleBookingReminders(id).catch(err => logger.error('Booking reminder scheduling error:', err));

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error confirming booking');
  }
});

/**
 * POST /api/spaces/bookings/:id/cancel - Cancel booking
 */
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
      return res.status(404).json({ error: req.t('spaces:bookingNotFoundOrCannotCancel') });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error cancelling booking');
  }
});

/**
 * POST /api/spaces/bookings/:id/complete - Mark as completed
 */
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
      return res.status(404).json({ error: req.t('spaces:bookingNotFoundOrNotConfirmed') });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error completing booking');
  }
});

/**
 * PUT /api/spaces/bookings/:id/status - Update booking status
 */
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
      throw createNotFoundError('Booking');
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating booking status');
  }
});

/**
 * PUT /api/spaces/bookings/:id/notes - Update internal notes
 */
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
      throw createNotFoundError('Booking');
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating booking notes');
  }
});

/**
 * PUT /api/spaces/bookings/:id/rating - Update booking rating
 */
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
      return res.status(404).json({ error: req.t('spaces:bookingNotFoundOrAccessDenied') });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error updating booking rating');
  }
});

/**
 * POST /api/spaces/bookings/:id/no-show - Mark booking as no-show
 */
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
      return res.status(404).json({ error: req.t('spaces:bookingNotFoundOrNotConfirmed') });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error marking booking as no-show');
  }
});

/**
 * DELETE /api/spaces/bookings/:id - Delete a booking
 */
router.delete('/bookings/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM space_bookings WHERE id = $1 RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      throw createNotFoundError('Booking');
    }

    res.json({ success: true, message: req.t('spaces:bookingDeleted') });
  } catch (error) {
    handleRouteError(res, error, 'Error deleting booking');
  }
});

export default router;
