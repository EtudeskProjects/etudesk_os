/**
 * SQL Query Tool — PostgreSQL structured data access
 * Intent-based queries (NEVER raw SQL from the LLM)
 *
 * SECURITY: The tool receives the authenticated talentId via factory injection,
 * NOT from LLM parameters. This prevents IDOR attacks.
 */

import { defineTool } from './tool-helper';
import { z } from 'zod';
import { pool } from '../../database';
import { i18next } from '../../../i18n';

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
  'my_triggers',
  // Org
  'org_members',
  'org_applications',
  'org_stats',
  'org_opportunities',
  'org_communities',
  'org_spaces',
  'org_invitations',
  'org_triggers',
  'org_documents',
  'org_talents',
  'org_talent_profile',
  'org_community_feed',
  'org_community_members',
  // Org analytics
  'org_skills_analytics',
  'org_application_funnel',
  'org_talent_cohorts',
  'org_geo_distribution',
  'org_community_engagement',
  'org_opportunity_performance',
  // Talent community
  'my_community_feed',
  'my_community_members',
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
  allowedIntents?: readonly SqlIntent[],
  language?: string
) {
  // Anti-loop: cache results per intent+params to return cached data on repeat calls
  const resultCache = new Map<string, any>();
  const callCounts = new Map<string, number>();

  return defineTool({
    name: 'sql_query',
    description:
      'Query PostgreSQL for structured data. Use for personal data (my_profile, my_applications, my_communities, my_documents, my_skills, my_triggers, my_community_feed, my_community_members), org management (org_stats, org_applications, org_members, org_opportunities, org_documents, org_talents, org_talent_profile, org_triggers, org_community_feed, org_community_members), and org analytics (org_skills_analytics, org_application_funnel, org_talent_cohorts, etc.). For discovery/search, use smart_search instead. Personal data is automatically filtered for the authenticated user — do NOT include talentId in params. IMPORTANT: Do NOT call the same intent twice — results are deterministic and already in your conversation.',
    parameters: z.object({
      intent: z.enum(SQL_INTENTS).describe('The query intent. Use my_* for personal data, org_* for organization data (requires organizationId in params), search_* for text search.'),
      paramsJson: z.string().optional().describe('Optional JSON string with extra filters. Examples: \'{"status":"PENDING"}\', \'{"organizationId":"uuid"}\'. Do NOT include talentId — it is injected automatically.'),
      params: z.record(z.string(), z.unknown()).optional().describe('Optional parameters as an object. Alternative to paramsJson. Example: {"organizationId":"uuid","status":"PENDING"}. Do NOT include talentId.'),
      query: z.string().optional().describe('Text query for filtering results (rarely needed).'),
      country: z.string().optional().describe('Country code filter (e.g., "CI" for Côte d\'Ivoire).'),
    }),
    execute: async ({ intent, paramsJson, params: paramsObj, query, country }) => {
      const tr = (key: string, options?: Record<string, any>) => i18next.t(key, { lng: language, ...(options || {}) });
      // Merge params from multiple sources: paramsJson (string) or params (object)
      let params: Record<string, unknown> = {};
      if (paramsJson) {
        try { params = JSON.parse(paramsJson); } catch { params = {}; }
      }
      if (paramsObj && typeof paramsObj === 'object') {
        params = { ...params, ...paramsObj };
      }
      // Merge top-level query/country into params (agent may send them at root level)
      if (query && !params.query) params.query = query;
      if (country && !params.country) params.country = country;

      // Cap limit to prevent LLM from requesting excessive rows
      if (params.limit) params.limit = Math.min(Math.max(Number(params.limit) || 20, 1), 50);

      // Anti-loop: return cached result on repeat calls (NOT an error — errors cause retry loops)
      const cacheKey = `${intent}:${JSON.stringify(params)}`;
      const count = (callCounts.get(cacheKey) || 0) + 1;
      callCounts.set(cacheKey, count);

      if (count > 1 && resultCache.has(cacheKey)) {
        logger.warn(`[sql_query] Returning cached result for ${intent} (call #${count})`);
        const cached = resultCache.get(cacheKey);
        // Return cached data with a _cached flag — agent gets data, not an error
        return { ...cached, _cached: true, _note: `This is cached data from your first call. Do NOT call sql_query("${intent}") again.` };
      }

      // If allowedIntents is provided, reject disallowed intents
      if (allowedIntents && !allowedIntents.includes(intent)) {
        return { error: tr('copilot:toolIntentNotAllowed', { intent, allowed: allowedIntents.join(', ') }) };
      }

      // SECURITY: Always use the authenticated talentId, never from params
      const talentId = authenticatedTalentId;

      // Execute query and cache result
      const result = await (async () => {

      // For org intents, auto-inject organizationId if only one is authorized
      if (intent.startsWith('org_')) {
        if (!params.organizationId && authorizedOrgIds?.length === 1) {
          params.organizationId = authorizedOrgIds[0];
        }
        const orgId = params?.organizationId as string;
        if (!orgId) {
          return { error: tr('copilot:toolOrgIdRequired') };
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
            return { error: tr('copilot:toolOrgAccessDenied') };
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
                    t.goals, t.profile_tags,
                    (SELECT json_agg(json_build_object('name', ts.canonical_name, 'level', ts.proficiency_level, 'type', ts.type, 'origin', ts.origin, 'context', ts.context, 'updated_at', ts.updated_at))
                     FROM talent_skills ts WHERE ts.talent_id = t.id) as skills
             FROM talents t
             WHERE t.id = $1`,
              [talentId]
            );
            return res.rows[0] || { error: tr('copilot:toolProfileNotFound') };
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
             ORDER BY created_at DESC LIMIT 20`,
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
             ORDER BY cm.created_at DESC LIMIT 20`,
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
             ORDER BY created_at DESC LIMIT 20`,
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

          case 'my_triggers': {
            const limit = (params?.limit as number) || 50;
            const status = (params?.status as string) || 'PENDING';
            const from = params?.from ? new Date(String(params.from)) : null;
            const to = params?.to ? new Date(String(params.to)) : null;
            if (from && isNaN(from.getTime())) return { error: tr('copilot:toolFromInvalid') };
            if (to && isNaN(to.getTime())) return { error: tr('copilot:toolToInvalid') };

            const queryParams: any[] = [talentId, status];
            let idx = 3;
            let sql = `
            SELECT at.id, at.code, at.title, at.description, at.due_at, at.status, at.priority,
                   at.metadata, at.created_at, at.updated_at, at.completed_at
            FROM agenda_triggers at
            WHERE at.scope = 'TALENT' AND at.talent_id = $1 AND at.status = $2`;
            if (from) { sql += ` AND at.due_at >= $${idx}`; queryParams.push(from.toISOString()); idx++; }
            if (to) { sql += ` AND at.due_at <= $${idx}`; queryParams.push(to.toISOString()); idx++; }
            sql += ` ORDER BY at.due_at ASC LIMIT $${idx}`;
            queryParams.push(limit);

            const res = await pool.query(sql, queryParams);
            return { triggers: res.rows, totalCount: res.rows.length };
          }

          // --- Org ---
          case 'org_members': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const res = await pool.query(
              `SELECT om.role, om.created_at, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name, t.bio, t.avatar_url,
                    (SELECT json_agg(json_build_object('name', ts.canonical_name, 'level', ts.proficiency_level, 'type', ts.type, 'origin', ts.origin, 'context', ts.context, 'updated_at', ts.updated_at))
                     FROM (SELECT canonical_name, proficiency_level, type, origin, context, updated_at FROM talent_skills WHERE talent_id = t.id ORDER BY canonical_name LIMIT 5) ts) as top_skills
             FROM organization_members om
             JOIN talents t ON om.talent_id = t.id
             WHERE om.organization_id = $1 AND om.status = 'ACTIVE'
             ORDER BY om.created_at DESC LIMIT 20`,
              [orgId]
            );
            return { members: res.rows, chart_hint: 'table' };
          }

          case 'org_applications': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const res = await pool.query(
              `SELECT a.id, a.status, a.applied_at,
                    COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name, t.bio,
                    t.id as talent_id,
                    o.title as opportunity_title, o.id as opportunity_id,
                    o.summary as opportunity_summary, o.type as opportunity_type,
                    (SELECT json_agg(json_build_object('name', ts.canonical_name, 'level', ts.proficiency_level, 'type', ts.type, 'origin', ts.origin, 'context', ts.context, 'updated_at', ts.updated_at))
                     FROM (SELECT canonical_name, proficiency_level, type, origin, context, updated_at FROM talent_skills WHERE talent_id = t.id ORDER BY canonical_name LIMIT 5) ts) as top_skills
             FROM opportunity_applications a
             JOIN opportunities o ON a.opportunity_id = o.id
             JOIN opportunity_posters op ON o.id = op.opportunity_id
             JOIN talents t ON a.talent_id = t.id
             WHERE op.poster_organization_id = $1
             ORDER BY a.applied_at DESC LIMIT 20`,
              [orgId]
            );
            return { applications: res.rows, chart_hint: 'table' };
          }

          case 'org_stats': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const res = await pool.query(
              `SELECT
              (SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND status = 'ACTIVE') as member_count,
              (SELECT COUNT(*) FROM opportunities o JOIN opportunity_posters op ON o.id = op.opportunity_id WHERE op.poster_organization_id = $1 AND o.status = 'OPEN' AND o.deleted_at IS NULL) as open_opportunities,
              (SELECT COUNT(*) FROM communities WHERE organization_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL) as community_count,
              (SELECT COUNT(*) FROM spaces WHERE organization_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL) as space_count,
              (SELECT logo_url FROM organizations WHERE id = $1) as logo_url,
              (SELECT headquarters_city FROM organizations WHERE id = $1) as city,
              (SELECT headquarters_country FROM organizations WHERE id = $1) as country`,
              [orgId]
            );
            return res.rows[0];
          }

          case 'org_opportunities': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
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
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const res = await pool.query(
              `SELECT c.id, c.name, c.slug, c.type, c.status,
                    (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE') as member_count
             FROM communities c
             WHERE c.organization_id = $1 AND c.deleted_at IS NULL
             ORDER BY c.created_at DESC LIMIT 20`,
              [orgId]
            );
            return { communities: res.rows };
          }

          case 'org_spaces': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const res = await pool.query(
              `SELECT s.id, s.name, s.slug, s.type, s.capacity, s.status,
                    s.hourly_rate, s.city
             FROM spaces s
             WHERE s.organization_id = $1 AND s.deleted_at IS NULL
             ORDER BY s.created_at DESC LIMIT 20`,
              [orgId]
            );
            return { spaces: res.rows };
          }

          case 'org_invitations': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const res = await pool.query(
              `SELECT i.id, 'organization' as type, i.status, i.created_at, i.email as invitee_email, i.role as target_name
             FROM organization_invitations i
             WHERE i.organization_id = $1 AND i.status = 'PENDING'
             ORDER BY i.created_at DESC`,
              [orgId]
            );
            return { invitations: res.rows };
          }

          case 'org_triggers': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const limit = (params?.limit as number) || 50;
            const status = (params?.status as string) || 'PENDING';
            const from = params?.from ? new Date(String(params.from)) : null;
            const to = params?.to ? new Date(String(params.to)) : null;
            if (from && isNaN(from.getTime())) return { error: tr('copilot:toolFromInvalid') };
            if (to && isNaN(to.getTime())) return { error: tr('copilot:toolToInvalid') };

            const queryParams: any[] = [orgId, status];
            let idx = 3;
            let sql = `
            SELECT at.id, at.code, at.title, at.description, at.due_at, at.status, at.priority,
                   at.metadata, at.created_at, at.updated_at, at.completed_at,
                   COALESCE(t.first_name || ' ' || t.last_name, t.email) as created_by_name
            FROM agenda_triggers at
            LEFT JOIN talents t ON t.id = at.created_by
            WHERE at.scope = 'ORGANIZATION' AND at.organization_id = $1 AND at.status = $2`;
            if (from) { sql += ` AND at.due_at >= $${idx}`; queryParams.push(from.toISOString()); idx++; }
            if (to) { sql += ` AND at.due_at <= $${idx}`; queryParams.push(to.toISOString()); idx++; }
            sql += ` ORDER BY at.due_at ASC LIMIT $${idx}`;
            queryParams.push(limit);

            const res = await pool.query(sql, queryParams);
            return { triggers: res.rows, totalCount: res.rows.length };
          }

          case 'org_documents': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const limit = (params?.limit as number) || 20;
            const docType = params?.type as string;
            const category = params?.category as string;
            const search = params?.search as string;
            let query = `
            SELECT od.id, od.title, od.original_filename, od.document_type, od.category,
                   od.status, od.description, od.tags, od.created_at,
                   COALESCE(t.first_name || ' ' || t.last_name, t.email) as uploader_name
            FROM organization_documents od
            LEFT JOIN talents t ON od.uploaded_by = t.id
            WHERE od.organization_id = $1 AND od.deleted_at IS NULL`;
            const queryParams: any[] = [orgId];
            let idx = 2;
            if (docType) { query += ` AND od.document_type = $${idx}`; queryParams.push(docType); idx++; }
            if (category) { query += ` AND od.category = $${idx}`; queryParams.push(category); idx++; }
            if (search) { query += ` AND (od.title ILIKE '%' || $${idx} || '%' OR od.original_filename ILIKE '%' || $${idx} || '%')`; queryParams.push(search); idx++; }
            query += ` ORDER BY od.created_at DESC LIMIT $${idx}`;
            queryParams.push(limit);
            const res = await pool.query(query, queryParams);
            return { documents: res.rows };
          }

          case 'org_talents': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const limit = (params?.limit as number) || 20;
            const source = params?.source as string;
            const isFavorite = params?.isFavorite as boolean;
            const search = params?.search as string;
            const baseQuery = `
            WITH org_talents AS (
              SELECT DISTINCT oa.talent_id, 'APPLICATION' AS source, oa.applied_at AS interaction_date
              FROM opportunity_applications oa
              JOIN opportunities o ON o.id = oa.opportunity_id
              WHERE o.organization_id = $1 AND oa.deleted_at IS NULL AND o.deleted_at IS NULL
              UNION ALL
              SELECT DISTINCT cm.talent_id, 'COMMUNITY' AS source, cm.created_at AS interaction_date
              FROM community_members cm
              JOIN communities c ON c.id = cm.community_id
              WHERE c.organization_id = $1 AND cm.deleted_at IS NULL AND c.deleted_at IS NULL AND cm.status = 'ACTIVE'
              UNION ALL
              SELECT DISTINCT sb.talent_id, 'SPACE_BOOKING' AS source, sb.created_at AS interaction_date
              FROM space_bookings sb
              JOIN spaces s ON s.id = sb.space_id
              WHERE s.organization_id = $1 AND s.deleted_at IS NULL
              UNION ALL
              SELECT DISTINCT om.talent_id, 'MEMBER' AS source, om.created_at AS interaction_date
              FROM organization_members om
              WHERE om.organization_id = $1
            ),
            aggregated AS (
              SELECT ot.talent_id, array_agg(DISTINCT ot.source) AS sources,
                     MIN(ot.interaction_date) AS first_interaction,
                     MAX(ot.interaction_date) AS last_interaction
              FROM org_talents ot
              GROUP BY ot.talent_id
            )
            SELECT a.talent_id as id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
                   t.bio, t.city, t.country, a.sources, a.first_interaction, a.last_interaction,
                   (otf.talent_id IS NOT NULL) as is_favorite,
                   (SELECT json_agg(json_build_object('name', ts.canonical_name, 'level', ts.proficiency_level, 'type', ts.type, 'origin', ts.origin, 'context', ts.context, 'updated_at', ts.updated_at))
                    FROM (SELECT canonical_name, proficiency_level, type, origin, context, updated_at FROM talent_skills WHERE talent_id = a.talent_id ORDER BY canonical_name LIMIT 5) ts) as top_skills
            FROM aggregated a
            JOIN talents t ON a.talent_id = t.id
            LEFT JOIN organization_talent_favorites otf ON otf.talent_id = a.talent_id AND otf.organization_id = $1`;
            const conditions: string[] = [];
            const queryParams: any[] = [orgId];
            let idx = 2;
            if (source) { conditions.push(`$${idx} = ANY(a.sources)`); queryParams.push(source); idx++; }
            if (isFavorite === true) { conditions.push(`otf.talent_id IS NOT NULL`); }
            if (search) { conditions.push(`(COALESCE(t.first_name || ' ' || t.last_name, t.email) ILIKE '%' || $${idx} || '%' OR t.bio ILIKE '%' || $${idx} || '%')`); queryParams.push(search); idx++; }
            let fullQuery = baseQuery;
            if (conditions.length > 0) fullQuery += ` WHERE ${conditions.join(' AND ')}`;
            fullQuery += ` ORDER BY a.last_interaction DESC LIMIT $${idx}`;
            queryParams.push(limit);
            const res = await pool.query(fullQuery, queryParams);
            return { talents: res.rows };
          }

          case 'org_talent_profile': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const targetTalentId = params?.talentId as string;
            if (!targetTalentId) return { error: tr('copilot:toolTalentIdRequired') };
            // Verify the talent has interacted with the org (UNION 4 sources)
            const interactionCheck = await pool.query(
              `SELECT 1 FROM (
                SELECT oa.talent_id FROM opportunity_applications oa
                JOIN opportunities o ON o.id = oa.opportunity_id
                WHERE o.organization_id = $1 AND oa.talent_id = $2 AND oa.deleted_at IS NULL AND o.deleted_at IS NULL
                UNION
                SELECT cm.talent_id FROM community_members cm
                JOIN communities c ON c.id = cm.community_id
                WHERE c.organization_id = $1 AND cm.talent_id = $2 AND cm.deleted_at IS NULL AND c.deleted_at IS NULL
                UNION
                SELECT sb.talent_id FROM space_bookings sb
                JOIN spaces s ON s.id = sb.space_id
                WHERE s.organization_id = $1 AND sb.talent_id = $2 AND s.deleted_at IS NULL
                UNION
                SELECT om.talent_id FROM organization_members om
                WHERE om.organization_id = $1 AND om.talent_id = $2
              ) AS interactions LIMIT 1`,
              [orgId, targetTalentId]
            );
            if (interactionCheck.rows.length === 0) {
              return { error: tr('copilot:toolNoInteraction') };
            }
            const profileRes = await pool.query(
              `SELECT t.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
                      t.bio, t.city, t.country, t.sectors, t.goals
               FROM talents t WHERE t.id = $1`,
              [targetTalentId]
            );
            const [skillsRes, docsRes] = await Promise.all([
              pool.query(
                `SELECT canonical_name as name, type, proficiency_level
                 FROM talent_skills WHERE talent_id = $1 ORDER BY canonical_name`,
                [targetTalentId]
              ),
              pool.query(
                `SELECT id, title, original_filename, document_type, mime_type
                 FROM talent_documents WHERE talent_id = $1 AND deleted_at IS NULL
                 ORDER BY created_at DESC LIMIT 10`,
                [targetTalentId]
              ),
            ]);
            return {
              profile: profileRes.rows[0] || { error: tr('copilot:toolProfileNotFound') },
              skills: skillsRes.rows,
              documents: docsRes.rows,
            };
          }

          case 'org_community_feed': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const communityId = params?.communityId as string;
            if (!communityId) return { error: tr('copilot:toolCommunityIdRequired') };
            const limit = (params?.limit as number) || 10;
            const activityType = params?.type as string;
            // Verify community belongs to this org
            const comCheck = await pool.query(
              `SELECT id FROM communities WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
              [communityId, orgId]
            );
            if (comCheck.rows.length === 0) {
              return { error: tr('copilot:toolCommunityNotFoundOrg') };
            }
            let query = `
            SELECT ca.id, ca.type, ca.content, ca.metadata, ca.reactions_count, ca.comments_count,
                   ca.is_pinned, COALESCE(t.first_name || ' ' || t.last_name, t.email) as author_name,
                   ca.published_at
            FROM community_activities ca
            JOIN talents t ON ca.author_id = t.id
            WHERE ca.community_id = $1 AND ca.status = 'PUBLISHED' AND ca.deleted_at IS NULL`;
            const queryParams: any[] = [communityId];
            let idx = 2;
            if (activityType) { query += ` AND ca.type = $${idx}`; queryParams.push(activityType); idx++; }
            query += ` ORDER BY ca.is_pinned DESC, ca.published_at DESC NULLS LAST LIMIT $${idx}`;
            queryParams.push(limit);
            const res = await pool.query(query, queryParams);
            return { activities: res.rows };
          }

          case 'org_community_members': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const communityId = params?.communityId as string;
            if (!communityId) return { error: tr('copilot:toolCommunityIdRequired') };
            const limit = (params?.limit as number) || 20;
            const role = params?.role as string;
            // Verify community belongs to this org
            const comCheck = await pool.query(
              `SELECT id FROM communities WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
              [communityId, orgId]
            );
            if (comCheck.rows.length === 0) {
              return { error: tr('copilot:toolCommunityNotFoundOrg') };
            }
            let query = `
            SELECT cm.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
                   cm.role, t.bio, t.city, t.country, cm.created_at as joined_at
            FROM community_members cm
            JOIN talents t ON cm.talent_id = t.id
            WHERE cm.community_id = $1 AND cm.status = 'ACTIVE' AND cm.deleted_at IS NULL`;
            const queryParams: any[] = [communityId];
            let idx = 2;
            if (role) { query += ` AND cm.role = $${idx}`; queryParams.push(role); idx++; }
            query += ` ORDER BY cm.created_at DESC LIMIT $${idx}`;
            queryParams.push(limit);
            const res = await pool.query(query, queryParams);
            return { members: res.rows };
          }

          // --- Org Analytics ---
          case 'org_skills_analytics': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const limit = (params?.limit as number) || 20;
            const skillType = params?.type as string;
            let query = `
            WITH org_talent_ids AS (
              SELECT DISTINCT oa.talent_id FROM opportunity_applications oa
              JOIN opportunities o ON o.id = oa.opportunity_id WHERE o.organization_id = $1 AND oa.deleted_at IS NULL AND o.deleted_at IS NULL
              UNION SELECT DISTINCT cm.talent_id FROM community_members cm
              JOIN communities c ON c.id = cm.community_id WHERE c.organization_id = $1 AND cm.deleted_at IS NULL AND c.deleted_at IS NULL AND cm.status = 'ACTIVE'
              UNION SELECT DISTINCT sb.talent_id FROM space_bookings sb
              JOIN spaces s ON s.id = sb.space_id WHERE s.organization_id = $1 AND s.deleted_at IS NULL
              UNION SELECT DISTINCT om.talent_id FROM organization_members om WHERE om.organization_id = $1
            )
            SELECT ts.canonical_name as skill_name, ts.proficiency_level, COUNT(*) as talent_count
            FROM talent_skills ts
            JOIN org_talent_ids oti ON ts.talent_id = oti.talent_id`;
            const queryParams: any[] = [orgId];
            let idx = 2;
            if (skillType) { query += ` WHERE ts.type = $${idx}`; queryParams.push(skillType); idx++; }
            query += ` GROUP BY ts.canonical_name, ts.proficiency_level ORDER BY talent_count DESC LIMIT $${idx}`;
            queryParams.push(limit);
            const res = await pool.query(query, queryParams);
            return { skills: res.rows, chart_hint: 'bar' };
          }

          case 'org_application_funnel': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const opportunityId = params?.opportunityId as string;
            let query = `
            SELECT o.title as opportunity_title,
                   COUNT(*) as total,
                   COUNT(*) FILTER (WHERE a.status = 'SUBMITTED') as submitted,
                   COUNT(*) FILTER (WHERE a.status = 'IN_REVIEW') as in_review,
                   COUNT(*) FILTER (WHERE a.status = 'ACCEPTED') as accepted,
                   COUNT(*) FILTER (WHERE a.status = 'REJECTED') as rejected,
                   ROUND(COUNT(*) FILTER (WHERE a.status = 'ACCEPTED')::numeric / NULLIF(COUNT(*), 0) * 100, 1) as acceptance_rate
            FROM opportunity_applications a
            JOIN opportunities o ON a.opportunity_id = o.id
            JOIN opportunity_posters op ON o.id = op.opportunity_id
            WHERE op.poster_organization_id = $1 AND a.deleted_at IS NULL AND o.deleted_at IS NULL`;
            const queryParams: any[] = [orgId];
            let idx = 2;
            if (opportunityId) { query += ` AND o.id = $${idx}`; queryParams.push(opportunityId); idx++; }
            query += ` GROUP BY o.id, o.title ORDER BY total DESC LIMIT 10`;
            const res = await pool.query(query, queryParams);
            return { funnel: res.rows, chart_hint: 'stacked_bar' };
          }

          case 'org_talent_cohorts': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const months = (params?.months as number) || 12;
            const res = await pool.query(
              `WITH org_talent_ids AS (
                SELECT DISTINCT oa.talent_id, MIN(oa.applied_at) as first_seen FROM opportunity_applications oa
                JOIN opportunities o ON o.id = oa.opportunity_id WHERE o.organization_id = $1 AND oa.deleted_at IS NULL AND o.deleted_at IS NULL GROUP BY oa.talent_id
                UNION ALL
                SELECT DISTINCT cm.talent_id, MIN(cm.created_at) as first_seen FROM community_members cm
                JOIN communities c ON c.id = cm.community_id WHERE c.organization_id = $1 AND cm.deleted_at IS NULL AND c.deleted_at IS NULL AND cm.status = 'ACTIVE' GROUP BY cm.talent_id
                UNION ALL
                SELECT DISTINCT sb.talent_id, MIN(sb.created_at) as first_seen FROM space_bookings sb
                JOIN spaces s ON s.id = sb.space_id WHERE s.organization_id = $1 AND s.deleted_at IS NULL GROUP BY sb.talent_id
                UNION ALL
                SELECT DISTINCT om.talent_id, MIN(om.created_at) as first_seen FROM organization_members om WHERE om.organization_id = $1 GROUP BY om.talent_id
              ),
              first_seen AS (
                SELECT talent_id, MIN(first_seen) as first_interaction FROM org_talent_ids GROUP BY talent_id
              ),
              monthly AS (
                SELECT DATE_TRUNC('month', first_interaction) as month,
                       COUNT(*) as new_talents
                FROM first_seen
                WHERE first_interaction >= NOW() - ($2 || ' months')::interval
                GROUP BY DATE_TRUNC('month', first_interaction)
              )
              SELECT TO_CHAR(month, 'YYYY-MM') as month, new_talents
              FROM monthly ORDER BY month`,
              [orgId, months]
            );
            return { cohorts: res.rows, chart_hint: 'bar' };
          }

          case 'org_geo_distribution': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const column = (params?.groupBy as string) === 'city' ? 'city' : 'country';
            const res = await pool.query(
              `WITH org_talent_ids AS (
                SELECT DISTINCT oa.talent_id FROM opportunity_applications oa
                JOIN opportunities o ON o.id = oa.opportunity_id WHERE o.organization_id = $1 AND oa.deleted_at IS NULL AND o.deleted_at IS NULL
                UNION SELECT DISTINCT cm.talent_id FROM community_members cm
                JOIN communities c ON c.id = cm.community_id WHERE c.organization_id = $1 AND cm.deleted_at IS NULL AND c.deleted_at IS NULL AND cm.status = 'ACTIVE'
                UNION SELECT DISTINCT sb.talent_id FROM space_bookings sb
                JOIN spaces s ON s.id = sb.space_id WHERE s.organization_id = $1 AND s.deleted_at IS NULL
                UNION SELECT DISTINCT om.talent_id FROM organization_members om WHERE om.organization_id = $1
              )
              SELECT COALESCE(t.${column}, $2::text) as label, COUNT(*) as value
              FROM org_talent_ids oti
              JOIN talents t ON oti.talent_id = t.id
              GROUP BY t.${column}
              ORDER BY value DESC LIMIT 15`,
              [orgId, tr('copilot:toolGeoNotProvided')]
            );
            return { distribution: res.rows, chart_hint: 'donut' };
          }

          case 'org_community_engagement': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const communityId = params?.communityId as string;
            let query = `
            SELECT c.id, c.name,
                   (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE' AND cm.deleted_at IS NULL) as total_members,
                   (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id AND cm.status = 'ACTIVE' AND cm.deleted_at IS NULL AND cm.created_at >= NOW() - INTERVAL '30 days') as active_30d,
                   (SELECT COUNT(*) FROM community_activities ca WHERE ca.community_id = c.id AND ca.status = 'PUBLISHED' AND ca.deleted_at IS NULL) as posts,
                   (SELECT COALESCE(SUM(ca.reactions_count), 0) FROM community_activities ca WHERE ca.community_id = c.id AND ca.status = 'PUBLISHED' AND ca.deleted_at IS NULL) as reactions,
                   (SELECT COALESCE(SUM(ca.comments_count), 0) FROM community_activities ca WHERE ca.community_id = c.id AND ca.status = 'PUBLISHED' AND ca.deleted_at IS NULL) as comments
            FROM communities c
            WHERE c.organization_id = $1 AND c.deleted_at IS NULL`;
            const queryParams: any[] = [orgId];
            if (communityId) { query += ` AND c.id = $2`; queryParams.push(communityId); }
            query += ` ORDER BY total_members DESC`;
            const res = await pool.query(query, queryParams);
            return { engagement: res.rows, chart_hint: 'table' };
          }

          case 'org_opportunity_performance': {
            const orgId = params?.organizationId as string;
            if (!orgId) return { error: tr('copilot:toolOrgIdRequiredShort') };
            const limit = (params?.limit as number) || 10;
            const res = await pool.query(
              `SELECT o.title,
                      COUNT(a.id) as total_applications,
                      COUNT(a.id) FILTER (WHERE a.status = 'ACCEPTED') as accepted,
                      ROUND(COUNT(a.id) FILTER (WHERE a.status = 'ACCEPTED')::numeric / NULLIF(COUNT(a.id), 0) * 100, 1) as acceptance_rate,
                      ROUND(EXTRACT(EPOCH FROM MIN(a.applied_at) - o.posted_at) / 3600, 1) as hours_to_first_application
               FROM opportunities o
               JOIN opportunity_posters op ON o.id = op.opportunity_id
               LEFT JOIN opportunity_applications a ON a.opportunity_id = o.id AND a.deleted_at IS NULL
               WHERE op.poster_organization_id = $1 AND o.deleted_at IS NULL
               GROUP BY o.id, o.title, o.posted_at
               ORDER BY total_applications DESC LIMIT $2`,
              [orgId, limit]
            );
            return { performance: res.rows, chart_hint: 'table' };
          }

          // --- Talent community ---
          case 'my_community_feed': {
            const communityId = params?.communityId as string;
            if (!communityId) return { error: tr('copilot:toolCommunityIdRequired') };
            const limit = (params?.limit as number) || 10;
            const activityType = params?.type as string;
            // Verify talent is member of this community
            const memberCheck = await pool.query(
              `SELECT id FROM community_members
               WHERE community_id = $1 AND talent_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
              [communityId, talentId]
            );
            if (memberCheck.rows.length === 0) {
              return { error: tr('copilot:toolNotCommunityMember') };
            }
            let query = `
            SELECT ca.id, ca.type, ca.content, ca.metadata, ca.reactions_count, ca.comments_count,
                   ca.is_pinned, COALESCE(t.first_name || ' ' || t.last_name, t.email) as author_name,
                   ca.published_at
            FROM community_activities ca
            JOIN talents t ON ca.author_id = t.id
            WHERE ca.community_id = $1 AND ca.status = 'PUBLISHED' AND ca.deleted_at IS NULL`;
            const queryParams: any[] = [communityId];
            let idx = 2;
            if (activityType) { query += ` AND ca.type = $${idx}`; queryParams.push(activityType); idx++; }
            query += ` ORDER BY ca.is_pinned DESC, ca.published_at DESC NULLS LAST LIMIT $${idx}`;
            queryParams.push(limit);
            const res = await pool.query(query, queryParams);
            return { activities: res.rows };
          }

          case 'my_community_members': {
            const communityId = params?.communityId as string;
            if (!communityId) return { error: tr('copilot:toolCommunityIdRequired') };
            const limit = (params?.limit as number) || 20;
            const role = params?.role as string;
            // Verify talent is member of this community
            const memberCheck = await pool.query(
              `SELECT id FROM community_members
               WHERE community_id = $1 AND talent_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
              [communityId, talentId]
            );
            if (memberCheck.rows.length === 0) {
              return { error: tr('copilot:toolNotCommunityMember') };
            }
            let query = `
            SELECT cm.id, COALESCE(t.first_name || ' ' || t.last_name, t.email) as display_name,
                   cm.role, t.bio, cm.created_at as joined_at
            FROM community_members cm
            JOIN talents t ON cm.talent_id = t.id
            WHERE cm.community_id = $1 AND cm.status = 'ACTIVE' AND cm.deleted_at IS NULL`;
            const queryParams: any[] = [communityId];
            let idx = 2;
            if (role) { query += ` AND cm.role = $${idx}`; queryParams.push(role); idx++; }
            query += ` ORDER BY cm.created_at DESC LIMIT $${idx}`;
            queryParams.push(limit);
            const res = await pool.query(query, queryParams);
            return { members: res.rows };
          }

          default:
            return { error: tr('copilot:toolIntentNotImplemented', { intent }) };
        }
      } catch (error: any) {
        logger.error(`SQL query error (${intent}):`, error);
        return { error: error.message };
      }

      })(); // end IIFE

      // Cache successful results for anti-loop dedup
      if (result && !result.error) {
        resultCache.set(cacheKey, result);
      }
      return result;
    },
  });
}

// NOTE: sqlQueryTool export was removed for security reasons.
// Use createSqlQueryTool(authenticatedTalentId) instead to prevent IDOR vulnerabilities.
