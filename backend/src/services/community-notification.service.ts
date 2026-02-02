import { pool } from './database';
import {
    CommunityNotification,
    CommunityNotificationType,
    NotificationFilters
} from '../types/community-activity.types';
import { sendPushNotification } from './notification.service';

interface CreateNotificationDTO {
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
     * Create a new community notification
     */
    async createNotification(dto: CreateNotificationDTO): Promise<CommunityNotification> {
        const query = `
            INSERT INTO community_notifications (
                talent_id, community_id, type, activity_id, comment_id,
                actor_id, title, body, data, scheduled_for
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;

        const result = await pool.query(query, [
            dto.talent_id,
            dto.community_id,
            dto.type,
            dto.activity_id || null,
            dto.comment_id || null,
            dto.actor_id || null,
            dto.title,
            dto.body || null,
            dto.data ? JSON.stringify(dto.data) : '{}',
            dto.scheduled_for || null
        ]);

        const notification = result.rows[0];

        // Send push notification if not scheduled
        if (!dto.scheduled_for) {
            this.sendPush(dto.talent_id, dto.title, dto.body || '', {
                type: dto.type,
                community_id: dto.community_id,
                activity_id: dto.activity_id,
                notification_id: notification.id
            }).catch(err => console.error('Failed to send push:', err));
        }

        return notification;
    }

    /**
     * Get notifications for a user
     */
    async getNotifications(filters: NotificationFilters): Promise<{
        data: CommunityNotification[],
        unread_count: number,
        total: number
    }> {
        const params: any[] = [filters.talent_id];
        let paramIndex = 2;

        let whereClause = 'WHERE cn.talent_id = $1';

        if (filters.community_id) {
            whereClause += ` AND cn.community_id = $${paramIndex++}`;
            params.push(filters.community_id);
        }

        if (filters.type) {
            whereClause += ` AND cn.type = $${paramIndex++}`;
            params.push(filters.type);
        }

        if (filters.unread_only) {
            whereClause += ' AND cn.read_at IS NULL';
        }

        const limit = filters.limit || 20;
        const offset = filters.offset || 0;

        // Get notifications with related data
        const query = `
            SELECT
                cn.*,
                json_build_object(
                    'id', actor.id,
                    'display_name', COALESCE(actor.first_name || ' ' || actor.last_name, actor.email),
                    'avatar_url', actor.avatar_url
                ) as actor,
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'slug', c.slug
                ) as community
            FROM community_notifications cn
            LEFT JOIN talents actor ON cn.actor_id = actor.id
            JOIN communities c ON cn.community_id = c.id
            ${whereClause}
            ORDER BY cn.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get unread count
        const unreadResult = await pool.query(
            `SELECT COUNT(*) FROM community_notifications WHERE talent_id = $1 AND read_at IS NULL`,
            [filters.talent_id]
        );

        // Get total count
        const totalResult = await pool.query(
            `SELECT COUNT(*) FROM community_notifications cn ${whereClause}`,
            params.slice(0, paramIndex - 3) // Exclude limit and offset
        );

