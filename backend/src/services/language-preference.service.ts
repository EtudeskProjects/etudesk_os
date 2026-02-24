import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n';
import { pool } from './database';

function toSupportedLanguage(value: unknown): SupportedLanguage | null {
  const lang = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang)
    ? (lang as SupportedLanguage)
    : null;
}

export function normalizeLanguage(value: unknown, fallback: SupportedLanguage = FALLBACK_LANGUAGE): SupportedLanguage {
  return toSupportedLanguage(value) || fallback;
}

export function getLanguageDisplayName(language: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    fr: 'French',
    en: 'English',
    es: 'Spanish',
    ar: 'Arabic',
    it: 'Italian',
    de: 'German',
    zh: 'Chinese (Simplified)',
  };
  return names[language] || 'English';
}

/**
 * Resolve the default language for a talent's AI generations.
 * Priority:
 * 1) Any user linked to this talent with a valid preferred_language
 * 2) Current user preferred_language (if provided)
 * 3) Global fallback language (en)
 */
export async function resolveTalentLanguage(params: {
  talentId?: string | null;
  userId?: string | null;
}): Promise<SupportedLanguage> {
  const { talentId, userId } = params;

  if (talentId) {
    const byTalent = await pool.query(
      `SELECT preferred_language
       FROM users
       WHERE talent_id = $1
         AND deleted_at IS NULL
       ORDER BY updated_at DESC NULLS LAST, created_at ASC
       LIMIT 1`,
      [talentId]
    );
    const lang = toSupportedLanguage(byTalent.rows[0]?.preferred_language);
    if (lang) return lang;
  }

  if (userId) {
    const byUser = await pool.query(
      `SELECT preferred_language
       FROM users
       WHERE id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );
    const lang = toSupportedLanguage(byUser.rows[0]?.preferred_language);
    if (lang) return lang;
  }

  return FALLBACK_LANGUAGE;
}
