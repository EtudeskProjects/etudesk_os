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
import { i18next } from '../../../i18n';
import {
  validateApplyOpportunity,
  validateJoinCommunity,
  validateBookSpace,
  validateRespondInvitation,
  validatePublishOpportunity,
  validateCreateCommunity,
  validateCreateSpace,
} from './action.validators';
import { resolveAgendaSchedule } from '../../agenda-scheduling.service';
import { validateFromCommunity } from '../../skills/skill-validation.service';
import { debitWalletForAction } from '../../billing/credit.service';
import { normalizeSpaceFeatures } from '../../../types/space.types';

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

export async function handleConfirmation(
  talentId: string,
  request: ActionRequest,
  language?: string
): Promise<ActionResult> {
  const { action, entityId, sessionId, data } = request;
  const tr = (key: string, options?: Record<string, any>) => i18next.t(key, { lng: language, ...(options || {}) });

  // Resolve "self" entity_id to the talent's own ID
  const resolvedEntityId = entityId === 'self' ? talentId : entityId;

  try {
    switch (action) {
      case 'apply_opportunity': {
        const validation = await validateApplyOpportunity(talentId, entityId, language);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const result = await pool.query(
          `INSERT INTO opportunity_applications (talent_id, opportunity_id, status, applied_at)
           VALUES ($1, $2, 'SUBMITTED', NOW())
           RETURNING id`,
          [talentId, entityId]
        );

        const message = tr('copilot:actionApplySuccess', { title: validation.data?.title });
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} applied to opportunity ${entityId}`);
        return { success: true, message, data: { applicationId: result.rows[0].id } };
      }

      case 'join_community': {
        const validation = await validateJoinCommunity(talentId, entityId, language);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const result = await pool.query(
          `INSERT INTO community_members (talent_id, community_id, role, status, created_at)
           VALUES ($1, $2, 'MEMBER', 'ACTIVE', NOW())
           RETURNING id`,
          [talentId, entityId]
        );

        const message = tr('copilot:actionJoinCommunitySuccess', { name: validation.data?.name });
        await saveActionMessage(sessionId, message);

        // Participation validation: active membership validates community soft skills.
        validateFromCommunity(talentId, entityId).catch((err) =>
          logger.error('Skill validation error:', err)
        );

        logger.info(`[action.handler] Talent ${talentId} joined community ${entityId}`);
        return { success: true, message, data: { membershipId: result.rows[0].id } };
      }

      case 'book_space': {
        const validation = await validateBookSpace(talentId, entityId, data, language);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const result = await pool.query(
          `INSERT INTO space_bookings (talent_id, space_id, start_datetime, end_datetime, status, total_amount, created_at)
           VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW())
           RETURNING id`,
          [talentId, entityId, data?.startDatetime, data?.endDatetime, validation.data?.rate || 0]
        );

        const message = tr('copilot:actionBookSpaceSuccess', { name: validation.data?.name });
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} booked space ${entityId}`);
        return { success: true, message, data: { bookingId: result.rows[0].id } };
      }

      case 'accept_invitation':
      case 'decline_invitation': {
        const accept = action === 'accept_invitation';
        const validation = await validateRespondInvitation(talentId, entityId, accept, language);
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
              validateFromCommunity(talentId, inv.rows[0].community_id).catch((err) =>
                logger.error('Skill validation error:', err)
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

        const message = accept ? tr('copilot:actionInvitationAccepted') : tr('copilot:actionInvitationDeclined');
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} ${newStatus.toLowerCase()} invitation ${entityId}`);
        return { success: true, message };
      }

      case 'publish_opportunity': {
        const orgId = data?.organization_id || entityId;
        const validation = await validatePublishOpportunity(talentId, orgId, data, language);
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
          `INSERT INTO opportunity_posters (opportunity_id, poster_talent_id, role) VALUES ($1, $2, 'AUTHOR')`,
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

        const message = tr('copilot:actionOpportunityPublished', { title });
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} published opportunity ${id} for org ${orgId}`);
        return { success: true, message, data: { opportunityId: id } };
      }

      case 'create_community': {
        const orgId = data?.organization_id || entityId;
        const validation = await validateCreateCommunity(talentId, orgId, data, language);
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

        const message = tr('copilot:actionCommunityCreated', { name });
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} created community ${communityId} for org ${orgId}`);
        return { success: true, message, data: { communityId } };
      }

      case 'create_space': {
        const orgId = data?.organization_id || entityId;
        const validation = await validateCreateSpace(talentId, orgId, data, language);
        if (!validation.valid) {
          return { success: false, message: validation.error! };
        }

        const features = normalizeSpaceFeatures(data || {});
        if (features.invalid.length > 0) {
          return { success: false, message: `Invalid space feature values: ${features.invalid.join(', ')}` };
        }
        data!.equipment = features.equipment;
        data!.amenities = features.amenities;

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
            data!.country || process.env.DEFAULT_COUNTRY || null,
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

        const message = tr('copilot:actionSpaceCreated', { name });
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} created space ${id} for org ${orgId}`);
        return { success: true, message, data: { spaceId: id } };
      }

      case 'update_profile': {
        if (!data || Object.keys(data).length === 0) {
          return { success: false, message: tr('copilot:actionProfileNoData') };
        }

        // --- Strict constants ---
        const VALID_PROFILE_TAGS = new Set([
          'STUDENT', 'PUPIL', 'JOB_SEEKER', 'SALARIED', 'ENTREPRENEUR',
          'CIVIL_SERVANT', 'MANAGER', 'CONSULTANT', 'INVESTOR',
          'CONTENT_CREATOR', 'COACH', 'RETIRED',
        ]);
        const VALID_GOALS = new Set([
          'LEARN_NEW_SKILLS', 'PREPARE_EXAMS', 'FIND_JOB', 'ADVANCE_CAREER',
          'RESEARCH_SUPPORT', 'IMPROVE_PRODUCTIVITY', 'COLLABORATIVE_LEARNING',
          'TEACH_OR_MENTOR', 'BUILD_NETWORK_OR_VISIBILITY', 'CONTRIBUTE_OR_GIVE_BACK',
        ]);
        const MAX_ARRAY = 3;
        const MAX_BIO = 500;
        const MAX_CITY = 100;
        const MAX_COUNTRY = 100;
        const VALID_SECTORS = new Set([
          'AGRICULTURE', 'RESOURCES', 'ENERGY', 'ENVIRONMENT', 'INDUSTRY',
          'CONSTRUCTION', 'TRANSPORT', 'COMMERCE', 'FINANCE', 'DIGITAL',
          'MEDIA', 'TOURISM', 'HEALTH', 'EDUCATION', 'PROFESSIONAL_SERVICES',
          'RESEARCH', 'PUBLIC', 'SECURITY', 'SOCIAL_IMPACT', 'PERSONAL_SERVICES', 'CRAFTS',
        ]);
        const MAX_SECTORS = 5;

        // Allowed fields for profile update
        const ALLOWED_FIELDS: Record<string, string> = {
          bio: 'bio',
          city: 'city',
          country: 'country',
          goals: 'goals',
          remote_ready: 'remote_ready',
          willing_to_relocate: 'willing_to_relocate',
          profile_tags: 'profile_tags',
          sectors: 'sectors',
        };

        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(data)) {
          const dbField = ALLOWED_FIELDS[key];
          if (!dbField) continue;

          // Strict validation per field
          if (dbField === 'profile_tags') {
            if (!Array.isArray(value)) continue;
            const valid = value.filter((v: any) => typeof v === 'string' && VALID_PROFILE_TAGS.has(v)).slice(0, MAX_ARRAY);
            if (valid.length === 0) continue;
            setClauses.push(`${dbField} = $${paramIndex}::text[]`);
            values.push(`{${valid.join(',')}}`);
          } else if (dbField === 'goals') {
            if (!Array.isArray(value)) continue;
            const valid = value.filter((v: any) => typeof v === 'string' && VALID_GOALS.has(v)).slice(0, MAX_ARRAY);
            if (valid.length === 0) continue;
            setClauses.push(`${dbField} = $${paramIndex}::text[]`);
            values.push(`{${valid.join(',')}}`);
          } else if (dbField === 'sectors') {
            if (!Array.isArray(value)) continue;
            const valid = value.filter((v: any) => typeof v === 'string' && VALID_SECTORS.has(v)).slice(0, MAX_SECTORS);
            if (valid.length === 0) continue;
            setClauses.push(`${dbField} = $${paramIndex}::text[]`);
            values.push(`{${valid.join(',')}}`);

          } else if (dbField === 'bio') {
            if (typeof value !== 'string' || !value.trim()) continue;
            setClauses.push(`${dbField} = $${paramIndex}`);
            values.push(value.trim().slice(0, MAX_BIO));
          } else if (dbField === 'city') {
            if (typeof value !== 'string' || !value.trim()) continue;
            setClauses.push(`${dbField} = $${paramIndex}`);
            values.push(value.trim().slice(0, MAX_CITY));
          } else if (dbField === 'country') {
            if (typeof value !== 'string' || !value.trim()) continue;
            setClauses.push(`${dbField} = $${paramIndex}`);
            values.push(value.trim().slice(0, MAX_COUNTRY));
          } else if (dbField === 'remote_ready' || dbField === 'willing_to_relocate') {
            if (typeof value !== 'boolean') continue;
            setClauses.push(`${dbField} = $${paramIndex}`);
            values.push(value);
          } else {
            continue;
          }
          paramIndex++;
        }

        if (setClauses.length === 0) {
          return { success: false, message: tr('copilot:actionProfileNoValidField') };
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
        const message = tr('copilot:actionProfileUpdated', { fields: updatedFields });
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} updated profile: ${updatedFields}`);
        return { success: true, message };
      }

      case 'create_agenda_trigger': {
        if (!data || !data.title) {
          return { success: false, message: tr('copilot:actionTriggerMissingData') };
        }

        const VALID_CODES = new Set([
          'FOLLOW_UP', 'REMINDER', 'RESEARCH', 'LEARNING', 'APPLICATION',
          'INTERVIEW', 'DEADLINE', 'REVIEW', 'CUSTOM',
        ]);
        const VALID_PRIORITIES = new Set(['LOW', 'NORMAL', 'HIGH']);

        // Accept "code" or "type" (agent sometimes sends "type" instead of "code")
        const rawCode = String(data.code || data.type || 'CUSTOM').trim().toUpperCase();
        const triggerCode = VALID_CODES.has(rawCode) ? rawCode : 'CUSTOM';
        const priority = VALID_PRIORITIES.has(data.priority) ? data.priority : 'NORMAL';
        const organizationId = data.organizationId || data.organization_id || null;
        // Default dueAt to 7 days from now if not provided
        const dueAtRaw = data.dueAt || data.due_at;
        let dueAt = dueAtRaw ? new Date(dueAtRaw) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        if (isNaN(dueAt.getTime())) {
          return { success: false, message: tr('copilot:actionTriggerInvalidDate') };
        }
        let metadata = { ...data.metadata, ...(data.keywords ? { keywords: data.keywords } : {}), ...(data.frequency ? { frequency: data.frequency } : {}) };
        let latestAllowedAt: Date | null = null;
        if (triggerCode === 'FOLLOW_UP') {
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
                adjusted_due_at: cappedDueAt.toISOString(),
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
          return { success: false, message: tr('copilot:actionTriggerNoAvailableSlot') };
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

        let result;
        if (organizationId) {
          const membership = await pool.query(
            `SELECT 1 FROM organization_members WHERE organization_id = $1::uuid AND talent_id = $2::uuid AND status = 'ACTIVE' LIMIT 1`,
            [String(organizationId), talentId]
          );
          if (membership.rows.length === 0) {
            return { success: false, message: tr('copilot:toolOrgAccessDenied') };
          }

          try {
            await debitWalletForAction({
              scope: 'ORGANIZATION',
              ownerId: String(organizationId),
              actionCode: 'ORG_SCHEDULED_TASK',
              idempotencyKey: `org_sched_confirm_${organizationId}_${triggerCode}_${dueAt.toISOString()}`,
              metadata: { channel: 'copilot_confirm', code: triggerCode, title: data.title },
              createdBy: talentId,
            });
          } catch (debitError: any) {
            if (String(debitError?.message || '').includes('INSUFFICIENT_CREDITS')) {
              return { success: false, message: tr('billing:insufficientCredits') };
            }
            throw debitError;
          }

          result = await pool.query(
            `INSERT INTO agenda_triggers (scope, organization_id, code, title, description, due_at, status, priority, metadata, created_by)
             VALUES ('ORGANIZATION', $1::uuid, $2, $3, $4, $5, 'PENDING', $6, $7::jsonb, $8::uuid)
             RETURNING id`,
            [
              String(organizationId),
              triggerCode,
              data.title.slice(0, 200),
              data.description?.slice(0, 500) || null,
              dueAt.toISOString(),
              priority,
              JSON.stringify(metadata),
              talentId,
            ]
          );
        } else {
          result = await pool.query(
            `INSERT INTO agenda_triggers (scope, talent_id, code, title, description, due_at, status, priority, metadata, created_by)
             VALUES ('TALENT', $1::uuid, $2, $3, $4, $5, 'PENDING', $6, $7::jsonb, $1::uuid)
             RETURNING id`,
            [
              talentId,
              triggerCode,
              data.title.slice(0, 200),
              data.description?.slice(0, 500) || null,
              dueAt.toISOString(),
              priority,
              JSON.stringify(metadata),
            ]
          );
        }

        const dateLocale = (language || 'en').startsWith('fr') ? 'fr-FR' : 'en-GB';
        const message = tr('copilot:actionTriggerCreated', {
          title: data.title,
          date: dueAt.toLocaleString(dateLocale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} created agenda trigger ${result.rows[0].id}`);
        return {
          success: true,
          message,
          data: {
            triggerId: result.rows[0].id,
            dueAt: dueAt.toISOString(),
            schedulingAdjusted: scheduled.adjusted,
            schedulingReasons: scheduled.reasons,
          },
        };
      }

      case 'update_agenda_trigger': {
        if (!data) {
          return { success: false, message: tr('copilot:actionUpdateNoData') };
        }

        // Verify the trigger belongs to this talent or an organization they can access.
        const existing = await pool.query(
          `SELECT id, scope, talent_id, organization_id, status, code, metadata FROM agenda_triggers WHERE id = $1::uuid LIMIT 1`,
          [resolvedEntityId]
        );
        if (existing.rows.length === 0) {
          return { success: false, message: tr('copilot:actionTriggerNotFoundOrUnauthorized') };
        }
        const row = existing.rows[0];
        if (row.scope === 'TALENT') {
          if (String(row.talent_id) !== String(talentId)) {
            return { success: false, message: tr('copilot:actionTriggerNotFoundOrUnauthorized') };
          }
        } else {
          const membership = await pool.query(
            `SELECT 1 FROM organization_members WHERE organization_id = $1::uuid AND talent_id = $2::uuid AND status = 'ACTIVE' LIMIT 1`,
            [String(row.organization_id), talentId]
          );
          if (membership.rows.length === 0) {
            return { success: false, message: tr('copilot:actionTriggerNotFoundOrUnauthorized') };
          }
        }

        const updates: string[] = [];
        const vals: any[] = [];
        let idx = 1;
        let metadataPatch = data.metadata && typeof data.metadata === 'object' ? { ...data.metadata } : null;

        if (data.status && ['PENDING', 'DONE', 'CANCELED'].includes(data.status)) {
          updates.push(`status = $${idx}`);
          vals.push(data.status);
          idx++;
          if (data.status === 'DONE') {
            updates.push(`completed_at = NOW()`);
          } else {
            updates.push(`completed_at = NULL`);
          }
        }
        const dueAtRaw = data.dueAt || data.due_at;
        if (dueAtRaw) {
          let newDue = new Date(dueAtRaw);
          if (!isNaN(newDue.getTime())) {
            const metadata = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
            const latestAllowedAt = row.code === 'FOLLOW_UP' && metadata.adjusted_due_at
              ? new Date(String(metadata.adjusted_due_at))
              : null;
            const scheduled = await resolveAgendaSchedule({
              scope: row.scope,
              talentId,
              organizationId: row.organization_id ? String(row.organization_id) : undefined,
              requestedDueAt: newDue,
              excludeTriggerId: resolvedEntityId,
              latestAllowedAt: latestAllowedAt && !isNaN(latestAllowedAt.getTime()) ? latestAllowedAt : null,
            });
            if (!scheduled) {
              return { success: false, message: tr('copilot:actionTriggerNoAvailableSlot') };
            }
            newDue = scheduled.dueAt;
            updates.push(`due_at = $${idx}`);
            vals.push(newDue.toISOString());
            idx++;
            metadataPatch = {
              ...(metadataPatch || {}),
              scheduling: {
                requested_due_at: scheduled.requestedDueAt.toISOString(),
                final_due_at: scheduled.dueAt.toISOString(),
                adjusted: scheduled.adjusted,
                reasons: scheduled.reasons,
              },
            };
          }
        }
        if (metadataPatch) {
          updates.push(`metadata = metadata || $${idx}::jsonb`);
          vals.push(JSON.stringify(metadataPatch));
          idx++;
        }

        if (updates.length === 0) {
          return { success: false, message: tr('copilot:actionTriggerNoValidField') };
        }

        updates.push(`updated_at = NOW()`);
        vals.push(resolvedEntityId);

        await pool.query(
          `UPDATE agenda_triggers SET ${updates.join(', ')} WHERE id = $${idx}`,
          vals
        );

        const message = tr('copilot:actionTriggerUpdated');
        await saveActionMessage(sessionId, message);

        logger.info(`[action.handler] Talent ${talentId} updated agenda trigger ${resolvedEntityId}`);
        return { success: true, message };
      }

      default:
        return { success: false, message: tr('copilot:actionUnsupported', { action }) };
    }
  } catch (error: any) {
    logger.error(`[action.handler] Error (${action} ${entityId}): ${error.message}`);
    return { success: false, message: tr('copilot:actionError') };
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
