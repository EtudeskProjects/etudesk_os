/**
 * Notification Service
 *
 * Handles sending notifications via:
 * - Email (using existing email service)
 * - Push notifications (Expo)
 * - In-app notifications (stored in database)
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from './database';
import { sendEmail } from './email.service';

import { logger } from '../utils';
// Notification types
export type NotificationType =
  | 'APPLICATION_STATUS_CHANGED'
  | 'NEW_MESSAGE'
  | 'NEW_APPLICATION'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_REMINDER'
  | 'INVITATION_RECEIVED'
  | 'SYSTEM';

// Status labels for notifications - Simplified to 4 statuses
const APPLICATION_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Soumise',
  IN_REVIEW: 'En cours d\'examen',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Non retenue',
};

// ═══════════════════════════════════════════════════════════════
// BRAND DESIGN SYSTEM - Luxe Africain
// ═══════════════════════════════════════════════════════════════
const BRAND_PRIMARY = '#3B2416';
const BRAND_PRIMARY_LIGHT = '#5C3D2E';
const BRAND_SUCCESS = '#4A6741';
const BRAND_ERROR = '#8B4A3C';

// Logo URL (web assets)
const LOGO_URL = 'https://etudesk.org/images/etudesk_logo_black.png';

export interface NotificationData {
  talentId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceType?: string;
  referenceId?: string;
  data?: Record<string, any>;
}

export interface NotificationPreferences {
  email_application_status: boolean;
  email_new_message: boolean;
  email_new_application: boolean;
  email_interview_reminder: boolean;
  push_application_status: boolean;
  push_new_message: boolean;
  push_new_application: boolean;
  push_interview_reminder: boolean;
}

/**
 * Get or create notification preferences for a talent
 */
