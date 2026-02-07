/**
 * Log Service
 * Centralized logging and error handling for the application
 *
 * Features:
 * - Structured logging with severity levels
 * - Error categorization
 * - Log history for debugging
 * - Environment-aware (dev vs prod)
 * - Easy integration with external services (Sentry, etc.)
 */

import {
  ErrorSeverity,
  ErrorCategory,
  AppError,
  LogEntry,
  ErrorCode,
  ErrorCodes,
} from '../types/errors';

// Configuration
const CONFIG = {
  maxLogHistory: 100,
  enableConsole: __DEV__, // Only log to console in development
  enableStorage: true,
  logLevel: __DEV__ ? ErrorSeverity.DEBUG : ErrorSeverity.WARN,
};

// Log severity priority (lower = more severe)
const SEVERITY_PRIORITY: Record<ErrorSeverity, number> = {
  [ErrorSeverity.CRITICAL]: 0,
  [ErrorSeverity.ERROR]: 1,
  [ErrorSeverity.WARN]: 2,
  [ErrorSeverity.INFO]: 3,
  [ErrorSeverity.DEBUG]: 4,
};

// In-memory log storage
let logHistory: LogEntry[] = [];
let errorListeners: Array<(error: AppError) => void> = [];

/**
 * Generate unique log ID
 */
function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if severity should be logged based on config
 */
function shouldLog(severity: ErrorSeverity): boolean {
  return SEVERITY_PRIORITY[severity] <= SEVERITY_PRIORITY[CONFIG.logLevel];
}

/**
 * Format log message for console
 */
function formatLogMessage(entry: LogEntry): string {
  const timestamp = entry.timestamp.toISOString().split('T')[1].split('.')[0];
  return `[${timestamp}] [${entry.severity.toUpperCase()}] [${entry.source}] ${entry.message}`;
}

/**
 * Get console method based on severity
 */
function getConsoleMethod(severity: ErrorSeverity): 'log' | 'warn' | 'error' | 'debug' | 'info' {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
    case ErrorSeverity.ERROR:
      return 'error';
    case ErrorSeverity.WARN:
      return 'warn';
    case ErrorSeverity.DEBUG:
      return 'debug';
    case ErrorSeverity.INFO:
    default:
      return 'log';
  }
}

/**
 * Add log entry to history
 */
function addToHistory(entry: LogEntry): void {
  logHistory.unshift(entry);
  if (logHistory.length > CONFIG.maxLogHistory) {
    logHistory = logHistory.slice(0, CONFIG.maxLogHistory);
  }
}

/**
 * Notify error listeners
 */
function notifyErrorListeners(error: AppError): void {
  errorListeners.forEach((listener) => {
    try {
      listener(error);
    } catch (e) {
      console.error('[LogService] Error in error listener:', e);
    }
  });
}

/**
 * Create a standardized AppError
 */
function createAppError(
  code: ErrorCode,
  message: string,
  options: {
    userMessage?: string;
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    context?: Record<string, any>;
    originalError?: Error | unknown;
  } = {}
): AppError {
  const {
    userMessage,
    severity = ErrorSeverity.ERROR,
    category = ErrorCategory.UNKNOWN,
    context,
    originalError,
  } = options;

  return {
    code,
    message,
    userMessage: userMessage || getDefaultUserMessage(code),
    severity,
    category,
    context,
    originalError,
    timestamp: new Date(),
    stack: originalError instanceof Error ? originalError.stack : undefined,
  };
}

/**
 * Get default user-friendly message for error code
 */
function getDefaultUserMessage(code: ErrorCode): string {
  const messages: Record<string, string> = {
    [ErrorCodes.NETWORK_ERROR]: 'Problème de connexion. Vérifiez votre connexion internet.',
    [ErrorCodes.TIMEOUT]: 'La requête a pris trop de temps. Réessayez.',
    [ErrorCodes.NO_CONNECTION]: 'Pas de connexion internet.',
    [ErrorCodes.UNAUTHORIZED]: 'Session expirée. Veuillez vous reconnecter.',
    [ErrorCodes.SESSION_EXPIRED]: 'Votre session a expiré. Veuillez vous reconnecter.',
    [ErrorCodes.SERVER_ERROR]: 'Erreur serveur. Réessayez plus tard.',
    [ErrorCodes.NOT_FOUND]: 'Ressource introuvable.',
    [ErrorCodes.VALIDATION_ERROR]: 'Données invalides. Vérifiez vos informations.',
    [ErrorCodes.PERMISSION_DENIED]: 'Permission refusée.',
    [ErrorCodes.UNKNOWN_ERROR]: 'Une erreur inattendue s\'est produite.',
  };
  return messages[code] || messages[ErrorCodes.UNKNOWN_ERROR];
}

/**
 * Main logging class
 */
class LogService {
  /**
   * Log a message with the specified severity
   */
  log(
    severity: ErrorSeverity,
    source: string,
    message: string,
    data?: Record<string, any>
  ): void {
    if (!shouldLog(severity)) return;

    const entry: LogEntry = {
      id: generateLogId(),
      timestamp: new Date(),
      severity,
      category: ErrorCategory.UNKNOWN,
      source,
      message,
      data,
    };

    addToHistory(entry);

    if (CONFIG.enableConsole) {
      const method = getConsoleMethod(severity);
      const formattedMessage = formatLogMessage(entry);

      if (data) {
        console[method](formattedMessage, data);
      } else {
        console[method](formattedMessage);
      }
    }
  }

