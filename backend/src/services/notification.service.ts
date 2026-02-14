/**
 * Unified Notification Service
 *
 * Single service handling all notifications:
 * - In-app (stored in unified `notifications` table)
 * - Push (Expo)
 * - Email
 * - Scheduling (J-1, H-1 reminders)
 *
 * Replaces the former split between notification.service.ts, push-notification.service.ts
 * and the DB-level split between `notifications` / `community_notifications`.
 */

import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { pool } from './database';
import { sendEmail } from './email.service';
import { logger } from '../utils';

// Expo SDK client
const expo = new Expo();

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType =
  // Legacy / application types
  | 'APPLICATION_STATUS_CHANGED'
  | 'NEW_MESSAGE'
  | 'NEW_APPLICATION'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_REMINDER'
  | 'INVITATION_RECEIVED'
  | 'SYSTEM'
  // Push categories
  | 'OPPORTUNITY'
  | 'APPLICATION'
  | 'MESSAGE'
  | 'SPACE'
  | 'REMINDER'
  | 'MEMBERSHIP'
  | 'BOOKING'
  // Community types
  | 'MENTION'
  | 'COMMENT_REPLY'
  | 'NEW_ACTIVITY'
  | 'EVENT_REMINDER_1D'
  | 'EVENT_REMINDER_1H'
  | 'EVENT_REMINDER'
  | 'BOOKING_REMINDER'
  | 'OPPORTUNITY_REMINDER'
  | 'APPLICATION_REMINDER'
  | 'MEMBERSHIP_APPROVED'
  | 'MEMBERSHIP_REJECTED';

export interface CreateNotificationDTO {
  talentId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  referenceType?: string;
  referenceId?: string;
  communityId?: string;
  activityId?: string;
  commentId?: string;
  actorId?: string;
  scheduledFor?: Date;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  notify_opportunities: boolean;
  notify_messages: boolean;
  notify_applications: boolean;
  notify_reminders: boolean;
  // Legacy fields (kept for backward compat)
  email_application_status?: boolean;
  email_new_message?: boolean;
  email_new_application?: boolean;
  email_interview_reminder?: boolean;
  push_application_status?: boolean;
  push_new_message?: boolean;
  push_new_application?: boolean;
  push_interview_reminder?: boolean;
}

// ============================================================================
// CORE CRUD
// ============================================================================

/**
 * Create a notification in the database and optionally send push
 */
export async function create(dto: CreateNotificationDTO): Promise<string> {
  const result = await pool.query(
    `INSERT INTO notifications (
      talent_id, type, title, body, data,
      reference_type, reference_id,
      community_id, activity_id, comment_id, actor_id,
      scheduled_for, sent_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id`,
    [
      dto.talentId,
      dto.type,
      dto.title,
      dto.body,
      dto.data ? JSON.stringify(dto.data) : '{}',
      dto.referenceType || null,
      dto.referenceId || null,
      dto.communityId || null,
      dto.activityId || null,
      dto.commentId || null,
      dto.actorId || null,
      dto.scheduledFor || null,
      dto.scheduledFor ? null : new Date(), // sent_at = now if not scheduled
    ]
  );

  const id = result.rows[0].id;

  // Send push immediately if not scheduled
  if (!dto.scheduledFor) {
    sendPush(dto.talentId, dto.title, dto.body, {
      type: dto.type,
      ...(dto.data || {}),
      ...(dto.communityId && { communityId: dto.communityId }),
      ...(dto.activityId && { activityId: dto.activityId }),
    }).catch(err => logger.error('Push notification failed:', err));
  }

  return id;
}

/**
 * Batch create notifications (for notifying multiple members)
 */
