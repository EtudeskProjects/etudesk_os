/**
 * Community Repository
 *
 * Handles all database operations for communities.
 */

import { BaseRepository, PaginationOptions, PaginatedResult, QueryParam } from './base.repository';

export type CommunityVisibility = 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

export interface Community {
  id: string;
  slug: string;
  organization_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  visibility: CommunityVisibility;
  sectors: string[] | null;
  tags: string[] | null;
  rules: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CommunityWithStats extends Community {
  member_count: number;
  activity_count?: number;
  organization_name?: string;
  organization_logo?: string;
  user_membership_status?: MembershipStatus;
  user_role?: MemberRole;
}

export interface CommunityMembership {
  id: string;
  community_id: string;
  talent_id: string;
  status: MembershipStatus;
  role: MemberRole;
  joined_at: Date;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCommunityDTO {
  slug: string;
  organization_id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  logo_url?: string;
  visibility?: CommunityVisibility;
  sectors?: string[];
  tags?: string[];
  rules?: string;
}

export interface UpdateCommunityDTO {
  name?: string;
  description?: string;
  cover_image_url?: string;
  logo_url?: string;
  visibility?: CommunityVisibility;
  sectors?: string[];
  tags?: string[];
  rules?: string;
}

export interface CommunityFilters {
  organizationId?: string;
  visibility?: CommunityVisibility;
  sectors?: string[];
  search?: string;
}

class CommunityRepository extends BaseRepository<Community> {
  protected tableName = 'communities';
  protected primaryKey = 'id';

