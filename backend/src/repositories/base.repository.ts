/**
 * Base Repository
 *
 * Abstract base class for all repositories providing common database operations.
 * Implements the Repository pattern to abstract data access from business logic.
 */

import { Pool, PoolClient } from 'pg';
import { pool } from '../services/database';

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export type QueryParam = string | number | boolean | null | Date | string[] | number[];

// Custom result type to avoid pg's QueryResultRow constraint
export interface DbQueryResult<R> {
  rows: R[];
  rowCount: number | null;
}

/**
 * Base repository class with common database operations
 */
export abstract class BaseRepository<T> {
  protected pool: Pool = pool;
  protected abstract tableName: string;
  protected abstract primaryKey: string;

  /**
   * Execute a query with parameters
   */
  protected async query<R>(
    sql: string,
    params?: QueryParam[]
  ): Promise<DbQueryResult<R>> {
    const result = await this.pool.query(sql, params);
    return { rows: result.rows as R[], rowCount: result.rowCount };
  }

  /**
   * Execute a query within a transaction
   */
  protected async withTransaction<R>(
    callback: (client: PoolClient) => Promise<R>
  ): Promise<R> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string): Promise<T | null> {
    const result = await this.query<T>(
      `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1 AND deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Check if a record exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const result = await this.query(
      `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = $1 AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Soft delete a record by ID
   */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE ${this.tableName} SET deleted_at = NOW() WHERE ${this.primaryKey} = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Hard delete a record by ID (use with caution)
   */
  async hardDelete(id: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Count records matching a condition
   */
  protected async count(whereClause: string, params?: QueryParam[]): Promise<number> {
    const result = await this.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${whereClause}`,
      params
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Build a paginated query result
   */
  protected async paginate<R = T>(
    baseQuery: string,
    countQuery: string,
    params: QueryParam[],
    pagination: PaginationOptions
  ): Promise<PaginatedResult<R>> {
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = pagination.offset || 0;

    // Execute both queries in parallel
    const [dataResult, countResult] = await Promise.all([
      this.query<R>(`${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
        ...params,
        limit,
        offset,
      ]),
      this.query<{ count: string }>(countQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      data: dataResult.rows,
      total,
      limit,
      offset,
      hasMore: offset + dataResult.rows.length < total,
    };
  }

  /**
   * Build dynamic WHERE clause from filters
   */
  protected buildWhereClause(
    filters: Record<string, unknown>,
    startIndex: number = 1
  ): { clause: string; params: QueryParam[]; nextIndex: number } {
    const conditions: string[] = [];
    const params: QueryParam[] = [];
    let paramIndex = startIndex;

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;

      if (value === null) {
        conditions.push(`${key} IS NULL`);
      } else if (Array.isArray(value)) {
        conditions.push(`${key} = ANY($${paramIndex})`);
        params.push(value);
        paramIndex++;
      } else {
        conditions.push(`${key} = $${paramIndex}`);
        params.push(value as QueryParam);
        paramIndex++;
      }
    }

    return {
      clause: conditions.length > 0 ? conditions.join(' AND ') : '1=1',
      params,
      nextIndex: paramIndex,
    };
  }
}
