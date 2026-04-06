import express, { Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { pool } from '../services/database';
import { resolveAgendaSchedule } from '../services/agenda-scheduling.service';

import { logger } from '../utils';
const router = express.Router();

async function canAccessOrganizationAgenda(organizationId: string, talentId: string): Promise<boolean> {
    const result = await pool.query(
        `SELECT 1
         FROM organization_members
         WHERE organization_id = $1::uuid
           AND talent_id = $2::uuid
           AND status = 'ACTIVE'
         LIMIT 1`,
        [organizationId, talentId]
    );
    return result.rows.length > 0;
}

type TriggerScope = 'TALENT' | 'ORGANIZATION';
type TriggerStatus = 'PENDING' | 'DONE' | 'CANCELED';
type TriggerPriority = 'LOW' | 'NORMAL' | 'HIGH';

function parseDateOnly(dateOnly: string): Date {
    return new Date(`${dateOnly}T00:00:00.000Z`);
}

function dayBeforeStartAt0900Utc(startDateOnly: string): Date {
    const start = parseDateOnly(startDateOnly);
    const due = new Date(Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate(),
        9, 0, 0, 0
    ));
    due.setUTCDate(due.getUTCDate() - 1);
    return due;
}

async function resolveOpportunityStartDateForFollowUp(metadata: Record<string, any>): Promise<string | null> {
    const applicationId = metadata.applicationId || metadata.application_id || null;
    const opportunityId = metadata.opportunityId || metadata.opportunity_id || null;

    if (applicationId) {
        const appRes = await pool.query(
            `SELECT o.start_date
             FROM opportunity_applications oa
             JOIN opportunities o ON o.id = oa.opportunity_id
             WHERE oa.id = $1::uuid
             LIMIT 1`,
            [String(applicationId)]
        );
        return appRes.rows[0]?.start_date || null;
    }

    if (opportunityId) {
        const oppRes = await pool.query(
            `SELECT start_date
             FROM opportunities
             WHERE id = $1::uuid
             LIMIT 1`,
            [String(opportunityId)]
        );
        return oppRes.rows[0]?.start_date || null;
    }

    return null;
}

/**
 * POST /api/calendar/triggers
 * Create an agenda trigger (agent-scheduled action / reminder).
 * Body:
 *  - code: string
 *  - title: string
 *  - description?: string
 *  - due_at: ISO date string
 *  - priority?: LOW | NORMAL | HIGH
 *  - metadata?: object
 *  - scope?: TALENT | ORGANIZATION (optional; derived from organizationId)
 *  - organizationId?: uuid (optional; when present creates an org-scope trigger)
 */
