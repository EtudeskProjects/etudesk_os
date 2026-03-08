/**
 * Backend i18n configuration
 *
 * Uses i18next with fs-backend for loading locale files
 * and http-middleware for Accept-Language detection.
 *
 * Usage in routes: req.t('common:serverError')
 * Usage outside request: i18next.t('common:serverError', { lng: 'fr' })
 */

import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import i18nextMiddleware from 'i18next-http-middleware';
import path from 'path';

const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'ar', 'it', 'de', 'zh'] as const;
const FALLBACK_LANGUAGE = 'en';

const NAMESPACES = [
  'common',
  'auth',
  'validation',
  'onboarding',
  'opportunities',
  'applications',
  'communities',
  'spaces',
  'organizations',
  'emails',
  'bookmarks',
  'talents',
  'documents',
  'skills',
  'kyc',
  'notifications',
  'payments',
  'copilot',
  'calendar',
  'billing',
  'rateLimit',
  'orgDocs',
  'orgTalents',
] as const;

i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    preload: [...SUPPORTED_LANGUAGES],
    ns: [...NAMESPACES],
    defaultNS: 'common',

    backend: {
      loadPath: path.join(__dirname, 'locales/{{lng}}/{{ns}}.json'),
    },

    detection: {
      order: ['header'],
      lookupHeader: 'accept-language',
    },

    interpolation: {
      escapeValue: false,
    },

    // Suppress locize promo messages in stdout
    saveMissing: false,
    // @ts-ignore — undocumented option that suppresses console.info spam
    showSupportNotice: false,
  });

/** Express middleware — add after cors/json, before routes */
export const i18nMiddleware = i18nextMiddleware.handle(i18next);

/** Direct access for non-request contexts (e.g. cron jobs, background tasks) */
export { i18next };

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export { SUPPORTED_LANGUAGES, FALLBACK_LANGUAGE };

export function getLocaleForLanguage(language: SupportedLanguage): string {
  const locales: Record<SupportedLanguage, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
    ar: 'ar',
    it: 'it-IT',
    de: 'de-DE',
    zh: 'zh-CN',
  };

  return locales[language] || 'en-US';
}

export function normalizeLanguage(value: unknown, fallback: SupportedLanguage = FALLBACK_LANGUAGE): SupportedLanguage {
  const lang = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
    ? (lang as SupportedLanguage)
    : fallback;
}

export function resolveLanguageFromHeader(
  headerValue: unknown,
  fallback: SupportedLanguage = FALLBACK_LANGUAGE
): SupportedLanguage {
  const rawHeader = Array.isArray(headerValue)
    ? headerValue.join(',')
    : typeof headerValue === 'string'
      ? headerValue
      : '';

  if (!rawHeader) {
    return fallback;
  }

  const candidates = rawHeader
    .split(',')
    .map((value) => value.split(';')[0]?.trim().toLowerCase())
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    const exactMatch = normalizeLanguage(candidate, fallback);
    if (exactMatch !== fallback || candidate === fallback) {
      return exactMatch;
    }

    const baseLanguage = candidate.split('-')[0];
    const normalizedBase = normalizeLanguage(baseLanguage, fallback);
    if (normalizedBase !== fallback || baseLanguage === fallback) {
      return normalizedBase;
    }
  }

  return fallback;
}