export async function createBatch(dtos: CreateNotificationDTO[]): Promise<void> {
  if (dtos.length === 0) return;

  const values = dtos.map((dto, i) => {
    const base = i * 12;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`;
  });

  const flatParams = dtos.flatMap(dto => [
    dto.talentId,
    dto.type,
    dto.title,
    dto.body,
    dto.data ? JSON.stringify(dto.data) : '{}',
    dto.communityId || null,
    dto.activityId || null,
    dto.commentId || null,
    dto.actorId || null,
    dto.scheduledFor || null,
    dto.scheduledFor ? null : new Date(),
    dto.referenceType || null,
  ]);

  await pool.query(
    `INSERT INTO notifications (
      talent_id, type, title, body, data,
      community_id, activity_id, comment_id, actor_id,
      scheduled_for, sent_at, reference_type
    ) VALUES ${values.join(', ')}`,
    flatParams
  );
}

/**
 * Schedule a notification for later delivery
 */
export async function schedule(dto: Omit<CreateNotificationDTO, 'scheduledFor'>, scheduledFor: Date): Promise<string> {
  return create({ ...dto, scheduledFor });
}

/**
 * Process scheduled notifications (called by cron every 10 min)
 */
export async function processScheduled(): Promise<number> {
  const result = await pool.query(`
    UPDATE notifications
    SET sent_at = NOW()
    WHERE scheduled_for IS NOT NULL
      AND scheduled_for <= NOW()
      AND sent_at IS NULL
    RETURNING *
  `);

  for (const notification of result.rows) {
    sendPush(
      notification.talent_id,
      notification.title,
      notification.body || '',
      {
        type: notification.type,
        ...(notification.community_id && { communityId: notification.community_id }),
        ...(notification.activity_id && { activityId: notification.activity_id }),
        ...(notification.data || {}),
      }
    ).catch(err => logger.error('Failed to send scheduled push:', err));
  }

  return result.rowCount || 0;
}

/**
 * Get notifications for a user (unified: includes both general and community)
 */
export async function getAll(
  talentId: string,
  options: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    communityId?: string;
    type?: string;
  } = {}
): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
  const { limit = 20, offset = 0, unreadOnly = false, communityId, type } = options;

  const conditions: string[] = ['n.talent_id = $1'];
  const params: any[] = [talentId];
  let paramIndex = 2;

  if (unreadOnly) conditions.push('n.read_at IS NULL');

  if (communityId) {
    conditions.push(`n.community_id = $${paramIndex++}`);
    params.push(communityId);
  }

  if (type) {
    conditions.push(`n.type = $${paramIndex++}`);
    params.push(type);
  }

  // Only show sent notifications (not future scheduled ones)
  conditions.push('(n.scheduled_for IS NULL OR n.sent_at IS NOT NULL)');

  const whereClause = conditions.join(' AND ');

  const [notificationsResult, countResult, unreadResult] = await Promise.all([
    pool.query(
      `SELECT n.*,
        CASE WHEN n.actor_id IS NOT NULL THEN
          json_build_object(
            'id', actor.id,
            'display_name', COALESCE(actor.first_name || ' ' || actor.last_name, actor.email),
            'avatar_url', actor.avatar_url
          )
        ELSE NULL END as actor
      FROM notifications n
      LEFT JOIN talents actor ON n.actor_id = actor.id
      WHERE ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM notifications n WHERE ${whereClause}`,
      params
    ),
    pool.query(
      `SELECT COUNT(*) FROM notifications WHERE talent_id = $1 AND read_at IS NULL
       AND (scheduled_for IS NULL OR sent_at IS NOT NULL)`,
      [talentId]
    ),
  ]);

  return {
    notifications: notificationsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
    unreadCount: parseInt(unreadResult.rows[0].count, 10),
  };
}

/**
 * Get unread count
 */
export async function getUnreadCount(talentId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE talent_id = $1 AND read_at IS NULL
     AND (scheduled_for IS NULL OR sent_at IS NOT NULL)`,
    [talentId]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string, talentId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE notifications SET read_at = NOW()
     WHERE id = $1 AND talent_id = $2 AND read_at IS NULL
     RETURNING id`,
    [notificationId, talentId]
  );
  return result.rows.length > 0;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(talentId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE notifications SET read_at = NOW()
     WHERE talent_id = $1 AND read_at IS NULL`,
    [talentId]
  );
  return result.rowCount || 0;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, talentId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM notifications WHERE id = $1 AND talent_id = $2 RETURNING id`,
    [notificationId, talentId]
  );
  return result.rows.length > 0;
}

/**
 * Cleanup old read notifications
 */
export async function cleanup(olderThanDays: number = 90): Promise<number> {
  const result = await pool.query(
    `DELETE FROM notifications
     WHERE created_at < NOW() - INTERVAL '1 day' * $1
       AND read_at IS NOT NULL`,
    [olderThanDays]
  );
  return result.rowCount || 0;
}

// ============================================================================
// PUSH NOTIFICATION
// ============================================================================

/**
 * Send push notification via Expo SDK
 */
export async function sendPush(
  talentId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const tokensResult = await pool.query(
      'SELECT token FROM push_tokens WHERE talent_id = $1 AND is_active = TRUE',
      [talentId]
    );

    if (tokensResult.rows.length === 0) {
      return { success: true };
    }

    const tokens = tokensResult.rows.map(row => row.token);

    const messages: ExpoPushMessage[] = tokens
      .filter(token => Expo.isExpoPushToken(token))
      .map(token => ({
        to: token,
        sound: 'default' as const,
        title,
        body,
        data: data || {},
      }));

    if (messages.length === 0) return { success: true };

    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        logger.error('Error sending push notification chunk:', error);
      }
    }

    // Deactivate invalid tokens
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if ('status' in ticket && ticket.status === 'error') {
        if (ticket.details?.error === 'DeviceNotRegistered') {
          await pool.query(
            'UPDATE push_tokens SET is_active = FALSE WHERE token = $1',
            [tokens[i]]
          );
        }
      }
    }

    return { success: true };
  } catch (error) {
    logger.error('Failed to send push notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================================================
// PUSH TOKEN MANAGEMENT
// ============================================================================

export async function registerPushToken(
  talentId: string,
  token: string,
  platform: 'ios' | 'android' | 'web',
  deviceName?: string
): Promise<{ success: boolean; error?: string }> {
  if (!Expo.isExpoPushToken(token)) {
    return { success: false, error: 'Invalid Expo push token' };
  }

  try {
    await pool.query(
      `INSERT INTO push_tokens (talent_id, token, device_type, device_name, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (token)
       DO UPDATE SET is_active = true, talent_id = $1, device_name = $4, device_type = $3, updated_at = NOW()`,
      [talentId, token, platform, deviceName]
    );
    return { success: true };
  } catch (error) {
    logger.error('Error registering push token:', error);
    return { success: false, error: 'Failed to register token' };
  }
}

export async function deactivatePushToken(
  talentId: string,
  token: string
): Promise<{ success: boolean }> {
  try {
    await pool.query(
      `UPDATE push_tokens SET is_active = false, updated_at = NOW()
       WHERE talent_id = $1 AND token = $2`,
      [talentId, token]
    );
    return { success: true };
  } catch (error) {
    logger.error('Error deactivating push token:', error);
    return { success: false };
  }
}

// ============================================================================
// PREFERENCES
// ============================================================================

export async function getPreferences(talentId: string): Promise<any> {
  const result = await pool.query(
    `INSERT INTO notification_preferences (talent_id)
     VALUES ($1)
     ON CONFLICT (talent_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [talentId]
  );
  return result.rows[0];
}

export async function updatePreferences(
  talentId: string,
  preferences: Partial<{
    push_enabled: boolean;
    email_enabled: boolean;
    sms_enabled: boolean;
    notify_opportunities: boolean;
    notify_messages: boolean;
    notify_applications: boolean;
    notify_reminders: boolean;
  }>
): Promise<any> {
  const fields = Object.keys(preferences);
  if (fields.length === 0) return getPreferences(talentId);

  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => (preferences as any)[f]);

  const result = await pool.query(
    `UPDATE notification_preferences
     SET ${setClause}, updated_at = NOW()
     WHERE talent_id = $1
     RETURNING *`,
    [talentId, ...values]
  );

  if (result.rows.length === 0) {
    return pool.query(
      `INSERT INTO notification_preferences (talent_id, ${fields.join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
       RETURNING *`,
      [talentId, ...values]
    ).then(r => r.rows[0]);
  }

  return result.rows[0];
}

// ============================================================================
// SCHEDULING HELPERS — Reminders
// ============================================================================

/**
 * Schedule booking reminders (J-1 and H-1) for the talent
 */
export async function scheduleBookingReminders(bookingId: string): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT sb.talent_id, sb.start_datetime, s.name as space_name, s.id as space_id
      FROM space_bookings sb
      JOIN spaces s ON s.id = sb.space_id
      WHERE sb.id = $1
    `, [bookingId]);

    if (result.rows.length === 0) return;

    const { talent_id, start_datetime, space_name, space_id } = result.rows[0];
    const startDate = new Date(start_datetime);
    const now = new Date();

    const baseDto = {
      talentId: talent_id,
      type: 'BOOKING_REMINDER' as NotificationType,
      data: { bookingId, spaceId: space_id, spaceName: space_name, type: 'BOOKING_REMINDER' },
    };

    // J-1
    const oneDayBefore = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    if (oneDayBefore > now) {
      await schedule(
        { ...baseDto, title: 'Reservation demain', body: `Rappel: votre reservation "${space_name}" a lieu demain` },
        oneDayBefore
      );
    }

    // H-1
    const oneHourBefore = new Date(startDate.getTime() - 60 * 60 * 1000);
    if (oneHourBefore > now) {
      await schedule(
        { ...baseDto, title: 'Reservation dans 1 heure', body: `Rappel: votre reservation "${space_name}" commence dans 1 heure` },
        oneHourBefore
      );
    }
  } catch (error) {
    logger.error('Error scheduling booking reminders:', error);
  }
}

/**
 * Schedule opportunity deadline reminder (J-1) when a talent applies
 */
export async function scheduleOpportunityDeadlineReminder(applicationId: string): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT a.talent_id, o.id as opportunity_id, o.title as opportunity_title, o.deadline
      FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      WHERE a.id = $1
    `, [applicationId]);

    if (result.rows.length === 0) return;

    const { talent_id, opportunity_id, opportunity_title, deadline } = result.rows[0];
    if (!deadline) return;

    const deadlineDate = new Date(deadline);
    const oneDayBefore = new Date(deadlineDate.getTime() - 24 * 60 * 60 * 1000);
    const now = new Date();

    if (oneDayBefore > now) {
      await schedule({
        talentId: talent_id,
        type: 'OPPORTUNITY_REMINDER',
        title: 'Date limite demain',
        body: `Rappel: la date limite pour "${opportunity_title}" est demain`,
        data: { opportunityId: opportunity_id, opportunityTitle: opportunity_title, type: 'OPPORTUNITY_REMINDER' },
      }, oneDayBefore);
    }
  } catch (error) {
    logger.error('Error scheduling opportunity deadline reminder:', error);
  }
}

