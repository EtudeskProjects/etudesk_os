/**
 * Centralized error handling & response utilities
 */

import { Response } from 'express';
import { logger } from './index';
import { AppError, isAppError } from '../errors';

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Standard API success response
 */
export function apiResponse(
  res: Response,
  options: {
    data?: unknown;
    meta?: Record<string, unknown>;
    status?: number;
    message?: string;
  }
): void {
  const { data, meta, status = 200, message } = options;
  const body: Record<string, unknown> = { success: true };
  if (data !== undefined) body.data = data;
  if (meta) body.meta = meta;
  if (message) body.message = message;
  res.status(status).json(body);
}

/**
 * Standard API error response
 */
export function apiError(
  res: Response,
  status: number,
  error: string,
  code?: string,
  details?: unknown
): void {
  const body: ErrorResponse = { error };
  if (code) body.code = code;
  if (details) body.details = details;
  res.status(status).json({ success: false, ...body });
}

/**
 * Handle route errors consistently
 */
export function handleRouteError(
  res: Response,
  error: unknown,
  context: string,
  statusCode = 500
): void {
  // Log the error
  logger.error(`${context}:`, error);

  // If it's an AppError, use its properties
  if (isAppError(error)) {
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  // Handle standard Error
  if (error instanceof Error) {
    res.status(statusCode).json({
      error: error.message,
      code: 'INTERNAL_ERROR',
    } as ErrorResponse);
    return;
  }

  // Handle unknown error types
  res.status(statusCode).json({
    error: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
  } as ErrorResponse);
}

/**
 * Create a not found error
 */
export function createNotFoundError(resource: string): AppError {
  return new AppError('NOT_FOUND', `${resource} not found`, 404);
}

/**
 * Create a forbidden error
 */
export function createForbiddenError(message = 'Access denied'): AppError {
  return new AppError('FORBIDDEN', message, 403);
}
