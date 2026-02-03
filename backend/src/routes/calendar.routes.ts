import express, { Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { pool } from '../services/database';

import { logger } from '../utils';
const router = express.Router();

/**
 * GET /api/calendar/events
 * Returns all calendar events for the authenticated user
 * Query params:
 *   - start_date: ISO date string (required)
 *   - end_date: ISO date string (required)
 */
router.get('/events', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.talentId || req.userId;
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date and end_date are required' });
        }

        const startDate = new Date(start_date as string);
        const endDate = new Date(end_date as string);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        // Fetch all calendar-related items for the user
        const events: any[] = [];

        // 1. Scheduled posts (from community activities where author is user and has scheduled_at)
        const scheduledPostsResult = await pool.query(`
            SELECT
                ca.id,
                ca.type,
                ca.content,
                ca.scheduled_at,
                ca.metadata,
                c.name as community_name
            FROM community_activities ca
            JOIN communities c ON c.id = ca.community_id
            WHERE ca.author_id = $1
                AND ca.scheduled_at IS NOT NULL
                AND ca.scheduled_at >= $2
                AND ca.scheduled_at <= $3
                AND ca.is_draft = false
            ORDER BY ca.scheduled_at ASC
        `, [userId, startDate.toISOString(), endDate.toISOString()]);

        for (const row of scheduledPostsResult.rows) {
            events.push({
                id: row.id,
                source: 'scheduled_post',
                type: row.type,
                content: row.content,
                scheduled_at: row.scheduled_at,
                metadata: row.metadata,
                community_name: row.community_name,
            });
        }

        // 2. Community events (from community activities where type = EVENT)
        const communityEventsResult = await pool.query(`
            SELECT
                ca.id,
                ca.type,
                ca.content,
                ca.metadata,
                c.name as community_name
            FROM community_activities ca
            JOIN communities c ON c.id = ca.community_id
            JOIN community_members cm ON cm.community_id = c.id AND cm.talent_id = $1
            WHERE ca.type = 'EVENT'
                AND ca.is_draft = false
                AND (ca.metadata->>'start_date')::timestamp >= $2
                AND (ca.metadata->>'start_date')::timestamp <= $3
            ORDER BY (ca.metadata->>'start_date')::timestamp ASC
        `, [userId, startDate.toISOString(), endDate.toISOString()]);

        for (const row of communityEventsResult.rows) {
            const meta = row.metadata || {};
            events.push({
                id: row.id,
                source: 'event',
                type: 'EVENT',
                title: meta.title || 'Événement',
                description: row.content,
                start_date: meta.start_date,
                end_date: meta.end_date,
                location: meta.location,
                metadata: meta,
                community_name: row.community_name,
            });
        }

        // 3. Opportunities the user applied to (with deadline)
        const opportunitiesResult = await pool.query(`
            SELECT
                o.id,
                o.title,
                o.summary,
                o.deadline,
                o.locations,
                org.name as organization_name
            FROM opportunities o
            JOIN opportunity_applications oa ON oa.opportunity_id = o.id
            JOIN organizations org ON org.id = o.organization_id
            WHERE oa.talent_id = $1
                AND o.deadline >= $2
                AND o.deadline <= $3
                AND o.deleted_at IS NULL
            ORDER BY o.deadline ASC
        `, [userId, startDate.toISOString(), endDate.toISOString()]);

        for (const row of opportunitiesResult.rows) {
            // Extract location from locations JSONB (first location if available)
            const locations = row.locations || [];
            const firstLocation = locations[0];
            const locationStr = firstLocation ?
                [firstLocation.city, firstLocation.country].filter(Boolean).join(', ') :
                null;

            events.push({
                id: row.id,
                source: 'opportunity',
                type: 'OPPORTUNITY',
                title: row.title,
                description: row.summary,
                date: row.deadline,
                location: locationStr,
                organization_name: row.organization_name,
            });
        }

        // 4. Space bookings (reservations)
        const reservationsResult = await pool.query(`
            SELECT
                sb.id,
                sb.start_datetime,
                sb.end_datetime,
                sb.status,
                s.name as space_name,
                s.address as location
            FROM space_bookings sb
            JOIN spaces s ON s.id = sb.space_id
            WHERE sb.talent_id = $1
                AND sb.start_datetime >= $2
                AND sb.start_datetime <= $3
                AND sb.status IN ('CONFIRMED', 'PENDING')
                AND s.deleted_at IS NULL
            ORDER BY sb.start_datetime ASC
        `, [userId, startDate.toISOString(), endDate.toISOString()]);

        for (const row of reservationsResult.rows) {
            events.push({
                id: row.id,
                source: 'reservation',
                type: 'RESERVATION',
                title: `Reservation - ${row.space_name}`,
                start_date: row.start_datetime,
                end_date: row.end_datetime,
                location: row.location,
                status: row.status,
            });
        }

        // Sort all events by date
        events.sort((a, b) => {
            const dateA = new Date(a.scheduled_at || a.start_date || a.date);
            const dateB = new Date(b.scheduled_at || b.start_date || b.date);
            return dateA.getTime() - dateB.getTime();
        });

        res.json({ data: events });
    } catch (error: any) {
        logger.error('Error fetching calendar events:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
