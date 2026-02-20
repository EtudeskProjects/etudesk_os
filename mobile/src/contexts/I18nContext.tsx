import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { Language } from '../i18n';
import { STORAGE_KEYS } from '../constants/config';
import { api } from '../services/api';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
  locale: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

function isValidLanguage(value: string): value is Language {
  return value === 'fr' || value === 'en';
}

// Helper to safely get device locale without expo-localization
function getDeviceLanguage(): Language {
  try {
    let locale = 'fr';
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      locale = settings?.AppleLocale || settings?.AppleLanguages?.[0] || 'fr';
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || 'fr';
    }
    const lang = locale.substring(0, 2);
    return lang === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getDeviceLanguage());

  // Load stored language on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
        if (stored && isValidLanguage(stored)) {
          setLanguageState(stored);
          i18n.locale = stored;
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Update i18n locale when language changes
  useEffect(() => {
    i18n.locale = language;
  }, [language]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    i18n.locale = lang;
    AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang).catch(() => {});

    // Sync language preference to backend (fire-and-forget)
    try {
      const isAuthenticated = await api.isAuthenticated();
      if (isAuthenticated) {
        api.put('/api/auth/language', { language: lang }).catch(() => {});
      }
    } catch {
      // Ignore sync errors - local preference is the source of truth
    }
  }, []);

  // Translation function with interpolation support
  const t = useCallback((key: string, options?: Record<string, string | number>): string => {
    try {
      return i18n.t(key, options);
    } catch (error) {
      if (__DEV__) console.warn(`Translation missing for key: ${key}`);
      return key;
    }
  }, [language]); // Re-create when language changes

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
    locale: language,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// Shortcut hook for just the translation function
export const useTranslation = () => {
  const { t, language } = useI18n();
  return { t, language };
};

export default I18nContext;
