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
  message: {
    error: 'Trop de requêtes. Veuillez réessayer dans quelques minutes.',
    retry_after: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for authentication routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getAuthMax(),
  message: {
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    retry_after: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// OTP rate limiter
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: getOtpMax(),
  message: {
    error: 'Limite d\'envoi de code atteinte. Veuillez réessayer dans 1 heure.',
    retry_after: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Application submission limiter
export const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200,
  message: {
    error: 'Vous avez soumis trop de candidatures. Veuillez réessayer plus tard.',
    retry_after: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Write operations limiter
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    error: 'Trop d\'opérations. Veuillez réessayer dans quelques minutes.',
    retry_after: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search/heavy query limiter
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300,
  message: {
    error: 'Trop de recherches. Veuillez patienter.',
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Copilot chat limiter (expensive AI calls)
export const copilotChatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: {
    error: 'Trop de messages envoyés. Veuillez patienter quelques instants.',
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Copilot general limiter
export const copilotGeneralLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: {
    error: 'Trop de requêtes copilot. Veuillez patienter.',
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Waitlist limiter (public endpoint)
export const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: {
    error: 'Trop de demandes. Veuillez réessayer dans 1 heure.',
    retry_after: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Paystack webhook limiter
export const paystackWebhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Trop de requêtes webhook.',
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// WhatsApp webhook limiter (external provider callbacks)
export const whatsappWebhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Trop de requêtes webhook. Veuillez réessayer.',
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export endpoint limiter
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: {
    error: 'Limite d\'exportation atteinte. Veuillez réessayer plus tard.',
    retry_after: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});
