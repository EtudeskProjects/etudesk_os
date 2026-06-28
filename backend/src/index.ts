import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
import './services/ai/provider'; // AI provider init — MUST be before route imports
import opportunitiesRouter from './routes/opportunities';
import applicationsRouter from './routes/applications';
import communitiesRouter from './routes/communities';
import spacesRouter from './routes/spaces';
import authRouter from './routes/auth';
import onboardingRouter from './routes/onboarding';
import talentsRouter from './routes/talents';
import organizationsRouter from './routes/organizations';
import organizationMembersRouter from './routes/organization-members';
import kycRouter from './routes/kyc';
import bookmarksRouter from './routes/bookmarks';
import notificationsRouter from './routes/notifications';
import imagesRouter from './routes/images';
import filesRouter from './routes/files';
import paymentMethodsRouter from './routes/payment-methods';
import billingRouter from './routes/billing';
import communityActivitiesRouter from './routes/community-activities.routes';

import communityInvitationsRouter from './routes/community-invitations.routes';
import opportunityInvitationsRouter from './routes/opportunity-invitations.routes';
import spaceInvitationsRouter from './routes/space-invitations.routes';
import calendarRouter from './routes/calendar.routes';
import copilotRouter from './routes/copilot';
import documentsRouter from './routes/documents';
import orgDocumentsRouter from './routes/org-documents';
import orgTalentsRouter from './routes/org-talents';
import skillsRouter from './routes/skills';
import dailyObjectiveRouter from './routes/daily-objective';
import waitlistRouter from './routes/waitlist';
import whatsappRouter from './routes/whatsapp';
import communityNotificationsRouter from './routes/community-notifications.routes';
import ecosystemRouter from './routes/ecosystem.routes';
import entitiesRouter from './routes/entities';
import bootstrapRouter from './routes/bootstrap';
import shortLinksRouter from './routes/short-links';
import linkRedirectRouter from './routes/link-redirect';
import backofficeRouter from './routes/backoffice';
import { verifyEmailConnection } from './services/email.service';
import { cleanupExpiredOTPs } from './services/otp.service';
import { apiLimiter, authLimiter, otpLimiter, writeLimiter } from './middleware/rateLimit.middleware';

import * as notificationService from './services/notification.service';
import { communityActivityService } from './services/community-activity.service';
import { processDueAgendaTriggers } from './services/agenda-trigger.service';
import { AppError, isAppError, RateLimitError } from './errors';
import { createVersionedRouter, CURRENT_API_VERSION } from './middleware/api-version.middleware';
import { logger } from './utils';
import { i18nMiddleware } from './i18n';
import { pool } from './services/database';
import { cache } from './utils/cache';
import { v4 as uuidv4 } from 'uuid';
import { precomputeSkillEmbeddings } from './services/copilot/skills/skill.loader';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const getCorsOrigin = (): string | string[] => {
  const corsOrigin = process.env.CORS_ORIGIN;

  // In production, CORS_ORIGIN must be set and cannot be wildcard
  if (process.env.NODE_ENV === 'production') {
    if (!corsOrigin) {
      logger.error('CORS_ORIGIN must be set in production');
      throw new Error('CORS_ORIGIN must be set in production');
    }
    if (corsOrigin === '*') {
      logger.error('CORS_ORIGIN cannot be wildcard (*) in production');
      throw new Error('CORS_ORIGIN cannot be wildcard (*) in production. Specify exact origins.');
    }
  }

  if (!corsOrigin) {
    // Development: allow localhost origins
    return ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];
  }

  // Reject wildcard even in development (bad practice)
  if (corsOrigin === '*') {
    logger.warn('CORS_ORIGIN=* is insecure. Using localhost defaults instead.');
    return ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];
  }

  // Allow multiple origins separated by comma
  if (corsOrigin.includes(',')) {
    return corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  }

  return [corsOrigin];
};

// Trust first proxy (Nginx) — required for express-rate-limit to read real client IP
app.set('trust proxy', 1);

// Request ID tracking — generates X-Request-Id for every request
app.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.paystack.co", "https://api.openai.com", "https://api.anthropic.com", "https://generativelanguage.googleapis.com"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: getCorsOrigin(),
  credentials: true,
}));
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    const originalUrl = (req as any).originalUrl as string | undefined;
    if (originalUrl?.includes('/billing/webhooks/paystack')) {
      (req as any).rawBody = buf.toString('utf8');
    }
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(i18nMiddleware);

