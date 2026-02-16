import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware
 * Protects against brute force attacks and abuse
 */

const isProd = process.env.NODE_ENV === 'production';

const getApiMax = () => {
  const v = process.env.RATE_LIMIT_API_MAX;
  if (v) return parseInt(v, 10);
  return isProd ? 500 : 5000;
};

const getAuthMax = () => {
  const v = process.env.RATE_LIMIT_AUTH_MAX;
  if (v) return parseInt(v, 10);
  return isProd ? 20 : 100;
};

const getOtpMax = () => {
  const v = process.env.RATE_LIMIT_OTP_MAX;
  if (v) return parseInt(v, 10);
  return isProd ? 10 : 30;
};

// Generic API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getApiMax(),
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:tooManyRequests'), retry_after: 15 * 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for authentication routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getAuthMax(),
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:tooManyLoginAttempts'), retry_after: 15 * 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// OTP rate limiter
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: getOtpMax(),
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:codeLimitReached'), retry_after: 60 * 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Application submission limiter
export const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200,
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:tooManyApplications'), retry_after: 60 * 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Write operations limiter
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:tooManyOperations'), retry_after: 15 * 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search/heavy query limiter
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:tooManySearches'), retry_after: 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Copilot chat limiter (expensive AI calls)
export const copilotChatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:tooManyMessages'), retry_after: 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Copilot general limiter
export const copilotGeneralLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:tooManyCopilotRequests'), retry_after: 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Waitlist limiter (public endpoint)
export const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:tooManyDemands'), retry_after: 60 * 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Paystack webhook limiter
export const paystackWebhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:webhookLimitExceeded'), retry_after: 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// WhatsApp webhook limiter (external provider callbacks)
export const whatsappWebhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:webhookRetryLimitExceeded'), retry_after: 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export endpoint limiter
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: (_req: any, res: any) => {
    return res.status(429).json({ error: _req.t('rateLimit:exportLimitReached'), retry_after: 60 * 60 });
  },
  standardHeaders: true,
  legacyHeaders: false,
});
