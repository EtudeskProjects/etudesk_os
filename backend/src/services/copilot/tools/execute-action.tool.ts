/**
 * Execute Action Tool — Perform user-confirmed actions
 * Factory pattern with injected authenticatedTalentId for IDOR protection
 * Actions: apply_opportunity, join_community, book_space, accept_invitation, decline_invitation
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { pool } from '../../database';
import { logger } from '../../../utils';
import { i18next } from '../../../i18n';
import { resolveAgendaSchedule } from '../../agenda-scheduling.service';
import { debitWalletForAction } from '../../billing/credit.service';

const ACTION_TYPES = [
  'apply_opportunity',
  'join_community',
  'book_space',
  'accept_invitation',
  'decline_invitation',
  // Agenda triggers (agent scheduled follow-ups / reminders)
  'create_agenda_trigger',
  'update_agenda_trigger',
] as const;

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

async function resolveOpportunityStartDateForFollowUp(data: Record<string, any>): Promise<string | null> {
  const metadata = (data.metadata && typeof data.metadata === 'object') ? data.metadata as Record<string, any> : {};
  const applicationId = data.applicationId || data.application_id || metadata.applicationId || metadata.application_id || null;
  const opportunityId = data.opportunityId || data.opportunity_id || metadata.opportunityId || metadata.opportunity_id || null;

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

export function createExecuteActionTool(authenticatedTalentId: string, language?: string) {
  return defineTool({
    name: 'execute_action',
    description:
      'Execute a user-confirmed action on the platform. ALWAYS show a confirmation block to the user BEFORE calling this tool. Actions: apply to opportunity, join community, book space, accept/decline invitation.',
    parameters: z.object({
      action: z.enum(ACTION_TYPES).describe('The action to execute'),
      entityId: z.string().optional().default('').describe('The UUID of the target entity (opportunity, community, space, invitation, or trigger). For create_agenda_trigger tool execution, empty string "" is accepted, but UI confirmation blocks should use "self".'),
      dataJson: z
        .union([z.string(), z.record(z.string(), z.unknown())])
        .default('')
        .describe('Additional data as JSON string or object. For book_space: \'{"startDatetime":"...","endDatetime":"..."}\'. For agenda: \'{"code":"FOLLOW_UP","title":"...","dueAt":"...","organizationId":"...","priority":"HIGH","metadata":{...}}\''),
    }),
    normalize: (raw) => {
      // Handle aliases: entity_id → entityId, data → dataJson, data_json → dataJson
      return {
        ...raw,
        action: raw.action || raw.type,
        entityId: raw.entityId || raw.entity_id || raw.id || '',
        dataJson: raw.dataJson || raw.data_json || raw.data || '',
      };
    },
    execute: async ({ action, entityId, dataJson }) => {
      const talentId = authenticatedTalentId;
      const tr = (key: string, options?: Record<string, any>) => i18next.t(key, { lng: language, ...(options || {}) });
      // Accept dataJson as object or string (some providers may send objects)
      const data = typeof dataJson === 'object' && dataJson !== null
        ? dataJson
        : (typeof dataJson === 'string' && dataJson.trim() ? JSON.parse(dataJson) : {});

      // Sanitize known fields to prevent oversized or extreme values
      if (data.code) data.code = String(data.code).slice(0, 100);
      if (data.title) data.title = String(data.title).slice(0, 200);
      if (data.description) data.description = String(data.description).slice(0, 2000);
      if (data.dueAt || data.due_at) {
        const rawDate = data.dueAt || data.due_at;
        const d = new Date(String(rawDate));
        if (isNaN(d.getTime()) || d.getFullYear() < 2020 || d.getFullYear() > 2035) {
          delete data.dueAt;
          delete data.due_at;
        }
      }

      try {
        switch (action) {
          case 'create_agenda_trigger': {
            const code = String(data.code || '').trim();
            const title = String(data.title || '').trim();
            const description = (data.description !== undefined && data.description !== null) ? String(data.description) : null;
            const dueAtRaw = data.dueAt || data.due_at;
            const organizationId = data.organizationId || data.organization_id;
            const priority = (data.priority === 'LOW' || data.priority === 'HIGH') ? data.priority : 'NORMAL';
            let metadata = (data.metadata && typeof data.metadata === 'object') ? { ...(data.metadata as Record<string, any>) } : {};

            if (!code || code.length < 2) {
              return { success: false, error: tr('copilot:toolCodeRequired') };
            }
            if (!title || title.length < 2) {
              return { success: false, error: tr('copilot:toolTitleRequired') };
            }
            if (!dueAtRaw) {
              return { success: false, error: tr('copilot:toolDueAtRequired') };
            }
            let dueAt = new Date(String(dueAtRaw));
            if (isNaN(dueAt.getTime())) {
              return { success: false, error: tr('copilot:toolDueAtInvalid') };
            }
            let latestAllowedAt: Date | null = null;

            // FOLLOW_UP must account for opportunity start_date when available.
            if (code.toUpperCase() === 'FOLLOW_UP') {
              const startDate = await resolveOpportunityStartDateForFollowUp(data);
              if (startDate) {
                const cappedDueAt = dayBeforeStartAt0900Utc(startDate);
                latestAllowedAt = cappedDueAt;
                if (dueAt > cappedDueAt) {
                  dueAt = cappedDueAt;
                  metadata = {
                    ...metadata,
                    adjusted_due_to_start_date: true,
                    opportunity_start_date: startDate,
                    adjusted_due_at: dueAt.toISOString(),
                  };
                }
              }
            }

            const scope = organizationId ? 'ORGANIZATION' : 'TALENT';
            const scheduled = await resolveAgendaSchedule({
              scope,
              talentId,
              organizationId: organizationId ? String(organizationId) : undefined,
              requestedDueAt: dueAt,
              latestAllowedAt,
            });
            if (!scheduled) {
              return { success: false, error: tr('copilot:toolNoAvailableAgendaSlot') };
            }
            dueAt = scheduled.dueAt;
            metadata = {
              ...metadata,
              scheduling: {
                requested_due_at: scheduled.requestedDueAt.toISOString(),
                final_due_at: scheduled.dueAt.toISOString(),
                adjusted: scheduled.adjusted,
                reasons: scheduled.reasons,
              },
            };

            if (organizationId) {
              // Must be an active member of the org to create org triggers
              const membership = await pool.query(
                `SELECT 1 FROM organization_members WHERE organization_id = $1::uuid AND talent_id = $2::uuid AND status = 'ACTIVE' LIMIT 1`,
                [String(organizationId), talentId]
              );
              if (membership.rows.length === 0) {
                return { success: false, error: tr('copilot:toolOrgAccessDenied') };
              }

              // Debit credits for org scheduled task
              const debitIdempotencyKey = `org_sched_${organizationId}_${code}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              try {
                await debitWalletForAction({
                  scope: 'ORGANIZATION',
                  ownerId: String(organizationId),
                  actionCode: 'ORG_SCHEDULED_TASK',
                  idempotencyKey: debitIdempotencyKey,
                  metadata: { code, title },
                  createdBy: talentId,
                });
              } catch (debitError: any) {
                if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
                  return { success: false, error: tr('billing:insufficientCredits') };
                }
                throw debitError;
              }

              const result = await pool.query(
                `INSERT INTO agenda_triggers (scope, organization_id, code, title, description, due_at, status, priority, metadata, created_by)
                 VALUES ('ORGANIZATION', $1::uuid, $2, $3, $4, $5, 'PENDING', $6, $7::jsonb, $8::uuid)
                 RETURNING id`,
                [String(organizationId), code, title, description, dueAt.toISOString(), priority, JSON.stringify(metadata), talentId]
              );

              return { success: true, message: tr('copilot:toolOrgTriggerCreated'), triggerId: result.rows[0].id };
            }

            const result = await pool.query(
              `INSERT INTO agenda_triggers (scope, talent_id, code, title, description, due_at, status, priority, metadata, created_by)
               VALUES ('TALENT', $1::uuid, $2, $3, $4, $5, 'PENDING', $6, $7::jsonb, $8::uuid)
               RETURNING id`,
              [talentId, code, title, description, dueAt.toISOString(), priority, JSON.stringify(metadata), talentId]
            );

            return {
              success: true,
              message: tr('copilot:toolTalentTriggerCreated'),
              triggerId: result.rows[0].id,
              dueAt: dueAt.toISOString(),
              schedulingAdjusted: scheduled.adjusted,
              schedulingReasons: scheduled.reasons,
            };
          }

          case 'update_agenda_trigger': {
            if (!entityId) return { success: false, error: tr('copilot:toolEntityIdRequired') };

            const nextStatus = (data.status === 'PENDING' || data.status === 'DONE' || data.status === 'CANCELED') ? data.status : null;
            const dueAtRaw = data.dueAt || data.due_at;
            const nextDueAt = dueAtRaw ? new Date(String(dueAtRaw)) : null;
            if (nextDueAt && isNaN(nextDueAt.getTime())) {
              return { success: false, error: tr('copilot:toolDueAtInvalid') };
            }
            const metadata = (data.metadata && typeof data.metadata === 'object') ? data.metadata : null;

            // Fetch trigger to enforce access control
            const existing = await pool.query(
              `SELECT id, scope, talent_id, organization_id, code, metadata FROM agenda_triggers WHERE id = $1::uuid LIMIT 1`,
              [entityId]
            );
            if (existing.rows.length === 0) {
              return { success: false, error: tr('copilot:toolTriggerNotFound') };
            }
            const row = existing.rows[0];
            if (row.scope === 'TALENT') {
              if (String(row.talent_id) !== String(talentId)) {
                return { success: false, error: tr('copilot:toolAccessDenied') };
              }
            } else {
              const membership = await pool.query(
                `SELECT 1 FROM organization_members WHERE organization_id = $1::uuid AND talent_id = $2::uuid AND status = 'ACTIVE' LIMIT 1`,
                [String(row.organization_id), talentId]
              );
              if (membership.rows.length === 0) {
                return { success: false, error: tr('copilot:toolOrgAccessDenied') };
              }
            }

            let normalizedDueAt = nextDueAt;
            let normalizedMetadata = metadata ? { ...metadata } : null;
            if (normalizedDueAt) {
              const existingMetadata = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
              const latestAllowedAt = row.code === 'FOLLOW_UP' && existingMetadata.adjusted_due_at
                ? new Date(String(existingMetadata.adjusted_due_at))
                : null;
              const scheduled = await resolveAgendaSchedule({
                scope: row.scope,
                talentId,
                organizationId: row.organization_id ? String(row.organization_id) : undefined,
                requestedDueAt: normalizedDueAt,
                excludeTriggerId: entityId,
                latestAllowedAt: latestAllowedAt && !isNaN(latestAllowedAt.getTime()) ? latestAllowedAt : null,
              });
              if (!scheduled) {
                return { success: false, error: tr('copilot:toolNoAvailableAgendaSlot') };
              }
              normalizedDueAt = scheduled.dueAt;
              normalizedMetadata = {
                ...(normalizedMetadata || {}),
                scheduling: {
                  requested_due_at: scheduled.requestedDueAt.toISOString(),
                  final_due_at: scheduled.dueAt.toISOString(),
                  adjusted: scheduled.adjusted,
                  reasons: scheduled.reasons,
                },
              };
            }

            const result = await pool.query(
              `
              UPDATE agenda_triggers
              SET
                status = COALESCE($2::text, status),
                due_at = COALESCE($3::timestamptz, due_at),
                metadata = CASE WHEN $4::jsonb IS NULL THEN metadata ELSE (metadata || $4::jsonb) END,
                completed_at = CASE WHEN COALESCE($2::text, status) = 'DONE' THEN CURRENT_TIMESTAMP ELSE completed_at END
              WHERE id = $1::uuid
              RETURNING id, status, due_at
              `,
              [entityId, nextStatus, normalizedDueAt ? normalizedDueAt.toISOString() : null, normalizedMetadata ? JSON.stringify(normalizedMetadata) : null]
            );

            return { success: true, message: tr('copilot:toolTriggerUpdated'), data: result.rows[0] };
          }

          case 'apply_opportunity': {
            // Check opportunity exists and is open
            const opp = await pool.query(
              `SELECT id, title, status, deadline FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
              [entityId]
            );
            if (opp.rows.length === 0) {
              return { success: false, error: tr('copilot:toolOpportunityNotFound') };
            }
            if (opp.rows[0].status !== 'OPEN') {
              return { success: false, error: tr('copilot:toolOpportunityNotOpen') };
            }
            if (opp.rows[0].deadline && new Date(opp.rows[0].deadline) < new Date()) {
              return { success: false, error: tr('copilot:toolDeadlinePassed') };
            }

            // Check not already applied
            const existing = await pool.query(
              `SELECT id FROM opportunity_applications WHERE talent_id = $1 AND opportunity_id = $2`,
              [talentId, entityId]
            );
            if (existing.rows.length > 0) {
              return { success: false, error: tr('copilot:toolAlreadyApplied') };
            }

            // Apply
            const result = await pool.query(
              `INSERT INTO opportunity_applications (talent_id, opportunity_id, status, applied_at)
               VALUES ($1, $2, 'SUBMITTED', NOW())
               RETURNING id`,
              [talentId, entityId]
            );

            logger.info(`[execute_action] Talent ${talentId} applied to opportunity ${entityId}`);
            return {
              success: true,
              message: tr('copilot:toolApplicationSuccess', { title: opp.rows[0].title }),
              applicationId: result.rows[0].id,
            };
          }

          case 'join_community': {
            // Check community exists
            const comm = await pool.query(
              `SELECT id, name, status FROM communities WHERE id = $1 AND deleted_at IS NULL`,
              [entityId]
            );
            if (comm.rows.length === 0) {
              return { success: false, error: tr('copilot:toolCommunityNotFound') };
            }
            if (comm.rows[0].status !== 'ACTIVE') {
              return { success: false, error: tr('copilot:toolCommunityNotActive') };
            }

            // Check not already member
            const existing = await pool.query(
              `SELECT id FROM community_members WHERE talent_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
              [talentId, entityId]
            );
            if (existing.rows.length > 0) {
              return { success: false, error: tr('copilot:toolAlreadyMember') };
            }

            // Join
            const result = await pool.query(
              `INSERT INTO community_members (talent_id, community_id, role, status, created_at)
               VALUES ($1, $2, 'MEMBER', 'ACTIVE', NOW())
               RETURNING id`,
              [talentId, entityId]
            );

            logger.info(`[execute_action] Talent ${talentId} joined community ${entityId}`);
            return {
              success: true,
              message: tr('copilot:toolJoinCommunitySuccess', { name: comm.rows[0].name }),
              membershipId: result.rows[0].id,
            };
          }

          case 'book_space': {
            // Check space exists and is active
            const space = await pool.query(
              `SELECT id, name, status, hourly_rate, organization_id FROM spaces WHERE id = $1 AND deleted_at IS NULL`,
              [entityId]
            );
            if (space.rows.length === 0) {
              return { success: false, error: tr('copilot:toolSpaceNotFound') };
            }
            if (space.rows[0].status !== 'ACTIVE') {
              return { success: false, error: tr('copilot:toolSpaceNotAvailable') };
            }

            const startDatetime = data.startDatetime || data.start_datetime;
            const endDatetime = data.endDatetime || data.end_datetime;
            if (!startDatetime || !endDatetime) {
              return { success: false, error: tr('copilot:toolBookingDatesRequired') };
            }

            // Validate dates are not inverted
            const durationMs = new Date(endDatetime).getTime() - new Date(startDatetime).getTime();
            if (durationMs <= 0) {
              return { success: false, error: 'End date must be after start date' };
            }

            // Atomic transaction: conflict check + INSERT to prevent double bookings
            const client = await pool.connect();
            try {
              await client.query('BEGIN');

              // Lock the space row to serialize concurrent bookings
              await client.query(
                `SELECT id FROM spaces WHERE id = $1 FOR UPDATE`,
                [entityId]
              );

              // Check no conflict (within transaction)
              const conflict = await client.query(
                `SELECT id FROM space_bookings
                 WHERE space_id = $1 AND status IN ('PENDING', 'CONFIRMED')
                 AND start_datetime < $3 AND end_datetime > $2`,
                [entityId, startDatetime, endDatetime]
              );
              if (conflict.rows.length > 0) {
                await client.query('ROLLBACK');
                return { success: false, error: tr('copilot:toolSlotTaken') };
              }

              // Calculate duration and total amount
              const hourlyRate = parseFloat(space.rows[0].hourly_rate) || 0;
              const durationHours = Math.max(durationMs / (1000 * 60 * 60), 1); // minimum 1 hour
              const totalAmount = Math.round(hourlyRate * durationHours * 100) / 100;

              // Book (within transaction)
              const result = await client.query(
                `INSERT INTO space_bookings (talent_id, space_id, organization_id, start_datetime, end_datetime,
                 pricing_type, unit_price, units_count, subtotal, total_amount, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, 'HOURLY', $6, $7, $8, $8, 'PENDING', NOW())
                 RETURNING id`,
                [talentId, entityId, space.rows[0].organization_id, startDatetime, endDatetime,
                 hourlyRate, durationHours, totalAmount]
              );

              await client.query('COMMIT');

              logger.info(`[execute_action] Talent ${talentId} booked space ${entityId}`);
              return {
                success: true,
                message: tr('copilot:toolBookingSuccess', { name: space.rows[0].name, hours: durationHours, amount: totalAmount }),
                bookingId: result.rows[0].id,
              };
            } catch (txError) {
              await client.query('ROLLBACK');
              throw txError;
            } finally {
              client.release();
            }
          }

          case 'accept_invitation':
          case 'decline_invitation': {
            const newStatus = action === 'accept_invitation' ? 'ACCEPTED' : 'DECLINED';

            // Try community invitations first
            let result = await pool.query(
              `UPDATE community_invitations SET status = $3, updated_at = NOW()
               WHERE id = $1 AND invitee_talent_id = $2 AND status = 'PENDING'
               RETURNING id, community_id`,
              [entityId, talentId, newStatus]
            );

            if (result.rows.length > 0) {
              // If accepted, add as member
              if (action === 'accept_invitation') {
                await pool.query(
                  `INSERT INTO community_members (talent_id, community_id, role, status, created_at)
                   VALUES ($1, $2, 'MEMBER', 'ACTIVE', NOW())
                   ON CONFLICT DO NOTHING`,
                  [talentId, result.rows[0].community_id]
                );
              }
              logger.info(`[execute_action] Talent ${talentId} ${newStatus.toLowerCase()} community invitation ${entityId}`);
              return { success: true, message: newStatus === 'ACCEPTED' ? tr('copilot:toolInvitationAccepted') : tr('copilot:toolInvitationDeclined') };
            }

            // Organization invitations are email-based in the current schema.
            result = await pool.query(
              `UPDATE organization_invitations SET status = $3, updated_at = NOW()
               WHERE id = (
                 SELECT id FROM organization_invitations
                 WHERE id = $1 AND status = 'PENDING'
                   AND email = (SELECT email FROM talents WHERE id = $2 AND email IS NOT NULL)
                 LIMIT 1
               )
               RETURNING id, organization_id, role`,
              [entityId, talentId, newStatus]
            );

            if (result.rows.length > 0) {
              if (action === 'accept_invitation') {
                await pool.query(
                  `INSERT INTO organization_members (talent_id, organization_id, role, status, created_at)
                   VALUES ($1, $2, $3, 'ACTIVE', NOW())
                   ON CONFLICT DO NOTHING`,
                  [talentId, result.rows[0].organization_id, result.rows[0].role || 'MEMBER']
                );
              }
              logger.info(`[execute_action] Talent ${talentId} ${newStatus.toLowerCase()} org invitation ${entityId}`);
              return { success: true, message: newStatus === 'ACCEPTED' ? tr('copilot:toolInvitationAccepted') : tr('copilot:toolInvitationDeclined') };
            }

            return { success: false, error: tr('copilot:toolInvitationNotFound') };
          }

          default:
            return { success: false, error: tr('copilot:toolActionUnsupported', { action }) };
        }
      } catch (error: any) {
        logger.error(`[execute_action] Error (${action} ${entityId}): ${error.message}`);
        return { success: false, error: error.message };
      }
    },
  });
}