export async function getNotificationPreferences(talentId: string): Promise<NotificationPreferences> {
  // Try to get existing preferences
  const result = await pool.query(
    'SELECT * FROM notification_preferences WHERE talent_id = $1',
    [talentId]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  // Create default preferences
  const id = uuidv4();
  const insertResult = await pool.query(
    `INSERT INTO notification_preferences (id, talent_id)
     VALUES ($1, $2)
     RETURNING *`,
    [id, talentId]
  );

  return insertResult.rows[0];
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  talentId: string,
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Build dynamic update query
  for (const [key, value] of Object.entries(preferences)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    return getNotificationPreferences(talentId);
  }

  values.push(talentId);

  const result = await pool.query(
    `UPDATE notification_preferences
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE talent_id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    // Create preferences first if they don't exist
    await getNotificationPreferences(talentId);
    return updateNotificationPreferences(talentId, preferences);
  }

  return result.rows[0];
}

/**
 * Create a notification in the database
 */
export async function createNotification(data: NotificationData): Promise<string> {
  const id = uuidv4();

  await pool.query(
    `INSERT INTO notifications (id, talent_id, type, title, body, reference_type, reference_id, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      data.talentId,
      data.type,
      data.title,
      data.body,
      data.referenceType || null,
      data.referenceId || null,
      data.data ? JSON.stringify(data.data) : '{}',
    ]
  );

  return id;
}

/**
 * Send push notification via Expo
 */
export async function sendPushNotification(
  talentId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get active push tokens for the talent
    const tokensResult = await pool.query(
      'SELECT token FROM push_tokens WHERE talent_id = $1 AND is_active = TRUE',
      [talentId]
    );

    if (tokensResult.rows.length === 0) {
      return { success: true }; // No tokens, nothing to send
    }

    const tokens = tokensResult.rows.map(row => row.token);

    // Prepare Expo push messages
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    // Send to Expo push notification service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Expo push error:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json() as { data?: Array<{ status: string; details?: { error?: string } }> };

    // Handle invalid tokens
    if (result.data) {
      for (let i = 0; i < result.data.length; i++) {
        const ticket = result.data[i];
        if (ticket.status === 'error') {
          if (ticket.details?.error === 'DeviceNotRegistered') {
            // Deactivate invalid token
            await pool.query(
              'UPDATE push_tokens SET is_active = FALSE WHERE token = $1',
              [tokens[i]]
            );
          }
        }
      }
    }

    logger.info(`📱 Push notification sent to ${tokens.length} device(s) for talent ${talentId}`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to send push notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Register a push token for a talent
 */
export async function registerPushToken(
  talentId: string,
  token: string,
  deviceType?: 'ios' | 'android' | 'web',
  deviceName?: string
): Promise<void> {
  const id = uuidv4();

  await pool.query(
    `INSERT INTO push_tokens (id, talent_id, token, device_type, device_name)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (token) DO UPDATE SET
       talent_id = $2,
       device_type = $4,
       device_name = $5,
       is_active = TRUE,
       last_used_at = NOW(),
       updated_at = NOW()`,
    [id, talentId, token, deviceType || null, deviceName || null]
  );

  logger.info(`📱 Push token registered for talent ${talentId}`);
}

/**
 * Unregister a push token
 */
export async function unregisterPushToken(token: string): Promise<void> {
  await pool.query(
    'UPDATE push_tokens SET is_active = FALSE, updated_at = NOW() WHERE token = $1',
    [token]
  );
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

/**
 * Send notification for application status change
 */
export async function notifyApplicationStatusChanged(
  applicationId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  try {
    // Get application details with talent and opportunity info
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

    const title = `Candidature mise à jour`;
    const body = `Votre candidature pour "${app.opportunity_title}" est maintenant: ${statusLabel}`;

    // Get preferences
    const prefs = await getNotificationPreferences(app.talent_id);

    // Create in-app notification
    const notificationId = await createNotification({
      talentId: app.talent_id,
      type: 'APPLICATION_STATUS_CHANGED',
      title,
      body,
      referenceType: 'application',
      referenceId: applicationId,
      data: { oldStatus, newStatus, opportunityTitle: app.opportunity_title },
    });

    // Send email if enabled
    if (prefs.email_application_status) {
      await sendApplicationStatusEmail(
        app.talent_email,
        app.talent_name,
        app.opportunity_title,
        app.organization_name,
        newStatus,
        statusLabel,
        applicationId
      );

      // Mark email as sent
      await pool.query(
        'UPDATE notifications SET email_sent = TRUE, email_sent_at = NOW() WHERE id = $1',
        [notificationId]
      );
    }

    // Send push if enabled
    if (prefs.push_application_status) {
      await sendPushNotification(app.talent_id, title, body, {
        type: 'APPLICATION_STATUS_CHANGED',
        applicationId,
        newStatus,
      });

      // Mark push as sent
      await pool.query(
        'UPDATE notifications SET push_sent = TRUE, push_sent_at = NOW() WHERE id = $1',
        [notificationId]
      );
    }
  } catch (error) {
    logger.error('Error sending application status notification:', error);
  }
}

/**
 * Send notification for new message
 */
export async function notifyNewMessage(
  applicationId: string,
  messageId: string,
  senderType: 'TALENT' | 'ORGANIZATION'
): Promise<void> {
  try {
    // Get message and application details
    const result = await pool.query(`
      SELECT
        m.id as message_id,
        m.content,
        m.sender_type,
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
      const title = `Nouveau message de ${msg.organization_name}`;
      const body = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');

      const prefs = await getNotificationPreferences(msg.talent_id);

      const notificationId = await createNotification({
        talentId: msg.talent_id,
        type: 'NEW_MESSAGE',
        title,
        body,
        referenceType: 'message',
        referenceId: messageId,
        data: { applicationId, opportunityTitle: msg.opportunity_title },
      });

      if (prefs.email_new_message) {
        await sendNewMessageEmail(
          msg.talent_email,
          msg.talent_name,
          msg.organization_name,
          msg.opportunity_title,
          msg.content,
          applicationId
        );

        await pool.query(
          'UPDATE notifications SET email_sent = TRUE, email_sent_at = NOW() WHERE id = $1',
          [notificationId]
        );
      }

      if (prefs.push_new_message) {
        await sendPushNotification(msg.talent_id, title, body, {
          type: 'NEW_MESSAGE',
          applicationId,
          messageId,
        });

        await pool.query(
          'UPDATE notifications SET push_sent = TRUE, push_sent_at = NOW() WHERE id = $1',
          [notificationId]
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

        const prefs = await getNotificationPreferences(member.talent_id);

        const notificationId = await createNotification({
          talentId: member.talent_id,
          type: 'NEW_MESSAGE',
          title,
          body,
          referenceType: 'message',
          referenceId: messageId,
          data: { applicationId, opportunityTitle: msg.opportunity_title, talentName: msg.talent_name },
        });

        if (prefs.push_new_message) {
          await sendPushNotification(member.talent_id, title, body, {
            type: 'NEW_MESSAGE',
            applicationId,
            messageId,
          });

          await pool.query(
            'UPDATE notifications SET push_sent = TRUE, push_sent_at = NOW() WHERE id = $1',
            [notificationId]
          );
        }
      }
    }
  } catch (error) {
    logger.error('Error sending new message notification:', error);
  }
}

/**
 * Send notification for new application (to organization)
 */
export async function notifyNewApplication(applicationId: string): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.talent_id,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        t.email as talent_email,
        o.title as opportunity_title,
        o.organization_id,
        org.name as organization_name
      FROM opportunity_applications a
      JOIN talents t ON a.talent_id = t.id
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN organizations org ON o.organization_id = org.id
      WHERE a.id = $1
    `, [applicationId]);

    if (result.rows.length === 0) return;

    const app = result.rows[0];

    // Get organization members to notify
    const orgMembers = await pool.query(
      `SELECT om.talent_id, t.email, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name
       FROM organization_members om
       JOIN talents t ON om.talent_id = t.id
       WHERE om.organization_id = $1`,
      [app.organization_id]
    );

    const title = `Nouvelle candidature`;
    const body = `${app.talent_name} a postulé pour "${app.opportunity_title}"`;

    for (const member of orgMembers.rows) {
      const prefs = await getNotificationPreferences(member.talent_id);

      const notificationId = await createNotification({
        talentId: member.talent_id,
        type: 'NEW_APPLICATION',
        title,
        body,
        referenceType: 'application',
        referenceId: applicationId,
        data: { opportunityTitle: app.opportunity_title, talentName: app.talent_name },
      });

      if (prefs.email_new_application) {
        await sendNewApplicationEmail(
          member.email,
          member.display_name,
          app.talent_name,
          app.opportunity_title,
          applicationId
        );

        await pool.query(
          'UPDATE notifications SET email_sent = TRUE, email_sent_at = NOW() WHERE id = $1',
          [notificationId]
        );
      }

      if (prefs.push_new_application) {
        await sendPushNotification(member.talent_id, title, body, {
          type: 'NEW_APPLICATION',
          applicationId,
        });

        await pool.query(
          'UPDATE notifications SET push_sent = TRUE, push_sent_at = NOW() WHERE id = $1',
          [notificationId]
        );
      }
    }
  } catch (error) {
    logger.error('Error sending new application notification:', error);
  }
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

async function sendApplicationStatusEmail(
  email: string,
  talentName: string,
  opportunityTitle: string,
  organizationName: string,
  status: string,
  statusLabel: string,
  applicationId: string
): Promise<void> {
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const applicationLink = `${appUrl}/my-applications/${applicationId}`;

  // Semantic colors from Luxe Africain design system
  const statusColor = status === 'ACCEPTED' ? BRAND_SUCCESS
    : status === 'REJECTED' ? BRAND_ERROR
      : status === 'IN_REVIEW' ? '#A67C52' // Warning/Info tone
        : BRAND_PRIMARY;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mise à jour de votre candidature</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #FAF9F7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="${LOGO_URL}" alt="Etudesk" style="height: 36px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #4a4a4a;">
                Bonjour ${talentName},
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Le statut de votre candidature a été mis à jour.
              </p>

              <!-- Status Card -->
              <div style="background-color: ${statusColor}10; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid ${statusColor};">
                <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                  ${opportunityTitle}
                </p>
                <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af;">
                  ${organizationName}
                </p>
                <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${statusColor};">
                  ${statusLabel}
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${applicationLink}" style="display: inline-block; background-color: ${BRAND_PRIMARY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Voir ma candidature
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #F5F3F0; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} Etudesk. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await sendEmail({
    to: email,
    subject: `Candidature mise à jour: ${statusLabel}`,
    html,
    text: `Bonjour ${talentName},\n\nLe statut de votre candidature pour "${opportunityTitle}" chez ${organizationName} est maintenant: ${statusLabel}.\n\nVoir votre candidature: ${applicationLink}\n\n© ${new Date().getFullYear()} Etudesk.`,
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
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const applicationLink = `${appUrl}/my-applications/${applicationId}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouveau message</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #FAF9F7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="${LOGO_URL}" alt="Etudesk" style="height: 36px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #4a4a4a;">
                Bonjour ${talentName},
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Vous avez reçu un nouveau message de <strong>${organizationName}</strong> concernant votre candidature.
              </p>

              <!-- Message Preview -->
              <div style="background-color: #F5F3F0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280;">
                  ${opportunityTitle}
                </p>
                <p style="margin: 0; font-size: 14px; color: #374151; font-style: italic;">
                  "${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}"
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${applicationLink}" style="display: inline-block; background-color: ${BRAND_PRIMARY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Répondre au message
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #F5F3F0; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} Etudesk. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await sendEmail({
    to: email,
    subject: `Nouveau message de ${organizationName}`,
    html,
    text: `Bonjour ${talentName},\n\nVous avez reçu un nouveau message de ${organizationName} concernant votre candidature pour "${opportunityTitle}".\n\nMessage: "${messageContent.substring(0, 200)}${messageContent.length > 200 ? '...' : ''}"\n\nRépondre: ${applicationLink}\n\n© ${new Date().getFullYear()} Etudesk.`,
  });
}

async function sendNewApplicationEmail(
  email: string,
  memberName: string,
  talentName: string,
  opportunityTitle: string,
  applicationId: string
): Promise<void> {
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const applicationLink = `${appUrl}/gestion/applications/${applicationId}`;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nouvelle candidature</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #FAF9F7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="${LOGO_URL}" alt="Etudesk" style="height: 36px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #4a4a4a;">
                Bonjour ${memberName},
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Une nouvelle candidature a été reçue!
              </p>

              <!-- Application Card -->
              <div style="background-color: ${BRAND_PRIMARY}10; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: ${BRAND_PRIMARY};">
                  ${talentName}
                </p>
                <p style="margin: 0; font-size: 14px; color: #6b7280;">
                  a postulé pour "${opportunityTitle}"
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${applicationLink}" style="display: inline-block; background-color: ${BRAND_PRIMARY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Voir la candidature
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #F5F3F0; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} Etudesk. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await sendEmail({
    to: email,
    subject: `Nouvelle candidature: ${talentName}`,
    html,
    text: `Bonjour ${memberName},\n\n${talentName} a postulé pour "${opportunityTitle}".\n\nVoir la candidature: ${applicationLink}\n\n© ${new Date().getFullYear()} Etudesk.`,
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
  const appUrl = process.env.APP_URL || 'https://etudesk.com';
  const applicationLink = `${appUrl}/my-applications/${applicationId}`;

  const formattedDate = new Date(interviewDate).toLocaleString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Entretien programmé</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #FAF9F7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <img src="${LOGO_URL}" alt="Etudesk" style="height: 36px; width: auto;" />
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #4a4a4a;">
                Bonjour ${talentName},
              </p>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                Un entretien a été programmé pour votre candidature!
              </p>

              <!-- Interview Card -->
              <div style="background-color: ${BRAND_PRIMARY_LIGHT}10; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid ${BRAND_PRIMARY_LIGHT};">
                <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                  ${opportunityTitle} • ${organizationName}
                </p>
                <p style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: ${BRAND_PRIMARY_LIGHT};">
                  📅 ${formattedDate}
                </p>
                <p style="margin: 0; font-size: 14px; color: #374151;">
                  <strong>Type:</strong> ${interviewType}
                </p>
                ${interviewLocation ? `<p style="margin: 8px 0 0; font-size: 14px; color: #374151;"><strong>Lieu/Lien:</strong> ${interviewLocation}</p>` : ''}
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${applicationLink}" style="display: inline-block; background-color: ${BRAND_PRIMARY}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Voir les détails
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #F5F3F0; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                © ${new Date().getFullYear()} Etudesk. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  await sendEmail({
    to: email,
    subject: `Entretien programmé: ${opportunityTitle}`,
    html,
    text: `Bonjour ${talentName},\n\nUn entretien a été programmé pour votre candidature!\n\n${opportunityTitle} • ${organizationName}\n\nDate: ${formattedDate}\nType: ${interviewType}${interviewLocation ? `\nLieu/Lien: ${interviewLocation}` : ''}\n\nVoir les détails: ${applicationLink}\n\n© ${new Date().getFullYear()} Etudesk.`,
  });
}