  /**
   * Log debug message
   */
  debug(source: string, message: string, data?: Record<string, any>): void {
    this.log(ErrorSeverity.DEBUG, source, message, data);
  }

  /**
   * Log info message
   */
  info(source: string, message: string, data?: Record<string, any>): void {
    this.log(ErrorSeverity.INFO, source, message, data);
  }

  /**
   * Log warning message
   */
  warn(source: string, message: string, data?: Record<string, any>): void {
    this.log(ErrorSeverity.WARN, source, message, data);
  }

  /**
   * Log error
   */
  error(
    source: string,
    message: string,
    error?: Error | unknown,
    context?: Record<string, any>
  ): AppError {
    const appError = createAppError(ErrorCodes.UNKNOWN_ERROR, message, {
      severity: ErrorSeverity.ERROR,
      originalError: error,
      context,
    });

    const entry: LogEntry = {
      id: generateLogId(),
      timestamp: new Date(),
      severity: ErrorSeverity.ERROR,
      category: appError.category,
      source,
      message,
      data: context,
      error: appError,
    };

    addToHistory(entry);

    if (CONFIG.enableConsole) {
      console.error(formatLogMessage(entry), {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        context,
      });
    }

    notifyErrorListeners(appError);

    return appError;
  }

  /**
   * Log critical error
   */
  critical(
    source: string,
    message: string,
    error?: Error | unknown,
    context?: Record<string, any>
  ): AppError {
    const appError = createAppError(ErrorCodes.UNKNOWN_ERROR, message, {
      severity: ErrorSeverity.CRITICAL,
      originalError: error,
      context,
    });

    const entry: LogEntry = {
      id: generateLogId(),
      timestamp: new Date(),
      severity: ErrorSeverity.CRITICAL,
      category: appError.category,
      source,
      message,
      data: context,
      error: appError,
    };

    addToHistory(entry);

    if (CONFIG.enableConsole) {
      console.error(`🚨 CRITICAL: ${formatLogMessage(entry)}`, {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        context,
      });
    }

    notifyErrorListeners(appError);

    return appError;
  }

  /**
   * Log API error with proper categorization
   */
  apiError(
    source: string,
    status: number,
    message: string,
    endpoint: string,
    originalError?: unknown
  ): AppError {
    let code: ErrorCode = ErrorCodes.API_ERROR;
    let category = ErrorCategory.API;
    let severity = ErrorSeverity.ERROR;

    // Categorize by status code
    if (status === 401) {
      code = ErrorCodes.UNAUTHORIZED;
      category = ErrorCategory.AUTH;
    } else if (status === 403) {
      code = ErrorCodes.PERMISSION_DENIED;
      category = ErrorCategory.PERMISSION;
    } else if (status === 404) {
      code = ErrorCodes.NOT_FOUND;
      severity = ErrorSeverity.WARN;
    } else if (status === 422 || status === 400) {
      code = ErrorCodes.VALIDATION_ERROR;
      category = ErrorCategory.VALIDATION;
    } else if (status === 429) {
      code = ErrorCodes.RATE_LIMITED;
    } else if (status >= 500) {
      code = ErrorCodes.SERVER_ERROR;
      severity = ErrorSeverity.ERROR;
    } else if (status === 408 || status === 0) {
      code = ErrorCodes.TIMEOUT;
      category = ErrorCategory.NETWORK;
    }

    const appError = createAppError(code, message, {
      severity,
      category,
      context: { endpoint, status },
      originalError,
    });

    this.log(severity, source, `API Error [${status}] ${endpoint}: ${message}`, {
      status,
      endpoint,
      code,
    });

    notifyErrorListeners(appError);

    return appError;
  }

  /**
   * Log network error
   */
  networkError(source: string, message: string, originalError?: unknown): AppError {
    const appError = createAppError(ErrorCodes.NETWORK_ERROR, message, {
      severity: ErrorSeverity.WARN,
      category: ErrorCategory.NETWORK,
      originalError,
    });

    this.log(ErrorSeverity.WARN, source, `Network Error: ${message}`);
    notifyErrorListeners(appError);

    return appError;
  }

  /**
   * Register error listener (for global error handling UI)
   */
  onError(listener: (error: AppError) => void): () => void {
    errorListeners.push(listener);
    return () => {
      errorListeners = errorListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get log history
   */
  getHistory(
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      source?: string;
      limit?: number;
    } = {}
  ): LogEntry[] {
    let filtered = [...logHistory];

    if (options.severity) {
      filtered = filtered.filter((e) => e.severity === options.severity);
    }
    if (options.category) {
      filtered = filtered.filter((e) => e.category === options.category);
    }
    if (options.source) {
      filtered = filtered.filter((e) => e.source.includes(options.source!));
    }
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    logHistory = [];
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(logHistory, null, 2);
  }

  /**
   * Get error summary for debugging
   */
  getErrorSummary(): {
    totalLogs: number;
    errorCount: number;
    warningCount: number;
    recentErrors: LogEntry[];
  } {
    const errors = logHistory.filter(
      (e) => e.severity === ErrorSeverity.ERROR || e.severity === ErrorSeverity.CRITICAL
    );
    const warnings = logHistory.filter((e) => e.severity === ErrorSeverity.WARN);

    return {
      totalLogs: logHistory.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      recentErrors: errors.slice(0, 10),
    };
  }
}

// Export singleton instance
export const logger = new LogService();

// Export helper to create errors
export { createAppError };

// Export types
export type { AppError, LogEntry };