/**
 * Schedule application begin date reminders (J-1, H-1) when status changes to ACCEPTED
 */
export async function scheduleApplicationBeginReminders(applicationId: string): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT a.talent_id, o.id as opportunity_id, o.title as opportunity_title, o.begin_date
      FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      WHERE a.id = $1
    `, [applicationId]);

    if (result.rows.length === 0) return;

    const { talent_id, opportunity_id, opportunity_title, begin_date } = result.rows[0];
    if (!begin_date) return;

    const beginDate = new Date(begin_date);
    const now = new Date();

    const baseDto = {
      talentId: talent_id,
      type: 'APPLICATION_REMINDER' as NotificationType,
      data: { applicationId, opportunityId: opportunity_id, opportunityTitle: opportunity_title, type: 'APPLICATION_REMINDER' },
    };

    // J-1
    const oneDayBefore = new Date(beginDate.getTime() - 24 * 60 * 60 * 1000);
    if (oneDayBefore > now) {
      await schedule(
        { ...baseDto, title: 'Debut demain', body: `Rappel: "${opportunity_title}" commence demain` },
        oneDayBefore
      );
    }

    // H-1
    const oneHourBefore = new Date(beginDate.getTime() - 60 * 60 * 1000);
    if (oneHourBefore > now) {
      await schedule(
        { ...baseDto, title: 'Debut dans 1 heure', body: `Rappel: "${opportunity_title}" commence dans 1 heure` },
        oneHourBefore
      );
    }
  } catch (error) {
    logger.error('Error scheduling application begin reminders:', error);
  }
}

// ============================================================================
// NOTIFICATION TEMPLATES (Application lifecycle — with email)
// ============================================================================

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Soumise',
  IN_REVIEW: 'En cours d\'examen',
  ACCEPTED: 'Acceptee',
  REJECTED: 'Non retenue',
};

const BRAND_PRIMARY = '#3B2416';
const BRAND_PRIMARY_LIGHT = '#5C3D2E';
const BRAND_SUCCESS = '#4A6741';
const BRAND_ERROR = '#8B4A3C';
const LOGO_URL = 'https://etudesk.org/images/etudesk_logo_black.png';
const APP_URL = process.env.APP_URL || 'https://etudesk.org';

/**
 * Notify talent when their application status changes (push + email)
 */
export async function notifyApplicationStatusChanged(
  applicationId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.talent_id,
        t.email as talent_email,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        o.title as opportunity_title,
        org.name as organization_name
      FROM opportunity_applications a
      JOIN talents t ON a.talent_id = t.id
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organizations org ON op.poster_organization_id = org.id
      WHERE a.id = $1
    `, [applicationId]);

    if (result.rows.length === 0) return;

    const app = result.rows[0];
    const statusLabel = APPLICATION_STATUS_LABELS[newStatus] || newStatus;
    const title = 'Candidature mise a jour';
    const body = `Votre candidature pour "${app.opportunity_title}" est maintenant: ${statusLabel}`;

    const prefs = await getPreferences(app.talent_id);

    if (prefs.push_enabled !== false && prefs.notify_applications !== false) {
      await create({
        talentId: app.talent_id,
        type: 'APPLICATION',
        title,
        body,
        data: { applicationId, newStatus, type: 'APPLICATION' },
      });
    }

    if (prefs.email_enabled !== false && prefs.notify_applications !== false) {
      await sendApplicationStatusEmail(
        app.talent_email,
        app.talent_name,
        app.opportunity_title,
        app.organization_name || 'L\'organisation',
        newStatus,
        statusLabel,
        applicationId
      );
    }

    // Schedule begin date reminders when ACCEPTED
    if (newStatus === 'ACCEPTED') {
      scheduleApplicationBeginReminders(applicationId).catch(err =>
        logger.error('Error scheduling begin reminders:', err)
      );
    }
  } catch (error) {
    logger.error('Error sending application status notification:', error);
  }
}

