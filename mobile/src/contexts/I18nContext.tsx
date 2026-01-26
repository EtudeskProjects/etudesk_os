import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Platform, NativeModules } from 'react-native';
import i18n, { Language } from '../i18n';

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
  // Initialize with device locale or default to French
  const initialLanguage: Language = getDeviceLanguage();

  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // Update i18n locale when language changes
  useEffect(() => {
    i18n.locale = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    i18n.locale = lang;
  }, []);

  // Translation function with interpolation support
  const t = useCallback((key: string, options?: Record<string, string | number>): string => {
    try {
      return i18n.t(key, options);
    } catch (error) {
      console.warn(`Translation missing for key: ${key}`);
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
