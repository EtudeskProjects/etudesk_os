/**
 * SQL Query Tool — PostgreSQL structured data access
 * Intent-based queries (NEVER raw SQL from the LLM)
 *
 * SECURITY: The tool receives the authenticated talentId via factory injection,
 * NOT from LLM parameters. This prevents IDOR attacks.
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import { pool } from '../../database';

import { logger } from '../../../utils';
// Schema for intents
const SQL_INTENTS = [
  // Talent
  'my_profile',
  'my_applications',
  'my_reservations',
  'my_invitations',
  'my_communities',
  'my_bookmarks',
  'my_documents',
  'my_skills',
  'my_flashcards',
  'my_quiz_results',
  'my_learning_topics',
  // Org
  'org_members',
  'org_applications',
  'org_stats',
  'org_opportunities',
  'org_communities',
  'org_spaces',
  'org_revenue',
  'org_invitations',
  // Search
  'search_opportunities',
  'search_communities',
  'search_spaces',
  'search_organizations',
  'search_talents',
  // Actions
  'apply_opportunity',
  'join_community',
  'book_space',
  'create_activity',
  'respond_invitation',
  'update_application',
  'create_flashcard',
  'record_review',
] as const;

type SqlIntent = typeof SQL_INTENTS[number];

/**
 * Creates a SQL query tool with the authenticated talentId injected.
 * This ensures the tool always operates on the authenticated user's data,
 * preventing IDOR (Insecure Direct Object Reference) vulnerabilities.
 *
 * @param authenticatedTalentId - The talentId from the authenticated session
 * @param authorizedOrgIds - Optional list of organization IDs the user is authorized to access
 */
