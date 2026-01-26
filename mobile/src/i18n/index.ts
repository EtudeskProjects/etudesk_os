import { I18n } from 'i18n-js';
import { Platform, NativeModules } from 'react-native';
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

// Get device language using React Native's native modules
function getDeviceLocale(): string {
  try {
    // iOS
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      const locale = settings?.AppleLocale || settings?.AppleLanguages?.[0];
      if (locale) {
        return locale.substring(0, 2);
      }
    }
    // Android
    if (Platform.OS === 'android') {
      const locale = NativeModules.I18nManager?.localeIdentifier;
      if (locale) {
        return locale.substring(0, 2);
      }
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
