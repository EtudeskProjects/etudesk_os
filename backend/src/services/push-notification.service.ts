/**
 * Push Notification Service
 * Handles Expo Push Notifications for the Etudesk platform
 */

import Expo, { ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';
import { pool } from './database';
import { sendEmail } from './email.service';

// Create Expo SDK client
const expo = new Expo();

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type NotificationType = 'OPPORTUNITY' | 'APPLICATION' | 'MESSAGE' | 'SYSTEM' | 'REMINDER';

export interface PushNotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface SendResult {
  success: boolean;
  ticketCount: number;
  errors?: string[];
}

// ═══════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Register or update a push token for a user
 */
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
      `INSERT INTO push_tokens (talent_id, token, platform, device_name, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (talent_id, token)
       DO UPDATE SET is_active = true, device_name = $4, updated_at = NOW()`,
      [talentId, token, platform, deviceName]
    );
    return { success: true };
  } catch (error) {
    console.error('Error registering push token:', error);
    return { success: false, error: 'Failed to register token' };
  }
}

/**
 * Deactivate a push token (on logout)
 */
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
    console.error('Error deactivating push token:', error);
    return { success: false };
  }
}

/**
 * Get active push tokens for a user
 */
async function getActiveTokens(talentId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT token FROM push_tokens WHERE talent_id = $1 AND is_active = true`,
    [talentId]
  );
  return result.rows.map(row => row.token);
}

/**
 * Check if user has push notifications enabled
 */
async function isPushEnabled(talentId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT push_enabled FROM notification_preferences WHERE talent_id = $1`,
    [talentId]
  );
  // Default to true if no preferences set
  return result.rows.length === 0 || result.rows[0].push_enabled;
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION STORAGE
// ═══════════════════════════════════════════════════════════════

/**
 * Store a notification in the database
 */
async function storeNotification(
  talentId: string,
  notification: PushNotificationData,
  sent: boolean
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO notifications (talent_id, type, title, body, data, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      talentId,
      notification.type,
      notification.title,
      notification.body,
      JSON.stringify(notification.data || {}),
      sent ? new Date() : null,
    ]
  );
  return result.rows[0].id;
}

// ═══════════════════════════════════════════════════════════════
// SEND NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Send push notification to a single user
 */
