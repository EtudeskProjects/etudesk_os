/**
 * Space Repository
 *
 * Handles all database operations for spaces (coworking, meeting rooms, etc.).
 */

import { BaseRepository, PaginationOptions, PaginatedResult, QueryParam } from './base.repository';

export type SpaceType = 'COWORKING' | 'MEETING_ROOM' | 'EVENT_SPACE' | 'OFFICE' | 'VIRTUAL';
export type SpaceVisibility = 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';

export interface Space {
  id: string;
  slug: string;
  organization_id: string;
  name: string;
  type: SpaceType;
  description: string | null;
  cover_image_url: string | null;
  images: string[] | null;
  visibility: SpaceVisibility;
  capacity: number | null;
  amenities: string[] | null;
  address: string | null;
  city: string | null;
  country: string | null;
  coordinates: [number, number] | null;
  hourly_rate: number | null;
  daily_rate: number | null;
  currency: string | null;
  availability_schedule: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface SpaceWithStats extends Space {
  organization_name?: string;
  organization_logo?: string;
  booking_count?: number;
  average_rating?: number;
}

export interface SpaceBooking {
  id: string;
  space_id: string;
  talent_id: string;
  start_time: Date;
  end_time: Date;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  total_price: number | null;
  currency: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSpaceDTO {
  slug: string;
  organization_id: string;
  name: string;
  type: SpaceType;
  description?: string;
  cover_image_url?: string;
  images?: string[];
  visibility?: SpaceVisibility;
  capacity?: number;
  amenities?: string[];
  address?: string;
  city?: string;
  country?: string;
  coordinates?: [number, number];
  hourly_rate?: number;
  daily_rate?: number;
  currency?: string;
  availability_schedule?: Record<string, unknown>;
}

export interface UpdateSpaceDTO extends Partial<Omit<CreateSpaceDTO, 'slug' | 'organization_id'>> {}

export interface SpaceFilters {
  organizationId?: string;
  type?: SpaceType;
  city?: string;
  country?: string;
  minCapacity?: number;
  maxHourlyRate?: number;
  amenities?: string[];
  search?: string;
}

class SpaceRepository extends BaseRepository<Space> {
  protected tableName = 'spaces';
  protected primaryKey = 'id';

  /**
   * Find space by slug
   */
  async findBySlug(slug: string): Promise<Space | null> {
    const result = await this.query<Space>(
      `SELECT * FROM spaces WHERE slug = $1 AND deleted_at IS NULL`,
      [slug]
    );
    return result.rows[0] || null;
  }

