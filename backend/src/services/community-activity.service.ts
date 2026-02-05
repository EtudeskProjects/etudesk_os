import { pool } from './database';
import {
    CommunityActivity,
    CreateActivityDTO,
    UpdateActivityDTO,
    ActivityType,
    ActivityComment,
    CreateCommentDTO,
    UpdateCommentDTO,
    ActivityFilters,
    ACTIVITY_VALIDATION,
    COMMENT_VALIDATION
} from '../types/community-activity.types';
import { communityPermissionService } from './community-permission.service';
import { autoModerationService } from './auto-moderation.service';
import { communityNotificationService } from './community-notification.service';

import { logger } from '../utils';
export class CommunityActivityService {

    /**
     * Create a new activity (Post, Event, Poll)
     */
    async createActivity(dto: CreateActivityDTO): Promise<CommunityActivity> {
        // 1. Validate content length
        if (dto.content.length > ACTIVITY_VALIDATION.MAX_CONTENT_LENGTH) {
            throw new Error(`Le contenu ne peut pas dépasser ${ACTIVITY_VALIDATION.MAX_CONTENT_LENGTH} caractères`);
        }

        // 2. Validate attachments
        if (dto.attachments && dto.attachments.length > ACTIVITY_VALIDATION.MAX_ATTACHMENTS) {
            throw new Error(`Maximum ${ACTIVITY_VALIDATION.MAX_ATTACHMENTS} fichiers autorisés`);
        }

        // 3. Check permissions
        const canPost = await communityPermissionService.canPerformAction(dto.author_id, dto.community_id, 'POST');
        if (!canPost) {
            throw new Error('User does not have permission to post in this community');
        }

        // 4. Auto-moderation - reject if flagged
        const moderation = await autoModerationService.screenContent(dto.content);
        if (moderation.status === 'FLAGGED') {
            throw new Error(`Votre publication a été rejetée: ${moderation.reason || 'contenu inapproprié détecté'}`);
        }

        // 5. Insert Activity
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Determine published_at based on scheduled_at and is_draft
            const scheduledAt = dto.scheduled_at ? new Date(dto.scheduled_at) : null;
            const isDraft = dto.is_draft === true;
            const publishedAt = (scheduledAt || isDraft) ? null : new Date();

            // 5.1 BUSINESS RULE: One draft per type per member per community
            // If creating a draft, delete any existing draft of the same type
            if (isDraft) {
                await client.query(`
                    DELETE FROM community_activities
                    WHERE community_id = $1
                      AND author_id = $2
                      AND type = $3
                      AND is_draft = TRUE
                      AND deleted_at IS NULL
                `, [dto.community_id, dto.author_id, dto.type]);
            }

            const query = `
                INSERT INTO community_activities (
                    community_id, author_id, type, content, metadata, attachments,
                    moderation_status, moderation_reason, scheduled_at, published_at, is_draft
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const values = [
                dto.community_id,
                dto.author_id,
                dto.type,
                dto.content,
                dto.metadata || {},
                JSON.stringify(dto.attachments || []),
                moderation.status,
                moderation.reason,
                scheduledAt,
                publishedAt,
                isDraft
            ];

            const result = await client.query(query, values);
            const activity = result.rows[0];

            // 6. If Poll, insert options
            if (dto.type === 'POLL' && dto.metadata?.options && Array.isArray(dto.metadata.options)) {
                if (dto.metadata.options.length < ACTIVITY_VALIDATION.MIN_POLL_OPTIONS) {
                    throw new Error(`Un sondage doit avoir au moins ${ACTIVITY_VALIDATION.MIN_POLL_OPTIONS} options`);
                }
                if (dto.metadata.options.length > ACTIVITY_VALIDATION.MAX_POLL_OPTIONS) {
                    throw new Error(`Un sondage ne peut pas avoir plus de ${ACTIVITY_VALIDATION.MAX_POLL_OPTIONS} options`);
                }

                const optionQuery = `
                    INSERT INTO community_poll_options (activity_id, text, order_index)
                    VALUES ($1, $2, $3)
                `;

                let index = 0;
                for (const optionText of dto.metadata.options) {
                    await client.query(optionQuery, [activity.id, optionText, index++]);
                }
            }

            await client.query('COMMIT');

            // 7. Notify community members of new activity (async, non-blocking)
            if (publishedAt) {
                setImmediate(() => {
                    communityNotificationService.notifyNewActivity(activity.id, dto.community_id, dto.author_id)
                        .catch(err => logger.error('Failed to notify new activity:', err));
                });
            }

            // 8. Schedule event reminders if this is an EVENT with a start_date
            if (dto.type === 'EVENT' && dto.metadata?.start_date) {
                const eventDate = new Date(dto.metadata.start_date);
                setImmediate(() => {
                    communityNotificationService.scheduleEventReminders(activity.id, dto.community_id, eventDate)
                        .catch(err => logger.error('Failed to schedule event reminders:', err));
                });
            }

            return activity;

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Update an activity
     */
    async updateActivity(activityId: string, userId: string, dto: UpdateActivityDTO): Promise<CommunityActivity> {
        const activityRes = await pool.query(
            'SELECT community_id, author_id FROM community_activities WHERE id = $1 AND deleted_at IS NULL',
            [activityId]
        );
        if (activityRes.rows.length === 0) {
            throw new Error('Activity not found');
        }

        const { community_id, author_id } = activityRes.rows[0];

        // Only author can edit
        if (author_id !== userId) {
            throw new Error('Only the author can edit this activity');
        }

        // Validate content if provided
        if (dto.content && dto.content.length > ACTIVITY_VALIDATION.MAX_CONTENT_LENGTH) {
            throw new Error(`Le contenu ne peut pas dépasser ${ACTIVITY_VALIDATION.MAX_CONTENT_LENGTH} caractères`);
        }

        // Moderate content if changed
        if (dto.content) {
            const moderation = await autoModerationService.screenContent(dto.content);
            if (moderation.status === 'FLAGGED') {
                throw new Error(`Votre modification a été rejetée: ${moderation.reason || 'contenu inapproprié détecté'}`);
            }
        }

        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (dto.content !== undefined) {
            updates.push(`content = $${paramIndex++}`);
            values.push(dto.content);
        }
        if (dto.metadata !== undefined) {
            updates.push(`metadata = metadata || $${paramIndex++}`);
            values.push(JSON.stringify(dto.metadata));
        }
        if (dto.attachments !== undefined) {
            updates.push(`attachments = $${paramIndex++}`);
            values.push(JSON.stringify(dto.attachments));
        }
        if (dto.scheduled_at !== undefined) {
            updates.push(`scheduled_at = $${paramIndex++}`);
            values.push(dto.scheduled_at ? new Date(dto.scheduled_at) : null);
        }

        if (updates.length === 0) {
            throw new Error('No fields to update');
        }

        updates.push(`updated_at = NOW()`);
        values.push(activityId);

        const query = `
            UPDATE community_activities
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Publish a scheduled activity now
     */
    async publishScheduledActivity(activityId: string, userId: string): Promise<CommunityActivity> {
        const activityRes = await pool.query(
            'SELECT community_id, author_id, scheduled_at, published_at FROM community_activities WHERE id = $1 AND deleted_at IS NULL',
            [activityId]
        );
        if (activityRes.rows.length === 0) {
            throw new Error('Activity not found');
        }

        const { community_id, author_id, published_at } = activityRes.rows[0];

        if (author_id !== userId) {
            const canManage = await communityPermissionService.canPerformAction(userId, community_id, 'DELETE_ANY');
            if (!canManage) {
                throw new Error('You do not have permission to publish this activity');
            }
        }

        if (published_at) {
            throw new Error('Activity is already published');
        }

        const result = await pool.query(
            'UPDATE community_activities SET published_at = NOW(), scheduled_at = NULL WHERE id = $1 RETURNING *',
            [activityId]
        );

        // Notify community members
        setImmediate(() => {
            communityNotificationService.notifyNewActivity(activityId, community_id, author_id)
                .catch(err => logger.error('Failed to notify new activity:', err));
        });

        return result.rows[0];
    }

    /**
     * Get Community Feed (Infinite Scroll)
     */
    async getCommunityFeed(
        communityId: string,
        userId: string,
        limit: number = 20,
        cursor?: string,
        includeScheduled: boolean = false
    ): Promise<{ data: CommunityActivity[], nextCursor: string | null }> {

        const finalParams = [communityId, userId, limit + 1];

        // Build where clause
        let whereClause = `
            WHERE ca.community_id = $1
            AND ca.deleted_at IS NULL
            AND (ca.is_draft IS NULL OR ca.is_draft = FALSE)
            AND (
                ca.moderation_status = 'APPROVED'
                OR ca.author_id = $2
            )
        `;

        // Show published activities to everyone, and scheduled activities only to their author
        if (!includeScheduled) {
            whereClause += ` AND (
                (ca.published_at IS NOT NULL AND ca.published_at <= NOW())
                OR (ca.scheduled_at IS NOT NULL AND ca.scheduled_at > NOW() AND ca.author_id = $2)
            )`;
        }

        if (cursor) {
            whereClause += ` AND COALESCE(ca.published_at, ca.scheduled_at) < $4`;
            finalParams.push(cursor);
        }

        const query = `
            SELECT
                ca.*,
                json_build_object(
                    'id', u.id,
                    'display_name', COALESCE(u.first_name || ' ' || u.last_name, u.email),
                    'avatar_url', u.avatar_url,
                    'bio', u.bio
                ) as author,
                CASE WHEN car.activity_id IS NOT NULL THEN true ELSE false END as has_liked,
                (
                    SELECT cpv.option_id FROM community_poll_votes cpv
                    WHERE cpv.activity_id = ca.id AND cpv.user_id = $2 LIMIT 1
                ) as user_vote_id,
                CASE WHEN cab.activity_id IS NOT NULL THEN true ELSE false END as is_bookmarked
            FROM community_activities ca
            JOIN talents u ON ca.author_id = u.id
            LEFT JOIN community_activity_reactions car ON ca.id = car.activity_id AND car.user_id = $2
            LEFT JOIN community_activity_bookmarks cab ON ca.id = cab.activity_id AND cab.user_id = $2
            ${whereClause}
            ORDER BY
                ca.is_pinned DESC,
                COALESCE(ca.published_at, ca.scheduled_at) DESC
            LIMIT $3
        `;

        const result = await pool.query(query, finalParams);

        const rows = result.rows;
        let nextCursor = null;

        if (rows.length > limit) {
            rows.pop();
            const lastItem = rows[rows.length - 1];
            // Use published_at or scheduled_at for cursor
            const cursorDate = lastItem.published_at || lastItem.scheduled_at;
            if (cursorDate) {
                nextCursor = cursorDate.toISOString();
            }
        }

        // OPTIMIZED: Batch load poll options instead of N+1 queries
        const pollActivityIds = rows.filter(a => a.type === 'POLL').map(a => a.id);

        let pollOptionsMap: Record<string, any[]> = {};
        if (pollActivityIds.length > 0) {
            const pollOptions = await pool.query(
                `SELECT po.*,
                 CASE WHEN pv.option_id IS NOT NULL THEN true ELSE false END as is_voted_by_user
                 FROM community_poll_options po
                 LEFT JOIN community_poll_votes pv ON po.id = pv.option_id AND pv.user_id = $2
                 WHERE po.activity_id = ANY($1)
                 ORDER BY po.activity_id, po.order_index ASC`,
                [pollActivityIds, userId]
            );
            // Group options by activity_id
            for (const option of pollOptions.rows) {
                if (!pollOptionsMap[option.activity_id]) {
                    pollOptionsMap[option.activity_id] = [];
                }
                pollOptionsMap[option.activity_id].push(option);
            }
        }

        // Hydrate poll options and apply visibility logic
        const activitiesWithPolls = rows.map((activity) => {
            if (activity.type === 'POLL') {
                activity.poll_options = pollOptionsMap[activity.id] || [];
                return this.applyPollResultsVisibility(activity);
            }
            return activity;
        });

        return {
            data: activitiesWithPolls,
            nextCursor
        };
    }

    /**
     * Toggle Like on Activity (simplified from reactions)
     */
    async toggleLike(activityId: string, userId: string): Promise<boolean> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if like exists
            const existing = await client.query(
                `SELECT activity_id FROM community_activity_reactions WHERE activity_id = $1 AND user_id = $2`,
                [activityId, userId]
            );

            let isLiked: boolean;

            if (existing.rows.length > 0) {
                // Remove like (toggle off)
                await client.query(
                    `DELETE FROM community_activity_reactions WHERE activity_id = $1 AND user_id = $2`,
                    [activityId, userId]
                );
                isLiked = false;
            } else {
                // Add like
                await client.query(
                    `INSERT INTO community_activity_reactions (activity_id, user_id) VALUES ($1, $2)`,
                    [activityId, userId]
                );
                isLiked = true;

                // Notify author (async)
                const activityRes = await client.query(
                    'SELECT author_id, community_id, content, type FROM community_activities WHERE id = $1',
                    [activityId]
                );
                const activity = activityRes.rows[0];

                if (activity && activity.author_id !== userId) {
                    setImmediate(() => {
                        communityNotificationService.createNotification({
                            talent_id: activity.author_id,
                            community_id: activity.community_id,
                            type: 'MENTION', // Using MENTION as generic notification
                            activity_id: activityId,
                            actor_id: userId,
                            title: 'Nouveau like',
                            body: `Quelqu'un a aimé votre ${activity.type.toLowerCase()}`
                        }).catch(err => logger.error('Failed to send like notification:', err));
                    });
                }
            }

            await client.query('COMMIT');
            return isLiked;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Add a comment to an activity
     */
    async addComment(dto: CreateCommentDTO): Promise<ActivityComment> {
        // 1. Validate content
        if (dto.content.length > COMMENT_VALIDATION.MAX_CONTENT_LENGTH) {
            throw new Error(`Le commentaire ne peut pas dépasser ${COMMENT_VALIDATION.MAX_CONTENT_LENGTH} caractères`);
        }

        if (dto.mentions && dto.mentions.length > COMMENT_VALIDATION.MAX_MENTIONS) {
            throw new Error(`Maximum ${COMMENT_VALIDATION.MAX_MENTIONS} mentions autorisées`);
        }

        // 2. Moderate content
        const moderation = await autoModerationService.screenContent(dto.content);
        if (moderation.status === 'FLAGGED') {
            throw new Error(`Votre commentaire a été rejeté: ${moderation.reason || 'contenu inapproprié détecté'}`);
        }

        // 3. Insert Comment
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const query = `
                INSERT INTO community_activity_comments
                (activity_id, author_id, content, parent_id, mentions, moderation_status)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

            const result = await client.query(query, [
                dto.activity_id,
                dto.author_id,
                dto.content,
                dto.parent_id || null,
                dto.mentions || null,
                moderation.status
            ]);
            const comment = result.rows[0];
            const enrichedCommentRes = await client.query(
                `
                    SELECT
                        c.*,
                        (SELECT COUNT(*)::int FROM community_activity_comments r WHERE r.parent_id = c.id AND r.deleted_at IS NULL) as replies_count,
                        0 as likes_count,
                        json_build_object(
                            'id', u.id,
                            'display_name', COALESCE(u.first_name || ' ' || u.last_name, u.email),
                            'avatar_url', u.avatar_url
                        ) as author
                    FROM community_activity_comments c
                    JOIN talents u ON c.author_id = u.id
                    WHERE c.id = $1
                `,
                [comment.id]
            );
            const enrichedComment = enrichedCommentRes.rows[0] || comment;

            // Get activity info for notifications
            const activityRes = await client.query(
                'SELECT author_id, community_id, content, type FROM community_activities WHERE id = $1',
                [dto.activity_id]
            );
            const activity = activityRes.rows[0];

            // Get parent comment if reply
            let parentComment = null;
            if (dto.parent_id) {
                const parentRes = await client.query(
                    'SELECT author_id, content FROM community_activity_comments WHERE id = $1',
                    [dto.parent_id]
                );
                parentComment = parentRes.rows[0];
            }

            await client.query('COMMIT');

            // Send notifications (async)
            setImmediate(async () => {
                try {
                    // Notify activity author
                    if (activity && activity.author_id !== dto.author_id) {
                        await communityNotificationService.createNotification({
                            talent_id: activity.author_id,
                            community_id: activity.community_id,
                            type: 'COMMENT_REPLY',
                            activity_id: dto.activity_id,
                            comment_id: comment.id,
                            actor_id: dto.author_id,
                            title: 'Nouveau commentaire',
                            body: `Quelqu'un a commenté votre ${activity.type.toLowerCase()}`
                        });
                    }

                    // Notify parent comment author if reply
                    if (parentComment && parentComment.author_id !== dto.author_id && parentComment.author_id !== activity?.author_id) {
                        await communityNotificationService.createNotification({
                            talent_id: parentComment.author_id,
                            community_id: activity.community_id,
                            type: 'COMMENT_REPLY',
                            activity_id: dto.activity_id,
                            comment_id: comment.id,
                            actor_id: dto.author_id,
                            title: 'Réponse à votre commentaire',
                            body: dto.content.substring(0, 50) + (dto.content.length > 50 ? '...' : '')
                        });
                    }

                    // Notify mentioned users
                    if (dto.mentions && dto.mentions.length > 0) {
                        await communityNotificationService.notifyMentions(
                            dto.mentions,
                            activity.community_id,
                            dto.activity_id,
                            comment.id,
                            dto.author_id
                        );
                    }
                } catch (err) {
                    logger.error('Failed to send comment notifications:', err);
                }
            });

            return enrichedComment;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Update a comment
     */
    async updateComment(commentId: string, userId: string, dto: UpdateCommentDTO): Promise<ActivityComment> {
        const commentRes = await pool.query(
            'SELECT author_id, activity_id FROM community_activity_comments WHERE id = $1 AND deleted_at IS NULL',
            [commentId]
        );
        if (commentRes.rows.length === 0) {
            throw new Error('Comment not found');
        }

        const { author_id, activity_id } = commentRes.rows[0];

        if (author_id !== userId) {
            throw new Error('Only the author can edit this comment');
        }

        // Validate and moderate
        if (dto.content.length > COMMENT_VALIDATION.MAX_CONTENT_LENGTH) {
            throw new Error(`Le commentaire ne peut pas dépasser ${COMMENT_VALIDATION.MAX_CONTENT_LENGTH} caractères`);
        }

        const moderation = await autoModerationService.screenContent(dto.content);
        if (moderation.status === 'FLAGGED') {
            throw new Error(`Votre modification a été rejetée: ${moderation.reason || 'contenu inapproprié détecté'}`);
        }

        const result = await pool.query(
            `UPDATE community_activity_comments
             SET content = $1, mentions = $2, edited_at = NOW(), updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [dto.content, dto.mentions || null, commentId]
        );

        return result.rows[0];
    }

    /**
     * Delete a comment (soft delete)
     */
    async deleteComment(commentId: string, userId: string): Promise<void> {
        const commentRes = await pool.query(
            `SELECT c.author_id, c.activity_id, a.community_id
             FROM community_activity_comments c
             JOIN community_activities a ON c.activity_id = a.id
             WHERE c.id = $1 AND c.deleted_at IS NULL`,
            [commentId]
        );
        if (commentRes.rows.length === 0) {
            throw new Error('Comment not found');
        }

        const { author_id, community_id } = commentRes.rows[0];

        // Allow author or Admin/Moderator
        if (author_id !== userId) {
            const canDeleteAny = await communityPermissionService.canPerformAction(userId, community_id, 'DELETE_ANY');
            if (!canDeleteAny) {
                throw new Error('You do not have permission to delete this comment');
            }
        }

        await pool.query('UPDATE community_activity_comments SET deleted_at = NOW() WHERE id = $1', [commentId]);
    }

    /**
     * Get comments for an activity
     */
    async getComments(
        activityId: string,
        userId: string,
        parentId: string | null = null,
        limit: number = 20,
        offset: number = 0
    ): Promise<ActivityComment[]> {
        const query = `
            SELECT
                c.*,
                json_build_object(
                    'id', u.id,
                    'display_name', COALESCE(u.first_name || ' ' || u.last_name, u.email),
                    'avatar_url', u.avatar_url
                ) as author
            FROM community_activity_comments c
            JOIN talents u ON c.author_id = u.id
            WHERE c.activity_id = $1
              AND c.deleted_at IS NULL
              AND ${parentId ? 'c.parent_id = $4' : 'c.parent_id IS NULL'}
            ORDER BY c.created_at ASC
            LIMIT $2 OFFSET $3
        `;

        const params = parentId
            ? [activityId, limit, offset, parentId]
            : [activityId, limit, offset];

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Vote on a poll
     */
    async votePoll(activityId: string, userId: string, optionId: string): Promise<void> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if poll exists and is not expired
            const activityRes = await client.query(
                `SELECT type, metadata FROM community_activities WHERE id = $1 AND deleted_at IS NULL`,
                [activityId]
            );

            if (activityRes.rows.length === 0) {
                throw new Error('Poll not found');
            }

            const activity = activityRes.rows[0];
            if (activity.type !== 'POLL') {
                throw new Error('This is not a poll');
            }

            // Check if poll is expired
            if (activity.metadata?.poll_end_date) {
                const endDate = new Date(activity.metadata.poll_end_date);
                if (endDate < new Date()) {
                    throw new Error('This poll has ended');
                }
            }

            // Remove previous vote if single choice
            if (!activity.metadata?.multiple_choice) {
                await client.query(
                    `DELETE FROM community_poll_votes WHERE activity_id = $1 AND user_id = $2`,
                    [activityId, userId]
                );
            }

            // Insert new vote
            await client.query(
                `INSERT INTO community_poll_votes (activity_id, option_id, user_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (activity_id, user_id) DO UPDATE SET option_id = $2`,
                [activityId, optionId, userId]
            );

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Toggle Bookmark on Activity
     */
    async toggleBookmark(activityId: string, userId: string): Promise<boolean> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const existing = await client.query(
                `SELECT activity_id FROM community_activity_bookmarks WHERE activity_id = $1 AND user_id = $2`,
                [activityId, userId]
            );

            let isBookmarked: boolean;

            if (existing.rows.length > 0) {
                await client.query(
                    `DELETE FROM community_activity_bookmarks WHERE activity_id = $1 AND user_id = $2`,
                    [activityId, userId]
                );
                isBookmarked = false;
            } else {
                await client.query(
                    `INSERT INTO community_activity_bookmarks (activity_id, user_id) VALUES ($1, $2)`,
                    [activityId, userId]
                );
                isBookmarked = true;
            }

            await client.query('COMMIT');
            return isBookmarked;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Get all bookmarked activities for a user
     */
    async getMyBookmarkedActivities(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
        const result = await pool.query(`
            SELECT
                a.id,
                a.type,
                a.content,
                a.metadata,
                a.created_at,
                a.reactions_count,
                a.comments_count,
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'slug', c.slug
                ) as community,
                json_build_object(
                    'id', t.id,
                    'display_name', COALESCE(t.first_name || ' ' || t.last_name, t.email),
                    'avatar_url', t.avatar_url
                ) as author,
                b.created_at as bookmarked_at
            FROM community_activity_bookmarks b
            JOIN community_activities a ON b.activity_id = a.id
            JOIN communities c ON a.community_id = c.id
            JOIN talents t ON a.author_id = t.id
            WHERE b.user_id = $1
              AND a.deleted_at IS NULL
              AND a.moderation_status = 'APPROVED'
            ORDER BY b.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);

        return result.rows;
    }

    /**
     * Delete an activity (Soft delete)
     */
    async deleteActivity(activityId: string, userId: string): Promise<void> {
        const activityRes = await pool.query(
            'SELECT community_id, author_id FROM community_activities WHERE id = $1 AND deleted_at IS NULL',
            [activityId]
        );
        if (activityRes.rows.length === 0) {
            throw new Error('Activity not found');
        }

        const { community_id, author_id } = activityRes.rows[0];

        if (author_id !== userId) {
            const canDeleteAny = await communityPermissionService.canPerformAction(userId, community_id, 'DELETE_ANY');
            if (!canDeleteAny) {
                throw new Error('You do not have permission to delete this activity');
            }
        }

        await pool.query('UPDATE community_activities SET deleted_at = NOW() WHERE id = $1', [activityId]);
    }

    /**
     * Toggle Pin status of an activity
     * Only one activity can be pinned per community
     */
    async togglePin(activityId: string, userId: string): Promise<boolean> {
        const activityRes = await pool.query(
            'SELECT community_id, is_pinned FROM community_activities WHERE id = $1 AND deleted_at IS NULL',
            [activityId]
        );
        if (activityRes.rows.length === 0) {
            throw new Error('Activity not found');
        }

        const { community_id, is_pinned } = activityRes.rows[0];

        // Only admins can pin
        const canPin = await communityPermissionService.canPerformAction(userId, community_id, 'PIN');
        if (!canPin) {
            throw new Error('Only admins can pin activities');
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            if (!is_pinned) {
                // Unpin any currently pinned activity first (only 1 allowed)
                await client.query(
                    'UPDATE community_activities SET is_pinned = FALSE WHERE community_id = $1 AND is_pinned = TRUE',
                    [community_id]
                );
            }

            // Toggle pin status
            const newStatus = !is_pinned;
            await client.query(
                'UPDATE community_activities SET is_pinned = $1 WHERE id = $2',
                [newStatus, activityId]
            );

            await client.query('COMMIT');
            return newStatus;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    /**
     * Get single activity details with comments tree
     */
    async getActivityDetails(activityId: string, userId: string): Promise<{ activity: CommunityActivity, comments: ActivityComment[] }> {
        // 1. Get Activity
        const activityQuery = `
            SELECT
                ca.*,
                json_build_object(
                    'id', u.id,
                    'display_name', COALESCE(u.first_name || ' ' || u.last_name, u.email),
                    'avatar_url', u.avatar_url,
                    'bio', u.bio
                ) as author,
                CASE WHEN car.activity_id IS NOT NULL THEN true ELSE false END as has_liked,
                (
                    SELECT cpv.option_id FROM community_poll_votes cpv
                    WHERE cpv.activity_id = ca.id AND cpv.user_id = $2 LIMIT 1
                ) as user_vote_id,
                CASE WHEN cab.activity_id IS NOT NULL THEN true ELSE false END as is_bookmarked
            FROM community_activities ca
            JOIN talents u ON ca.author_id = u.id
            LEFT JOIN community_activity_reactions car ON ca.id = car.activity_id AND car.user_id = $2
            LEFT JOIN community_activity_bookmarks cab ON ca.id = cab.activity_id AND cab.user_id = $2
            WHERE ca.id = $1 AND ca.deleted_at IS NULL
        `;

        const activityRes = await pool.query(activityQuery, [activityId, userId]);
        if (activityRes.rows.length === 0) {
            throw new Error('Activity not found');
        }
        let activity = activityRes.rows[0];

        // Hydrate Poll Options if type is POLL and apply visibility
        if (activity.type === 'POLL') {
            const pollOptions = await pool.query(
                `SELECT po.*,
                 CASE WHEN pv.option_id IS NOT NULL THEN true ELSE false END as is_voted_by_user
                 FROM community_poll_options po
                 LEFT JOIN community_poll_votes pv ON po.id = pv.option_id AND pv.user_id = $2
                 WHERE po.activity_id = $1
                 ORDER BY po.order_index ASC`,
                [activity.id, userId]
            );
            activity.poll_options = pollOptions.rows;
            // Apply poll results visibility logic
            activity = this.applyPollResultsVisibility(activity);
        }

        // 2. Get Comments
        const commentsQuery = `
            SELECT
                c.*,
                (SELECT COUNT(*)::int FROM community_activity_comments r WHERE r.parent_id = c.id AND r.deleted_at IS NULL) as replies_count,
                0 as likes_count,
                json_build_object(
                    'id', u.id,
                    'display_name', COALESCE(u.first_name || ' ' || u.last_name, u.email),
                    'avatar_url', u.avatar_url
                ) as author
            FROM community_activity_comments c
            JOIN talents u ON c.author_id = u.id
            WHERE c.activity_id = $1 AND c.deleted_at IS NULL
            ORDER BY c.created_at ASC
        `;

        const commentsRes = await pool.query(commentsQuery, [activityId]);
        const allComments = commentsRes.rows;

        // Build Tree
        const commentMap = new Map();
        const rootComments: ActivityComment[] = [];

        allComments.forEach(c => {
            c.replies = [];
            commentMap.set(c.id, c);
        });

        allComments.forEach(c => {
            if (c.parent_id) {
                const parent = commentMap.get(c.parent_id);
                if (parent) {
                    parent.replies.push(c);
                } else {
                    rootComments.push(c);
                }
            } else {
                rootComments.push(c);
            }
        });

        return { activity, comments: rootComments };
    }

    /**
     * Get scheduled activities (for admins)
     */
    async getScheduledActivities(communityId: string, userId: string): Promise<CommunityActivity[]> {
        // Check if user is admin
        const canManage = await communityPermissionService.canPerformAction(userId, communityId, 'PIN');
        if (!canManage) {
            throw new Error('Only admins can view scheduled activities');
        }

        const result = await pool.query(`
            SELECT ca.*,
                   json_build_object('id', u.id, 'display_name', COALESCE(u.first_name || ' ' || u.last_name, u.email), 'avatar_url', u.avatar_url) as author
            FROM community_activities ca
            JOIN talents u ON ca.author_id = u.id
            WHERE ca.community_id = $1
              AND ca.deleted_at IS NULL
              AND ca.scheduled_at IS NOT NULL
              AND ca.published_at IS NULL
            ORDER BY ca.scheduled_at ASC
        `, [communityId]);

        return result.rows;
    }

    /**
     * Publish all scheduled activities that are due (called by cron job)
     */
    async publishScheduledActivities(): Promise<number> {
        const result = await pool.query(`
            UPDATE community_activities
            SET published_at = NOW(), scheduled_at = NULL
            WHERE scheduled_at IS NOT NULL
            AND scheduled_at <= NOW()
            AND published_at IS NULL
            RETURNING id, community_id, author_id
        `);

        // Notify community members for each published activity
        for (const activity of result.rows) {
            setImmediate(() => {
                communityNotificationService.notifyNewActivity(activity.id, activity.community_id, activity.author_id)
                    .catch(err => logger.error('Failed to notify scheduled activity:', err));
            });
        }

        return result.rowCount || 0;
    }

    /**
     * Get user's drafts for a community
     * @param communityId - Community ID
     * @param userId - User ID
     * @param type - Optional: Filter by activity type (POST, EVENT, POLL)
     */
    async getDrafts(communityId: string, userId: string, type?: ActivityType): Promise<CommunityActivity[]> {
        const params: any[] = [communityId, userId];
        let typeFilter = '';

        if (type) {
            typeFilter = 'AND ca.type = $3';
            params.push(type);
        }

        const result = await pool.query(`
            SELECT ca.*,
                   json_build_object('id', u.id, 'display_name', COALESCE(u.first_name || ' ' || u.last_name, u.email), 'avatar_url', u.avatar_url) as author
            FROM community_activities ca
            JOIN talents u ON ca.author_id = u.id
            WHERE ca.community_id = $1
              AND ca.author_id = $2
              AND ca.is_draft = TRUE
              AND ca.deleted_at IS NULL
              ${typeFilter}
            ORDER BY ca.updated_at DESC
        `, params);

        return result.rows;
    }

    /**
     * Get a single draft by type (for pre-filling forms)
     * Returns the draft if exists, null otherwise
     */
    async getDraftByType(communityId: string, userId: string, type: ActivityType): Promise<CommunityActivity | null> {
        const result = await pool.query(`
            SELECT ca.*,
                   json_build_object('id', u.id, 'display_name', COALESCE(u.first_name || ' ' || u.last_name, u.email), 'avatar_url', u.avatar_url) as author
            FROM community_activities ca
            JOIN talents u ON ca.author_id = u.id
            WHERE ca.community_id = $1
              AND ca.author_id = $2
              AND ca.type = $3
              AND ca.is_draft = TRUE
              AND ca.deleted_at IS NULL
            LIMIT 1
        `, [communityId, userId, type]);

        return result.rows[0] || null;
    }

    /**
     * Publish a draft
     */
    async publishDraft(activityId: string, userId: string): Promise<CommunityActivity> {
        const activityRes = await pool.query(
            'SELECT community_id, author_id, is_draft, type, metadata FROM community_activities WHERE id = $1 AND deleted_at IS NULL',
            [activityId]
        );

        if (activityRes.rows.length === 0) {
            throw new Error('Draft not found');
        }

        const { community_id, author_id, is_draft, type, metadata } = activityRes.rows[0];

        if (author_id !== userId) {
            throw new Error('You can only publish your own drafts');
        }

        if (!is_draft) {
            throw new Error('This activity is not a draft');
        }

        const result = await pool.query(
            `UPDATE community_activities
             SET is_draft = FALSE, published_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [activityId]
        );

        const activity = result.rows[0];

        // Notify community members
        setImmediate(() => {
            communityNotificationService.notifyNewActivity(activityId, community_id, userId)
                .catch(err => logger.error('Failed to notify new activity:', err));
        });

        // Schedule event reminders if this is an EVENT with a start_date
        if (type === 'EVENT' && metadata?.start_date) {
            const eventDate = new Date(metadata.start_date);
            setImmediate(() => {
                communityNotificationService.scheduleEventReminders(activityId, community_id, eventDate)
                    .catch(err => logger.error('Failed to schedule event reminders:', err));
            });
        }

        return activity;
    }

    /**
     * Apply poll results visibility logic
     * Hides vote counts if show_results=false and poll hasn't ended
     */
    private applyPollResultsVisibility(activity: any): any {
        if (activity.type !== 'POLL' || !activity.poll_options) {
            return activity;
        }

        const metadata = activity.metadata || {};
        const pollEndDate = metadata.poll_end_date ? new Date(metadata.poll_end_date) : null;
        const pollEnded = pollEndDate && pollEndDate < new Date();
        const showResults = metadata.show_results !== false; // Default to true if not specified

        // User can see results if show_results is true OR poll has ended
        const canSeeResults = showResults || pollEnded;

        if (!canSeeResults) {
            activity.poll_options = activity.poll_options.map((opt: any) => ({
                ...opt,
                votes_count: undefined // Hide vote counts
            }));
        }

        return activity;
    }
}

export const communityActivityService = new CommunityActivityService();
