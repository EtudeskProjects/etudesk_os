/**
 * Centralized error handling utilities
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
 * Create a typed error for database operations
 */
export function createDbError(message: string, originalError?: unknown): AppError {
  if (originalError instanceof Error) {
    logger.error('Database error details:', originalError);
  }
  return new AppError('DATABASE_ERROR', message, 500);
}

/**
 * Create a not found error
 */
export function createNotFoundError(resource: string): AppError {
  return new AppError('NOT_FOUND', `${resource} not found`, 404);
}

/**
 * Create an unauthorized error
 */
export function createUnauthorizedError(message = 'Unauthorized'): AppError {
  return new AppError('UNAUTHORIZED', message, 401);
}

/**
 * Create a forbidden error
 */
export function createForbiddenError(message = 'Access denied'): AppError {
  return new AppError('FORBIDDEN', message, 403);
}

/**
 * Create a validation error
 */
export function createValidationError(message: string): AppError {
  return new AppError('VALIDATION_ERROR', message, 400);
}
