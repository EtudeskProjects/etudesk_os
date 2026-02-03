/**
 * API Versioning Middleware
 *
 * Provides versioning support for the API with backward compatibility.
 *
 * Usage in index.ts:
 * ```typescript
 * import { createVersionedRouter, API_VERSIONS } from './middleware/api-version.middleware';
 *
 * // Create versioned router
 * const v1Router = createVersionedRouter('v1');
 * v1Router.use('/auth', authRouter);
 * v1Router.use('/talents', talentsRouter);
 *
 * // Mount versioned and unversioned (for backward compatibility)
 * app.use('/api/v1', v1Router);
 * app.use('/api', v1Router); // Backward compatible - defaults to v1
 * ```
 */

import { Router, Request, Response, NextFunction } from 'express';

// Supported API versions
export const API_VERSIONS = {
  V1: 'v1',
  // V2: 'v2', // Future version
} as const;

export type ApiVersion = typeof API_VERSIONS[keyof typeof API_VERSIONS];

// Current/default version
export const CURRENT_API_VERSION = API_VERSIONS.V1;

// Extended request with version info
export interface VersionedRequest extends Request {
  apiVersion?: ApiVersion;
}

/**
 * Middleware to set API version on request
 */
export function apiVersionMiddleware(version: ApiVersion) {
  return (req: VersionedRequest, _res: Response, next: NextFunction) => {
    req.apiVersion = version;
    next();
  };
}

/**
 * Create a versioned router with version header in responses
 */
export function createVersionedRouter(version: ApiVersion): Router {
  const router = Router();

  // Add version to all responses
  router.use((req: VersionedRequest, res: Response, next: NextFunction) => {
    req.apiVersion = version;
    res.setHeader('X-API-Version', version);
    next();
  });

  return router;
}

/**
 * Middleware to add standard pagination to response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Format a paginated response with standard structure
 */
export function formatPaginatedResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    },
  };
}

/**
 * Standard API response format
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    version: string;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Format a successful API response
 */
export function formatSuccessResponse<T>(
  data: T,
  version: ApiVersion = CURRENT_API_VERSION,
  requestId?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      version,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

/**
 * Format an error API response
 */
export function formatErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  version: ApiVersion = CURRENT_API_VERSION,
  requestId?: string
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      version,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

/**
 * Deprecation warning header
 */
export function addDeprecationWarning(
  res: Response,
  message: string,
  sunsetDate?: Date
) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('X-Deprecation-Notice', message);
  if (sunsetDate) {
    res.setHeader('Sunset', sunsetDate.toUTCString());
  }
}
