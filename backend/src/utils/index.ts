/**
 * Backend Utilities
 */

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

/**
 * Simple structured logger
 * Replaces console.log/error with consistent format
 */
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
    }
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }));
    }
  },
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      const errorInfo = error instanceof Error
        ? { errorMessage: error.message, stack: error.stack }
        : { errorMessage: String(error) };
      console.error(JSON.stringify({ level: 'error', message, ...errorInfo, ...meta, timestamp: new Date().toISOString() }));
    }
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify({ level: 'debug', message, ...meta, timestamp: new Date().toISOString() }));
    }
  },
};