/**
 * Notify talent when they receive a new application message (push + email)
 */
export async function notifyApplicationMessage(
  applicationId: string,
  messageId: string,
  senderType: 'TALENT' | 'ORGANIZATION'
): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        m.content,
        a.id as application_id,
        a.talent_id,
        t.email as talent_email,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        o.title as opportunity_title,
        o.organization_id,
        org.name as organization_name
      FROM application_messages m
      JOIN opportunity_applications a ON m.application_id = a.id
      JOIN talents t ON a.talent_id = t.id
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN organizations org ON o.organization_id = org.id
      WHERE m.id = $1
    `, [messageId]);

    if (result.rows.length === 0) return;

    const msg = result.rows[0];

    if (senderType === 'ORGANIZATION') {
      const title = `Nouveau message de ${msg.organization_name || 'l\'organisation'}`;
      const body = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');

      const prefs = await getPreferences(msg.talent_id);

      if (prefs.push_enabled !== false && prefs.notify_messages !== false) {
        await create({
          talentId: msg.talent_id,
          type: 'MESSAGE',
          title,
          body,
          data: { applicationId, messageId, type: 'MESSAGE' },
        });
      }

      if (prefs.email_enabled !== false && prefs.notify_messages !== false) {
        await sendNewMessageEmail(
          msg.talent_email,
          msg.talent_name,
          msg.organization_name || 'L\'organisation',
          msg.opportunity_title,
          msg.content,
          applicationId
        );
      }
    } else {
      const orgMembers = await pool.query(
        `SELECT om.talent_id FROM organization_members om WHERE om.organization_id = $1`,
        [msg.organization_id]
      );

      for (const member of orgMembers.rows) {
        const title = `Nouveau message de ${msg.talent_name}`;
        const body = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');

        const prefs = await getPreferences(member.talent_id);

        if (prefs.push_enabled !== false && prefs.notify_messages !== false) {
          await create({
            talentId: member.talent_id,
            type: 'MESSAGE',
            title,
            body,
            data: { applicationId, messageId, talentName: msg.talent_name, type: 'MESSAGE' },
          });
        }
      }
    }
  } catch (error) {
    logger.error('Error sending message notification:', error);
  }
}

/**
 * Notify organization members when a new application is received
 */
export async function notifyNewApplication(applicationId: string): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        a.id, a.talent_id,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        o.title as opportunity_title,
        o.organization_id
      FROM opportunity_applications a
      JOIN talents t ON a.talent_id = t.id
      JOIN opportunities o ON a.opportunity_id = o.id
      WHERE a.id = $1
    `, [applicationId]);

    if (result.rows.length === 0) return;

    const app = result.rows[0];

    const orgMembers = await pool.query(
      `SELECT om.talent_id, t.email, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name
       FROM organization_members om
       JOIN talents t ON om.talent_id = t.id
       WHERE om.organization_id = $1`,
      [app.organization_id]
    );

    const title = 'Nouvelle candidature';
    const body = `${app.talent_name} a postule pour "${app.opportunity_title}"`;

    for (const member of orgMembers.rows) {
      const prefs = await getPreferences(member.talent_id);

      if (prefs.push_enabled !== false && prefs.notify_applications !== false) {
        await create({
          talentId: member.talent_id,
          type: 'APPLICATION',
          title,
          body,
          data: { applicationId, talentName: app.talent_name, type: 'APPLICATION' },
        });
      }

      if (prefs.email_enabled !== false && prefs.notify_applications !== false) {
        await sendNewApplicationEmail(
          member.email,
          member.display_name,
          app.talent_name,
          app.opportunity_title,
          applicationId
        );
      }
    }
  } catch (error) {
    logger.error('Error sending new application notification:', error);
  }
}