  /**
   * Find community by slug
   */
  async findBySlug(slug: string): Promise<Community | null> {
    const result = await this.query<Community>(
      `SELECT * FROM communities WHERE slug = $1 AND deleted_at IS NULL`,
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Find community by ID or slug with stats
   */
  async findByIdOrSlugWithStats(
    idOrSlug: string,
    talentId?: string
  ): Promise<CommunityWithStats | null> {
    const result = await this.query<CommunityWithStats>(
      `SELECT c.*,
        (SELECT COUNT(*) FROM community_memberships WHERE community_id = c.id AND status = 'ACTIVE') as member_count,
        (SELECT COUNT(*) FROM community_activities WHERE community_id = c.id AND deleted_at IS NULL) as activity_count,
        o.name as organization_name,
        o.logo_url as organization_logo
        ${talentId ? `,
          (SELECT status FROM community_memberships WHERE community_id = c.id AND talent_id = $2 LIMIT 1) as user_membership_status,
          (SELECT role FROM community_memberships WHERE community_id = c.id AND talent_id = $2 LIMIT 1) as user_role
        ` : ''}
      FROM communities c
      LEFT JOIN organizations o ON o.id = c.organization_id
      WHERE (c.id::text = $1 OR c.slug = $1) AND c.deleted_at IS NULL`,
      talentId ? [idOrSlug, talentId] : [idOrSlug]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new community
   */
  async create(data: CreateCommunityDTO): Promise<Community> {
    const result = await this.query<Community>(
      `INSERT INTO communities (
        slug, organization_id, name, description, cover_image_url, logo_url,
        visibility, sectors, tags, rules
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        data.slug,
        data.organization_id,
        data.name,
        data.description || null,
        data.cover_image_url || null,
        data.logo_url || null,
        data.visibility || 'PUBLIC',
        data.sectors || null,
        data.tags || null,
        data.rules || null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update a community
   */
  async update(id: string, data: UpdateCommunityDTO): Promise<Community | null> {
    const updates: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    const fields: (keyof UpdateCommunityDTO)[] = [
      'name', 'description', 'cover_image_url', 'logo_url', 'visibility',
      'sectors', 'tags', 'rules'
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(data[field] as QueryParam);
      }
    }

    if (updates.length === 0) return this.findById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.query<Community>(
      `UPDATE communities SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * List communities with filters
   */
  async list(
    filters: CommunityFilters,
    pagination: PaginationOptions,
    talentId?: string
  ): Promise<PaginatedResult<CommunityWithStats>> {
    const conditions: string[] = ['c.deleted_at IS NULL'];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    // Visibility logic
    if (talentId) {
      conditions.push(`(
        c.visibility = 'PUBLIC'
        OR EXISTS (SELECT 1 FROM community_memberships cm WHERE cm.community_id = c.id AND cm.talent_id = $${paramIndex})
        OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = c.organization_id AND om.talent_id = $${paramIndex})
      )`);
      params.push(talentId);
      paramIndex++;
    } else {
      conditions.push(`c.visibility = 'PUBLIC'`);
    }

    if (filters.organizationId) {
      conditions.push(`c.organization_id = $${paramIndex++}`);
      params.push(filters.organizationId);
    }

    if (filters.visibility) {
      conditions.push(`c.visibility = $${paramIndex++}`);
      params.push(filters.visibility);
    }

    if (filters.sectors && filters.sectors.length > 0) {
      conditions.push(`c.sectors && $${paramIndex++}`);
      params.push(filters.sectors);
    }

    if (filters.search) {
      conditions.push(`(c.name ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const baseQuery = `
      SELECT c.*,
        (SELECT COUNT(*) FROM community_memberships WHERE community_id = c.id AND status = 'ACTIVE') as member_count,
        o.name as organization_name,
        o.logo_url as organization_logo
      FROM communities c
      LEFT JOIN organizations o ON o.id = c.organization_id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
    `;
    const countQuery = `SELECT COUNT(*) as count FROM communities c WHERE ${whereClause}`;

    return this.paginate<CommunityWithStats>(baseQuery, countQuery, params, pagination);
  }

  /**
   * Get communities for a talent (member of)
   */
  async findByTalentMembership(talentId: string): Promise<CommunityWithStats[]> {
    const result = await this.query<CommunityWithStats>(
      `SELECT c.*,
        cm.status as user_membership_status,
        cm.role as user_role,
        (SELECT COUNT(*) FROM community_memberships WHERE community_id = c.id AND status = 'ACTIVE') as member_count,
        o.name as organization_name,
        o.logo_url as organization_logo
      FROM communities c
      INNER JOIN community_memberships cm ON cm.community_id = c.id AND cm.talent_id = $1
      LEFT JOIN organizations o ON o.id = c.organization_id
      WHERE c.deleted_at IS NULL AND cm.status = 'ACTIVE'
      ORDER BY c.created_at DESC`,
      [talentId]
    );
    return result.rows;
  }

  /**
   * Get communities by organization
   */
  async findByOrganization(organizationId: string): Promise<Community[]> {
    const result = await this.query<Community>(
      `SELECT * FROM communities WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [organizationId]
    );
    return result.rows;
  }

  /**
   * Add member to community
   */
  async addMember(
    communityId: string,
    talentId: string,
    role: MemberRole = 'MEMBER',
    status: MembershipStatus = 'ACTIVE'
  ): Promise<CommunityMembership> {
    const result = await this.query<CommunityMembership>(
      `INSERT INTO community_memberships (community_id, talent_id, role, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (community_id, talent_id) DO UPDATE SET role = $3, status = $4, updated_at = NOW()
       RETURNING *`,
      [communityId, talentId, role, status]
    );
    return result.rows[0];
  }

  /**
   * Remove member from community
   */
  async removeMember(communityId: string, talentId: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM community_memberships WHERE community_id = $1 AND talent_id = $2`,
      [communityId, talentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get membership for a talent in a community
   */
  async getMembership(communityId: string, talentId: string): Promise<CommunityMembership | null> {
    const result = await this.query<CommunityMembership>(
      `SELECT * FROM community_memberships WHERE community_id = $1 AND talent_id = $2`,
      [communityId, talentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if talent is member of community
   */
  async isMember(communityId: string, talentId: string): Promise<boolean> {
    const membership = await this.getMembership(communityId, talentId);
    return membership?.status === 'ACTIVE';
  }

  /**
   * Check if talent can manage community (is admin/owner of community or org)
   */
  async canManage(communityId: string, talentId: string): Promise<boolean> {
    const result = await this.query<{ can_manage: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM community_memberships cm
        WHERE cm.community_id = $1 AND cm.talent_id = $2 AND cm.role IN ('OWNER', 'ADMIN')
        UNION
        SELECT 1 FROM communities c
        JOIN organization_members om ON om.organization_id = c.organization_id
        WHERE c.id = $1 AND om.talent_id = $2 AND om.role IN ('OWNER', 'ADMIN')
      ) as can_manage`,
      [communityId, talentId]
    );
    return result.rows[0]?.can_manage || false;
  }

  /**
   * Update membership status
   */
  async updateMembershipStatus(
    communityId: string,
    talentId: string,
    status: MembershipStatus
  ): Promise<boolean> {
    const result = await this.query(
      `UPDATE community_memberships SET status = $1, updated_at = NOW() WHERE community_id = $2 AND talent_id = $3`,
      [status, communityId, talentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Update membership role
   */
  async updateMemberRole(
    communityId: string,
    talentId: string,
    role: MemberRole
  ): Promise<boolean> {
    const result = await this.query(
      `UPDATE community_memberships SET role = $1, updated_at = NOW() WHERE community_id = $2 AND talent_id = $3`,
      [role, communityId, talentId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export const communityRepository = new CommunityRepository();
