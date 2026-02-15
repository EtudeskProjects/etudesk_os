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

const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
const FALLBACK_LANGUAGE = 'fr';

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
