import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { I18nManager, Platform } from 'react-native';
import fr from './fr.json';
import en from './en.json';
import es from './es.json';
import ar from './ar.json';
import it from './it.json';
import de from './de.json';
import zh from './zh.json';

const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'ar', 'it', 'de', 'zh'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'fr';

export const LANGUAGE_OPTIONS: readonly { id: Language; label: string; flag: string }[] = [
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
] as const;

const RTL_LANGUAGES: ReadonlySet<string> = new Set(['ar']);

// Create i18n instance
const i18n = new I18n({
  fr,
  en,
  es,
  ar,
  it,
  de,
  zh,
});

// Set default locale (French on first launch, with fallbacks for missing translations)
i18n.defaultLocale = DEFAULT_LANGUAGE;
i18n.enableFallback = true;

export function isValidLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

// Get device language using expo-localization (works reliably on iOS + Android)
export function getDeviceLanguage(): Language {
  try {
    const locales = getLocales();
    if (locales?.length > 0) {
      const lang = locales[0].languageCode ?? DEFAULT_LANGUAGE;
      if (isValidLanguage(lang)) return lang;
    }
  } catch {
    // Fallback to the app default language
  }
  return DEFAULT_LANGUAGE;
}

export function getLocaleForLanguage(language: Language): string {
  const localeMap: Record<Language, string> = {
    en: 'en-US',
    fr: 'fr-FR',
    es: 'es-ES',
    ar: 'ar',
    it: 'it-IT',
    de: 'de-DE',
    zh: 'zh-CN',
  };
  return localeMap[language];
}

export function normalizeLanguage(value: unknown): Language {
  const lang = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return isValidLanguage(lang) ? lang : DEFAULT_LANGUAGE;
}

export function getCurrentLanguage(): Language {
  return normalizeLanguage(i18n.locale);
}

export function getCurrentLocale(): string {
  return getLocaleForLanguage(getCurrentLanguage());
}

const initialLanguage = DEFAULT_LANGUAGE;
i18n.locale = initialLanguage;

// Apply RTL layout for Arabic
const isRTL = RTL_LANGUAGES.has(initialLanguage);
if (I18nManager.isRTL !== isRTL) {
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
}

/** Change language at runtime */
export function setLanguage(lang: Language): void {
  i18n.locale = lang;
  const shouldBeRTL = RTL_LANGUAGES.has(lang);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    // On native, RTL change requires app restart
    if (Platform.OS !== 'web') {
      // The app will pick up the new RTL direction on next launch
    }
  }
}

export { SUPPORTED_LANGUAGES };
export default i18n;
export type TranslationKey = string;
