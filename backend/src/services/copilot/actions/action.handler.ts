/**
 * Action Handler
 * Processes confirmed actions from the frontend confirmation component.
 */

import { v4 as uuidv4 } from 'uuid';
import { pool, generateSlug } from '../../database';
import { logger } from '../../../utils';
import { cache } from '../../../utils/cache';
import {
  upsertOpportunityEmbedding,
  upsertCommunityEmbedding,
  upsertSpaceEmbedding,
} from '../../embedding.service';
import {
  validateApplyOpportunity,
  validateJoinCommunity,
  validateBookSpace,
  validateRespondInvitation,
  validatePublishOpportunity,
  validateCreateCommunity,
  validateCreateSpace,
} from './action.validators';

export interface ActionRequest {
  action: string;
  entityId: string;
  sessionId?: string;
  data?: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

export async function handleConfirmation(
  talentId: string,
  request: ActionRequest
): Promise<ActionResult> {
  const { action, entityId, sessionId, data } = request;

  // Resolve "self" entity_id to the talent's own ID
  const resolvedEntityId = entityId === 'self' ? talentId : entityId;

  try {
    switch (action) {
      case 'apply_opportunity': {
        const validation = await validateApplyOpportunity(talentId, entityId);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const result = await pool.query(
          `INSERT INTO opportunity_applications (talent_id, opportunity_id, status, applied_at)
           VALUES ($1, $2, 'SUBMITTED', NOW())
           RETURNING id`,
          [talentId, entityId]
        );

        const message = `Candidature soumise pour "${validation.data?.title}".`;
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} applied to opportunity ${entityId}`);
        return { success: true, message, data: { applicationId: result.rows[0].id } };
      }

      case 'join_community': {
        const validation = await validateJoinCommunity(talentId, entityId);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const result = await pool.query(
          `INSERT INTO community_members (talent_id, community_id, role, status, created_at)
           VALUES ($1, $2, 'MEMBER', 'ACTIVE', NOW())
           RETURNING id`,
          [talentId, entityId]
        );

        const message = `Vous avez rejoint la communauté "${validation.data?.name}".`;
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} joined community ${entityId}`);
        return { success: true, message, data: { membershipId: result.rows[0].id } };
      }

      case 'book_space': {
        const validation = await validateBookSpace(talentId, entityId, data);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const result = await pool.query(
          `INSERT INTO space_bookings (talent_id, space_id, start_datetime, end_datetime, status, total_amount, created_at)
           VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW())
           RETURNING id`,
          [talentId, entityId, data?.startDatetime, data?.endDatetime, validation.data?.rate || 0]
        );

        const message = `Réservation de "${validation.data?.name}" soumise.`;
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} booked space ${entityId}`);
        return { success: true, message, data: { bookingId: result.rows[0].id } };
      }

      case 'accept_invitation':
      case 'decline_invitation': {
        const accept = action === 'accept_invitation';
        const validation = await validateRespondInvitation(talentId, entityId, accept);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const newStatus = accept ? 'ACCEPTED' : 'DECLINED';
        const invType = validation.data?.type;

        if (invType === 'community') {
          await pool.query(
            `UPDATE community_invitations SET status = $2, updated_at = NOW() WHERE id = $1`,
            [entityId, newStatus]
          );
          if (accept) {
            const inv = await pool.query(
              `SELECT community_id FROM community_invitations WHERE id = $1`,
              [entityId]
            );
            if (inv.rows.length > 0) {
              await pool.query(
                `INSERT INTO community_members (talent_id, community_id, role, status, created_at)
                 VALUES ($1, $2, 'MEMBER', 'ACTIVE', NOW()) ON CONFLICT DO NOTHING`,
                [talentId, inv.rows[0].community_id]
              );
            }
          }
        } else if (invType === 'organization') {
          await pool.query(
            `UPDATE organization_invitations SET status = $2, updated_at = NOW() WHERE id = $1`,
            [entityId, newStatus]
          );
          if (accept) {
            const inv = await pool.query(
              `SELECT organization_id, role FROM organization_invitations WHERE id = $1`,
              [entityId]
            );
            if (inv.rows.length > 0) {
              await pool.query(
                `INSERT INTO organization_members (talent_id, organization_id, role, status, created_at)
                 VALUES ($1, $2, $3, 'ACTIVE', NOW()) ON CONFLICT DO NOTHING`,
                [talentId, inv.rows[0].organization_id, inv.rows[0].role || 'MEMBER']
              );
            }
          }
        }

        const message = `Invitation ${accept ? 'acceptée' : 'déclinée'}.`;
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} ${newStatus.toLowerCase()} invitation ${entityId}`);
        return { success: true, message };
      }

      case 'publish_opportunity': {
        const orgId = data?.organization_id || entityId;
        const validation = await validatePublishOpportunity(talentId, orgId, data);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const id = uuidv4();
        const title = data!.title;
        const slug = generateSlug(title) + '-' + id.slice(0, 8);
        const postedAt = new Date().toISOString();

        const result = await pool.query(
          `INSERT INTO opportunities (
            id, title, slug, type, contract_type, work_rhythm, summary, requirements, nice_to_have,
            compensation_min, compensation_max, currency, compensation_frequency,
            location_type, locations, posted_at, deadline,
            status, organization_id, visibility, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            'OPEN', $18, 'PUBLIC', NOW(), NOW()
          ) RETURNING id`,
          [
            id, title, slug,
            data!.type || null, data!.contract_type || null, data!.work_rhythm || null,
            data!.summary || null, data!.requirements || null, data!.nice_to_have || null,
            data!.compensation_min || null, data!.compensation_max || null,
            data!.currency || null, data!.compensation_frequency || null,
            data!.location_type || null,
            data!.locations ? JSON.stringify(data!.locations) : null,
            postedAt, data!.deadline || null,
            orgId,
          ]
        );

        // Insert poster
        await pool.query(
          `INSERT INTO opportunity_posters (opportunity_id, talent_id, role) VALUES ($1, $2, 'AUTHOR')`,
          [id, talentId]
        );

        // Async embedding upsert
        upsertOpportunityEmbedding(id, {
          title,
          summary: data!.summary,
          requirements: data!.requirements,
          contract_type: data!.contract_type,
          location_type: data!.location_type,
          locations: data!.locations,
          type: data!.type,
        }).catch(() => {});

        const message = `Offre "${title}" publiée avec succès.`;
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} published opportunity ${id} for org ${orgId}`);
        return { success: true, message, data: { opportunityId: id } };
      }

      case 'create_community': {
        const orgId = data?.organization_id || entityId;
        const validation = await validateCreateCommunity(talentId, orgId, data);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const name = data!.name;
        let slug = generateSlug(name);
        // Ensure unique slug
        let slugExists = true;
        let attempt = 0;
        while (slugExists) {
          const check = await pool.query(
            `SELECT id FROM communities WHERE slug = $1`,
            [attempt === 0 ? slug : `${slug}-${attempt}`]
          );
          if (check.rows.length === 0) {
            if (attempt > 0) slug = `${slug}-${attempt}`;
            slugExists = false;
          } else {
            attempt++;
          }
        }

        const result = await pool.query(
          `INSERT INTO communities (
            name, slug, organization_id, type, description,
            access_type, visibility, sectors, city, country,
            created_by, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE')
          RETURNING id`,
          [
            name, slug, orgId,
            data!.type || 'PROFESSIONAL',
            data!.description || null,
            data!.access_type || 'OPEN',
            data!.visibility || 'PUBLIC',
            data!.sectors ? JSON.stringify(data!.sectors) : null,
            data!.city || null,
            data!.country || null,
            talentId,
          ]
        );

        const communityId = result.rows[0].id;

        // Add creator as ADMIN member
        await pool.query(
          `INSERT INTO community_members (talent_id, community_id, role, status, created_at)
           VALUES ($1, $2, 'ADMIN', 'ACTIVE', NOW())`,
          [talentId, communityId]
        );

        // Async embedding upsert
        upsertCommunityEmbedding(communityId, {
          name,
          description: data!.description,
          type: data!.type,
          access_type: data!.access_type,
          city: data!.city,
          country: data!.country,
          sectors: data!.sectors,
        }).catch(() => {});

        const message = `Communauté "${name}" créée avec succès.`;
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} created community ${communityId} for org ${orgId}`);
        return { success: true, message, data: { communityId } };
      }

      case 'create_space': {
        const orgId = data?.organization_id || entityId;
        const validation = await validateCreateSpace(talentId, orgId, data);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const id = uuidv4();
        const name = data!.name;
        const slug = generateSlug(name) + '-' + id.slice(0, 8);

        await pool.query(
          `INSERT INTO spaces (
            id, name, slug, description, type, surface_m2, capacity,
            city, country, organization_id, created_by,
            hourly_rate, daily_rate,
            equipment, amenities,
            is_bookable, visibility,
            status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            'ACTIVE', NOW(), NOW()
          ) RETURNING id`,
          [
            id, name, slug,
            data!.description || null,
            data!.type,
            data!.surface_m2,
            data!.capacity || null,
            data!.city || null,
            data!.country || 'CI',
            orgId, talentId,
            data!.hourly_rate || null,
            data!.daily_rate || null,
            data!.equipment || [],
            data!.amenities || [],
            data!.is_bookable !== false,
            data!.visibility || 'PUBLIC',
          ]
        );

        // Async embedding upsert
        upsertSpaceEmbedding(id, {
          name,
          description: data!.description,
          type: data!.type,
          capacity: data!.capacity,
          city: data!.city,
          country: data!.country,
          equipment: data!.equipment,
          amenities: data!.amenities,
          hourly_rate: data!.hourly_rate,
        }).catch(() => {});

        const message = `Espace "${name}" créé avec succès.`;
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} created space ${id} for org ${orgId}`);
        return { success: true, message, data: { spaceId: id } };
      }

      case 'update_profile': {
        if (!data || Object.keys(data).length === 0) {
          return { success: false, message: 'Aucune donnée de profil à mettre à jour.' };
        }

        // Allowed fields for profile update
        const ALLOWED_FIELDS: Record<string, string> = {
          bio: 'bio',
          city: 'city',
          country: 'country',
          goals: 'goals',
          remote_ready: 'remote_ready',
          willing_to_relocate: 'willing_to_relocate',
          profile_tags: 'profile_tags',
        };

        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(data)) {
          const dbField = ALLOWED_FIELDS[key];
          if (!dbField) continue;

          // Handle array fields (profile_tags, goals — max 3 each, pass as JS array for pg TEXT[])
          if ((dbField === 'profile_tags' || dbField === 'goals') && Array.isArray(value)) {
            setClauses.push(`${dbField} = $${paramIndex}`);
            values.push(value.slice(0, 3));
          } else {
            setClauses.push(`${dbField} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }

        if (setClauses.length === 0) {
          return { success: false, message: 'Aucun champ valide à mettre à jour.' };
        }

        setClauses.push(`updated_at = NOW()`);
        values.push(talentId);

        await pool.query(
          `UPDATE talents SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
          values
        );

        // Invalidate copilot context cache
        cache.deleteByPrefix(`ctx:${talentId}:`);

        const updatedFields = Object.keys(data).filter(k => ALLOWED_FIELDS[k]).join(', ');
        const message = `Profil mis à jour (${updatedFields}).`;
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} updated profile: ${updatedFields}`);
        return { success: true, message };
      }

      default:
        return { success: false, message: `Action "${action}" non supportée.` };
    }
  } catch (error: any) {
    logger.error(`[action.handler] Error (${action} ${entityId}): ${error.message}`);
    return { success: false, message: 'Une erreur est survenue lors de l\'exécution de l\'action.' };
  }
}

/**
 * Save the action result as a system message in the session.
 */
async function saveActionMessage(sessionId: string | undefined, message: string): Promise<void> {
  if (!sessionId) return;
  try {
    await pool.query(
      `INSERT INTO copilot_messages (session_id, role, content) VALUES ($1, 'assistant', $2)`,
      [sessionId, `✅ ${message}`]
    );
  } catch {
    // Non-critical, don't throw
  }
}
