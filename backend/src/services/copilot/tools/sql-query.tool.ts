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
  authorizedOrgIds?: string[],
  allowedIntents?: readonly SqlIntent[]
) {
  return tool({
    name: 'sql_query',
    description:
      'Query PostgreSQL for structured data. Use for personal data (my_profile, my_applications, my_communities, my_documents, my_skills), org management (org_stats, org_applications, org_members, org_opportunities, org_revenue), and structured search (search_opportunities, search_communities). Personal data is automatically filtered for the authenticated user — do NOT include talentId in params.',
    parameters: z.object({
      intent: z.enum(SQL_INTENTS).describe('The query intent. Use my_* for personal data, org_* for organization data (requires organizationId in params), search_* for text search.'),
      paramsJson: z.string().describe('Optional parameters as JSON string. Examples: \'{"status":"PENDING"}\' to filter, \'{"organizationId":"uuid"}\' for org intents. Do NOT include talentId — it is injected automatically.'),
    }),
    execute: async ({ intent, paramsJson }) => {
      // If allowedIntents is provided, reject disallowed intents
      if (allowedIntents && !allowedIntents.includes(intent)) {
        return { error: `L'intent '${intent}' n'est pas disponible dans ce mode. Intents autorisés : ${allowedIntents.join(', ')}` };
      }

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
          // --- Talent ---
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
            SELECT a.id, a.status, a.applied_at, a.updated_at,
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
            query += ` ORDER BY a.applied_at DESC LIMIT $${queryParams.length + 1}`;
            queryParams.push(limit);
            const res = await pool.query(query, queryParams);
            return { applications: res.rows, totalCount: res.rows.length };
          }

          case 'my_reservations': {
            const res = await pool.query(
              `SELECT r.id, r.start_datetime, r.end_datetime, r.status, r.total_amount,
                    s.name as space_name, s.slug as space_slug, s.city,
                    org.name as organization_name
             FROM space_bookings r
             JOIN spaces s ON r.space_id = s.id
             LEFT JOIN organizations org ON s.organization_id = org.id
             WHERE r.talent_id = $1
             ORDER BY r.start_datetime DESC LIMIT 20`,
              [talentId]
            );
            return { reservations: res.rows };
          }

          case 'my_invitations': {
            const res = await pool.query(
              `SELECT ci.id, 'community' as type, ci.status, ci.created_at, ci.expires_at,
                    COALESCE(t1.first_name || ' ' || t1.last_name, t1.email, '') as inviter_name, '' as target_name
             FROM community_invitations ci
             LEFT JOIN talents t1 ON ci.invited_by = t1.id
             WHERE ci.invitee_talent_id = $1 AND ci.status = 'PENDING'
             UNION ALL
             SELECT oi.id, 'opportunity' as type, 'PENDING' as status, oi.created_at, oi.expires_at,
                    COALESCE(t2.first_name || ' ' || t2.last_name, t2.email, '') as inviter_name, '' as target_name
             FROM opportunity_invitations oi
             LEFT JOIN talents t2 ON oi.invited_by = t2.id
             WHERE oi.invitee_talent_id = $1 AND oi.expires_at > NOW()
             UNION ALL
             SELECT orgi.id, 'organization' as type, orgi.status, orgi.created_at, orgi.expires_at,
                    '' as inviter_name, '' as target_name
             FROM organization_invitations orgi
             WHERE orgi.email = (SELECT email FROM talents WHERE id = $1) AND orgi.status = 'PENDING'
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
              `SELECT b.opportunity_id as id, 'opportunity' as entity_type, b.opportunity_id as entity_id, b.created_at
             FROM opportunity_bookmarks b
             WHERE b.talent_id = $1
             ORDER BY b.created_at DESC LIMIT 20`,
              [talentId]
            );
            return { bookmarks: res.rows };
          }

          case 'my_documents': {
            const res = await pool.query(
              `SELECT id, document_type, category, title, original_filename, status, description, created_at
             FROM talent_documents
             WHERE talent_id = $1 AND deleted_at IS NULL
             ORDER BY created_at DESC`,
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

          // --- Org ---
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
              `SELECT a.id, a.status, a.applied_at,
                    COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name, t.bio,
                    o.title as opportunity_title
             FROM opportunity_applications a
             JOIN opportunities o ON a.opportunity_id = o.id
             JOIN opportunity_posters op ON o.id = op.opportunity_id
             JOIN talents t ON a.talent_id = t.id
             WHERE op.poster_organization_id = $1
             ORDER BY a.applied_at DESC LIMIT 20`,
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
              (SELECT COUNT(*) FROM spaces WHERE organization_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL) as space_count`,
              [orgId]
            );
            return res.rows[0];
          }

          case 'org_opportunities': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: 'organizationId requis' };
            const res = await pool.query(
              `SELECT o.id, o.title, o.type, o.status, o.slug,
                    (SELECT COUNT(*) FROM opportunity_applications WHERE opportunity_id = o.id) as applications_count, o.deadline
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
              `SELECT s.id, s.name, s.slug, s.type, s.capacity, s.status,
                    s.hourly_rate, s.city
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

          // --- Search ---
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
            p.push((lim as number) || 10);
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
            p.push((lim as number) || 10);
            const res = await pool.query(sql, p);
            return { communities: res.rows };
          }

          case 'search_spaces': {
            const { query: q, type, location, limit: lim } = params || {};
            let sql = `
            SELECT s.id, s.name, s.description, s.type, s.slug, s.capacity,
                   s.hourly_rate, s.city
            FROM spaces s
            WHERE s.status = 'ACTIVE' AND s.deleted_at IS NULL`;
            const p: any[] = [];
            let idx = 1;
            if (q) { sql += ` AND (s.name ILIKE '%' || $${idx} || '%' OR s.description ILIKE '%' || $${idx} || '%')`; p.push(q); idx++; }
            if (type) { sql += ` AND s.type = $${idx}`; p.push(type); idx++; }
            if (location) { sql += ` AND s.city ILIKE '%' || $${idx} || '%'`; p.push(location); idx++; }
            sql += ` ORDER BY s.created_at DESC NULLS LAST LIMIT $${idx}`;
            p.push((lim as number) || 10);
            const res = await pool.query(sql, p);
            return { spaces: res.rows };
          }

          case 'search_organizations': {
            const { query: q, sectors, limit: lim } = params || {};
            let sql = `
            SELECT o.id, o.name, o.description, o.sectors, o.slug, o.city, o.country
            FROM organizations o
            WHERE o.deleted_at IS NULL AND o.verification_status IN ('VERIFIED', 'OFFICIAL')
            AND o.is_visible = TRUE`;
            const p: any[] = [];
            let idx = 1;
            if (q) { sql += ` AND (o.name ILIKE '%' || $${idx} || '%' OR o.description ILIKE '%' || $${idx} || '%')`; p.push(q); idx++; }
            if (sectors) { sql += ` AND o.sectors && $${idx}::text[]`; p.push(sectors); idx++; }
            sql += ` ORDER BY o.name LIMIT $${idx}`;
            p.push((lim as number) || 10);
            const res = await pool.query(sql, p);
            return { organizations: res.rows };
          }

          case 'search_talents': {
            const { query: q, skills, limit: lim } = params || {};
            let sql = `
            SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.bio, t.city, t.country
            FROM talents t
            WHERE t.deleted_at IS NULL
            AND t.is_visible = TRUE`;
            const p: any[] = [];
            let idx = 1;
            if (q) { sql += ` AND (COALESCE(t.first_name || ' ' || t.last_name, t.email) ILIKE '%' || $${idx} || '%' OR t.bio ILIKE '%' || $${idx} || '%')`; p.push(q); idx++; }
            sql += ` ORDER BY t.first_name, t.last_name LIMIT $${idx}`;
            p.push((lim as number) || 10);
            const res = await pool.query(sql, p);
            return { talents: res.rows };
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

// NOTE: sqlQueryTool export was removed for security reasons.
// Use createSqlQueryTool(authenticatedTalentId) instead to prevent IDOR vulnerabilities.