// Serve uploaded files — split into public and private directories
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');

// Public directories: avatars, logos, illustrations, seed assets (no auth required).
// `seed` holds shared sample covers (opportunities/communities/orgs) shown in cards,
// which <img>/SVG fetches load WITHOUT a Bearer token — keeping it private caused 401s.
// Private content (talent documents) lives elsewhere and stays behind the auth catch-all.
const PUBLIC_UPLOAD_DIRS = ['avatars', 'logos', 'illustrations', 'seed'];
for (const dir of PUBLIC_UPLOAD_DIRS) {
  app.use(`/uploads/${dir}`, express.static(path.join(uploadDir, dir)));
}

// Private directories: everything else requires authentication
const { authMiddleware: uploadsAuthMiddleware } = require('./middleware/auth.middleware');
app.use('/uploads', uploadsAuthMiddleware, express.static(uploadDir));

// Health check (no rate limit) — enriched monitoring
app.get('/health', async (req, res) => {
  const mem = process.memoryUsage();
  const uptime = process.uptime();

  // Optional: check DB connectivity
  let dbOk = true;
  try {
    await pool.query('SELECT 1');
  } catch {
    dbOk = false;
  }

  res.json({
    status: dbOk ? 'ok' : 'degraded',
    name: 'Etudesk API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    },
    db: {
      status: dbOk ? 'ok' : 'error',
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
    },
    cache: {
      entries: cache.size,
    },
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    },
    pid: process.pid,
  });
});

// --- API v1 Router (Versioned) ---
const v1Router = createVersionedRouter('v1');

// Apply rate limiter to v1 routes
v1Router.use(apiLimiter);

// Auth Routes with stricter rate limiting
v1Router.use('/auth/request-otp', otpLimiter);
v1Router.use('/auth/verify-otp', authLimiter);
v1Router.use('/auth/request-whatsapp-otp', otpLimiter);
v1Router.use('/auth/verify-whatsapp-otp', authLimiter);
v1Router.use('/auth/refresh', authLimiter);
v1Router.use('/auth/google', authLimiter);
v1Router.use('/auth/delete-account', authLimiter);
v1Router.use('/auth', authRouter);
v1Router.use('/onboarding', onboardingRouter);

// Domain Routes (writeLimiter on mutation-heavy routes)
v1Router.use('/talents', talentsRouter);
v1Router.use('/organizations', organizationsRouter);
v1Router.use('/organizations', organizationMembersRouter);
v1Router.use('/kyc', kycRouter);
v1Router.use('/opportunities', opportunitiesRouter);
v1Router.use('/applications', applicationsRouter);
v1Router.use('/communities', communitiesRouter);
v1Router.use('/communities', communityActivitiesRouter);
v1Router.use('/community-invitations', communityInvitationsRouter);
v1Router.use('/opportunity-invitations', opportunityInvitationsRouter);

