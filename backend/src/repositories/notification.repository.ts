/**
 * Notification Repository
 *
 * Handles all database operations for notifications.
 */

import { BaseRepository, PaginationOptions, PaginatedResult, QueryParam } from './base.repository';

export type NotificationType =
  | 'OPPORTUNITY'
  | 'APPLICATION'
  | 'COMMUNITY'
  | 'MESSAGE'
  | 'SYSTEM'
  | 'SPACE'
  | 'REMINDER'
  | 'MEMBERSHIP'
  | 'BOOKING';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: Date | null;
  created_at: Date;
}

export interface CreateNotificationDTO {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationFilters {
  type?: NotificationType;
  read?: boolean;
}

class NotificationRepository extends BaseRepository<Notification> {
  protected tableName = 'notifications';
  protected primaryKey = 'id';

  /**
   * Create a new notification
   */
  async create(data: CreateNotificationDTO): Promise<Notification> {
    const result = await this.query<Notification>(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.user_id, data.type, data.title, data.body, data.data ? JSON.stringify(data.data) : null]
    );
    return result.rows[0];
  }

  /**
   * Create multiple notifications (bulk insert)
   */
  async createMany(notifications: CreateNotificationDTO[]): Promise<number> {
    if (notifications.length === 0) return 0;

    const values: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = 1;

    for (const n of notifications) {
      values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      params.push(n.user_id, n.type, n.title, n.body, n.data ? JSON.stringify(n.data) : null);
    }

    const result = await this.query(
      `INSERT INTO notifications (user_id, type, title, body, data) VALUES ${values.join(', ')}`,
      params
    );
    return result.rowCount ?? 0;
  }

  /**
   * Get notifications for a user
   */
  async findByUserId(
    userId: string,
    filters: NotificationFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResult<Notification>> {
    const conditions: string[] = ['user_id = $1'];
    const params: QueryParam[] = [userId];
    let paramIndex = 2;

    if (filters.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(filters.type);
    }

    if (filters.read !== undefined) {
      if (filters.read) {
        conditions.push(`read_at IS NOT NULL`);
      } else {
        conditions.push(`read_at IS NULL`);
      }
    }

    const whereClause = conditions.join(' AND ');
    const baseQuery = `SELECT * FROM notifications WHERE ${whereClause} ORDER BY created_at DESC`;
    const countQuery = `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`;

    return this.paginate<Notification>(baseQuery, countQuery, params, pagination);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND read_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.query(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Delete notifications older than a given number of days
   */
  async deleteOlderThan(days: number): Promise<number> {
    const result = await this.query(
      `DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
      [days]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllForUser(userId: string): Promise<number> {
    const result = await this.query(
      `DELETE FROM notifications WHERE user_id = $1`,
      [userId]
    );
    return result.rowCount ?? 0;
  }
}

export const notificationRepository = new NotificationRepository();
