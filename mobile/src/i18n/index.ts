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

// Set default locale (English as fallback for missing translations)
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

// Get device language using expo-localization (works reliably on iOS + Android)
function getDeviceLocale(): Language {
  try {
    const locales = getLocales();
    if (locales?.length > 0) {
      const lang = locales[0].languageCode ?? 'en';
      if ((SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
        return lang as Language;
      }
    }
  } catch {
    // Fallback to English
  }
  return 'en';
}

const detectedLocale = getDeviceLocale();
i18n.locale = detectedLocale;

// Apply RTL layout for Arabic
const isRTL = RTL_LANGUAGES.has(detectedLocale);
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
