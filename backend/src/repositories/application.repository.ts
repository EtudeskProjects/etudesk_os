/**
 * Application Repository
 *
 * Handles all database operations for opportunity applications.
 * Separates data access logic from route handlers and business logic.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, PaginatedResult, PaginationOptions, QueryParam } from './base.repository';

export interface Application {
  id: string;
  talent_id: string;
  opportunity_id: string;
  cover_letter?: string;
  custom_answers?: Record<string, string>[];
  cv_url?: string;
  status: ApplicationStatus;
  notes?: string;
  rating?: number;
  interview_scheduled_at?: Date;
  interview_type?: string;
  interview_location?: string;
  interview_notes?: string;
  applied_at: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export type ApplicationStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface CreateApplicationDTO {
  talent_id: string;
  opportunity_id: string;
  cover_letter?: string;
  custom_answers?: Record<string, string>[];
  resume_url?: string;
}

export interface UpdateApplicationDTO {
  status?: ApplicationStatus;
  notes?: string;
  rating?: number;
  interview_scheduled_at?: Date;
  interview_type?: string;
  interview_location?: string;
  interview_notes?: string;
}

export interface ApplicationFilters {
  talent_id?: string;
  opportunity_id?: string;
  status?: ApplicationStatus | ApplicationStatus[];
  organization_id?: string;
}

export interface ApplicationWithDetails extends Application {
  opportunity_title?: string;
  opportunity_slug?: string;
  opportunity_type?: string;
  organization_name?: string;
  talent_name?: string;
  talent_email?: string;
}

class ApplicationRepository extends BaseRepository<Application> {
  protected tableName = 'opportunity_applications';
  protected primaryKey = 'id';

  /**
   * Create a new application
   */
  async create(dto: CreateApplicationDTO): Promise<Application> {
    const id = uuidv4();
    const result = await this.query<Application>(
      `INSERT INTO opportunity_applications (
        id, talent_id, opportunity_id, cover_letter, custom_answers, cv_url, status, applied_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW())
      RETURNING *`,
      [
        id,
        dto.talent_id,
        dto.opportunity_id,
        dto.cover_letter || null,
        dto.custom_answers ? JSON.stringify(dto.custom_answers) : null,
        dto.resume_url || null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Find application by talent and opportunity (check for duplicates)
   */
  async findByTalentAndOpportunity(
    talentId: string,
    opportunityId: string
  ): Promise<Application | null> {
    const result = await this.query<Application>(
      `SELECT * FROM opportunity_applications
       WHERE talent_id = $1 AND opportunity_id = $2 AND deleted_at IS NULL`,
      [talentId, opportunityId]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if a talent has already applied to an opportunity
   */
  async hasApplied(talentId: string, opportunityId: string): Promise<boolean> {
    const result = await this.query(
      `SELECT 1 FROM opportunity_applications
       WHERE talent_id = $1 AND opportunity_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [talentId, opportunityId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get applications for a talent with pagination
   */
  async findByTalent(
    talentId: string,
    pagination: PaginationOptions = {},
    status?: ApplicationStatus | ApplicationStatus[]
  ): Promise<PaginatedResult<ApplicationWithDetails>> {
    const params: QueryParam[] = [talentId];
    let paramIndex = 2;

    let statusFilter = '';
    if (status) {
      if (Array.isArray(status)) {
        statusFilter = ` AND a.status = ANY($${paramIndex})`;
        params.push(status);
      } else {
        statusFilter = ` AND a.status = $${paramIndex}`;
        params.push(status);
      }
      paramIndex++;
    }

    const baseQuery = `
      SELECT
        a.*,
        o.title as opportunity_title,
        o.slug as opportunity_slug,
        o.type as opportunity_type,
        org.name as organization_name
      FROM opportunity_applications a
      JOIN opportunities o ON a.opportunity_id = o.id
      LEFT JOIN opportunity_posters op ON o.id = op.opportunity_id
      LEFT JOIN organizations org ON op.poster_organization_id = org.id
      WHERE a.talent_id = $1 AND a.deleted_at IS NULL ${statusFilter}
      ORDER BY a.applied_at DESC`;

    const countQuery = `
      SELECT COUNT(*) as count
      FROM opportunity_applications a
      WHERE a.talent_id = $1 AND a.deleted_at IS NULL ${statusFilter}`;

    return this.paginate<ApplicationWithDetails>(baseQuery, countQuery, params, pagination);
  }

  /**
   * Get applications for an opportunity with pagination
   */
  async findByOpportunity(
    opportunityId: string,
    pagination: PaginationOptions = {},
    status?: ApplicationStatus | ApplicationStatus[]
  ): Promise<PaginatedResult<ApplicationWithDetails>> {
    const params: QueryParam[] = [opportunityId];
    let paramIndex = 2;

    let statusFilter = '';
    if (status) {
      if (Array.isArray(status)) {
        statusFilter = ` AND a.status = ANY($${paramIndex})`;
        params.push(status);
      } else {
        statusFilter = ` AND a.status = $${paramIndex}`;
        params.push(status);
      }
      paramIndex++;
    }

    const baseQuery = `
      SELECT
        a.*,
        COALESCE(t.first_name || ' ' || t.last_name, t.email) as talent_name,
        t.email as talent_email
      FROM opportunity_applications a
      JOIN talents t ON a.talent_id = t.id
      WHERE a.opportunity_id = $1 AND a.deleted_at IS NULL ${statusFilter}
      ORDER BY a.applied_at DESC`;

    const countQuery = `
      SELECT COUNT(*) as count
      FROM opportunity_applications a
      WHERE a.opportunity_id = $1 AND a.deleted_at IS NULL ${statusFilter}`;

    return this.paginate<ApplicationWithDetails>(baseQuery, countQuery, params, pagination);
  }

  /**
   * Update application status
   */
  async updateStatus(id: string, status: ApplicationStatus): Promise<Application | null> {
    const result = await this.query<Application>(
      `UPDATE opportunity_applications
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Bulk update application status
   */
  async bulkUpdateStatus(
    ids: string[],
    status: ApplicationStatus
  ): Promise<{ updated: number; failed: number }> {
    const result = await this.query(
      `UPDATE opportunity_applications
       SET status = $1, updated_at = NOW()
       WHERE id = ANY($2) AND deleted_at IS NULL`,
      [status, ids]
    );
    const updated = result.rowCount ?? 0;
    return {
      updated,
      failed: ids.length - updated,
    };
  }

  /**
   * Update application notes
   */
  async updateNotes(id: string, notes: string | null): Promise<Application | null> {
    const result = await this.query<Application>(
      `UPDATE opportunity_applications
       SET notes = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [notes, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update application rating
   */
  async updateRating(id: string, rating: number | null): Promise<Application | null> {
    const result = await this.query<Application>(
      `UPDATE opportunity_applications
       SET rating = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [rating, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Schedule interview
   */
  async scheduleInterview(
    id: string,
    scheduledAt: Date,
    type?: string,
    location?: string,
    notes?: string
  ): Promise<Application | null> {
    const result = await this.query<Application>(
      `UPDATE opportunity_applications
       SET
         interview_scheduled_at = $1,
         interview_type = COALESCE($2, interview_type),
         interview_location = COALESCE($3, interview_location),
         interview_notes = COALESCE($4, interview_notes),
         updated_at = NOW()
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING *`,
      [scheduledAt, type || null, location || null, notes || null, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if user has permission to manage application
   * (is owner of the opportunity via organization)
   */
  async canManage(applicationId: string, talentId: string): Promise<boolean> {
    const result = await this.query(
      `SELECT 1 FROM opportunity_applications a
       JOIN opportunities o ON a.opportunity_id = o.id
       JOIN opportunity_posters op ON o.id = op.opportunity_id
       JOIN organization_members om ON op.poster_organization_id = om.organization_id
       WHERE a.id = $1
         AND om.talent_id = $2
         AND om.status = 'ACTIVE'
         AND om.role IN ('OWNER', 'ADMIN')
       LIMIT 1`,
      [applicationId, talentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if user owns the application
   */
  async isOwner(applicationId: string, talentId: string): Promise<boolean> {
    const result = await this.query(
      `SELECT 1 FROM opportunity_applications
       WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [applicationId, talentId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get application count by status for an opportunity
   */
  async getCountByStatus(opportunityId: string): Promise<Record<string, number>> {
    const result = await this.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) as count
       FROM opportunity_applications
       WHERE opportunity_id = $1 AND deleted_at IS NULL
       GROUP BY status`,
      [opportunityId]
    );

    return result.rows.reduce(
      (acc, row) => {
        acc[row.status] = parseInt(row.count, 10);
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Withdraw application (soft delete with status change)
   */
  async withdraw(id: string, talentId: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE opportunity_applications
       SET status = 'WITHDRAWN', updated_at = NOW()
       WHERE id = $1 AND talent_id = $2 AND deleted_at IS NULL
         AND status NOT IN ('ACCEPTED', 'REJECTED')`,
      [id, talentId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

// Export singleton instance
export const applicationRepository = new ApplicationRepository();
