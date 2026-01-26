/**
 * Error Types
 * Standardized error types for the application
 */

export enum ErrorSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  NETWORK = 'network',
  AUTH = 'auth',
  VALIDATION = 'validation',
  API = 'api',
  STORAGE = 'storage',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown',
}

export interface AppError {
  code: string;
  message: string;
  userMessage?: string; // User-friendly message
  severity: ErrorSeverity;
  category: ErrorCategory;
  context?: Record<string, any>;
  originalError?: Error | unknown;
  timestamp: Date;
  stack?: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  severity: ErrorSeverity;
  category: ErrorCategory;
  source: string;
  message: string;
  data?: Record<string, any>;
  error?: AppError;
}

// Common error codes
export const ErrorCodes = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  NO_CONNECTION: 'NO_CONNECTION',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  LOGIN_FAILED: 'LOGIN_FAILED',

  // API errors
  API_ERROR: 'API_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Storage errors
  STORAGE_READ_ERROR: 'STORAGE_READ_ERROR',
  STORAGE_WRITE_ERROR: 'STORAGE_WRITE_ERROR',

  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  LOCATION_DENIED: 'LOCATION_DENIED',
  CAMERA_DENIED: 'CAMERA_DENIED',

  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
