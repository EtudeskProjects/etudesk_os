import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, {
  DEFAULT_LANGUAGE,
  Language,
  getLocaleForLanguage,
  isValidLanguage,
  setLanguage as setI18nLanguage,
} from '../i18n';
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

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  const applyLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    setI18nLanguage(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang).catch(() => {});
  }, []);

  const syncStoredUserLanguage = useCallback(async (lang: Language) => {
    const existingUser = await api.getUser<Record<string, unknown>>();
    if (!existingUser) {
      return;
    }

    await api.storeUser({
      ...existingUser,
      preferredLanguage: lang,
    });
  }, []);

  // Load persisted language if present, otherwise use the global default.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
        const resolvedLang = stored && isValidLanguage(stored)
          ? stored
          : DEFAULT_LANGUAGE;

        await applyLanguage(resolvedLang);
      } catch {
        // ignore
      }
    })();
  }, [applyLanguage]);

  const setLanguage = useCallback(async (lang: Language) => {
    const normalizedLanguage = isValidLanguage(lang) ? lang : DEFAULT_LANGUAGE;
    const isAuthenticated = await api.isAuthenticated();

    if (isAuthenticated) {
      await api.put('/api/auth/language', { language: normalizedLanguage });
      await syncStoredUserLanguage(normalizedLanguage);
    }

    await applyLanguage(normalizedLanguage);
  }, [applyLanguage, syncStoredUserLanguage]);

  useEffect(() => {
    (async () => {
      try {
        if (!(await api.isAuthenticated())) {
          return;
        }

        const user = await api.getUser<Record<string, unknown>>();
        const preferredLanguage = user?.preferredLanguage;
        if (typeof preferredLanguage === 'string' && isValidLanguage(preferredLanguage) && preferredLanguage !== language) {
          await applyLanguage(preferredLanguage);
        }
      } catch {
        // ignore
      }
    })();
  }, [applyLanguage, language]);

  // Translation function with interpolation support
  const t = useCallback((key: string, options?: Record<string, string | number>): string => {
    try {
      return i18n.t(key, options);
    } catch {
      if (__DEV__) console.warn(`Translation missing for key: ${key}`);
      return key;
    }
  }, []);

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
    locale: getLocaleForLanguage(language),
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
