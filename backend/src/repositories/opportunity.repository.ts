/**
 * Opportunity Repository
 *
 * Handles all database operations for opportunities (jobs, internships, etc.).
 */

import { BaseRepository, PaginationOptions, PaginatedResult, QueryParam } from './base.repository';

export type OpportunityType = 'JOB' | 'INTERNSHIP' | 'APPRENTICESHIP' | 'FREELANCE' | 'VOLUNTEER';
export type OpportunityStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
export type LocationType = 'ONSITE' | 'REMOTE' | 'HYBRID';
export type Visibility = 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';

export interface Opportunity {
  id: string;
  slug: string;
  title: string;
  type: OpportunityType;
  status: OpportunityStatus;
  visibility: Visibility;
  description: string | null;
  requirements: string | null;
  responsibilities: string | null;
  benefits: string | null;
  location_type: LocationType;
  location_city: string | null;
  location_country: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  contract_duration: string | null;
  start_date: Date | null;
  application_deadline: Date | null;
  required_skills: string[] | null;
  sectors: string[] | null;
  experience_level: string | null;
  education_level: string | null;
  languages: string[] | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface OpportunityWithOrgs extends Opportunity {
  organizations: Array<{
    id: string;
    name: string;
    logo_url: string | null;
    types: string[];
    headquarters_city: string | null;
    headquarters_country: string | null;
    verification_status: string;
  }>;
  application_count?: number;
}

export interface CreateOpportunityDTO {
  slug: string;
  title: string;
  type: OpportunityType;
  status?: OpportunityStatus;
  visibility?: Visibility;
  description?: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: string;
  location_type: LocationType;
  location_city?: string;
  location_country?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  contract_duration?: string;
  start_date?: Date;
  application_deadline?: Date;
  required_skills?: string[];
  sectors?: string[];
  experience_level?: string;
  education_level?: string;
  languages?: string[];
}

export interface UpdateOpportunityDTO extends Partial<CreateOpportunityDTO> {}

export interface OpportunityFilters {
  status?: OpportunityStatus;
  type?: OpportunityType;
  location_type?: LocationType;
  country?: string;
  search?: string;
  organizationId?: string;
}

class OpportunityRepository extends BaseRepository<Opportunity> {
  protected tableName = 'opportunities';
  protected primaryKey = 'id';