export function createSqlQueryTool(
  authenticatedTalentId: string,
  authorizedOrgIds?: string[]
) {
  return tool({
    name: 'sql_query',
    description:
      "Exécute une requête sur la base PostgreSQL. Utilise pour accéder aux données structurées : profils, candidatures, réservations, invitations, activités, statistiques org, flashcards, quiz. Note: les données personnelles sont automatiquement filtrées pour l'utilisateur courant.",
    parameters: z.object({
      intent: z.enum(SQL_INTENTS),
      paramsJson: z.string().describe('Paramètres optionnels en JSON (ex: \'{"status":"PENDING"}\' pour filtrer). Ne pas inclure talentId.'),
    }),
    execute: async ({ intent, paramsJson }) => {
      const params: Record<string, unknown> = paramsJson ? JSON.parse(paramsJson) : {};

      // SECURITY: Always use the authenticated talentId, never from params
      const talentId = authenticatedTalentId;

      // For org intents, verify authorization
      if (intent.startsWith('org_')) {
        const orgId = params?.organizationId as string;
        if (!orgId) {
          return { error: 'organizationId requis pour les requêtes organisation' };
        }
        // If authorizedOrgIds is provided, check authorization
        if (authorizedOrgIds && !authorizedOrgIds.includes(orgId)) {
          // Verify user is member of the organization
          const memberCheck = await pool.query(
            `SELECT role FROM organization_members
             WHERE organization_id = $1 AND talent_id = $2 AND status = 'ACTIVE'`,
            [orgId, talentId]
          );
          if (memberCheck.rows.length === 0) {
            return { error: 'Accès non autorisé à cette organisation' };
          }
        }
      }

    try {
      switch (intent) {
        // ─── TALENT ────────────────────────────────────────────
        case 'my_profile': {
          const res = await pool.query(
            `SELECT t.id, t.first_name, t.last_name, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.bio,
                    t.city, t.country, t.email, t.phone, t.slug,
                    t.remote_ready, t.willing_to_relocate, t.sectors,
                    t.goals, t.profile_tags
             FROM talents t
             WHERE t.id = $1`,
            [talentId]
          );
          return res.rows[0] || { error: 'Profil non trouvé' };
        }

        case 'my_applications': {
          const limit = (params?.limit as number) || 10;
          const status = params?.status as string;
          let query = `
            SELECT a.id, a.status, a.created_at, a.updated_at,
                   o.title as opportunity_title, o.type, o.slug as opportunity_slug,
                   org.name as organization_name
            FROM opportunity_applications a
            JOIN opportunities o ON a.opportunity_id = o.id
            LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
            LEFT JOIN organizations org ON op.poster_organization_id = org.id
            WHERE a.talent_id = $1`;
          const queryParams: any[] = [talentId];
          if (status) {
            query += ` AND a.status = $2`;
            queryParams.push(status);
          }
          query += ` ORDER BY a.created_at DESC LIMIT $${queryParams.length + 1}`;
          queryParams.push(limit);
          const res = await pool.query(query, queryParams);
          return { applications: res.rows, totalCount: res.rows.length };
        }

        case 'my_reservations': {
          const res = await pool.query(
            `SELECT r.id, r.date, r.start_time, r.end_time, r.status, r.total_amount,
                    s.name as space_name, s.slug as space_slug, s.city,
                    org.name as organization_name
             FROM space_bookings r
             JOIN spaces s ON r.space_id = s.id
             LEFT JOIN organizations org ON s.organization_id = org.id
             WHERE r.talent_id = $1
             ORDER BY r.date DESC LIMIT 10`,
            [talentId]
          );
          return { reservations: res.rows };
        }

        case 'my_invitations': {
          const res = await pool.query(
            `SELECT id, 'community' as type, status, created_at, expires_at, inviter_name, '' as target_name
             FROM community_invitations WHERE invitee_talent_id = $1 AND status = 'PENDING'
             UNION ALL
             SELECT id, 'opportunity' as type, status, created_at, expires_at, inviter_name, '' as target_name
             FROM opportunity_invitations WHERE invitee_talent_id = $1 AND status = 'PENDING'
             UNION ALL
             SELECT id, 'organization' as type, status, created_at, expires_at, '' as inviter_name, '' as target_name
             FROM organization_invitations WHERE email = (SELECT email FROM talents WHERE id = $1) AND status = 'PENDING'
             ORDER BY created_at DESC`,
            [talentId]
          );
          return { invitations: res.rows, pendingCount: res.rows.length };
        }

        case 'my_communities': {
          const res = await pool.query(
            `SELECT cm.role, cm.created_at as joined_at,
                    c.id, c.name, c.slug, c.type, c.description,
                    org.name as organization_name
             FROM community_members cm
             JOIN communities c ON cm.community_id = c.id
             LEFT JOIN organizations org ON c.organization_id = org.id
             WHERE cm.talent_id = $1 AND cm.status = 'ACTIVE'
             ORDER BY cm.created_at DESC`,
            [talentId]
          );
          return { communities: res.rows };
        }

        case 'my_bookmarks': {
          const res = await pool.query(
            `SELECT b.id, 'opportunity' as entity_type, b.opportunity_id as entity_id, b.created_at
             FROM opportunity_bookmarks b
             WHERE b.talent_id = $1
             ORDER BY b.created_at DESC LIMIT 20`,
            [talentId]
          );
          return { bookmarks: res.rows };
        }

        case 'my_documents': {
          const res = await pool.query(
            `SELECT id, type, category, title, filename, status, extracted_summary, uploaded_at
             FROM talent_documents
             WHERE talent_id = $1 AND deleted_at IS NULL
             ORDER BY uploaded_at DESC`,
            [talentId]
          );
          return { documents: res.rows };
        }

        case 'my_skills': {
          const res = await pool.query(
            `SELECT canonical_name as name, type, proficiency_level, origin
             FROM talent_skills
             WHERE talent_id = $1
             ORDER BY canonical_name`,
            [talentId]
          );
          return { skills: res.rows };
        }

        case 'my_flashcards': {
          const topicId = params?.topicId as string;
          let query = `
            SELECT lf.id, lf.front_content, lf.back_content, lf.difficulty,
                   lf.next_review_at, lf.ease_factor, lf.repetitions,
                   lt.topic_name
            FROM learning_flashcards lf
            JOIN learning_topics lt ON lf.topic_id = lt.id
            WHERE lt.talent_id = $1`;
          const queryParams: any[] = [talentId];
          if (topicId) {
            query += ` AND lf.topic_id = $2`;
            queryParams.push(topicId);
          }
          query += ` ORDER BY lf.next_review_at ASC LIMIT 20`;
          const res = await pool.query(query, queryParams);
          return { flashcards: res.rows };
        }

        case 'my_quiz_results': {
          const res = await pool.query(
            `SELECT qr.id, qr.score, qr.total_questions, qr.percentage, qr.passed,
                    qr.completed_at, lt.topic_name
             FROM learning_quiz_results qr
             JOIN learning_topics lt ON qr.topic_id = lt.id
             WHERE lt.talent_id = $1
             ORDER BY qr.completed_at DESC LIMIT 10`,
            [talentId]
          );
          return { quizResults: res.rows };
        }

        case 'my_learning_topics': {
          const res = await pool.query(
            `SELECT lt.id, lt.topic_name, lt.mastery_level, lt.last_studied_at,
                    COUNT(lf.id) as flashcard_count,
                    COUNT(lf.id) FILTER (WHERE lf.next_review_at <= CURRENT_DATE) as due_count
             FROM learning_topics lt
             LEFT JOIN learning_flashcards lf ON lt.id = lf.topic_id
             WHERE lt.talent_id = $1
             GROUP BY lt.id ORDER BY lt.topic_name`,
            [talentId]
          );
          return { topics: res.rows };
        }

        // ─── ORG ───────────────────────────────────────────────
        case 'org_members': {
          const orgId = params?.organizationId as string;
          if (!orgId) return { error: 'organizationId requis' };
          const res = await pool.query(
            `SELECT om.role, om.created_at, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.bio, t.avatar_url
             FROM organization_members om
             JOIN talents t ON om.talent_id = t.id
             WHERE om.organization_id = $1 AND om.status = 'ACTIVE'
             ORDER BY om.created_at DESC LIMIT 20`,
            [orgId]
          );
          return { members: res.rows };
        }

        case 'org_applications': {
          const orgId = params?.organizationId as string;
          if (!orgId) return { error: 'organizationId requis' };
          const res = await pool.query(
            `SELECT a.id, a.status, a.created_at,
                    COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name, t.bio,
                    o.title as opportunity_title
             FROM opportunity_applications a
             JOIN opportunities o ON a.opportunity_id = o.id
             JOIN opportunity_posters op ON o.id = op.opportunity_id
             JOIN talents t ON a.talent_id = t.id
             WHERE op.poster_organization_id = $1
             ORDER BY a.created_at DESC LIMIT 20`,
            [orgId]
          );
          return { applications: res.rows };
        }

        case 'org_stats': {
          const orgId = params?.organizationId as string;
          if (!orgId) return { error: 'organizationId requis' };
          const res = await pool.query(
            `SELECT
              (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND status = 'ACTIVE') as member_count,
              (SELECT COUNT(*) FROM opportunities o JOIN opportunity_posters op ON o.id = op.opportunity_id WHERE op.poster_organization_id = $1 AND o.status = 'OPEN' AND o.deleted_at IS NULL) as open_opportunities,
              (SELECT COUNT(*) FROM communities WHERE organization_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL) as community_count,
              (SELECT COUNT(*) FROM spaces WHERE organization_id = $1 AND is_active = true AND deleted_at IS NULL) as space_count`,
            [orgId]
          );
          return res.rows[0];
        }

        case 'org_opportunities': {
          const orgId = params?.organizationId as string;
          if (!orgId) return { error: 'organizationId requis' };
          const res = await pool.query(
            `SELECT o.id, o.title, o.type, o.status, o.slug,
                    (SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = o.id) as applications_count, o.views_count, o.deadline
             FROM opportunities o
             JOIN opportunity_posters op ON o.id = op.opportunity_id
             WHERE op.poster_organization_id = $1 AND o.deleted_at IS NULL
             ORDER BY o.created_at DESC LIMIT 20`,
            [orgId]
          );
          return { opportunities: res.rows };
        }

        case 'org_communities': {
          const orgId = params?.organizationId as string;
          if (!orgId) return { error: 'organizationId requis' };
          const res = await pool.query(
            `SELECT c.id, c.name, c.slug, c.type, c.status,
                    (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') as member_count
             FROM communities c
             WHERE c.organization_id = $1 AND c.deleted_at IS NULL
             ORDER BY c.created_at DESC`,
            [orgId]
          );
          return { communities: res.rows };
        }

        case 'org_spaces': {
          const orgId = params?.organizationId as string;
          if (!orgId) return { error: 'organizationId requis' };
          const res = await pool.query(
            `SELECT s.id, s.name, s.slug, s.type, s.capacity, s.is_active,
                    s.hourly_rate, s.currency
             FROM spaces s
             WHERE s.organization_id = $1 AND s.deleted_at IS NULL
             ORDER BY s.created_at DESC`,
            [orgId]
          );
          return { spaces: res.rows };
        }

        case 'org_revenue': {
          const orgId = params?.organizationId as string;
          if (!orgId) return { error: 'organizationId requis' };
          const res = await pool.query(
            `SELECT COALESCE(SUM(r.total_amount), 0) as total_revenue,
                    COUNT(*) as total_bookings,
                    COUNT(*) FILTER (WHERE r.status = 'CONFIRMED') as confirmed_bookings
             FROM space_bookings r
             JOIN spaces s ON r.space_id = s.id
             WHERE s.organization_id = $1`,
            [orgId]
          );
          return res.rows[0];
        }

        case 'org_invitations': {
          const orgId = params?.organizationId as string;
          if (!orgId) return { error: 'organizationId requis' };
          const res = await pool.query(
            `SELECT i.id, 'organization' as type, i.status, i.created_at, i.email as invitee_email, i.role as target_name
             FROM organization_invitations i
             WHERE i.organization_id = $1 AND i.status = 'PENDING'
             ORDER BY i.created_at DESC`,
            [orgId]
          );
          return { invitations: res.rows };
        }

        // ─── SEARCH ────────────────────────────────────────────
        case 'search_opportunities': {
          const { query: q, type, contractType, location, limit: lim } = params || {};
          let sql = `
            SELECT o.id, o.title, o.summary, o.type, o.contract_type, o.location_type,
                   o.slug, o.deadline, org.name as org_name
            FROM opportunities o
            LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
            LEFT JOIN organizations org ON op.poster_organization_id = org.id
            WHERE o.status = 'OPEN' AND o.deleted_at IS NULL`;
          const p: any[] = [];
          let idx = 1;
          if (q) { sql += ` AND (o.title ILIKE '%' || $${idx} || '%' OR o.summary ILIKE '%' || $${idx} || '%')`; p.push(q); idx++; }
          if (type) { sql += ` AND o.type = $${idx}`; p.push(type); idx++; }
          if (contractType) { sql += ` AND o.contract_type = $${idx}`; p.push(contractType); idx++; }
          if (location) { sql += ` AND o.locations::text ILIKE '%' || $${idx} || '%'`; p.push(location); idx++; }
          sql += ` ORDER BY o.posted_at DESC NULLS LAST LIMIT $${idx}`;
          p.push((lim as number) || 5);
          const res = await pool.query(sql, p);
          return { opportunities: res.rows };
        }

        case 'search_communities': {
          const { query: q, type, limit: lim } = params || {};
          let sql = `
            SELECT c.id, c.name, c.description, c.type, c.slug,
                   (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') as member_count
            FROM communities c
            WHERE c.status = 'ACTIVE' AND c.deleted_at IS NULL`;
          const p: any[] = [];
          let idx = 1;
          if (q) { sql += ` AND (c.name ILIKE '%' || $${idx} || '%' OR c.description ILIKE '%' || $${idx} || '%')`; p.push(q); idx++; }
          if (type) { sql += ` AND c.type = $${idx}`; p.push(type); idx++; }
          sql += ` ORDER BY member_count DESC LIMIT $${idx}`;
          p.push((lim as number) || 5);
          const res = await pool.query(sql, p);
          return { communities: res.rows };
        }

        case 'search_spaces': {
          const { query: q, type, location, limit: lim } = params || {};
          let sql = `
            SELECT s.id, s.name, s.description, s.type, s.slug, s.capacity,
                   s.hourly_rate, s.currency, s.city
            FROM spaces s
            WHERE s.is_active = true AND s.deleted_at IS NULL`;
          const p: any[] = [];
          let idx = 1;
          if (q) { sql += ` AND (s.name ILIKE '%' || $${idx} || '%' OR s.description ILIKE '%' || $${idx} || '%')`; p.push(q); idx++; }
          if (type) { sql += ` AND s.type = $${idx}`; p.push(type); idx++; }
          if (location) { sql += ` AND s.city ILIKE '%' || $${idx} || '%'`; p.push(location); idx++; }
          sql += ` ORDER BY s.views_count DESC NULLS LAST LIMIT $${idx}`;
          p.push((lim as number) || 5);
          const res = await pool.query(sql, p);
          return { spaces: res.rows };
        }

        case 'search_organizations': {
          const { query: q, sectors, limit: lim } = params || {};
          let sql = `
            SELECT o.id, o.name, o.description, o.sectors, o.slug, o.city, o.country
            FROM organizations o
            WHERE o.deleted_at IS NULL AND o.verification_status IN ('VERIFIED', 'OFFICIAL')`;
          const p: any[] = [];
          let idx = 1;
          if (q) { sql += ` AND (o.name ILIKE '%' || $${idx} || '%' OR o.description ILIKE '%' || $${idx} || '%')`; p.push(q); idx++; }
          if (sectors) { sql += ` AND o.sectors && $${idx}::text[]`; p.push(sectors); idx++; }
          sql += ` ORDER BY o.name LIMIT $${idx}`;
          p.push((lim as number) || 5);
          const res = await pool.query(sql, p);
          return { organizations: res.rows };
        }

        case 'search_talents': {
          const { query: q, skills, limit: lim } = params || {};
          let sql = `
            SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.bio, t.city, t.country
            FROM talents t
            WHERE t.deleted_at IS NULL`;
          const p: any[] = [];
          let idx = 1;
          if (q) { sql += ` AND (COALESCE(t.first_name || ' ' || t.last_name, t.email) ILIKE '%' || $${idx} || '%' OR t.bio ILIKE '%' || $${idx} || '%')`; p.push(q); idx++; }
          sql += ` ORDER BY t.first_name, t.last_name LIMIT $${idx}`;
          p.push((lim as number) || 5);
          const res = await pool.query(sql, p);
          return { talents: res.rows };
        }

        // ─── ACTIONS ───────────────────────────────────────────
        case 'create_flashcard': {
          const { topicName, front, back, difficulty } = params || {};
          // Find or create topic
          let topicRes = await pool.query(
            `SELECT id FROM learning_topics WHERE talent_id = $1 AND topic_name = $2`,
            [talentId, topicName]
          );
          let topicId: string;
          if (topicRes.rows.length === 0) {
            topicRes = await pool.query(
              `INSERT INTO learning_topics (talent_id, topic_name) VALUES ($1, $2) RETURNING id`,
              [talentId, topicName]
            );
          }
          topicId = topicRes.rows[0].id;
          const fcRes = await pool.query(
            `INSERT INTO learning_flashcards (topic_id, front_content, back_content, difficulty)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [topicId, front, back, difficulty || 'medium']
          );
          return { success: true, flashcardId: fcRes.rows[0].id };
        }

        case 'record_review': {
          const { flashcardId, quality } = params || {};
          // SM-2 algorithm inline
          const card = await pool.query(
            `SELECT ease_factor, interval_days, repetitions FROM learning_flashcards WHERE id = $1`,
            [flashcardId]
          );
          if (card.rows.length === 0) return { error: 'Flashcard non trouvée' };
          let ef = card.rows[0].ease_factor;
          let interval = card.rows[0].interval_days;
          let reps = card.rows[0].repetitions;
          const q = quality as number;
          ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
          if (ef < 1.3) ef = 1.3;
          if (q < 3) { reps = 0; interval = 1; }
          else { reps++; interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef); }
          const nextReview = new Date();
          nextReview.setDate(nextReview.getDate() + interval);
          await pool.query(
            `UPDATE learning_flashcards SET ease_factor=$1, interval_days=$2, repetitions=$3,
             next_review_at=$4, last_reviewed_at=CURRENT_TIMESTAMP, last_quality=$5,
             total_reviews=total_reviews+1, correct_reviews=correct_reviews+CASE WHEN $5>=3 THEN 1 ELSE 0 END
             WHERE id=$6`,
            [ef, interval, reps, nextReview, q, flashcardId]
          );
          return { success: true, nextReviewAt: nextReview.toISOString() };
        }

        default:
          return { error: `Intent '${intent}' non implémenté. Contactez le développeur.` };
      }
    } catch (error: any) {
      logger.error(`SQL query error (${intent}):`, error);
      return { error: error.message };
    }
  },
  });
}

/**
 * @deprecated Use createSqlQueryTool(authenticatedTalentId) instead for security.
 * This static export is kept for backward compatibility but should be migrated.
 * WARNING: This version is vulnerable to IDOR attacks if talentId is not validated.
 */
export const sqlQueryTool = tool({
  name: 'sql_query',
  description:
    "Exécute une requête sur la base PostgreSQL. DEPRECATED: Utilisez createSqlQueryTool() pour la sécurité.",
  parameters: z.object({
    intent: z.enum(SQL_INTENTS),
    paramsJson: z.string().describe('Paramètres de la requête en JSON string'),
  }),
  execute: async ({ intent, paramsJson }) => {
    const params: Record<string, unknown> = paramsJson ? JSON.parse(paramsJson) : {};
    const talentId = params.talentId as string;
    if (!talentId) {
      return { error: 'talentId est requis. SECURITY WARNING: Use createSqlQueryTool() instead.' };
    }
    // Delegate to a minimal implementation that warns about security
    logger.warn('[SECURITY WARNING] sqlQueryTool used without authentication context. Migrate to createSqlQueryTool()');
    return { error: 'This tool is deprecated. Please update the agent to use createSqlQueryTool().' };
  },
});
