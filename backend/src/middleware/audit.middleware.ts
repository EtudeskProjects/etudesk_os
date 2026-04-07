/**
 * Audit Logging Middleware
 *
 * Logs sensitive actions (login, logout, permission changes, data exports)
 * with userId, action, timestamp, IP, and request ID.
 */

import { Request, Response, NextFunction } from 'express';
import { getClientIp, logger } from '../utils';

interface AuditContext {
  userId?: string;
  action: string;
  ip: string;
  requestId: string;
  method: string;
  path: string;
  userAgent?: string;
}

/**
 * Middleware factory: logs audit events for matched routes.
 *
 * Usage:
 *   router.post('/login', auditLog('AUTH_LOGIN'), handler)
 *   router.delete('/:id', auditLog('ORG_DELETE'), handler)
 */
export function auditLog(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Capture response on finish
    res.on('finish', () => {
      const context: AuditContext = {
        userId: (req as any).userId || (req as any).talentId,
        action,
        ip: getClientIp(req) || 'unknown',
        requestId: (req.headers['x-request-id'] as string) || 'none',
        method: req.method,
        path: req.originalUrl,
        userAgent: req.headers['user-agent'],
      };

      const level = res.statusCode >= 400 ? 'warn' : 'info';
      const auditLogger = logger.child({ module: 'audit' });

      if (level === 'warn') {
        auditLogger.warn(`[AUDIT] ${action}`, {
          ...context,
          statusCode: res.statusCode,
          durationMs: Date.now() - startTime,
        });
      } else {
        auditLogger.info(`[AUDIT] ${action}`, {
          ...context,
          statusCode: res.statusCode,
          durationMs: Date.now() - startTime,
        });
      }
    });

    next();
  };
}
