/**
 * Execute Action Tool — Perform user-confirmed actions
 * Factory pattern with injected authenticatedTalentId for IDOR protection
 * Actions: apply_opportunity, join_community, book_space, accept_invitation, decline_invitation
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { pool } from '../../database';
import { logger } from '../../../utils';

const ACTION_TYPES = [
  'apply_opportunity',
  'join_community',
  'book_space',
  'accept_invitation',
  'decline_invitation',
] as const;

export function createExecuteActionTool(authenticatedTalentId: string) {
  return defineTool({
    name: 'execute_action',
    description:
      'Execute a user-confirmed action on the platform. ALWAYS show a confirmation block to the user BEFORE calling this tool. Actions: apply to opportunity, join community, book space, accept/decline invitation.',
    parameters: z.object({
      action: z.enum(ACTION_TYPES).describe('The action to execute'),
      entityId: z.string().describe('The UUID of the target entity (opportunity, community, space, or invitation)'),
      dataJson: z.string().describe('Additional data as JSON string. For book_space: \'{"startDatetime":"...","endDatetime":"..."}\'. For other actions: pass empty string "".'),
    }),
    execute: async ({ action, entityId, dataJson }) => {
      const talentId = authenticatedTalentId;
      const data = dataJson && dataJson.trim() ? JSON.parse(dataJson) : {};

      try {
        switch (action) {
          case 'apply_opportunity': {
            // Check opportunity exists and is open
            const opp = await pool.query(
              `SELECT id, title, status, deadline FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
              [entityId]
            );
            if (opp.rows.length === 0) {
              return { success: false, error: "Cette opportunité n'existe pas ou a été supprimée." };
            }
            if (opp.rows[0].status !== 'OPEN') {
              return { success: false, error: "Cette opportunité n'est plus ouverte aux candidatures." };
            }
            if (opp.rows[0].deadline && new Date(opp.rows[0].deadline) < new Date()) {
              return { success: false, error: 'La date limite de candidature est dépassée.' };
            }

            // Check not already applied
            const existing = await pool.query(
              `SELECT id FROM opportunity_applications WHERE talent_id = $1 AND opportunity_id = $2`,
              [talentId, entityId]
            );
            if (existing.rows.length > 0) {
              return { success: false, error: 'Tu as déjà postulé à cette opportunité.' };
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
              message: `Candidature soumise pour "${opp.rows[0].title}".`,
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
              return { success: false, error: "Cette communauté n'existe pas." };
            }
            if (comm.rows[0].status !== 'ACTIVE') {
              return { success: false, error: "Cette communauté n'est pas active." };
            }

            // Check not already member
            const existing = await pool.query(
              `SELECT id FROM community_members WHERE talent_id = $1 AND community_id = $2 AND status = 'ACTIVE'`,
              [talentId, entityId]
            );
            if (existing.rows.length > 0) {
              return { success: false, error: 'Tu es déjà membre de cette communauté.' };
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
              message: `Tu as rejoint la communauté "${comm.rows[0].name}".`,
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
              return { success: false, error: "Cet espace n'existe pas." };
            }
            if (space.rows[0].status !== 'ACTIVE') {
              return { success: false, error: "Cet espace n'est pas disponible." };
            }

            const startDatetime = data.startDatetime || data.start_datetime;
            const endDatetime = data.endDatetime || data.end_datetime;
            if (!startDatetime || !endDatetime) {
              return { success: false, error: 'Les dates de début et de fin sont requises (startDatetime, endDatetime).' };
            }

            // Check no conflict
            const conflict = await pool.query(
              `SELECT id FROM space_bookings
               WHERE space_id = $1 AND status IN ('PENDING', 'CONFIRMED')
               AND start_datetime < $3 AND end_datetime > $2`,
              [entityId, startDatetime, endDatetime]
            );
            if (conflict.rows.length > 0) {
              return { success: false, error: 'Ce créneau est déjà réservé.' };
            }

            // Calculate duration and total amount
            const hourlyRate = parseFloat(space.rows[0].hourly_rate) || 0;
            const durationMs = new Date(endDatetime).getTime() - new Date(startDatetime).getTime();
            const durationHours = Math.max(durationMs / (1000 * 60 * 60), 1); // minimum 1 hour
            const totalAmount = Math.round(hourlyRate * durationHours * 100) / 100;

            // Book
            const result = await pool.query(
              `INSERT INTO space_bookings (talent_id, space_id, organization_id, start_datetime, end_datetime,
               pricing_type, unit_price, units_count, subtotal, total_amount, status, created_at)
               VALUES ($1, $2, $3, $4, $5, 'HOURLY', $6, $7, $8, $8, 'PENDING', NOW())
               RETURNING id`,
              [talentId, entityId, space.rows[0].organization_id, startDatetime, endDatetime,
               hourlyRate, durationHours, totalAmount]
            );

            logger.info(`[execute_action] Talent ${talentId} booked space ${entityId}`);
            return {
              success: true,
              message: `Réservation de "${space.rows[0].name}" soumise (${durationHours}h — ${totalAmount} FCFA).`,
              bookingId: result.rows[0].id,
            };
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
              return { success: true, message: `Invitation ${newStatus === 'ACCEPTED' ? 'acceptée' : 'déclinée'}.` };
            }

            // Try organization invitations
            result = await pool.query(
              `UPDATE organization_invitations SET status = $3, updated_at = NOW()
               WHERE id = $1 AND email = (SELECT email FROM talents WHERE id = $2) AND status = 'PENDING'
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
              return { success: true, message: `Invitation ${newStatus === 'ACCEPTED' ? 'acceptée' : 'déclinée'}.` };
            }

            return { success: false, error: "Invitation non trouvée ou déjà traitée." };
          }

          default:
            return { success: false, error: `Action "${action}" non supportée.` };
        }
      } catch (error: any) {
        logger.error(`[execute_action] Error (${action} ${entityId}): ${error.message}`);
        return { success: false, error: error.message };
      }
    },
  });
}
