import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
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
import communityActivitiesRouter from './routes/community-activities.routes';

import communityInvitationsRouter from './routes/community-invitations.routes';
import opportunityInvitationsRouter from './routes/opportunity-invitations.routes';
import spaceInvitationsRouter from './routes/space-invitations.routes';
import calendarRouter from './routes/calendar.routes';
import copilotRouter from './routes/copilot';
import documentsRouter from './routes/documents';
import skillsRouter from './routes/skills';
import dailyObjectiveRouter from './routes/daily-objective';
import { verifyEmailConnection } from './services/email.service';
import { cleanupExpiredOTPs } from './services/otp.service';
import { apiLimiter, authLimiter, otpLimiter } from './middleware/rateLimit.middleware';

import * as notificationService from './services/notification.service';
import { communityActivityService } from './services/community-activity.service';
import { AppError, isAppError, RateLimitError } from './errors';
import { createVersionedRouter, CURRENT_API_VERSION } from './middleware/api-version.middleware';
import { logger } from './utils';
import { i18nMiddleware } from './i18n';

dotenv.config();

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

app.use(cors({
  origin: getCorsOrigin(),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(i18nMiddleware);

// Serve uploaded files statically
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadDir));

// Health check (no rate limit)
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    name: 'Etudesk API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// --- API v1 Router (Versioned) ---
const v1Router = createVersionedRouter('v1');

// Apply rate limiter to v1 routes
v1Router.use(apiLimiter);

// Auth Routes with stricter rate limiting
v1Router.use('/auth/request-otp', otpLimiter);
v1Router.use('/auth/verify-otp', authLimiter);
v1Router.use('/auth', authRouter);
v1Router.use('/onboarding', onboardingRouter);

// Domain Routes
v1Router.use('/talents', talentsRouter);
v1Router.use('/organizations', organizationsRouter);
v1Router.use('/organizations', organizationMembersRouter);
v1Router.use('/kyc', kycRouter);
v1Router.use('/opportunities', opportunitiesRouter);
v1Router.use('/applications', applicationsRouter);
v1Router.use('/communities', communitiesRouter);
v1Router.use('/', communityActivitiesRouter);

v1Router.use('/communities', communityInvitationsRouter);
v1Router.use('/community-invitations', communityInvitationsRouter); // Fix: Explicit mount for /me path

v1Router.use('/opportunities', opportunityInvitationsRouter);
v1Router.use('/opportunity-invitations', opportunityInvitationsRouter); // Fix: Explicit mount for /me path

v1Router.use('/spaces', spacesRouter);
v1Router.use('/spaces', spaceInvitationsRouter);
v1Router.use('/space-invitations', spaceInvitationsRouter); // Fix: Explicit mount for /me path
v1Router.use('/bookmarks', bookmarksRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/images', imagesRouter);
v1Router.use('/files', filesRouter);
v1Router.use('/payment-methods', paymentMethodsRouter);
v1Router.use('/calendar', calendarRouter);
v1Router.use('/copilot', copilotRouter);
v1Router.use('/documents', documentsRouter);
v1Router.use('/skills', skillsRouter);
v1Router.use('/daily-objective', dailyObjectiveRouter);

// Mount versioned API
app.use('/api/v1', v1Router);
app.use('/api', v1Router); // Backward compatible - defaults to v1

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
app.listen(PORT, async () => {
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
