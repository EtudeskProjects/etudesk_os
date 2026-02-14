/**
 * Community Notification Service
 *
 * Thin wrapper over the unified notification.service.ts.
 * Provides community-specific convenience methods (notifyNewActivity,
 * notifyMentions, scheduleEventReminders, etc.) while delegating all
 * persistence and push delivery to the unified service.
 */

import { pool } from './database';
import {
  CommunityNotification,
  CommunityNotificationType,
  NotificationFilters,
} from '../types/community-activity.types';
import * as notificationService from './notification.service';
import { logger } from '../utils';

interface CreateCommunityNotificationDTO {
  talent_id: string;
  community_id: string;
  type: CommunityNotificationType;
  activity_id?: string;
  comment_id?: string;
  actor_id?: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  scheduled_for?: Date;
}

export class CommunityNotificationService {

  /**
   * Create a community notification (delegates to unified service)
   */
  async createNotification(dto: CreateCommunityNotificationDTO): Promise<CommunityNotification> {
    const id = await notificationService.create({
      talentId: dto.talent_id,
      type: dto.type,
      title: dto.title,
      body: dto.body || '',
      data: dto.data,
      communityId: dto.community_id,
      activityId: dto.activity_id,
      commentId: dto.comment_id,
      actorId: dto.actor_id,
      scheduledFor: dto.scheduled_for,
    });

    // Return the created notification for backward compat
    const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * Get notifications for a user (queries unified table)
   */
  async getNotifications(filters: NotificationFilters): Promise<{
    data: CommunityNotification[];
    unread_count: number;
    total: number;
  }> {
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    const params: any[] = [filters.talent_id];
    let paramIndex = 2;
    const conditions: string[] = ['n.talent_id = $1'];

    // Community notifications only: filter by community_id IS NOT NULL
    if (filters.community_id) {
      conditions.push(`n.community_id = $${paramIndex++}`);
      params.push(filters.community_id);
    } else {
      conditions.push('n.community_id IS NOT NULL');
    }

    if (filters.type) {
      conditions.push(`n.type = $${paramIndex++}`);
      params.push(filters.type);
    }

    if (filters.unread_only) {
      conditions.push('n.read_at IS NULL');
    }

    // Only show sent notifications
    conditions.push('(n.scheduled_for IS NULL OR n.sent_at IS NOT NULL)');

    const whereClause = conditions.join(' AND ');

    const [notificationsResult, unreadResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT n.*,
          CASE WHEN n.actor_id IS NOT NULL THEN
            json_build_object(
              'id', actor.id,
              'display_name', COALESCE(actor.first_name || ' ' || actor.last_name, actor.email),
              'avatar_url', actor.avatar_url
            )
          ELSE NULL END as actor,
          json_build_object(
            'id', c.id,
            'name', c.name,
            'slug', c.slug
          ) as community
        FROM notifications n
        LEFT JOIN talents actor ON n.actor_id = actor.id
        LEFT JOIN communities c ON n.community_id = c.id
        WHERE ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM notifications
         WHERE talent_id = $1 AND community_id IS NOT NULL AND read_at IS NULL
         AND (scheduled_for IS NULL OR sent_at IS NOT NULL)`,
        [filters.talent_id]
      ),
      pool.query(
        `SELECT COUNT(*) FROM notifications n WHERE ${whereClause}`,
        params
      ),
    ]);

    return {
      data: notificationsResult.rows,
      unread_count: parseInt(unreadResult.rows[0].count),
      total: parseInt(totalResult.rows[0].count),
    };
  }

  /**
   * Mark notifications as read (in unified table)
   */
  async markAsRead(
    talentId: string,
    notificationIds?: string[],
    communityId?: string
  ): Promise<number> {
    let query: string;
    let params: any[];

    if (notificationIds && notificationIds.length > 0) {
      query = `
        UPDATE notifications
        SET read_at = NOW()
        WHERE talent_id = $1 AND id = ANY($2) AND read_at IS NULL
      `;
      params = [talentId, notificationIds];
    } else if (communityId) {
      query = `
        UPDATE notifications
        SET read_at = NOW()
        WHERE talent_id = $1 AND community_id = $2 AND read_at IS NULL
      `;
      params = [talentId, communityId];
    } else {
      query = `
        UPDATE notifications
        SET read_at = NOW()
        WHERE talent_id = $1 AND community_id IS NOT NULL AND read_at IS NULL
      `;
      params = [talentId];
    }

    const result = await pool.query(query, params);
    return result.rowCount || 0;
  }

  /**
   * Get unread notification count by community (from unified table)
   */
  async getUnreadCounts(talentId: string): Promise<Array<{ community_id: string; count: number; community_name?: string }>> {
    const result = await pool.query(`
      SELECT n.community_id, COUNT(*)::int as count, c.name as community_name
      FROM notifications n
      LEFT JOIN communities c ON n.community_id = c.id
      WHERE n.talent_id = $1 AND n.community_id IS NOT NULL AND n.read_at IS NULL
        AND (n.scheduled_for IS NULL OR n.sent_at IS NOT NULL)
      GROUP BY n.community_id, c.name
    `, [talentId]);

    return result.rows;
  }

  /**
   * Notify all community members of a new activity
   */
  async notifyNewActivity(activityId: string, communityId: string, authorId: string): Promise<void> {
    const activityRes = await pool.query(
      'SELECT type, content FROM community_activities WHERE id = $1',
      [activityId]
    );
    if (activityRes.rows.length === 0) return;

    const activity = activityRes.rows[0];

    const authorRes = await pool.query(
      'SELECT COALESCE(first_name || \' \' || last_name, email) as display_name FROM talents WHERE id = $1',
      [authorId]
    );
    const authorName = authorRes.rows[0]?.display_name || 'Quelqu\'un';

    const membersRes = await pool.query(`
      SELECT talent_id FROM community_members
      WHERE community_id = $1
        AND talent_id != $2
        AND status = 'ACTIVE'
    `, [communityId, authorId]);

    if (membersRes.rows.length === 0) return;

    const title = 'Nouvelle publication';
    const body = `${authorName} a publie ${activity.type === 'EVENT' ? 'un evenement' : activity.type === 'POLL' ? 'un sondage' : 'une publication'}`;

    const dtos = membersRes.rows.map(row => ({
      talentId: row.talent_id,
      type: 'NEW_ACTIVITY' as notificationService.NotificationType,
      title,
      body,
      communityId,
      activityId,
      actorId: authorId,
      data: { type: 'NEW_ACTIVITY', communityId, activityId },
    }));

    await notificationService.createBatch(dtos);
  }

  /**
   * Notify mentioned users
   */
  async notifyMentions(
    mentionedUserIds: string[],
    communityId: string,
    activityId: string,
    commentId: string,
    actorId: string
  ): Promise<void> {
    if (mentionedUserIds.length === 0) return;

    const actorRes = await pool.query(
      'SELECT COALESCE(first_name || \' \' || last_name, email) as display_name FROM talents WHERE id = $1',
      [actorId]
    );
    const actorName = actorRes.rows[0]?.display_name || 'Quelqu\'un';

    const filteredMentions = mentionedUserIds.filter(id => id !== actorId);
    if (filteredMentions.length === 0) return;

    const title = 'Vous avez ete mentionne';
    const body = `${actorName} vous a mentionne dans un commentaire`;

    const dtos = filteredMentions.map(talentId => ({
      talentId,
      type: 'MENTION' as notificationService.NotificationType,
      title,
      body,
      communityId,
      activityId,
      commentId,
      actorId,
      data: { type: 'MENTION', communityId, activityId, commentId },
    }));

    await notificationService.createBatch(dtos);
  }

  /**
   * Schedule event reminders (J-1 and H-1)
   */
  async scheduleEventReminders(activityId: string, communityId: string, eventDate: Date): Promise<void> {
    const membersRes = await pool.query(`
      SELECT talent_id FROM community_members
      WHERE community_id = $1 AND status = 'ACTIVE'
    `, [communityId]);

    if (membersRes.rows.length === 0) return;

    const activityRes = await pool.query(
      'SELECT content, metadata FROM community_activities WHERE id = $1',
      [activityId]
    );
    const activity = activityRes.rows[0];
    const eventTitle = activity.content.substring(0, 50);

    const oneDayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    const oneHourBefore = new Date(eventDate.getTime() - 60 * 60 * 1000);
    const now = new Date();

    // J-1 reminders
    if (oneDayBefore > now) {
      const dtos = membersRes.rows.map(row => ({
        talentId: row.talent_id,
        type: 'EVENT_REMINDER_1D' as notificationService.NotificationType,
        title: 'Evenement demain',
        body: `Rappel: "${eventTitle}" a lieu demain`,
        communityId,
        activityId,
        data: { type: 'EVENT_REMINDER', communityId, activityId },
        scheduledFor: oneDayBefore,
      }));
      await notificationService.createBatch(dtos);
    }

    // H-1 reminders
    if (oneHourBefore > now) {
      const dtos = membersRes.rows.map(row => ({
        talentId: row.talent_id,
        type: 'EVENT_REMINDER_1H' as notificationService.NotificationType,
        title: 'Evenement dans 1 heure',
        body: `Rappel: "${eventTitle}" commence dans 1 heure`,
        communityId,
        activityId,
        data: { type: 'EVENT_REMINDER', communityId, activityId },
        scheduledFor: oneHourBefore,
      }));
      await notificationService.createBatch(dtos);
    }
  }

  /**
   * Process scheduled notifications — delegates to unified service
   */
  async processScheduledNotifications(): Promise<number> {
    return notificationService.processScheduled();
  }

  /**
   * Delete old notifications — delegates to unified service
   */
  async deleteOldNotifications(olderThanDays: number = 90): Promise<number> {
    return notificationService.cleanup(olderThanDays);
  }

  /**
   * Notify membership approved
   */
  async notifyMembershipApproved(
    talentId: string, communityId: string, communityName: string
  ): Promise<void> {
    await this.createNotification({
      talent_id: talentId,
      community_id: communityId,
      type: 'MEMBERSHIP_APPROVED',
      title: 'Demande acceptee',
      body: `Votre demande d'adhesion a "${communityName}" a ete acceptee. Bienvenue!`,
      data: { communityId },
    });
  }

  /**
   * Notify membership rejected
   */
  async notifyMembershipRejected(
    talentId: string, communityId: string, communityName: string, reason?: string
  ): Promise<void> {
    await this.createNotification({
      talent_id: talentId,
      community_id: communityId,
      type: 'MEMBERSHIP_REJECTED',
      title: 'Demande refusee',
      body: reason || `Votre demande d'adhesion a "${communityName}" n'a pas ete acceptee.`,
      data: { rejection_reason: reason, communityId },
    });
  }
}

export const communityNotificationService = new CommunityNotificationService();