export async function sendToUser(
  talentId: string,
  notification: PushNotificationData
): Promise<SendResult> {
  // Check if push is enabled for user
  const pushEnabled = await isPushEnabled(talentId);
  if (!pushEnabled) {
    // Store notification but don't send
    await storeNotification(talentId, notification, false);
    return { success: true, ticketCount: 0 };
  }

  const tokens = await getActiveTokens(talentId);
  if (tokens.length === 0) {
    // Store notification but no tokens to send to
    await storeNotification(talentId, notification, false);
    return { success: true, ticketCount: 0 };
  }

  // Build messages
  const messages: ExpoPushMessage[] = tokens
    .filter(token => Expo.isExpoPushToken(token))
    .map(token => ({
      to: token,
      sound: 'default' as const,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
    }));

  if (messages.length === 0) {
    await storeNotification(talentId, notification, false);
    return { success: true, ticketCount: 0 };
  }

  // Send in chunks
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];
  const errors: string[] = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending push notification chunk:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Store notification as sent
  await storeNotification(talentId, notification, tickets.length > 0);

  return {
    success: errors.length === 0,
    ticketCount: tickets.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Send push notification to multiple users
 */
export async function sendToUsers(
  talentIds: string[],
  notification: PushNotificationData
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const talentId of talentIds) {
    const result = await sendToUser(talentId, notification);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Send notification for new opportunity matching user interests
 */
export async function notifyNewOpportunity(
  talentId: string,
  opportunityTitle: string,
  opportunityId: string
): Promise<SendResult> {
  return sendToUser(talentId, {
    type: 'OPPORTUNITY',
    title: 'Nouvelle opportunité',
    body: `Une nouvelle opportunité pourrait vous intéresser: ${opportunityTitle}`,
    data: { opportunityId, screen: 'opportunity-details' },
  });
}

/**
 * Send notification for application status update
 */
export async function notifyApplicationUpdate(
  talentId: string,
  opportunityTitle: string,
  newStatus: string,
  applicationId: string
): Promise<SendResult> {
  const statusMessages: Record<string, string> = {
    IN_REVIEW: 'est en cours d\'examen',
    ACCEPTED: 'a été acceptée',
    REJECTED: 'n\'a pas été retenue',
  };

  const statusText = statusMessages[newStatus] || 'a été mise à jour';

  return sendToUser(talentId, {
    type: 'APPLICATION',
    title: 'Mise à jour de candidature',
    body: `Votre candidature pour "${opportunityTitle}" ${statusText}.`,
    data: { applicationId, screen: 'application-details' },
  });
}

/**
 * Send notification for new message
 */
export async function notifyNewMessage(
  talentId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<SendResult> {
  return sendToUser(talentId, {
    type: 'MESSAGE',
    title: `Message de ${senderName}`,
    body: messagePreview.length > 100 ? messagePreview.substring(0, 100) + '...' : messagePreview,
    data: { conversationId, screen: 'messages' },
  });
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION QUERIES
// ═══════════════════════════════════════════════════════════════

/**
 * Get notifications for a user
 */
export async function getNotifications(
  talentId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  const whereClause = unreadOnly ? 'AND read_at IS NULL' : '';

  const [notificationsResult, countResult, unreadResult] = await Promise.all([
    pool.query(
      `SELECT * FROM notifications
       WHERE talent_id = $1 ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [talentId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) FROM notifications WHERE talent_id = $1 ${whereClause}`,
      [talentId]
    ),
    pool.query(
      `SELECT COUNT(*) FROM notifications WHERE talent_id = $1 AND read_at IS NULL`,
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
 * Get or create notification preferences
 */
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

/**
 * Update notification preferences
 */
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
    // Create if not exists
    return pool.query(
      `INSERT INTO notification_preferences (talent_id, ${fields.join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
       RETURNING *`,
      [talentId, ...values]
    ).then(r => r.rows[0]);
  }

  return result.rows[0];
}

// ═══════════════════════════════════════════════════════════════
// APPLICATION NOTIFICATION HELPERS (Enhanced with Email)
// ═══════════════════════════════════════════════════════════════

const BRAND_BLUE = '#26449F';
const APP_URL = process.env.APP_URL || 'https://etudesk.com';

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Soumise',
  IN_REVIEW: 'En cours d\'examen',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Non retenue',
};

/**
 * Notify talent when their application status changes
 * Sends both push and email notifications
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
    const title = 'Candidature mise à jour';
    const body = `Votre candidature pour "${app.opportunity_title}" est maintenant: ${statusLabel}`;

    // Get preferences
    const prefs = await getPreferences(app.talent_id);

    // Send push notification
    if (prefs.push_enabled !== false && prefs.notify_applications !== false) {
      await sendToUser(app.talent_id, {
        type: 'APPLICATION',
        title,
        body,
        data: {
          applicationId,
          newStatus,
          screen: 'application-details',
        },
      });
    }

    // Send email notification
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
  } catch (error) {
    console.error('Error sending application status notification:', error);
  }
}

/**
 * Notify talent when they receive a new message
 * Sends both push and email notifications
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
      // Notify the talent
      const title = `Nouveau message de ${msg.organization_name || 'l\'organisation'}`;
      const body = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');

      const prefs = await getPreferences(msg.talent_id);

      // Send push
      if (prefs.push_enabled !== false && prefs.notify_messages !== false) {
        await sendToUser(msg.talent_id, {
          type: 'MESSAGE',
          title,
          body,
          data: {
            applicationId,
            messageId,
            screen: 'application-messages',
          },
        });
      }

      // Send email
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
      // Notify organization members
      const orgMembers = await pool.query(
        `SELECT om.talent_id, t.email, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name
         FROM organization_members om
         JOIN talents t ON om.talent_id = t.id
         WHERE om.organization_id = $1`,
        [msg.organization_id]
      );

      for (const member of orgMembers.rows) {
        const title = `Nouveau message de ${msg.talent_name}`;
        const body = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');

        const prefs = await getPreferences(member.talent_id);

        if (prefs.push_enabled !== false && prefs.notify_messages !== false) {
          await sendToUser(member.talent_id, {
            type: 'MESSAGE',
            title,
            body,
            data: {
              applicationId,
              messageId,
              talentName: msg.talent_name,
              screen: 'org-application-messages',
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error sending message notification:', error);
  }
}

/**
 * Notify organization members when a new application is received
 */
export async function notifyNewApplication(applicationId: string): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.talent_id,
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

    // Get organization members
    const orgMembers = await pool.query(
      `SELECT om.talent_id, t.email, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name
       FROM organization_members om
       JOIN talents t ON om.talent_id = t.id
       WHERE om.organization_id = $1`,
      [app.organization_id]
    );

    const title = 'Nouvelle candidature';
    const body = `${app.talent_name} a postulé pour "${app.opportunity_title}"`;

    for (const member of orgMembers.rows) {
      const prefs = await getPreferences(member.talent_id);

      // Send push
      if (prefs.push_enabled !== false && prefs.notify_applications !== false) {
        await sendToUser(member.talent_id, {
          type: 'APPLICATION',
          title,
          body,
          data: {
            applicationId,
            talentName: app.talent_name,
            screen: 'org-application-details',
          },
        });
      }

      // Send email
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
    console.error('Error sending new application notification:', error);
  }
}

/**
 * Notify talent when an interview is scheduled
 */
export async function notifyInterviewScheduled(
  applicationId: string,
  interviewDate: string,
  interviewType: string,
  interviewLocation?: string
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
    const interviewTypeLabel = interviewType === 'VIDEO' ? 'Visioconférence'
      : interviewType === 'PHONE' ? 'Téléphone'
      : 'En personne';

    const title = 'Entretien programmé';
    const body = `Entretien ${interviewTypeLabel.toLowerCase()} programmé pour "${app.opportunity_title}"`;

    const prefs = await getPreferences(app.talent_id);

    // Send push
    if (prefs.push_enabled !== false && prefs.notify_reminders !== false) {
      await sendToUser(app.talent_id, {
        type: 'REMINDER',
        title,
        body,
        data: {
          applicationId,
          interviewDate,
          interviewType,
          screen: 'application-details',
        },
      });
    }

    // Send email
    if (prefs.email_enabled !== false && prefs.notify_reminders !== false) {
      await sendInterviewScheduledEmail(
        app.talent_email,
        app.talent_name,
        app.opportunity_title,
        app.organization_name || 'L\'organisation',
        interviewDate,
        interviewTypeLabel,
        interviewLocation,
        applicationId
      );
    }
  } catch (error) {
    console.error('Error sending interview scheduled notification:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════

async function sendApplicationStatusEmail(
  email: string,
  talentName: string,
  opportunityTitle: string,
  organizationName: string,
  status: string,
  statusLabel: string,
  applicationId: string
): Promise<void> {
  const applicationLink = `${APP_URL}/my-applications/${applicationId}`;
  const statusColor = status === 'ACCEPTED' ? '#10B981'
    : status === 'REJECTED' ? '#EF4444'
    : status === 'IN_REVIEW' ? '#3B82F6'
    : BRAND_BLUE;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table style="width:100%;max-width:500px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <tr><td style="padding:40px 40px 20px;text-align:center;"><img src="https://etudesk.com/etudesk_logo_blue.png" alt="Etudesk" style="height:36px;width:auto;"/></td></tr>
          <tr>
            <td style="padding:20px 40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a4a4a;">Bonjour ${talentName},</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#4a4a4a;">Le statut de votre candidature a été mis à jour.</p>
              <div style="background-color:${statusColor}10;border-radius:8px;padding:20px;margin-bottom:24px;border-left:4px solid ${statusColor};">
                <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">${opportunityTitle}</p>
                <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">${organizationName}</p>
                <p style="margin:0;font-size:18px;font-weight:600;color:${statusColor};">${statusLabel}</p>
              </div>
              <div style="text-align:center;margin-bottom:20px;">
                <a href="${applicationLink}" style="display:inline-block;background-color:${BRAND_BLUE};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Voir ma candidature</a>
              </div>
            </td>
          </tr>
          <tr><td style="padding:24px 40px;background-color:#f8f9fa;border-radius:0 0 12px 12px;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">© ${new Date().getFullYear()} Etudesk</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  await sendEmail({
    to: email,
    subject: `Candidature mise à jour: ${statusLabel}`,
    html,
    text: `Bonjour ${talentName},\n\nVotre candidature pour "${opportunityTitle}" chez ${organizationName} est maintenant: ${statusLabel}.\n\nVoir: ${applicationLink}`,
  });
}

async function sendNewMessageEmail(
  email: string,
  talentName: string,
  organizationName: string,
  opportunityTitle: string,
  messageContent: string,
  applicationId: string
): Promise<void> {
  const applicationLink = `${APP_URL}/my-applications/${applicationId}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table style="width:100%;max-width:500px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <tr><td style="padding:40px 40px 20px;text-align:center;"><img src="https://etudesk.com/etudesk_logo_blue.png" alt="Etudesk" style="height:36px;width:auto;"/></td></tr>
          <tr>
            <td style="padding:20px 40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a4a4a;">Bonjour ${talentName},</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#4a4a4a;">Vous avez reçu un nouveau message de <strong>${organizationName}</strong>.</p>
              <div style="background-color:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">${opportunityTitle}</p>
                <p style="margin:0;font-size:14px;color:#374151;font-style:italic;">"${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}"</p>
              </div>
              <div style="text-align:center;margin-bottom:20px;">
                <a href="${applicationLink}" style="display:inline-block;background-color:${BRAND_BLUE};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Répondre</a>
              </div>
            </td>
          </tr>
          <tr><td style="padding:24px 40px;background-color:#f8f9fa;border-radius:0 0 12px 12px;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">© ${new Date().getFullYear()} Etudesk</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  await sendEmail({
    to: email,
    subject: `Nouveau message de ${organizationName}`,
    html,
    text: `Bonjour ${talentName},\n\nMessage de ${organizationName} pour "${opportunityTitle}":\n\n"${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}"\n\nRépondre: ${applicationLink}`,
  });
}

async function sendNewApplicationEmail(
  email: string,
  memberName: string,
  talentName: string,
  opportunityTitle: string,
  applicationId: string
): Promise<void> {
  const applicationLink = `${APP_URL}/gestion/applications/${applicationId}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table style="width:100%;max-width:500px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <tr><td style="padding:40px 40px 20px;text-align:center;"><img src="https://etudesk.com/etudesk_logo_blue.png" alt="Etudesk" style="height:36px;width:auto;"/></td></tr>
          <tr>
            <td style="padding:20px 40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a4a4a;">Bonjour ${memberName},</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#4a4a4a;">Une nouvelle candidature a été reçue!</p>
              <div style="background-color:${BRAND_BLUE}10;border-radius:8px;padding:20px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:${BRAND_BLUE};">${talentName}</p>
                <p style="margin:0;font-size:14px;color:#6b7280;">a postulé pour "${opportunityTitle}"</p>
              </div>
              <div style="text-align:center;margin-bottom:20px;">
                <a href="${applicationLink}" style="display:inline-block;background-color:${BRAND_BLUE};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Voir la candidature</a>
              </div>
            </td>
          </tr>
          <tr><td style="padding:24px 40px;background-color:#f8f9fa;border-radius:0 0 12px 12px;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">© ${new Date().getFullYear()} Etudesk</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  await sendEmail({
    to: email,
    subject: `Nouvelle candidature: ${talentName}`,
    html,
    text: `Bonjour ${memberName},\n\n${talentName} a postulé pour "${opportunityTitle}".\n\nVoir: ${applicationLink}`,
  });
}

async function sendInterviewScheduledEmail(
  email: string,
  talentName: string,
  opportunityTitle: string,
  organizationName: string,
  interviewDate: string,
  interviewType: string,
  interviewLocation: string | undefined,
  applicationId: string
): Promise<void> {
  const applicationLink = `${APP_URL}/my-applications/${applicationId}`;
  const formattedDate = new Date(interviewDate).toLocaleString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table style="width:100%;max-width:500px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
          <tr><td style="padding:40px 40px 20px;text-align:center;"><img src="https://etudesk.com/etudesk_logo_blue.png" alt="Etudesk" style="height:36px;width:auto;"/></td></tr>
          <tr>
            <td style="padding:20px 40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#4a4a4a;">Bonjour ${talentName},</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#4a4a4a;">Un entretien a été programmé!</p>
              <div style="background-color:#8B5CF610;border-radius:8px;padding:20px;margin-bottom:24px;border-left:4px solid #8B5CF6;">
                <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">${opportunityTitle} • ${organizationName}</p>
                <p style="margin:0 0 12px;font-size:18px;font-weight:600;color:#8B5CF6;">📅 ${formattedDate}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Type:</strong> ${interviewType}</p>
                ${interviewLocation ? `<p style="margin:8px 0 0;font-size:14px;color:#374151;"><strong>Lieu/Lien:</strong> ${interviewLocation}</p>` : ''}
              </div>
              <div style="text-align:center;margin-bottom:20px;">
                <a href="${applicationLink}" style="display:inline-block;background-color:${BRAND_BLUE};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Voir les détails</a>
              </div>
            </td>
          </tr>
          <tr><td style="padding:24px 40px;background-color:#f8f9fa;border-radius:0 0 12px 12px;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">© ${new Date().getFullYear()} Etudesk</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  await sendEmail({
    to: email,
    subject: `Entretien programmé: ${opportunityTitle}`,
    html,
    text: `Bonjour ${talentName},\n\nEntretien programmé pour "${opportunityTitle}" chez ${organizationName}.\n\nDate: ${formattedDate}\nType: ${interviewType}${interviewLocation ? `\nLieu: ${interviewLocation}` : ''}\n\nVoir: ${applicationLink}`,
  });
}

/**
 * Notify organization members when a new space booking is created
 */
export async function notifyNewBooking(bookingId: string): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        sb.id,
        sb.talent_id,
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

    // Get organization members
    const orgMembers = await pool.query(
      `SELECT om.talent_id, t.email, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name
       FROM organization_members om
       JOIN talents t ON om.talent_id = t.id
       WHERE om.organization_id = $1`,
      [booking.organization_id]
    );

    const title = 'Nouvelle demande de réservation';
    const body = `${booking.talent_name} souhaite réserver "${booking.space_name}"`;

    for (const member of orgMembers.rows) {
      const prefs = await getPreferences(member.talent_id);

      // Send push
      if (prefs.push_enabled !== false && prefs.notify_applications !== false) {
        await sendToUser(member.talent_id, {
          type: 'BOOKING',
          title,
          body,
          data: {
            bookingId,
            talentName: booking.talent_name,
            spaceName: booking.space_name,
            screen: 'org-booking-details',
          },
        });
      }
    }
  } catch (error) {
    console.error('Error sending new booking notification:', error);
  }
}
