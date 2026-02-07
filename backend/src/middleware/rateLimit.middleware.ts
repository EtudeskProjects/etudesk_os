import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware
 * Protects against brute force attacks and abuse
 */

// Generic API rate limiter
// Higher limit for development to avoid blocking during hot reload
const isDev = process.env.NODE_ENV !== 'production';
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 500 : 100, // 500 in dev, 100 in production per window per IP
  message: {
    error: 'Trop de requêtes. Veuillez réessayer dans quelques minutes.',
    retry_after: 15 * 60 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for authentication routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  message: {
    error: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    retry_after: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// OTP rate limiter (very strict)
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 OTP requests per hour per IP
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
  max: 20, // 20 applications per hour per IP
  message: {
    error: 'Vous avez soumis trop de candidatures. Veuillez réessayer plus tard.',
    retry_after: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Write operations limiter (create, update, delete)
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 write operations per window per IP
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
  max: 30, // 30 searches per minute per IP
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
  max: isDev ? 30 : 10, // 10 messages per minute per IP in production
  message: {
    error: 'Trop de messages envoyés. Veuillez patienter quelques instants.',
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Copilot general limiter (suggestions, sessions, etc.)
export const copilotGeneralLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 100 : 30, // 30 requests per minute per IP in production
  message: {
    error: 'Trop de requêtes copilot. Veuillez patienter.',
    retry_after: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export endpoint limiter (PDFs, etc.)
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exports per hour per IP
  message: {
    error: 'Limite d\'exportation atteinte. Veuillez réessayer plus tard.',
    retry_after: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});
