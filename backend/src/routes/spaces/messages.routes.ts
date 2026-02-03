/**
 * Space Booking Messages Routes
 * Messaging for bookings
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  getPaginationParams,
  handleRouteError,
  createNotFoundError,
  createForbiddenError,
} from '../../utils';

const router = Router();

type QueryParam = string | number | boolean | null | Date;

/**
 * GET /api/spaces/bookings/:id/messages - Get messages for a booking
 */
router.get('/bookings/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { before } = req.query;
    const pagination = getPaginationParams(req);
    const talentId = req.talentId;

    // Verify user has access to this booking
    const bookingCheck = await pool.query(
      `SELECT id, talent_id, organization_id FROM space_bookings WHERE id = $1`,
      [id]
    );

    if (bookingCheck.rows.length === 0) {
      throw createNotFoundError('Booking');
    }

    const booking = bookingCheck.rows[0];

    // Check if user is the talent or a member of the organization
    const isOrgMember = await pool.query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [booking.organization_id, talentId]
    );

    if (booking.talent_id !== talentId && isOrgMember.rows.length === 0) {
      throw createForbiddenError('Access denied');
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
    params.push(pagination.limit, pagination.offset);

    const result = await pool.query(query, params);

    res.json({ data: result.rows });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching booking messages');
  }
});

/**
 * POST /api/spaces/bookings/:id/messages - Send a message
 */
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
      throw createNotFoundError('Booking');
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
      throw createForbiddenError('Access denied');
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
    handleRouteError(res, error, 'Error sending booking message');
  }
});

/**
 * PUT /api/spaces/bookings/:id/messages/read-all - Mark all messages as read
 */
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
      throw createNotFoundError('Booking');
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
      throw createForbiddenError('Access denied');
    }

    const result = await pool.query(`
      UPDATE space_booking_messages
      SET is_read = true, read_at = NOW()
      WHERE booking_id = $1 AND sender_type = $2 AND is_read = false
    `, [id, senderTypeToMark]);

    res.json({ data: { marked: result.rowCount } });
  } catch (error) {
    handleRouteError(res, error, 'Error marking messages as read');
  }
});

/**
 * GET /api/spaces/bookings/:id/messages/unread-count - Get unread count
 */
router.get('/bookings/:id/messages/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    const bookingCheck = await pool.query(
      `SELECT talent_id, organization_id FROM space_bookings WHERE id = $1`,
      [id]
    );

    if (bookingCheck.rows.length === 0) {
      throw createNotFoundError('Booking');
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
      throw createForbiddenError('Access denied');
    }

    const result = await pool.query(`
      SELECT COUNT(*) as count FROM space_booking_messages
      WHERE booking_id = $1 AND sender_type = $2 AND is_read = false
    `, [id, senderTypeToCount]);

    res.json({ data: { count: parseInt(result.rows[0].count) } });
  } catch (error) {
    handleRouteError(res, error, 'Error getting unread count');
  }
});

export default router;
