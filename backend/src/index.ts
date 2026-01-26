import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import opportunitiesRouter from './routes/opportunities';
import applicationsRouter from './routes/applications';
import communitiesRouter from './routes/communities';
import hubsRouter from './routes/hubs';
import authRouter from './routes/auth';
import onboardingRouter from './routes/onboarding';
import talentsRouter from './routes/talents';
import organizationsRouter from './routes/organizations';
import organizationMembersRouter from './routes/organization-members';
import kycRouter from './routes/kyc';
import documentsRouter from './routes/documents';
import bookmarksRouter from './routes/bookmarks';
import notificationsRouter from './routes/notifications';
import imagesRouter from './routes/images';
import filesRouter from './routes/files';
import paymentMethodsRouter from './routes/payment-methods';
import communityActivitiesRouter from './routes/community-activities.routes';
import communitySubscriptionsRouter from './routes/community-subscriptions.routes';
import communityNotificationsRouter from './routes/community-notifications.routes';
import communityInvitationsRouter from './routes/community-invitations.routes';
import webhooksRouter from './routes/webhooks.routes';
import calendarRouter from './routes/calendar.routes';
import { verifyEmailConnection } from './services/email.service';
import { cleanupExpiredOTPs } from './services/otp.service';
import { apiLimiter, authLimiter, otpLimiter } from './middleware/rateLimit.middleware';
import { communitySubscriptionService } from './services/community-subscription.service';
import { communityPaymentService } from './services/community-payment.service';
import { communityNotificationService } from './services/community-notification.service';
import { communityActivityService } from './services/community-activity.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const getCorsOrigin = (): string | string[] | boolean => {
  const corsOrigin = process.env.CORS_ORIGIN;

  if (!corsOrigin) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ CORS_ORIGIN must be set in production');
      throw new Error('CORS_ORIGIN must be set in production');
    }
    // Development: allow localhost origins
    return ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];
  }

  // Allow multiple origins separated by comma
  if (corsOrigin.includes(',')) {
    return corsOrigin.split(',').map((o) => o.trim());
  }

  return corsOrigin;
};

app.use(cors({
  origin: getCorsOrigin(),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

// Webhooks route BEFORE rate limiter (needs raw body parsing for signature verification)
app.use('/api/webhooks', webhooksRouter);

// Apply global API rate limiter
app.use('/api', apiLimiter);

// Auth Routes with stricter rate limiting
app.use('/api/auth/request-otp', otpLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/onboarding', onboardingRouter);

// API Routes
app.use('/api/talents', talentsRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/organizations', organizationMembersRouter);
app.use('/api/kyc', kycRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/communities', communitiesRouter);
app.use('/api', communityActivitiesRouter);
app.use('/api/community-subscriptions', communitySubscriptionsRouter);
app.use('/api/community-notifications', communityNotificationsRouter);
app.use('/api/communities', communityInvitationsRouter); // Invitations routes /:communityId/invitations
app.use('/api/community-invitations', communityInvitationsRouter); // User routes /me, /:id/accept, /:id/decline
app.use('/api/hubs', hubsRouter);

app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/files', filesRouter);
app.use('/api/payment-methods', paymentMethodsRouter);
app.use('/api/calendar', calendarRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Etudesk API running on http://localhost:${PORT}`);

  // Verify email service connection
  const emailConnected = await verifyEmailConnection();
  if (!emailConnected) {
    console.warn('⚠️  Email service not available. OTP emails will fail.');
    console.warn('   Make sure Mailhog is running: docker-compose up -d mailhog');
  }

  // Setup periodic cleanup of expired OTPs (every hour)
  setInterval(() => {
    cleanupExpiredOTPs();
  }, 60 * 60 * 1000);

  // ═══════════════════════════════════════════════════════════════
  // COMMUNITY MODULE CRON JOBS
  // ═══════════════════════════════════════════════════════════════

  // Process expiring subscriptions daily (at startup and every 24h)
  const runSubscriptionCron = async () => {
    try {
      const result = await communitySubscriptionService.processExpiringSubscriptions();
      console.log(`[CRON] Subscription check: ${result.expired} expired, ${result.reminded} reminded`);
    } catch (err) {
      console.error('[CRON] Failed to process subscriptions:', err);
    }
  };
  runSubscriptionCron(); // Run at startup
  setInterval(runSubscriptionCron, 24 * 60 * 60 * 1000); // Every 24h

  // Retry failed payments daily
  const runPaymentRetryCron = async () => {
    try {
      const count = await communityPaymentService.processFailedPaymentsRetry();
      if (count > 0) {
        console.log(`[CRON] Retried ${count} failed payments`);
      }
    } catch (err) {
      console.error('[CRON] Failed to retry payments:', err);
    }
  };
  setInterval(runPaymentRetryCron, 24 * 60 * 60 * 1000); // Every 24h

  // Process scheduled notifications every 10 minutes
  const runNotificationCron = async () => {
    try {
      const count = await communityNotificationService.processScheduledNotifications();
      if (count > 0) {
        console.log(`[CRON] Sent ${count} scheduled notifications`);
      }
    } catch (err) {
      console.error('[CRON] Failed to process notifications:', err);
    }
  };
  setInterval(runNotificationCron, 10 * 60 * 1000); // Every 10 minutes

  // Publish scheduled activities every 5 minutes
  const runPublishScheduledCron = async () => {
    try {
      const count = await communityActivityService.publishScheduledActivities();
      if (count > 0) {
        console.log(`[CRON] Published ${count} scheduled activities`);
      }
    } catch (err) {
      console.error('[CRON] Failed to publish scheduled activities:', err);
    }
  };
  runPublishScheduledCron(); // Run at startup
  setInterval(runPublishScheduledCron, 5 * 60 * 1000); // Every 5 minutes

  // Cleanup old notifications weekly
  const runNotificationCleanupCron = async () => {
    try {
      const count = await communityNotificationService.deleteOldNotifications(90);
      if (count > 0) {
        console.log(`[CRON] Deleted ${count} old notifications`);
      }
    } catch (err) {
      console.error('[CRON] Failed to cleanup notifications:', err);
    }
  };
  setInterval(runNotificationCleanupCron, 7 * 24 * 60 * 60 * 1000); // Weekly

  console.log('');
  console.log('📋 Available endpoints:');
  console.log('   POST /api/auth/request-otp  - Request OTP code');
  console.log('   POST /api/auth/verify-otp   - Verify OTP and login');
  console.log('   POST /api/auth/refresh      - Refresh tokens');
  console.log('   POST /api/auth/logout       - Logout');
  console.log('   GET  /api/auth/me           - Get current user');
  console.log('   POST /api/onboarding/complete - Create talent profile');
  console.log('   GET  /api/onboarding/status   - Check onboarding status');
  console.log('   GET  /api/talents/me          - Get current talent profile');
  console.log('   PUT  /api/talents/me          - Update current talent profile');
  console.log('   GET  /api/organizations       - List organizations');
  console.log('   POST /api/organizations       - Create organization');
  console.log('   PUT  /api/organizations/:id   - Update organization');
  console.log('   GET  /api/kyc/status          - Get KYC status');
  console.log('   POST /api/kyc/submit          - Submit KYC documents');
  console.log('');
});