  /**
   * Find opportunity by slug
   */
  async findBySlug(slug: string): Promise<Opportunity | null> {
    const result = await this.query<Opportunity>(
      `SELECT * FROM opportunities WHERE slug = $1 AND deleted_at IS NULL`,
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Find opportunity by ID or slug with organizations
   */
  async findByIdOrSlugWithOrgs(idOrSlug: string): Promise<OpportunityWithOrgs | null> {
    const result = await this.query<OpportunityWithOrgs>(
      `SELECT o.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', org.id,
            'name', org.name,
            'logo_url', org.logo_url,
            'types', org.types,
            'headquarters_city', org.headquarters_city,
            'headquarters_country', org.headquarters_country,
            'verification_status', org.verification_status
          ))
          FROM opportunity_posters op
          JOIN organizations org ON op.poster_organization_id = org.id
          WHERE op.opportunity_id = o.id),
          '[]'
        ) as organizations,
        (SELECT COUNT(*) FROM applications WHERE opportunity_id = o.id) as application_count
      FROM opportunities o
      WHERE (o.id::text = $1 OR o.slug = $1) AND o.deleted_at IS NULL`,
      [idOrSlug]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new opportunity
   */
  async create(data: CreateOpportunityDTO): Promise<Opportunity> {
    const result = await this.query<Opportunity>(
      `INSERT INTO opportunities (
        slug, title, type, status, visibility, description, requirements,
        responsibilities, benefits, location_type, location_city, location_country,
        salary_min, salary_max, salary_currency, salary_period, contract_duration,
        start_date, application_deadline, required_skills, sectors,
        experience_level, education_level, languages
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        data.slug,
        data.title,
        data.type,
        data.status || 'DRAFT',
        data.visibility || 'PUBLIC',
        data.description || null,
        data.requirements || null,
        data.responsibilities || null,
        data.benefits || null,
        data.location_type,
        data.location_city || null,
        data.location_country || null,
        data.salary_min || null,
        data.salary_max || null,
        data.salary_currency || null,
        data.salary_period || null,
        data.contract_duration || null,
        data.start_date || null,
        data.application_deadline || null,
        data.required_skills || null,
        data.sectors || null,
        data.experience_level || null,
        data.education_level || null,
        data.languages || null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update an opportunity
   */
  async update(id: string, data: UpdateOpportunityDTO): Promise<Opportunity | null> {
    const updates: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    const fields: (keyof UpdateOpportunityDTO)[] = [
      'title', 'type', 'status', 'visibility', 'description', 'requirements',
      'responsibilities', 'benefits', 'location_type', 'location_city', 'location_country',
      'salary_min', 'salary_max', 'salary_currency', 'salary_period', 'contract_duration',
      'start_date', 'application_deadline', 'required_skills', 'sectors',
      'experience_level', 'education_level', 'languages'
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

    const result = await this.query<Opportunity>(
      `UPDATE opportunities SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * List opportunities with filters (public only)
   */
  async listPublic(
    filters: OpportunityFilters,
    pagination: PaginationOptions,
    talentId?: string,
    userEmail?: string
  ): Promise<PaginatedResult<OpportunityWithOrgs>> {
    const conditions: string[] = ['o.deleted_at IS NULL'];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    // Visibility logic: PUBLIC or user is invited
    let visibilityCondition = `COALESCE(o.visibility, 'PUBLIC') = 'PUBLIC'`;
    if (talentId && userEmail) {
      visibilityCondition = `(
        COALESCE(o.visibility, 'PUBLIC') = 'PUBLIC'
        OR EXISTS (
          SELECT 1 FROM opportunity_invitations oi
          WHERE oi.opportunity_id = o.id
          AND (oi.invitee_talent_id = $${paramIndex} OR LOWER(oi.invitee_email) = LOWER($${paramIndex + 1}))
        )
        OR EXISTS (
          SELECT 1 FROM opportunity_posters op
          JOIN organization_members om ON om.organization_id = op.poster_organization_id
          WHERE op.opportunity_id = o.id AND om.talent_id = $${paramIndex}
        )
      )`;
      params.push(talentId, userEmail);
      paramIndex += 2;
    }
    conditions.push(visibilityCondition);

    if (filters.status) {
      conditions.push(`o.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.type) {
      conditions.push(`o.type = $${paramIndex++}`);
      params.push(filters.type);
    }

    if (filters.location_type) {
      conditions.push(`o.location_type = $${paramIndex++}`);
      params.push(filters.location_type);
    }

    if (filters.country) {
      conditions.push(`o.location_country = $${paramIndex++}`);
      params.push(filters.country);
    }

    if (filters.search) {
      conditions.push(`(o.title ILIKE $${paramIndex} OR o.description ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.organizationId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM opportunity_posters op WHERE op.opportunity_id = o.id AND op.poster_organization_id = $${paramIndex++}
      )`);
      params.push(filters.organizationId);
    }

    const whereClause = conditions.join(' AND ');
    const baseQuery = `
      SELECT o.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', org.id,
            'name', org.name,
            'logo_url', org.logo_url,
            'types', org.types,
            'headquarters_city', org.headquarters_city,
            'headquarters_country', org.headquarters_country,
            'verification_status', org.verification_status
          ))
          FROM opportunity_posters op
          JOIN organizations org ON op.poster_organization_id = org.id
          WHERE op.opportunity_id = o.id),
          '[]'
        ) as organizations
      FROM opportunities o
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
    `;
    const countQuery = `SELECT COUNT(*) as count FROM opportunities o WHERE ${whereClause}`;

    return this.paginate<OpportunityWithOrgs>(baseQuery, countQuery, params, pagination);
  }

  /**
   * Link opportunity to organization
   */
  async linkToOrganization(opportunityId: string, organizationId: string): Promise<void> {
    await this.query(
      `INSERT INTO opportunity_posters (opportunity_id, poster_organization_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [opportunityId, organizationId]
    );
  }

  /**
   * Check if talent can manage opportunity (is admin/owner of posting organization)
   */
  async canManage(opportunityId: string, talentId: string): Promise<boolean> {
    const result = await this.query<{ role: string }>(
      `SELECT om.role FROM opportunity_posters op
       JOIN organization_members om ON om.organization_id = op.poster_organization_id
       WHERE op.opportunity_id = $1 AND om.talent_id = $2
       AND om.role IN ('OWNER', 'ADMIN')`,
      [opportunityId, talentId]
    );
    return result.rows.length > 0;
  }

  /**
   * Update opportunity status
   */
  async updateStatus(id: string, status: OpportunityStatus): Promise<boolean> {
    const result = await this.query(
      `UPDATE opportunities SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL`,
      [status, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get opportunities by organization
   */
  async findByOrganization(organizationId: string): Promise<Opportunity[]> {
    const result = await this.query<Opportunity>(
      `SELECT o.* FROM opportunities o
       JOIN opportunity_posters op ON op.opportunity_id = o.id
       WHERE op.poster_organization_id = $1 AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC`,
      [organizationId]
    );
    return result.rows;
  }
}

export const opportunityRepository = new OpportunityRepository();
