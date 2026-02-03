/**
 * Custom Error Classes for Etudesk API
 *
 * Provides a consistent error handling pattern across the application
 */

export interface ErrorDetails {
  field?: string;
  code?: string;
  [key: string]: unknown;
}

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetails;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: ErrorDetails
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * 400 Bad Request - Invalid input data
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

/**
 * 401 Unauthorized - Missing or invalid authentication
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', details?: ErrorDetails) {
    super('AUTHENTICATION_ERROR', message, 401, details);
  }
}

/**
 * 403 Forbidden - Authenticated but not authorized
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden', details?: ErrorDetails) {
    super('FORBIDDEN', message, 403, details);
  }
}

/**
 * 404 Not Found - Resource does not exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: ErrorDetails) {
    super('NOT_FOUND', `${resource} not found`, 404, details);
  }
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super('CONFLICT', message, 409, details);
  }
}

/**
 * 422 Unprocessable Entity - Business logic error
 */
export class BusinessError extends AppError {
  constructor(code: string, message: string, details?: ErrorDetails) {
    super(code, message, 422, details);
  }
}

/**
 * 429 Too Many Requests - Rate limited
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super('RATE_LIMITED', message, 429, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error', details?: ErrorDetails) {
    super('INTERNAL_ERROR', message, 500, details);
  }
}

/**
 * 503 Service Unavailable - External service unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: ErrorDetails) {
    super('SERVICE_UNAVAILABLE', `${service} is currently unavailable`, 503, details);
  }
}

/**
 * Database-specific error
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: ErrorDetails) {
    super('DATABASE_ERROR', message, 500, details);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message);
  }

  return new InternalError(String(error));
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
