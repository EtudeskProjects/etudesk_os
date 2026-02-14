/**
 * Organization Talent Service (CRM "Mes Talents")
 * Aggregates talents from: applications, community members, space bookings, org members
 * Provides favorites, custom tags, and filtered listing
 */

import { pool } from '../database';
import { logger } from '../../utils';

// --- Interfaces ---

export interface OrgTalent {
  talent_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  sources: string[];  // ['APPLICATION', 'COMMUNITY', 'SPACE_BOOKING', 'MEMBER']
  is_favorite: boolean;
  tags: { id: string; name: string; color: string }[];
  first_interaction: Date;
  last_interaction: Date;
}

export interface OrgTalentFilters {
  source?: 'APPLICATION' | 'COMMUNITY' | 'SPACE_BOOKING' | 'MEMBER';
  isFavorite?: boolean;
  tagId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface OrgTalentTag {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: Date;
}

// --- Aggregated Talent Listing ---

export async function getOrganizationTalents(
  orgId: string,
  filters: OrgTalentFilters = {}
): Promise<{
  talents: OrgTalent[];
  total: number;
  limit: number;
  offset: number;
}> {
  const { source, isFavorite, tagId, search, limit = 20, offset = 0 } = filters;

  // CTE: aggregate all talent interactions with the organization
  const baseQuery = `
    WITH org_talents AS (
      -- Source 1: Application candidates
      SELECT DISTINCT oa.talent_id, 'APPLICATION' AS source,
        oa.applied_at AS interaction_date
      FROM opportunity_applications oa
      JOIN opportunities o ON o.id = oa.opportunity_id
      WHERE o.organization_id = $1
        AND oa.deleted_at IS NULL
        AND o.deleted_at IS NULL

      UNION ALL

      -- Source 2: Community members
      SELECT DISTINCT cm.talent_id, 'COMMUNITY' AS source,
        cm.created_at AS interaction_date
      FROM community_members cm
      JOIN communities c ON c.id = cm.community_id
      WHERE c.organization_id = $1
        AND cm.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND cm.status = 'ACTIVE'

      UNION ALL

      -- Source 3: Space bookings
      SELECT DISTINCT sb.talent_id, 'SPACE_BOOKING' AS source,
        sb.created_at AS interaction_date
      FROM space_bookings sb
      JOIN spaces s ON s.id = sb.space_id
      WHERE s.organization_id = $1
        AND s.deleted_at IS NULL

      UNION ALL

      -- Source 4: Direct organization members
      SELECT DISTINCT om.talent_id, 'MEMBER' AS source,
        om.created_at AS interaction_date
      FROM organization_members om
      WHERE om.organization_id = $1
    ),
    aggregated AS (
      SELECT
        ot.talent_id,
        array_agg(DISTINCT ot.source) AS sources,
        MIN(ot.interaction_date) AS first_interaction,
        MAX(ot.interaction_date) AS last_interaction
      FROM org_talents ot
      GROUP BY ot.talent_id
    )
  `;

  // Build WHERE conditions
  const conditions: string[] = [];
  const params: (string | boolean | number)[] = [orgId];
  let paramIndex = 2;

  if (source) {
    conditions.push(`$${paramIndex} = ANY(a.sources)`);
    params.push(source);
    paramIndex++;
  }

  if (isFavorite) {
    conditions.push(`f.talent_id IS NOT NULL`);
  }

  if (tagId) {
    conditions.push(`EXISTS (
      SELECT 1 FROM organization_talent_tag_assignments ta
      WHERE ta.talent_id = a.talent_id AND ta.tag_id = $${paramIndex}
    )`);
    params.push(tagId);
    paramIndex++;
  }

  if (search) {
    conditions.push(`(
      t.first_name ILIKE $${paramIndex} OR
      t.last_name ILIKE $${paramIndex} OR
      t.email ILIKE $${paramIndex} OR
      (t.first_name || ' ' || t.last_name) ILIKE $${paramIndex}
    )`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  // Count query
  const countQuery = `
    ${baseQuery}
    SELECT COUNT(DISTINCT a.talent_id)::int AS total
    FROM aggregated a
    JOIN talents t ON t.id = a.talent_id
    LEFT JOIN organization_talent_favorites f
      ON f.organization_id = $1 AND f.talent_id = a.talent_id
    ${whereClause}
  `;

  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  // Data query
  params.push(limit, offset);
  const dataQuery = `
    ${baseQuery}
    SELECT
      a.talent_id,
      t.first_name,
      t.last_name,
      t.email,
      t.avatar_url,
      t.bio,
      a.sources,
      a.first_interaction,
      a.last_interaction,
      CASE WHEN f.talent_id IS NOT NULL THEN true ELSE false END AS is_favorite,
      COALESCE(
        (SELECT json_agg(json_build_object('id', td.id, 'name', td.name, 'color', td.color))
         FROM organization_talent_tag_assignments ta
         JOIN organization_talent_tag_definitions td ON td.id = ta.tag_id
         WHERE ta.talent_id = a.talent_id AND td.organization_id = $1),
        '[]'::json
      ) AS tags
    FROM aggregated a
    JOIN talents t ON t.id = a.talent_id
    LEFT JOIN organization_talent_favorites f
      ON f.organization_id = $1 AND f.talent_id = a.talent_id
    ${whereClause}
    ORDER BY
      CASE WHEN f.talent_id IS NOT NULL THEN 0 ELSE 1 END,
      a.last_interaction DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await pool.query(dataQuery, params);

  return {
    talents: dataResult.rows,
    total,
    limit,
    offset,
  };
}

export async function getOrganizationTalentCount(orgId: string): Promise<number> {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT talent_id)::int AS count FROM (
      SELECT oa.talent_id
      FROM opportunity_applications oa
      JOIN opportunities o ON o.id = oa.opportunity_id
      WHERE o.organization_id = $1 AND oa.deleted_at IS NULL AND o.deleted_at IS NULL

      UNION

      SELECT cm.talent_id
      FROM community_members cm
      JOIN communities c ON c.id = cm.community_id
      WHERE c.organization_id = $1 AND cm.deleted_at IS NULL AND c.deleted_at IS NULL AND cm.status = 'ACTIVE'

      UNION

      SELECT sb.talent_id
      FROM space_bookings sb
      JOIN spaces s ON s.id = sb.space_id
      WHERE s.organization_id = $1 AND s.deleted_at IS NULL

      UNION

      SELECT om.talent_id
      FROM organization_members om
      WHERE om.organization_id = $1
    ) AS all_talents
  `, [orgId]);

  return result.rows[0]?.count || 0;
}

// --- Favorites ---

export async function favoriteOrgTalent(
  orgId: string,
  talentId: string,
  favoritedBy: string,
  notes?: string
): Promise<boolean> {
  await pool.query(
    `INSERT INTO organization_talent_favorites (organization_id, talent_id, favorited_by, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (organization_id, talent_id) DO UPDATE SET notes = COALESCE($4, organization_talent_favorites.notes)`,
    [orgId, talentId, favoritedBy, notes || null]
  );
  return true;
}

export async function unfavoriteOrgTalent(orgId: string, talentId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM organization_talent_favorites WHERE organization_id = $1 AND talent_id = $2`,
    [orgId, talentId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getFavoriteIds(orgId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT talent_id FROM organization_talent_favorites WHERE organization_id = $1`,
    [orgId]
  );
  return result.rows.map((r: any) => r.talent_id);
}

// --- Tags ---

export async function createTag(
  orgId: string,
  name: string,
  color: string,
  createdBy: string
): Promise<OrgTalentTag> {
  const result = await pool.query(
    `INSERT INTO organization_talent_tag_definitions (organization_id, name, color, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [orgId, name.trim(), color, createdBy]
  );
  return result.rows[0];
}

export async function listTags(orgId: string): Promise<OrgTalentTag[]> {
  const result = await pool.query(
    `SELECT * FROM organization_talent_tag_definitions WHERE organization_id = $1 ORDER BY name`,
    [orgId]
  );
  return result.rows;
}

export async function updateTag(
  tagId: string,
  orgId: string,
  updates: { name?: string; color?: string }
): Promise<OrgTalentTag | null> {
  const fields: string[] = [];
  const params: string[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex}`);
    params.push(updates.name.trim());
    paramIndex++;
  }

