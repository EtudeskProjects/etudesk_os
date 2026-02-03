/**
 * Organization Repository
 *
 * Handles all database operations for organizations.
 */

import { BaseRepository, PaginationOptions, PaginatedResult, QueryParam } from './base.repository';

export type OrganizationType =
  | 'COMPANY'
  | 'STARTUP'
  | 'NGO'
  | 'ASSOCIATION'
  | 'EDUCATIONAL_INSTITUTION'
  | 'PUBLIC_ADMINISTRATION'
  | 'TRAINING_CENTER'
  | 'CONSULTING_FIRM'
  | 'RECRUITMENT_AGENCY'
  | 'FINANCIAL_INSTITUTION'
  | 'RESEARCH_CENTER'
  | 'COOPERATIVE'
  | 'SOCIAL_ENTERPRISE';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  types: OrganizationType[];
  description: string | null;
  logo_url: string | null;
  website: string | null;
  linkedin_url: string | null;
  employee_count: string | null;
  founded_year: number | null;
  headquarters_city: string | null;
  headquarters_country: string | null;
  headquarters_coordinates: [number, number] | null;
  sectors: string[] | null;
  verification_status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface OrganizationWithStats extends Organization {
  member_count: number;
  user_role?: string;
  headquarters_longitude?: number;
  headquarters_latitude?: number;
}

export interface CreateOrganizationDTO {
  name: string;
  slug: string;
  types: OrganizationType[];
  description?: string;
  logo_url?: string;
  website?: string;
  linkedin_url?: string;
  employee_count?: string;
  founded_year?: number;
  headquarters_city?: string;
  headquarters_country?: string;
  headquarters_coordinates?: [number, number];
  sectors?: string[];
}

export interface UpdateOrganizationDTO {
  name?: string;
  types?: OrganizationType[];
  description?: string;
  logo_url?: string;
  website?: string;
  linkedin_url?: string;
  employee_count?: string;
  founded_year?: number;
  headquarters_city?: string;
  headquarters_country?: string;
  headquarters_coordinates?: [number, number];
  sectors?: string[];
}

export interface OrganizationFilters {
  type?: OrganizationType;
  country?: string;
  search?: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  talent_id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joined_at: Date;
}

class OrganizationRepository extends BaseRepository<Organization> {
  protected tableName = 'organizations';
  protected primaryKey = 'id';

