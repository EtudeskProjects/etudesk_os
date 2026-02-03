/**
 * Bookmark Repository
 *
 * Handles all database operations for bookmarks.
 */

import { BaseRepository, PaginationOptions, PaginatedResult, QueryParam } from './base.repository';

export type BookmarkTargetType = 'opportunity' | 'community' | 'space' | 'talent' | 'organization';

export interface Bookmark {
  id: string;
  talent_id: string;
  target_type: BookmarkTargetType;
  target_id: string;
  created_at: Date;
}

export interface BookmarkWithTarget extends Bookmark {
  target: Record<string, unknown>;
}

export interface CreateBookmarkDTO {
  talent_id: string;
  target_type: BookmarkTargetType;
  target_id: string;
}

class BookmarkRepository extends BaseRepository<Bookmark> {
  protected tableName = 'bookmarks';
  protected primaryKey = 'id';

  /**
   * Create a bookmark
   */
  async create(data: CreateBookmarkDTO): Promise<Bookmark> {
    const result = await this.query<Bookmark>(
      `INSERT INTO bookmarks (talent_id, target_type, target_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (talent_id, target_type, target_id) DO NOTHING
       RETURNING *`,
      [data.talent_id, data.target_type, data.target_id]
    );
    return result.rows[0];
  }

  /**
   * Remove a bookmark
   */
  async remove(talentId: string, targetType: BookmarkTargetType, targetId: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM bookmarks WHERE talent_id = $1 AND target_type = $2 AND target_id = $3`,
      [talentId, targetType, targetId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if bookmark exists for a talent
   */
  async bookmarkExists(talentId: string, targetType: BookmarkTargetType, targetId: string): Promise<boolean> {
    const result = await this.query<{ id: string }>(
      `SELECT id FROM bookmarks WHERE talent_id = $1 AND target_type = $2 AND target_id = $3`,
      [talentId, targetType, targetId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get bookmarks for a talent
   */
  async findByTalentId(
    talentId: string,
    targetType?: BookmarkTargetType,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<Bookmark>> {
    const conditions: string[] = ['talent_id = $1'];
    const params: QueryParam[] = [talentId];
    let paramIndex = 2;

    if (targetType) {
      conditions.push(`target_type = $${paramIndex++}`);
      params.push(targetType);
    }

    const whereClause = conditions.join(' AND ');
    const baseQuery = `SELECT * FROM bookmarks WHERE ${whereClause} ORDER BY created_at DESC`;
    const countQuery = `SELECT COUNT(*) as count FROM bookmarks WHERE ${whereClause}`;

    return this.paginate<Bookmark>(baseQuery, countQuery, params, pagination || { limit: 50, offset: 0 });
  }

  /**
   * Get bookmarks with target details
   */
  async findByTalentIdWithTargets(
    talentId: string,
    targetType: BookmarkTargetType,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<BookmarkWithTarget>> {
    const tableName = this.getTargetTableName(targetType);
    if (!tableName) {
      return { data: [], total: 0, limit: pagination.limit || 20, offset: pagination.offset || 0, hasMore: false };
    }

    const baseQuery = `
      SELECT b.*, row_to_json(t.*) as target
      FROM bookmarks b
      JOIN ${tableName} t ON t.id = b.target_id::uuid
      WHERE b.talent_id = $1 AND b.target_type = $2
      ORDER BY b.created_at DESC
    `;
    const countQuery = `
      SELECT COUNT(*) as count FROM bookmarks b
      JOIN ${tableName} t ON t.id = b.target_id::uuid
      WHERE b.talent_id = $1 AND b.target_type = $2
    `;

    return this.paginate<BookmarkWithTarget>(baseQuery, countQuery, [talentId, targetType], pagination);
  }

  /**
   * Toggle bookmark (create if not exists, delete if exists)
   */
  async toggle(talentId: string, targetType: BookmarkTargetType, targetId: string): Promise<{ bookmarked: boolean }> {
    const exists = await this.bookmarkExists(talentId, targetType, targetId);
    if (exists) {
      await this.remove(talentId, targetType, targetId);
      return { bookmarked: false };
    } else {
      await this.create({ talent_id: talentId, target_type: targetType, target_id: targetId });
      return { bookmarked: true };
    }
  }

  /**
   * Get target table name for a bookmark type
   */
  private getTargetTableName(targetType: BookmarkTargetType): string | null {
    const mapping: Record<BookmarkTargetType, string> = {
      opportunity: 'opportunities',
      community: 'communities',
      space: 'spaces',
      talent: 'talents',
      organization: 'organizations',
    };
    return mapping[targetType] || null;
  }

  /**
   * Count bookmarks for a target
   */
  async countForTarget(targetType: BookmarkTargetType, targetId: string): Promise<number> {
    const result = await this.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM bookmarks WHERE target_type = $1 AND target_id = $2`,
      [targetType, targetId]
    );
    return parseInt(result.rows[0].count, 10);
  }
}

export const bookmarkRepository = new BookmarkRepository();