  if (updates.color !== undefined) {
    fields.push(`color = $${paramIndex}`);
    params.push(updates.color);
    paramIndex++;
  }

  if (fields.length === 0) return null;

  params.push(tagId, orgId);
  const result = await pool.query(
    `UPDATE organization_talent_tag_definitions SET ${fields.join(', ')}
     WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
     RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

export async function deleteTag(tagId: string, orgId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM organization_talent_tag_definitions WHERE id = $1 AND organization_id = $2`,
    [tagId, orgId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function assignTag(tagId: string, talentId: string, assignedBy: string): Promise<boolean> {
  await pool.query(
    `INSERT INTO organization_talent_tag_assignments (tag_id, talent_id, assigned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (tag_id, talent_id) DO NOTHING`,
    [tagId, talentId, assignedBy]
  );
  return true;
}

export async function unassignTag(tagId: string, talentId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM organization_talent_tag_assignments WHERE tag_id = $1 AND talent_id = $2`,
    [tagId, talentId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getTalentTags(talentId: string, orgId: string): Promise<OrgTalentTag[]> {
  const result = await pool.query(
    `SELECT td.* FROM organization_talent_tag_definitions td
     JOIN organization_talent_tag_assignments ta ON ta.tag_id = td.id
     WHERE ta.talent_id = $1 AND td.organization_id = $2
     ORDER BY td.name`,
    [talentId, orgId]
  );
  return result.rows;
}

export default {
  getOrganizationTalents,
  getOrganizationTalentCount,
  favoriteOrgTalent,
  unfavoriteOrgTalent,
  getFavoriteIds,
  createTag,
  listTags,
  updateTag,
  deleteTag,
  assignTag,
  unassignTag,
  getTalentTags,
};