  /**
   * Find space by ID or slug with stats
   */
  async findByIdOrSlugWithStats(idOrSlug: string): Promise<SpaceWithStats | null> {
    const result = await this.query<SpaceWithStats>(
      `SELECT s.*,
        o.name as organization_name,
        o.logo_url as organization_logo,
        (SELECT COUNT(*) FROM space_bookings WHERE space_id = s.id) as booking_count,
        (SELECT AVG(rating)::numeric(3,2) FROM space_reviews WHERE space_id = s.id) as average_rating
      FROM spaces s
      LEFT JOIN organizations o ON o.id = s.organization_id
      WHERE (s.id::text = $1 OR s.slug = $1) AND s.deleted_at IS NULL`,
      [idOrSlug]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new space
   */
  async create(data: CreateSpaceDTO): Promise<Space> {
    const result = await this.query<Space>(
      `INSERT INTO spaces (
        slug, organization_id, name, type, description, cover_image_url, images,
        visibility, capacity, amenities, address, city, country, coordinates,
        hourly_rate, daily_rate, currency, availability_schedule
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        data.slug,
        data.organization_id,
        data.name,
        data.type,
        data.description || null,
        data.cover_image_url || null,
        data.images || null,
        data.visibility || 'PUBLIC',
        data.capacity || null,
        data.amenities || null,
        data.address || null,
        data.city || null,
        data.country || null,
        data.coordinates || null,
        data.hourly_rate || null,
        data.daily_rate || null,
        data.currency || null,
        data.availability_schedule ? JSON.stringify(data.availability_schedule) : null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update a space
   */
  async update(id: string, data: UpdateSpaceDTO): Promise<Space | null> {
    const updates: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    const fields: (keyof UpdateSpaceDTO)[] = [
      'name', 'type', 'description', 'cover_image_url', 'images', 'visibility',
      'capacity', 'amenities', 'address', 'city', 'country', 'coordinates',
      'hourly_rate', 'daily_rate', 'currency', 'availability_schedule'
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        if (field === 'availability_schedule' && data[field]) {
          params.push(JSON.stringify(data[field]));
        } else {
          params.push(data[field] as QueryParam);
        }
      }
    }

    if (updates.length === 0) return this.findById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.query<Space>(
      `UPDATE spaces SET ${updates.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return result.rows[0] || null;
  }

  /**
   * List spaces with filters
   */
  async list(
    filters: SpaceFilters,
    pagination: PaginationOptions,
    talentId?: string,
    userEmail?: string
  ): Promise<PaginatedResult<SpaceWithStats>> {
    const conditions: string[] = ['s.deleted_at IS NULL'];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    // Visibility logic
    let visibilityCondition = `COALESCE(s.visibility, 'PUBLIC') = 'PUBLIC'`;
    if (talentId && userEmail) {
      visibilityCondition = `(
        COALESCE(s.visibility, 'PUBLIC') = 'PUBLIC'
        OR EXISTS (
          SELECT 1 FROM space_invitations si
          WHERE si.space_id = s.id
          AND (si.invitee_talent_id = $${paramIndex} OR LOWER(si.invitee_email) = LOWER($${paramIndex + 1}))
        )
        OR EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = s.organization_id AND om.talent_id = $${paramIndex}
        )
      )`;
      params.push(talentId, userEmail);
      paramIndex += 2;
    }
    conditions.push(visibilityCondition);

    if (filters.organizationId) {
      conditions.push(`s.organization_id = $${paramIndex++}`);
      params.push(filters.organizationId);
    }

    if (filters.type) {
      conditions.push(`s.type = $${paramIndex++}`);
      params.push(filters.type);
    }

    if (filters.city) {
      conditions.push(`s.city ILIKE $${paramIndex++}`);
      params.push(`%${filters.city}%`);
    }

    if (filters.country) {
      conditions.push(`s.country = $${paramIndex++}`);
      params.push(filters.country);
    }

    if (filters.minCapacity) {
      conditions.push(`s.capacity >= $${paramIndex++}`);
      params.push(filters.minCapacity);
    }

    if (filters.maxHourlyRate) {
      conditions.push(`s.hourly_rate <= $${paramIndex++}`);
      params.push(filters.maxHourlyRate);
    }

    if (filters.amenities && filters.amenities.length > 0) {
      conditions.push(`s.amenities @> $${paramIndex++}`);
      params.push(filters.amenities);
    }

    if (filters.search) {
      conditions.push(`(s.name ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const baseQuery = `
      SELECT s.*,
        o.name as organization_name,
        o.logo_url as organization_logo,
        (SELECT COUNT(*) FROM space_bookings WHERE space_id = s.id) as booking_count
      FROM spaces s
      LEFT JOIN organizations o ON o.id = s.organization_id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
    `;
    const countQuery = `SELECT COUNT(*) as count FROM spaces s WHERE ${whereClause}`;

    return this.paginate<SpaceWithStats>(baseQuery, countQuery, params, pagination);
  }

  /**
   * Get spaces by organization
   */
  async findByOrganization(organizationId: string): Promise<Space[]> {
    const result = await this.query<Space>(
      `SELECT * FROM spaces WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [organizationId]
    );
    return result.rows;
  }

  /**
   * Create a booking
   */
  async createBooking(
    spaceId: string,
    talentId: string,
    startTime: Date,
    endTime: Date,
    totalPrice?: number,
    currency?: string,
    notes?: string
  ): Promise<SpaceBooking> {
    const result = await this.query<SpaceBooking>(
      `INSERT INTO space_bookings (space_id, talent_id, start_time, end_time, total_price, currency, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [spaceId, talentId, startTime, endTime, totalPrice || null, currency || null, notes || null]
    );
    return result.rows[0];
  }

  /**
   * Get bookings for a space
   */
  async getBookings(spaceId: string, startDate?: Date, endDate?: Date): Promise<SpaceBooking[]> {
    const conditions: string[] = ['space_id = $1'];
    const params: QueryParam[] = [spaceId];
    let paramIndex = 2;

    if (startDate) {
      conditions.push(`start_time >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`end_time <= $${paramIndex++}`);
      params.push(endDate);
    }

    const result = await this.query<SpaceBooking>(
      `SELECT * FROM space_bookings WHERE ${conditions.join(' AND ')} ORDER BY start_time ASC`,
      params
    );
    return result.rows;
  }

  /**
   * Check if talent can manage space
   */
  async canManage(spaceId: string, talentId: string): Promise<boolean> {
    const result = await this.query<{ role: string }>(
      `SELECT om.role FROM spaces s
       JOIN organization_members om ON om.organization_id = s.organization_id
       WHERE s.id = $1 AND om.talent_id = $2 AND om.role IN ('OWNER', 'ADMIN')`,
      [spaceId, talentId]
    );
    return result.rows.length > 0;
  }

  /**
   * Check space availability
   */
  async isAvailable(spaceId: string, startTime: Date, endTime: Date): Promise<boolean> {
    const result = await this.query<{ id: string }>(
      `SELECT id FROM space_bookings
       WHERE space_id = $1
       AND status NOT IN ('CANCELLED')
       AND (
         (start_time, end_time) OVERLAPS ($2::timestamp, $3::timestamp)
       )
       LIMIT 1`,
      [spaceId, startTime, endTime]
    );
    return result.rows.length === 0;
  }
}

export const spaceRepository = new SpaceRepository();
