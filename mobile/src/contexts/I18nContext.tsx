import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
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

// Get device language using expo-localization
function getDeviceLanguage(): Language {
  try {
    const locales = getLocales();
    if (locales?.length > 0) {
      const lang = locales[0].languageCode ?? 'fr';
      return lang === 'en' ? 'en' : 'fr';
    }
  } catch {
    // Fallback to French
  }
  return 'fr';
}

const LANGUAGE_USER_CHOSEN_KEY = 'app_language_user_chosen';

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getDeviceLanguage());

  // Load stored language on mount — only if user explicitly chose it
  useEffect(() => {
    (async () => {
      try {
        const userChose = await AsyncStorage.getItem(LANGUAGE_USER_CHOSEN_KEY);
        if (userChose === 'true') {
          const stored = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
          if (stored && isValidLanguage(stored)) {
            setLanguageState(stored);
            i18n.locale = stored;
          }
        }
        // If user never explicitly chose, device language (from getDeviceLanguage) is used
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
    // Mark as explicit user choice + persist
    AsyncStorage.setItem(LANGUAGE_USER_CHOSEN_KEY, 'true').catch(() => {});
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
