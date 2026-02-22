import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import fr from './fr.json';
import en from './en.json';

// Create i18n instance
const i18n = new I18n({
  fr,
  en,
});

// Set default locale
i18n.defaultLocale = 'fr';
i18n.enableFallback = true;

// Get device language using expo-localization (works reliably on iOS + Android)
function getDeviceLocale(): string {
  try {
    const locales = getLocales();
    if (locales?.length > 0) {
      return locales[0].languageCode ?? 'fr';
    }
  } catch {
    // Fallback to French
  }
  return 'fr';
}

i18n.locale = getDeviceLocale();

export default i18n;
export type Language = 'fr' | 'en';
export type TranslationKey = string;