router.post('/triggers', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const talentId = req.talentId;
        if (!talentId) {
            return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
        }

        const {
            code,
            title,
            description,
            due_at,
            priority,
            metadata,
            organizationId,
        } = req.body || {};

        if (!code || typeof code !== 'string' || code.trim().length < 2) {
            return res.status(400).json({ error: 'code requis' });
        }
        if (!title || typeof title !== 'string' || title.trim().length < 2) {
            return res.status(400).json({ error: 'title requis' });
        }
        if (!due_at || typeof due_at !== 'string') {
            return res.status(400).json({ error: 'due_at requis' });
        }
        let dueAt = new Date(due_at);
        let latestAllowedAt: Date | null = null;
        if (isNaN(dueAt.getTime())) {
            return res.status(400).json({ error: 'due_at invalide' });
        }

        const pr: TriggerPriority = (priority === 'LOW' || priority === 'HIGH') ? priority : 'NORMAL';
        let metaObj = (metadata && typeof metadata === 'object') ? { ...metadata } : {};

        // FOLLOW_UP must account for opportunity start_date when available.
        if (String(code).toUpperCase().trim() === 'FOLLOW_UP') {
            const startDate = await resolveOpportunityStartDateForFollowUp(metaObj);
            if (startDate) {
                const cappedDueAt = dayBeforeStartAt0900Utc(startDate);
                latestAllowedAt = cappedDueAt;
                if (dueAt > cappedDueAt) {
                    dueAt = cappedDueAt;
                    metaObj = {
                        ...metaObj,
                        adjusted_due_to_start_date: true,
                        opportunity_start_date: startDate,
                        adjusted_due_at: dueAt.toISOString(),
                    };
                }
            }
        }

        const scope: TriggerScope = organizationId ? 'ORGANIZATION' : 'TALENT';
        const scheduled = await resolveAgendaSchedule({
            scope,
            talentId,
            organizationId: organizationId ? String(organizationId) : undefined,
            requestedDueAt: dueAt,
            latestAllowedAt,
        });
        if (!scheduled) {
            return res.status(400).json({ error: req.t('copilot:toolNoAvailableAgendaSlot') });
        }
        dueAt = scheduled.dueAt;
        metaObj = {
            ...metaObj,
            scheduling: {
                requested_due_at: scheduled.requestedDueAt.toISOString(),
                final_due_at: scheduled.dueAt.toISOString(),
                adjusted: scheduled.adjusted,
                reasons: scheduled.reasons,
            },
        };

        if (scope === 'ORGANIZATION') {
            const orgId = String(organizationId);
            const allowed = await canAccessOrganizationAgenda(orgId, talentId);
            if (!allowed) {
                return res.status(403).json({ error: req.t('organizations:notMember') });
            }

            const result = await pool.query(
                `
                INSERT INTO agenda_triggers (scope, organization_id, code, title, description, due_at, priority, metadata, created_by)
                VALUES ('ORGANIZATION', $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::uuid)
                RETURNING *
                `,
                [orgId, code.trim(), title.trim(), description || null, dueAt.toISOString(), pr, JSON.stringify(metaObj), talentId]
            );
            return res.json({ data: result.rows[0] });
        }

        const result = await pool.query(
            `
            INSERT INTO agenda_triggers (scope, talent_id, code, title, description, due_at, priority, metadata, created_by)
            VALUES ('TALENT', $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::uuid)
            RETURNING *
            `,
            [talentId, code.trim(), title.trim(), description || null, dueAt.toISOString(), pr, JSON.stringify(metaObj), talentId]
        );
        return res.json({ data: result.rows[0] });
    } catch (error: any) {
        logger.error('Error creating agenda trigger:', error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/calendar/triggers/:id
 * Update trigger status (DONE/CANCELED) or reschedule.
 */
router.patch('/triggers/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const talentId = req.talentId;
        if (!talentId) {
            return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
        }

        const { id } = req.params;
        const { status, due_at, title, description } = req.body || {};

        const nextStatus: TriggerStatus | null =
            (status === 'PENDING' || status === 'DONE' || status === 'CANCELED') ? status : null;
        let nextDueAt = due_at ? new Date(due_at) : null;
        const nextTitle = typeof title === 'string' ? title.trim() : null;
        const nextDescription = typeof description === 'string' ? description.trim() : null;
        if (nextDueAt && isNaN(nextDueAt.getTime())) {
            return res.status(400).json({ error: 'due_at invalide' });
        }
        if (nextTitle !== null && !nextTitle) {
            return res.status(400).json({ error: 'title invalide' });
        }

        // Fetch trigger to enforce ownership/membership
        const existing = await pool.query(
            `SELECT id, scope, talent_id, organization_id, code, metadata FROM agenda_triggers WHERE id = $1::uuid LIMIT 1`,
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: req.t('calendar:triggerNotFound') });
        }

        const row = existing.rows[0];
        if (row.scope === 'TALENT') {
            if (String(row.talent_id) !== String(talentId)) {
                return res.status(403).json({ error: req.t('calendar:accessDenied') });
            }
        } else {
            const allowed = await canAccessOrganizationAgenda(String(row.organization_id), talentId);
            if (!allowed) {
                return res.status(403).json({ error: req.t('organizations:notMember') });
            }
        }

        let schedulingMetadataJson: string | null = null;
        if (nextDueAt) {
            const metaObj = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
            const latestAllowedAt = row.code === 'FOLLOW_UP' && metaObj.adjusted_due_at
                ? new Date(String(metaObj.adjusted_due_at))
                : null;
            const scheduled = await resolveAgendaSchedule({
                scope: row.scope,
                talentId,
                organizationId: row.organization_id ? String(row.organization_id) : undefined,
                requestedDueAt: nextDueAt,
                excludeTriggerId: id,
                latestAllowedAt: latestAllowedAt && !isNaN(latestAllowedAt.getTime()) ? latestAllowedAt : null,
            });
            if (!scheduled) {
                return res.status(400).json({ error: req.t('copilot:toolNoAvailableAgendaSlot') });
            }
            nextDueAt = scheduled.dueAt;
            schedulingMetadataJson = JSON.stringify({
                ...metaObj,
                scheduling: {
                    requested_due_at: scheduled.requestedDueAt.toISOString(),
                    final_due_at: scheduled.dueAt.toISOString(),
                    adjusted: scheduled.adjusted,
                    reasons: scheduled.reasons,
                },
            });
        }

        const result = await pool.query(
            `
            UPDATE agenda_triggers
            SET
              status = COALESCE($2::text, status),
              due_at = COALESCE($3::timestamptz, due_at),
              title = COALESCE($4::text, title),
              description = COALESCE($5::text, description),
              metadata = CASE WHEN $6::jsonb IS NULL THEN metadata ELSE $6::jsonb END,
              completed_at = CASE WHEN COALESCE($2::text, status) = 'DONE' THEN CURRENT_TIMESTAMP ELSE completed_at END
            WHERE id = $1::uuid
            RETURNING *
            `,
            [
                id,
                nextStatus,
                nextDueAt ? nextDueAt.toISOString() : null,
                nextTitle,
                nextDescription,
                schedulingMetadataJson,
            ]
        );

        return res.json({ data: result.rows[0] });
    } catch (error: any) {
        logger.error('Error updating agenda trigger:', error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/calendar/events
 * Returns all calendar events for the authenticated user
 * Query params:
 *   - start_date: ISO date string (required)
 *   - end_date: ISO date string (required)
 *   - organizationId: UUID (optional). If present, returns organization agenda aggregation.
 */
router.get('/events', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const talentId = req.talentId;
        const userId = req.talentId || req.userId;
        const { start_date, end_date, organizationId } = req.query as any;

        if (!start_date || !end_date) {
            return res.status(400).json({ error: req.t('calendar:startEndDateRequired') });
        }

        const startDate = new Date(start_date as string);
        const endDate = new Date(end_date as string);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: req.t('calendar:invalidDateFormat') });
        }

        // Fetch all calendar-related items for the user
        const events: any[] = [];

        // --- Organization agenda (distinct view) ---
        if (organizationId) {
            if (!talentId) {
                return res.status(401).json({ error: req.t('copilot:notAuthenticated') });
            }

            const orgId = String(organizationId);
            const allowed = await canAccessOrganizationAgenda(orgId, talentId);
            if (!allowed) {
                return res.status(403).json({ error: req.t('organizations:notMember') });
            }

            // 1) Candidate applications received (organization opportunities)
            const orgApplicationsResult = await pool.query(
                `
                SELECT
                  oa.id,
                  oa.status,
                  oa.applied_at,
                  oa.viewed_at,
                  o.id as opportunity_id,
                  o.title as opportunity_title,
                  t.id as talent_id,
                  COALESCE(NULLIF(CONCAT_WS(' ', t.first_name, t.last_name), ''), t.email) as talent_name
                FROM opportunity_applications oa
                JOIN opportunities o ON o.id = oa.opportunity_id
                JOIN talents t ON t.id = oa.talent_id
                WHERE o.deleted_at IS NULL
                  AND (
                    o.organization_id = $1::uuid
                    OR EXISTS (
                      SELECT 1 FROM opportunity_posters op
                      WHERE op.opportunity_id = o.id
                        AND op.poster_organization_id = $1::uuid
                    )
                  )
                  AND oa.applied_at >= $2
                  AND oa.applied_at <= $3
                ORDER BY oa.applied_at ASC
                `,
                [orgId, startDate.toISOString(), endDate.toISOString()]
            );

            for (const row of orgApplicationsResult.rows) {
                events.push({
                    id: row.id,
                    source: 'application_received',
                    type: 'APPLICATION',
                    title: `Candidature · ${row.talent_name}`,
                    description: row.opportunity_title,
                    date: row.applied_at,
                    metadata: {
                        application_id: row.id,
                        opportunity_id: row.opportunity_id,
                        opportunity_title: row.opportunity_title,
                        talent_id: row.talent_id,
                        talent_name: row.talent_name,
                        status: row.status,
                        viewed_at: row.viewed_at,
                    },
                });
            }

            // 2) Space bookings for org spaces
            const orgReservationsResult = await pool.query(
                `
                SELECT
                  sb.id,
                  sb.start_datetime,
                  sb.end_datetime,
                  sb.status,
                  s.id as space_id,
                  s.name as space_name,
                  s.address as location
                FROM space_bookings sb
                JOIN spaces s ON s.id = sb.space_id
                WHERE s.organization_id = $1::uuid
                  AND s.deleted_at IS NULL
                  AND sb.start_datetime >= $2
                  AND sb.start_datetime <= $3
                  AND sb.status IN ('CONFIRMED', 'PENDING')
                ORDER BY sb.start_datetime ASC
                `,
                [orgId, startDate.toISOString(), endDate.toISOString()]
            );

            for (const row of orgReservationsResult.rows) {
                events.push({
                    id: row.id,
                    source: 'reservation',
                    type: 'RESERVATION',
                    title: `Réservation · ${row.space_name}`,
                    start_date: row.start_datetime,
                    end_date: row.end_datetime,
                    location: row.location,
                    status: row.status,
                    metadata: { booking_id: row.id, space_id: row.space_id },
                });
            }

            // 3) Community events (org communities)
            const orgCommunityEventsResult = await pool.query(
                `
                SELECT
                  ca.id,
                  ca.community_id,
                  ca.content,
                  ca.metadata,
                  c.name as community_name
                FROM community_activities ca
                JOIN communities c ON c.id = ca.community_id
                WHERE c.organization_id = $1::uuid
                  AND ca.type = 'EVENT'
                  AND ca.is_draft = false
                  AND (ca.metadata->>'start_date')::timestamp >= $2
                  AND (ca.metadata->>'start_date')::timestamp <= $3
                ORDER BY (ca.metadata->>'start_date')::timestamp ASC
                `,
                [orgId, startDate.toISOString(), endDate.toISOString()]
            );

            for (const row of orgCommunityEventsResult.rows) {
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
                    community_id: row.community_id,
                    community_name: row.community_name,
                });
            }

            // 4) Agent triggers (org scope)
            const orgTriggersResult = await pool.query(
                `
                SELECT id, code, title, description, due_at, status, priority, metadata
                FROM agenda_triggers
                WHERE scope = 'ORGANIZATION'
                  AND organization_id = $1::uuid
                  AND due_at >= $2
                  AND due_at <= $3
                  AND status = 'PENDING'
                ORDER BY due_at ASC
                `,
                [orgId, startDate.toISOString(), endDate.toISOString()]
            );

            for (const row of orgTriggersResult.rows) {
                events.push({
                    id: row.id,
                    source: 'trigger',
                    type: 'TRIGGER',
                    title: row.title,
                    description: row.description,
                    scheduled_at: row.due_at,
                    metadata: { code: row.code, priority: row.priority, ...row.metadata },
                });
            }

            events.sort((a, b) => {
                const dateA = new Date(a.scheduled_at || a.start_date || a.date);
                const dateB = new Date(b.scheduled_at || b.start_date || b.date);
                return dateA.getTime() - dateB.getTime();
            });

            return res.json({ data: events });
        }

        // 1. Scheduled posts (from community activities where author is user and has scheduled_at)
        const scheduledPostsResult = await pool.query(`
            SELECT
                ca.id,
                ca.community_id,
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
                community_id: row.community_id,
                community_name: row.community_name,
            });
        }

        // 2. Community events (from community activities where type = EVENT)
        const communityEventsResult = await pool.query(`
            SELECT
                ca.id,
                ca.community_id,
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
                community_id: row.community_id,
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

        // 5. Agent triggers (talent scope)
        if (talentId) {
            const triggersResult = await pool.query(
                `
                SELECT id, code, title, description, due_at, status, priority, metadata
                FROM agenda_triggers
                WHERE scope = 'TALENT'
                  AND talent_id = $1::uuid
                  AND due_at >= $2
                  AND due_at <= $3
                  AND status = 'PENDING'
                ORDER BY due_at ASC
                `,
                [talentId, startDate.toISOString(), endDate.toISOString()]
            );

            for (const row of triggersResult.rows) {
                events.push({
                    id: row.id,
                    source: 'trigger',
                    type: 'TRIGGER',
                    title: row.title,
                    description: row.description,
                    scheduled_at: row.due_at,
                    metadata: { code: row.code, priority: row.priority, ...row.metadata },
                });
            }
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
