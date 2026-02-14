/**
 * Talent Repository
 *
 * Handles all database operations for talents (user profiles).
 */

import { BaseRepository, PaginationOptions, PaginatedResult, QueryParam } from './base.repository';

export interface Talent {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  gender: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  remote_ready: boolean;
  willing_to_relocate: boolean;
  profile_tags: string[] | null;
  goals: string[] | null;
  sectors: string[] | null;
  onboarding_completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface TalentWithStats extends Talent {
  skill_count: number;
  kyc_status: string | null;
  verification_status: 'VERIFIED' | 'UNVERIFIED';
}

export interface CreateTalentDTO {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface UpdateTalentDTO {
  first_name?: string;
  last_name?: string;
  bio?: string;
  avatar_url?: string;
  phone?: string;
  gender?: string;
  city?: string;
  region?: string;
  country?: string;
  remote_ready?: boolean;
  willing_to_relocate?: boolean;
  profile_tags?: string[];
  goals?: string[];
  sectors?: string[];
}

export interface TalentFilters {
  country?: string;
  city?: string;
  remote_ready?: boolean;
  sectors?: string[];
  search?: string;
}

class TalentRepository extends BaseRepository<Talent> {
  protected tableName = 'talents';
  protected primaryKey = 'id';

  /**
   * Find talent by user ID
   */
  async findByUserId(userId: string): Promise<Talent | null> {
    const result = await this.query<Talent>(
      `SELECT * FROM talents WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find talent by email
   */
  async findByEmail(email: string): Promise<Talent | null> {
    const result = await this.query<Talent>(
      `SELECT * FROM talents WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`,
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Get talent with stats (skill count, KYC status)
   */
  async findByIdWithStats(id: string): Promise<TalentWithStats | null> {
    const result = await this.query<TalentWithStats>(
      `SELECT t.*,
        (SELECT COUNT(*) FROM talent_skills WHERE talent_id = t.id AND is_visible = true) as skill_count,
        (SELECT status FROM kyc_verifications WHERE talent_id = t.id ORDER BY created_at DESC LIMIT 1) as kyc_status,
        CASE
          WHEN EXISTS (SELECT 1 FROM kyc_verifications WHERE talent_id = t.id AND status = 'VERIFIED')
          THEN 'VERIFIED'
          ELSE 'UNVERIFIED'
        END as verification_status
      FROM talents t
      WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new talent
   */
  async create(data: CreateTalentDTO): Promise<Talent> {
    const result = await this.query<Talent>(
      `INSERT INTO talents (user_id, email, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.user_id, data.email, data.first_name || null, data.last_name || null]
    );
    return result.rows[0];
  }

  /**
   * Update a talent profile
   */
  async update(id: string, data: UpdateTalentDTO): Promise<Talent | null> {
    const updates: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    const fieldMappings: Record<keyof UpdateTalentDTO, string> = {
      first_name: 'first_name',
      last_name: 'last_name',
      bio: 'bio',
      avatar_url: 'avatar_url',
      phone: 'phone',
      gender: 'gender',
      city: 'city',
      region: 'region',
      country: 'country',
      remote_ready: 'remote_ready',
      willing_to_relocate: 'willing_to_relocate',
      profile_tags: 'profile_tags',
      goals: 'goals',
      sectors: 'sectors',
    };

    for (const [key, column] of Object.entries(fieldMappings)) {
      const value = data[key as keyof UpdateTalentDTO];
      if (value !== undefined) {
        updates.push(`${column} = $${paramIndex++}`);
        params.push(value as QueryParam);
      }
    }

    if (updates.length === 0) return this.findById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.query<Talent>(
      `UPDATE talents SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * Mark onboarding as completed
   */
  async completeOnboarding(id: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE talents SET onboarding_completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if talent has completed onboarding
   */
  async hasCompletedOnboarding(id: string): Promise<boolean> {
    const result = await this.query<{ onboarding_completed_at: Date | null }>(
      `SELECT onboarding_completed_at FROM talents WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0]?.onboarding_completed_at !== null;
  }

  /**
   * Search talents with filters
   */
  async search(
    filters: TalentFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Talent>> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    if (filters.country) {
      conditions.push(`country = $${paramIndex++}`);
      params.push(filters.country);
    }

    if (filters.city) {
      conditions.push(`city ILIKE $${paramIndex++}`);
      params.push(`%${filters.city}%`);
    }

    if (filters.remote_ready !== undefined) {
      conditions.push(`remote_ready = $${paramIndex++}`);
      params.push(filters.remote_ready);
    }

    if (filters.sectors && filters.sectors.length > 0) {
      conditions.push(`sectors && $${paramIndex++}`);
      params.push(filters.sectors);
    }

    if (filters.search) {
      conditions.push(`(
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        bio ILIKE $${paramIndex}
      )`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const baseQuery = `SELECT * FROM talents WHERE ${whereClause} ORDER BY created_at DESC`;
    const countQuery = `SELECT COUNT(*) as count FROM talents WHERE ${whereClause}`;

    return this.paginate<Talent>(baseQuery, countQuery, params, pagination);
  }

  /**
   * Check if talent has verified identity
   */
  async hasVerifiedIdentity(id: string): Promise<boolean> {
    const result = await this.query<{ id: string }>(
      `SELECT id FROM kyc_verifications WHERE talent_id = $1 AND status = 'VERIFIED' LIMIT 1`,
      [id]
    );
    return result.rows.length > 0;
  }
}

export const talentRepository = new TalentRepository();