/**
 * Notify organization members when a new space booking is created
 */
export async function notifyNewBooking(bookingId: string): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        sb.id, sb.talent_id,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        s.name as space_name,
        s.organization_id
      FROM space_bookings sb
      JOIN talents t ON sb.talent_id = t.id
      JOIN spaces s ON sb.space_id = s.id
      WHERE sb.id = $1
    `, [bookingId]);

    if (result.rows.length === 0) return;

    const booking = result.rows[0];

    const orgMembers = await pool.query(
      `SELECT om.talent_id FROM organization_members om WHERE om.organization_id = $1`,
      [booking.organization_id]
    );

    const title = 'Nouvelle demande de reservation';
    const body = `${booking.talent_name} souhaite reserver "${booking.space_name}"`;

    for (const member of orgMembers.rows) {
      await create({
        talentId: member.talent_id,
        type: 'BOOKING',
        title,
        body,
        data: { bookingId, talentName: booking.talent_name, spaceName: booking.space_name, type: 'BOOKING' },
      });
    }
  } catch (error) {
    logger.error('Error sending new booking notification:', error);
  }
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

async function sendApplicationStatusEmail(
  email: string, talentName: string, opportunityTitle: string,
  organizationName: string, status: string, statusLabel: string, applicationId: string
): Promise<void> {
  const applicationLink = `${APP_URL}/my-applications/${applicationId}`;
  const statusColor = status === 'ACCEPTED' ? BRAND_SUCCESS : status === 'REJECTED' ? BRAND_ERROR : status === 'IN_REVIEW' ? '#A67C52' : BRAND_PRIMARY;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#FAF9F7;">
  <table style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;">
    <table style="width:100%;max-width:500px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <tr><td style="padding:40px 40px 20px;text-align:center;"><img src="${LOGO_URL}" alt="Etudesk" style="height:36px;width:auto;"/></td></tr>
      <tr><td style="padding:20px 40px;">
        <p style="margin:0 0 20px;font-size:16px;color:#4a4a4a;">Bonjour ${talentName},</p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#4a4a4a;">Le statut de votre candidature a ete mis a jour.</p>
        <div style="background-color:${statusColor}10;border-radius:8px;padding:20px;margin-bottom:24px;border-left:4px solid ${statusColor};">
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">${opportunityTitle}</p>
          <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">${organizationName}</p>
          <p style="margin:0;font-size:18px;font-weight:600;color:${statusColor};">${statusLabel}</p>
        </div>
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${applicationLink}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Voir ma candidature</a>
        </div>
      </td></tr>
      <tr><td style="padding:24px 40px;background-color:#F5F3F0;border-radius:0 0 12px 12px;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} Etudesk</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  await sendEmail({
    to: email,
    subject: `Candidature mise a jour: ${statusLabel}`,
    html,
    text: `Bonjour ${talentName},\n\nVotre candidature pour "${opportunityTitle}" chez ${organizationName} est maintenant: ${statusLabel}.\n\nVoir: ${applicationLink}`,
  });
}

async function sendNewMessageEmail(
  email: string, talentName: string, organizationName: string,
  opportunityTitle: string, messageContent: string, applicationId: string
): Promise<void> {
  const applicationLink = `${APP_URL}/my-applications/${applicationId}`;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#FAF9F7;">
  <table style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;">
    <table style="width:100%;max-width:500px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <tr><td style="padding:40px 40px 20px;text-align:center;"><img src="${LOGO_URL}" alt="Etudesk" style="height:36px;width:auto;"/></td></tr>
      <tr><td style="padding:20px 40px;">
        <p style="margin:0 0 20px;font-size:16px;color:#4a4a4a;">Bonjour ${talentName},</p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#4a4a4a;">Vous avez recu un nouveau message de <strong>${organizationName}</strong>.</p>
        <div style="background-color:#F5F3F0;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">${opportunityTitle}</p>
          <p style="margin:0;font-size:14px;color:#374151;font-style:italic;">"${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}"</p>
        </div>
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${applicationLink}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Repondre</a>
        </div>
      </td></tr>
      <tr><td style="padding:24px 40px;background-color:#F5F3F0;border-radius:0 0 12px 12px;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} Etudesk</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  await sendEmail({
    to: email,
    subject: `Nouveau message de ${organizationName}`,
    html,
    text: `Bonjour ${talentName},\n\nMessage de ${organizationName} pour "${opportunityTitle}":\n\n"${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}"\n\nRepondre: ${applicationLink}`,
  });
}

async function sendNewApplicationEmail(
  email: string, memberName: string, talentName: string,
  opportunityTitle: string, applicationId: string
): Promise<void> {
  const applicationLink = `${APP_URL}/gestion/applications/${applicationId}`;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#FAF9F7;">
  <table style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;">
    <table style="width:100%;max-width:500px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <tr><td style="padding:40px 40px 20px;text-align:center;"><img src="${LOGO_URL}" alt="Etudesk" style="height:36px;width:auto;"/></td></tr>
      <tr><td style="padding:20px 40px;">
        <p style="margin:0 0 20px;font-size:16px;color:#4a4a4a;">Bonjour ${memberName},</p>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#4a4a4a;">Une nouvelle candidature a ete recue!</p>
        <div style="background-color:${BRAND_PRIMARY}10;border-radius:8px;padding:20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:${BRAND_PRIMARY};">${talentName}</p>
          <p style="margin:0;font-size:14px;color:#6b7280;">a postule pour "${opportunityTitle}"</p>
        </div>
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${applicationLink}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Voir la candidature</a>
        </div>
      </td></tr>
      <tr><td style="padding:24px 40px;background-color:#F5F3F0;border-radius:0 0 12px 12px;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${new Date().getFullYear()} Etudesk</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  await sendEmail({
    to: email,
    subject: `Nouvelle candidature: ${talentName}`,
    html,
    text: `Bonjour ${memberName},\n\n${talentName} a postule pour "${opportunityTitle}".\n\nVoir: ${applicationLink}`,
  });
}