        return {
            data: result.rows,
            unread_count: parseInt(unreadResult.rows[0].count),
            total: parseInt(totalResult.rows[0].count)
        };
    }

    /**
     * Mark notifications as read
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
                UPDATE community_notifications
                SET read_at = NOW()
                WHERE talent_id = $1 AND id = ANY($2) AND read_at IS NULL
            `;
            params = [talentId, notificationIds];
        } else if (communityId) {
            query = `
                UPDATE community_notifications
                SET read_at = NOW()
                WHERE talent_id = $1 AND community_id = $2 AND read_at IS NULL
            `;
            params = [talentId, communityId];
        } else {
            query = `
                UPDATE community_notifications
                SET read_at = NOW()
                WHERE talent_id = $1 AND read_at IS NULL
            `;
            params = [talentId];
        }

        const result = await pool.query(query, params);
        return result.rowCount || 0;
    }

    /**
     * Get unread notification count by community
     */
    async getUnreadCounts(talentId: string): Promise<Array<{ community_id: string, count: number }>> {
        const result = await pool.query(`
            SELECT community_id, COUNT(*) as count
            FROM community_notifications
            WHERE talent_id = $1 AND read_at IS NULL
            GROUP BY community_id
        `, [talentId]);

        return result.rows;
    }

    /**
     * Notify all community members of a new activity
     */
    async notifyNewActivity(activityId: string, communityId: string, authorId: string): Promise<void> {
        // Get activity details
        const activityRes = await pool.query(
            'SELECT type, content FROM community_activities WHERE id = $1',
            [activityId]
        );
        if (activityRes.rows.length === 0) return;

        const activity = activityRes.rows[0];

        // Get author name
        const authorRes = await pool.query(
            'SELECT COALESCE(first_name || \' \' || last_name, email) as display_name FROM talents WHERE id = $1',
            [authorId]
        );
        const authorName = authorRes.rows[0]?.display_name || 'Quelqu\'un';

        // Get all active community members except the author
        const membersRes = await pool.query(`
            SELECT talent_id FROM community_members
            WHERE community_id = $1
              AND talent_id != $2
              AND status = 'ACTIVE'
        `, [communityId, authorId]);

        // Create notifications in batch
        if (membersRes.rows.length > 0) {
            const title = `Nouvelle publication`;
            const body = `${authorName} a publié ${activity.type === 'EVENT' ? 'un événement' : activity.type === 'POLL' ? 'un sondage' : 'une publication'}`;

            const values = membersRes.rows.map(row => [
                row.talent_id,
                communityId,
                'NEW_ACTIVITY',
                activityId,
                authorId,
                title,
                body
            ]);

            // Batch insert
            const placeholders = values.map((_, i) =>
                `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
            ).join(', ');

            const flatValues = values.flat();

            await pool.query(`
                INSERT INTO community_notifications
                (talent_id, community_id, type, activity_id, actor_id, title, body)
                VALUES ${placeholders}
            `, flatValues);
        }
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

        // Get actor name
        const actorRes = await pool.query(
            'SELECT COALESCE(first_name || \' \' || last_name, email) as display_name FROM talents WHERE id = $1',
            [actorId]
        );
        const actorName = actorRes.rows[0]?.display_name || 'Quelqu\'un';

        // Filter out the actor from mentions
        const filteredMentions = mentionedUserIds.filter(id => id !== actorId);
        if (filteredMentions.length === 0) return;

        const title = 'Vous avez été mentionné';
        const body = `${actorName} vous a mentionné dans un commentaire`;

        const values = filteredMentions.map(talentId => [
            talentId,
            communityId,
            'MENTION',
            activityId,
            commentId,
            actorId,
            title,
            body
        ]);

        const placeholders = values.map((_, i) =>
            `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
        ).join(', ');

        const flatValues = values.flat();

        await pool.query(`
            INSERT INTO community_notifications
            (talent_id, community_id, type, activity_id, comment_id, actor_id, title, body)
            VALUES ${placeholders}
        `, flatValues);
    }

    /**
     * Schedule event reminders (J-1 and H-1)
     */
    async scheduleEventReminders(activityId: string, communityId: string, eventDate: Date): Promise<void> {
        // Get all active community members
        const membersRes = await pool.query(`
            SELECT talent_id FROM community_members
            WHERE community_id = $1 AND status = 'ACTIVE'
        `, [communityId]);

        if (membersRes.rows.length === 0) return;

        // Get event details
        const activityRes = await pool.query(
            'SELECT content, metadata FROM community_activities WHERE id = $1',
            [activityId]
        );
        const activity = activityRes.rows[0];
        const eventTitle = activity.content.substring(0, 50);

        // Calculate reminder times
        const oneDayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
        const oneHourBefore = new Date(eventDate.getTime() - 60 * 60 * 1000);

        // Create J-1 reminders
        if (oneDayBefore > new Date()) {
            const values1D = membersRes.rows.map(row => [
                row.talent_id,
                communityId,
                'EVENT_REMINDER_1D',
                activityId,
                'Événement demain',
                `Rappel: "${eventTitle}" a lieu demain`,
                oneDayBefore
            ]);

            const placeholders1D = values1D.map((_, i) =>
                `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
            ).join(', ');

            await pool.query(`
                INSERT INTO community_notifications
                (talent_id, community_id, type, activity_id, title, body, scheduled_for)
                VALUES ${placeholders1D}
            `, values1D.flat());
        }

        // Create H-1 reminders
        if (oneHourBefore > new Date()) {
            const values1H = membersRes.rows.map(row => [
                row.talent_id,
                communityId,
                'EVENT_REMINDER_1H',
                activityId,
                'Événement dans 1 heure',
                `Rappel: "${eventTitle}" commence dans 1 heure`,
                oneHourBefore
            ]);

            const placeholders1H = values1H.map((_, i) =>
                `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
            ).join(', ');

            await pool.query(`
                INSERT INTO community_notifications
                (talent_id, community_id, type, activity_id, title, body, scheduled_for)
                VALUES ${placeholders1H}
            `, values1H.flat());
        }
    }

    /**
     * Process scheduled notifications (called by cron job)
     */
    async processScheduledNotifications(): Promise<number> {
        const result = await pool.query(`
            UPDATE community_notifications
            SET sent_at = NOW()
            WHERE scheduled_for IS NOT NULL
              AND scheduled_for <= NOW()
              AND sent_at IS NULL
            RETURNING *
        `);

        // Send push notifications for each
        for (const notification of result.rows) {
            await this.sendPush(
                notification.talent_id,
                notification.title,
                notification.body || '',
                {
                    type: notification.type,
                    community_id: notification.community_id,
                    activity_id: notification.activity_id,
                    notification_id: notification.id
                }
            ).catch(err => console.error('Failed to send scheduled push:', err));
        }

        return result.rowCount || 0;
    }

    /**
     * Delete old notifications (cleanup job)
     */
    async deleteOldNotifications(olderThanDays: number = 90): Promise<number> {
        const result = await pool.query(`
            DELETE FROM community_notifications
            WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
              AND read_at IS NOT NULL
        `);

        return result.rowCount || 0;
    }

    /**
     * Send push notification wrapper
     */
    private async sendPush(
        talentId: string,
        title: string,
        body: string,
        data: Record<string, unknown>
    ): Promise<void> {
        try {
            await sendPushNotification(talentId, title, body, data);
        } catch (err) {
            console.error('Push notification failed:', err);
        }
    }

    /**
     * Notify subscription expiring soon
     */
    async notifySubscriptionExpiring(
        talentId: string,
        communityId: string,
        communityName: string,
        expiresAt: Date
    ): Promise<void> {
        await this.createNotification({
            talent_id: talentId,
            community_id: communityId,
            type: 'SUBSCRIPTION_EXPIRING',
            title: 'Abonnement bientôt expiré',
            body: `Votre abonnement à "${communityName}" expire le ${expiresAt.toLocaleDateString('fr-FR')}`,
            data: { expires_at: expiresAt.toISOString() }
        });
    }

    /**
     * Notify subscription expired
     */
    async notifySubscriptionExpired(
        talentId: string,
        communityId: string,
        communityName: string
    ): Promise<void> {
        await this.createNotification({
            talent_id: talentId,
            community_id: communityId,
            type: 'SUBSCRIPTION_EXPIRED',
            title: 'Abonnement expiré',
            body: `Votre abonnement à "${communityName}" a expiré. Renouvelez pour continuer à accéder au contenu.`
        });
    }

    /**
     * Notify payment failed
     */
    async notifyPaymentFailed(
        talentId: string,
        communityId: string,
        communityName: string,
        reason?: string
    ): Promise<void> {
        await this.createNotification({
            talent_id: talentId,
            community_id: communityId,
            type: 'PAYMENT_FAILED',
            title: 'Échec du paiement',
            body: `Le paiement pour "${communityName}" a échoué. ${reason || 'Veuillez vérifier votre moyen de paiement.'}`,
            data: { failure_reason: reason }
        });
    }

    /**
     * Notify payment success
     */
    async notifyPaymentSuccess(
        talentId: string,
        communityId: string,
        communityName: string,
        amount: number,
        currency: string
    ): Promise<void> {
        await this.createNotification({
            talent_id: talentId,
            community_id: communityId,
            type: 'PAYMENT_SUCCESS',
            title: 'Paiement réussi',
            body: `Votre paiement de ${amount} ${currency} pour "${communityName}" a été confirmé.`,
            data: { amount, currency }
        });
    }

    /**
     * Notify membership approved
     */
    async notifyMembershipApproved(
        talentId: string,
        communityId: string,
        communityName: string
    ): Promise<void> {
        await this.createNotification({
            talent_id: talentId,
            community_id: communityId,
            type: 'MEMBERSHIP_APPROVED',
            title: 'Demande acceptée',
            body: `Votre demande d'adhésion à "${communityName}" a été acceptée. Bienvenue!`
        });
    }

    /**
     * Notify membership rejected
     */
    async notifyMembershipRejected(
        talentId: string,
        communityId: string,
        communityName: string,
        reason?: string
    ): Promise<void> {
        await this.createNotification({
            talent_id: talentId,
            community_id: communityId,
            type: 'MEMBERSHIP_REJECTED',
            title: 'Demande refusée',
            body: reason || `Votre demande d'adhésion à "${communityName}" n'a pas été acceptée.`,
            data: { rejection_reason: reason }
        });
    }
}

export const communityNotificationService = new CommunityNotificationService();