  /**
   * Find organization by slug
   */
  async findBySlug(slug: string): Promise<Organization | null> {
    const result = await this.query<Organization>(
      `SELECT * FROM organizations WHERE slug = $1 AND deleted_at IS NULL`,
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Find organization by ID or slug with stats
   */
  async findByIdOrSlugWithStats(idOrSlug: string): Promise<OrganizationWithStats | null> {
    const result = await this.query<OrganizationWithStats>(
      `SELECT o.*,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count,
        o.headquarters_coordinates[0] as headquarters_longitude,
        o.headquarters_coordinates[1] as headquarters_latitude
      FROM organizations o
      WHERE (o.id::text = $1 OR o.slug = $1) AND o.deleted_at IS NULL`,
      [idOrSlug]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new organization
   */
  async create(data: CreateOrganizationDTO): Promise<Organization> {
    const result = await this.query<Organization>(
      `INSERT INTO organizations (
        name, slug, types, description, logo_url, website, linkedin_url,
        employee_count, founded_year, headquarters_city, headquarters_country,
        headquarters_coordinates, sectors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.name,
        data.slug,
        data.types,
        data.description || null,
        data.logo_url || null,
        data.website || null,
        data.linkedin_url || null,
        data.employee_count || null,
        data.founded_year || null,
        data.headquarters_city || null,
        data.headquarters_country || null,
        data.headquarters_coordinates || null,
        data.sectors || null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update an organization
   */
  async update(id: string, data: UpdateOrganizationDTO): Promise<Organization | null> {
    const updates: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.types !== undefined) {
      updates.push(`types = $${paramIndex++}`);
      params.push(data.types as unknown as QueryParam);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.logo_url !== undefined) {
      updates.push(`logo_url = $${paramIndex++}`);
      params.push(data.logo_url);
    }
    if (data.website !== undefined) {
      updates.push(`website = $${paramIndex++}`);
      params.push(data.website);
    }
    if (data.linkedin_url !== undefined) {
      updates.push(`linkedin_url = $${paramIndex++}`);
      params.push(data.linkedin_url);
    }
    if (data.employee_count !== undefined) {
      updates.push(`employee_count = $${paramIndex++}`);
      params.push(data.employee_count);
    }
    if (data.founded_year !== undefined) {
      updates.push(`founded_year = $${paramIndex++}`);
      params.push(data.founded_year);
    }
    if (data.headquarters_city !== undefined) {
      updates.push(`headquarters_city = $${paramIndex++}`);
      params.push(data.headquarters_city);
    }
    if (data.headquarters_country !== undefined) {
      updates.push(`headquarters_country = $${paramIndex++}`);
      params.push(data.headquarters_country);
    }
    if (data.headquarters_coordinates !== undefined) {
      updates.push(`headquarters_coordinates = $${paramIndex++}`);
      params.push(data.headquarters_coordinates as unknown as QueryParam);
    }
    if (data.sectors !== undefined) {
      updates.push(`sectors = $${paramIndex++}`);
      params.push(data.sectors);
    }

    if (updates.length === 0) return this.findById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.query<Organization>(
      `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * List organizations with filters
   */
  async list(
    filters: OrganizationFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<OrganizationWithStats>> {
    const conditions: string[] = ['o.deleted_at IS NULL'];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    if (filters.type) {
      conditions.push(`$${paramIndex++} = ANY(o.types)`);
      params.push(filters.type);
    }

    if (filters.country) {
      conditions.push(`o.headquarters_country = $${paramIndex++}`);
      params.push(filters.country);
    }

    if (filters.search) {
      conditions.push(`(o.name ILIKE $${paramIndex} OR o.description ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const baseQuery = `
      SELECT o.*,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count
      FROM organizations o
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
    `;
    const countQuery = `SELECT COUNT(*) as count FROM organizations o WHERE ${whereClause}`;

    return this.paginate<OrganizationWithStats>(baseQuery, countQuery, params, pagination);
  }

  /**
   * Get organizations for a talent
   */
  async findByTalentId(talentId: string): Promise<OrganizationWithStats[]> {
    const result = await this.query<OrganizationWithStats>(
      `SELECT o.*,
        om.role as user_role,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count,
        o.headquarters_coordinates[0] as headquarters_longitude,
        o.headquarters_coordinates[1] as headquarters_latitude
      FROM organizations o
      INNER JOIN organization_members om ON om.organization_id = o.id AND om.talent_id = $1
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at DESC`,
      [talentId]
    );
    return result.rows;
  }

  /**
   * Add a member to an organization
   */
  async addMember(
    organizationId: string,
    talentId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER'
  ): Promise<OrganizationMember> {
    const result = await this.query<OrganizationMember>(
      `INSERT INTO organization_members (organization_id, talent_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, talent_id) DO UPDATE SET role = $3
       RETURNING *`,
      [organizationId, talentId, role]
    );
    return result.rows[0];
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(organizationId: string, talentId: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [organizationId, talentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get member role in organization
   */
  async getMemberRole(organizationId: string, talentId: string): Promise<string | null> {
    const result = await this.query<{ role: string }>(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND talent_id = $2`,
      [organizationId, talentId]
    );
    return result.rows[0]?.role || null;
  }

  /**
   * Check if talent is owner of organization
   */
  async isOwner(organizationId: string, talentId: string): Promise<boolean> {
    const role = await this.getMemberRole(organizationId, talentId);
    return role === 'OWNER';
  }

  /**
   * Check if talent is admin or owner of organization
   */
  async isAdminOrOwner(organizationId: string, talentId: string): Promise<boolean> {
    const role = await this.getMemberRole(organizationId, talentId);
    return role === 'OWNER' || role === 'ADMIN';
  }
}

export const organizationRepository = new OrganizationRepository();
