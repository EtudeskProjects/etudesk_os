import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware
 * Protects against brute force attacks and abuse
 *
 * NOTE: All limits are currently set to generous dev-friendly values.
 * TODO: Tighten before public launch.
 */

const isDev = process.env.NODE_ENV !== 'production';

// Generic API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Very generous for dev/testing
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
  max: 100,
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
  max: 30,
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
