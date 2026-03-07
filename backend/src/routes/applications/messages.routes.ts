/**
 * Applications Messages Routes
 * Messaging between applicants and organizations
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../services/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  getPaginationParams,
  handleRouteError,
  createForbiddenError,
  logger,
} from '../../utils';
import * as notificationService from '../../services/notification.service';

const router = Router();

/**
 * GET /api/applications/:id/messages - Get messages for an application
 */
router.get('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const pagination = getPaginationParams(req);

    const accessCheck = await pool.query(`
      SELECT a.id, a.talent_id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (a.talent_id = $2 OR op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:accessDenied'));
    }

    const result = await pool.query(`
      SELECT * FROM application_messages
      WHERE application_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `, [id, pagination.limit, pagination.offset]);

    res.json({ data: result.rows });
  } catch (error) {
    handleRouteError(res, error, 'Error fetching messages');
  }
});

/**
 * POST /api/applications/:id/messages - Send a message
 * NOTE: Organization must send the first message - talents cannot initiate conversation
 */
router.post('/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;
    const { content, attachments, proposed_datetime, datetime_type } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: req.t('applications:messageEmpty') });
    }

    const accessCheck = await pool.query(`
      SELECT a.id, a.talent_id,
        CASE WHEN a.talent_id = $2 THEN 'TALENT' ELSE 'ORGANIZATION' END as sender_type
      FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (a.talent_id = $2 OR op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:accessDenied'));
    }

    const senderType = accessCheck.rows[0].sender_type;

    // Enforce organization-sends-first-message rule
    if (senderType === 'TALENT') {
      const existingMessages = await pool.query(
        'SELECT id FROM application_messages WHERE application_id = $1 LIMIT 1',
        [id]
      );

      if (existingMessages.rows.length === 0) {
        return res.status(403).json({
          error: req.t('applications:organizationFirstMessage'),
          code: 'ORGANIZATION_FIRST_MESSAGE_REQUIRED'
        });
      }
    }

    const messageId = uuidv4();

    const result = await pool.query(`
      INSERT INTO application_messages (
        id, application_id, sender_type, sender_id, content, attachments,
        proposed_datetime, datetime_type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      messageId,
      id,
      senderType,
      talentId,
      content.trim(),
      attachments ? JSON.stringify(attachments) : '[]',
      proposed_datetime || null,
      datetime_type || null
    ]);

    notificationService.notifyApplicationMessage(id, messageId, senderType)
      .catch(err => logger.error('Notification error:', err));

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    handleRouteError(res, error, 'Error sending message');
  }
});

/**
 * PUT /api/applications/:id/messages/read-all - Mark all messages as read
 */
router.put('/:id/messages/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const talentId = req.talentId;

    const accessCheck = await pool.query(`
      SELECT a.id, a.talent_id FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organization_members om ON op.poster_organization_id = om.organization_id
      WHERE a.id = $1 AND o.deleted_at IS NULL
      AND (a.talent_id = $2 OR op.poster_talent_id = $2 OR om.talent_id = $2)
    `, [id, talentId]);

    if (accessCheck.rows.length === 0) {
      throw createForbiddenError(req.t('applications:accessDenied'));
    }

    const isApplicant = accessCheck.rows[0].talent_id === talentId;
    const otherSenderType = isApplicant ? 'ORGANIZATION' : 'TALENT';

    const result = await pool.query(`
      UPDATE application_messages
      SET read_at = NOW()
      WHERE application_id = $1 AND sender_type = $2 AND read_at IS NULL
    `, [id, otherSenderType]);

    res.json({ success: true, marked: result.rowCount, data: { success: true, marked: result.rowCount } });
  } catch (error) {
    handleRouteError(res, error, 'Error marking messages as read');
  }
});

export default router;