v1Router.use('/spaces', spacesRouter);
v1Router.use('/space-invitations', spaceInvitationsRouter);
v1Router.use('/bookmarks', writeLimiter, bookmarksRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/community-notifications', communityNotificationsRouter);
v1Router.use('/ecosystem', ecosystemRouter);
v1Router.use('/entities', entitiesRouter);
v1Router.use('/bootstrap', bootstrapRouter);
v1Router.use('/images', imagesRouter);
v1Router.use('/files', filesRouter);
v1Router.use('/payment-methods', paymentMethodsRouter);
v1Router.use('/billing', billingRouter);
v1Router.use('/calendar', calendarRouter);
v1Router.use('/copilot', copilotRouter);
v1Router.use('/documents', documentsRouter);
v1Router.use('/organizations/:orgId/documents', orgDocumentsRouter);
v1Router.use('/organizations/:orgId/talents', orgTalentsRouter);
v1Router.use('/skills', skillsRouter);
v1Router.use('/daily-objective', dailyObjectiveRouter);
v1Router.use('/waitlist', waitlistRouter);

// WhatsApp — versioned under /api/v1/whatsapp
v1Router.use('/whatsapp', whatsappRouter);

// Short Links CRUD (admin — protected by auth)
v1Router.use('/short-links', shortLinksRouter);

// Backoffice (non-indexed, token-protected)
v1Router.use('/backoffice', backofficeRouter);

// Mount versioned API — source unique /api/v1
app.use('/api/v1', v1Router);

// Public redirect route: /link/:slug (outside /api/v1, no auth)
app.use('/link', linkRedirectRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Handle our custom AppError instances
  if (isAppError(err)) {
    // Log operational errors at appropriate level
    if (err.statusCode >= 500) {
      logger.error(`[${err.code}] ${err.message}`, err, {
        path: req.path,
        method: req.method,
        statusCode: err.statusCode,
      });
    } else if (process.env.NODE_ENV !== 'production') {
      logger.warn(`[${err.code}] ${err.message}`, { path: req.path });
    }

    // Add Retry-After header for rate limit errors
    if (err instanceof RateLimitError && err.retryAfter) {
      res.setHeader('Retry-After', err.retryAfter);
    }

    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle unexpected errors
  logger.error('Unexpected error', err, {
    path: req.path,
    method: req.method,
  });

  // Never expose internal error details in production
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
});

// Start server
const server = app.listen(PORT, async () => {
  logger.info('Etudesk API started', { port: PORT, version: CURRENT_API_VERSION });

  // Verify email service connection
  const emailConnected = await verifyEmailConnection();
  if (!emailConnected) {
    logger.warn('Email service not available. OTP emails will fail.', {
      hint: 'Make sure Mailhog is running: docker-compose up -d mailhog',
    });
  }

  // Setup periodic cleanup of expired OTPs (every hour)
  setInterval(() => {
    cleanupExpiredOTPs();
  }, 60 * 60 * 1000);

  // --- Cron Jobs ---
  const cronLogger = logger.child({ module: 'cron' });

  cronLogger.info('Cron jobs initialized');

  // Process scheduled notifications every 10 minutes
  const runNotificationCron = async () => {
    try {
      const count = await notificationService.processScheduled();
      if (count > 0) {
        cronLogger.info('Sent scheduled notifications', { count });
      }
    } catch (err) {
      cronLogger.error('Failed to process notifications', err);
    }
  };
  setInterval(runNotificationCron, 10 * 60 * 1000);

  // Publish scheduled activities every 5 minutes
  const runPublishScheduledCron = async () => {
    try {
      const count = await communityActivityService.publishScheduledActivities();
      if (count > 0) {
        cronLogger.info('Published scheduled activities', { count });
      }
    } catch (err) {
      cronLogger.error('Failed to publish scheduled activities', err);
    }
  };
  runPublishScheduledCron();
  setInterval(runPublishScheduledCron, 5 * 60 * 1000);

  // Execute due agenda triggers every 5 minutes
  const runAgendaTriggersCron = async () => {
    try {
      const result = await processDueAgendaTriggers(100);
      if (result.skipped) return;
      if (result.processed > 0) {
        cronLogger.info('Processed agenda triggers', result);
      }
    } catch (err) {
      cronLogger.error('Failed to process agenda triggers', err);
    }
  };
  runAgendaTriggersCron();
  setInterval(runAgendaTriggersCron, 5 * 60 * 1000);

  // Cleanup old notifications weekly
  const runNotificationCleanupCron = async () => {
    try {
      const count = await notificationService.cleanup(90);
      if (count > 0) {
        cronLogger.info('Deleted old notifications', { count });
      }
    } catch (err) {
      cronLogger.error('Failed to cleanup notifications', err);
    }
  };
  setInterval(runNotificationCleanupCron, 7 * 24 * 60 * 60 * 1000);

  // Pre-compute skill embeddings (non-blocking — server is already accepting requests)
  precomputeSkillEmbeddings().catch(err =>
    logger.warn('Skill embedding pre-computation failed (static fallback active):', err)
  );

  logger.info('API ready', {
    endpoints: {
      auth: '/api/v1/auth',
      talents: '/api/v1/talents',
      organizations: '/api/v1/organizations',
      opportunities: '/api/v1/opportunities',
      communities: '/api/v1/communities',
    },
  });
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  try {
    server.close(() => logger.info('HTTP server closed'));
    await pool.end();
    logger.info('Database pool closed');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
