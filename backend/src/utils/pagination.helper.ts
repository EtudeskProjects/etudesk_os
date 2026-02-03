/**
 * Pagination utilities for consistent pagination across routes
 */

import { Request } from 'express';

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Extract pagination parameters from request query
 */
export function getPaginationParams(req: Request, defaultLimit = DEFAULT_LIMIT): PaginationParams {
  const limit = Math.min(
    Math.max(1, parseInt(req.query.limit as string) || defaultLimit),
    MAX_LIMIT
  );
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

  return { limit, offset };
}

/**
 * Build pagination SQL clause
 */
export function getPaginationSQL(params: PaginationParams, paramIndex: number): {
  sql: string;
  values: number[];
  nextParamIndex: number;
} {
  return {
    sql: `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    values: [params.limit, params.offset],
    nextParamIndex: paramIndex + 2,
  };
}

/**
 * Create paginated response object
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      total,
      limit: params.limit,
      offset: params.offset,
      hasMore: params.offset + data.length < total,
    },
  };
}
