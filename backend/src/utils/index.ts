/**
 * Backend Utilities
 */

// Re-export helpers
export * from './pagination.helper';
export * from './error-handler';
export * from './query-builder';

/**
 * Safely parse JSON string, returns fallback on error
 */
export function safeParseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') {
    return (value as T) ?? fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════
// STRUCTURED LOGGER
// ═══════════════════════════════════════════════════════════════

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

// Patterns to mask in logs (tokens, passwords, keys)
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/gi, // JWT tokens
  /sk-[A-Za-z0-9\-_]+/gi, // OpenAI/Anthropic keys
  /pk_[a-z]+_[A-Za-z0-9]+/gi, // Paystack public keys
  /sk_[a-z]+_[A-Za-z0-9]+/gi, // Paystack secret keys
  /password["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, // password fields
  /token["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, // token fields
  /secret["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, // secret fields
  /api[_-]?key["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, // API key fields
];

/**
 * Mask sensitive data in a string or object
 */
function maskSensitive(data: unknown): unknown {
  if (typeof data === 'string') {
    let masked = data;
    for (const pattern of SENSITIVE_PATTERNS) {
      masked = masked.replace(pattern, '[REDACTED]');
    }
    return masked;
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitive);
  }

  if (data && typeof data === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Mask sensitive field names
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('authorization')
      ) {
        masked[key] = '[REDACTED]';
      } else {
        masked[key] = maskSensitive(value);
      }
    }
    return masked;
  }

  return data;
}

/**
 * Format log entry
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): string {
  const entry: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  };

  if (context) {
    entry.context = maskSensitive(context);
  }

  if (error) {
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      };
    } else {
      entry.error = { message: String(error) };
    }
  }

  return JSON.stringify(entry);
}

/**
 * Determine if log should be output based on level
 */
function shouldLog(level: LogLevel): boolean {
  if (process.env.NODE_ENV === 'test') return false;

  const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(logLevel as LogLevel);
  const messageLevelIndex = levels.indexOf(level);

  return messageLevelIndex >= currentLevelIndex;
}

/**
 * Structured logger with sensitive data masking
 *
 * Usage:
 * ```typescript
 * import { logger } from '../utils';
 *
 * logger.info('User logged in', { userId: '123', email: 'user@example.com' });
 * logger.error('Database error', dbError, { query: 'SELECT...' });
 * logger.warn('Deprecated API called', { endpoint: '/api/v1/old' });
 * logger.debug('Cache miss', { key: 'user:123' });
 * ```
 */
export const logger = {
  /**
   * Debug level - only in development
   */
  debug: (message: string, context?: LogContext) => {
    if (shouldLog('debug')) {
      console.debug(formatLogEntry('debug', message, context));
    }
  },

  /**
   * Info level - general information
   */
  info: (message: string, context?: LogContext) => {
    if (shouldLog('info')) {
      console.log(formatLogEntry('info', message, context));
    }
  },

  /**
   * Warn level - potential issues
   */
  warn: (message: string, context?: LogContext) => {
    if (shouldLog('warn')) {
      console.warn(formatLogEntry('warn', message, context));
    }
  },

  /**
   * Error level - errors and exceptions
   */
  error: (message: string, error?: unknown, context?: LogContext) => {
    if (shouldLog('error')) {
      console.error(formatLogEntry('error', message, context, error));
    }
  },

  /**
   * Create a child logger with default context
   */
  child: (defaultContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      logger.warn(message, { ...defaultContext, ...context }),
    error: (message: string, error?: unknown, context?: LogContext) =>
      logger.error(message, error, { ...defaultContext, ...context }),
  }),

  /**
   * Log HTTP request (for middleware)
   */
  http: (method: string, path: string, statusCode: number, durationMs: number, context?: LogContext) => {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    if (shouldLog(level)) {
      const entry = formatLogEntry(level, `${method} ${path}`, {
        ...context,
        statusCode,
        durationMs,
        type: 'http',
      });
      if (level === 'error') {
        console.error(entry);
      } else if (level === 'warn') {
        console.warn(entry);
      } else {
        console.log(entry);
      }
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 10000 } = options;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, { delay, error: lastError.message });
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
