'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isLocale, defaultLocale, type Locale } from '../lib/i18n';

export type Lang = Locale;

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const LangContext = createContext<LangContextType>({
  lang: defaultLocale,
  setLang: () => {},
});

/** Derive la langue depuis le premier segment de l'URL (/fr/... ou /en/...). */
function langFromPath(pathname: string | null): Lang {
  const seg = (pathname ?? '/').split('/')[1];
  return isLocale(seg) ? seg : defaultLocale;
}

export const LangProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const lang = langFromPath(pathname);

  // Tient l'attribut <html lang> a jour cote client (le SEO est gere par hreflang).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Change de langue en remplacant le premier segment du chemin courant.
  const setLang = (l: Lang) => {
    if (l === lang) return;
    const parts = (pathname ?? '/').split('/');
    if (isLocale(parts[1])) {
      parts[1] = l;
    } else {
      parts.splice(1, 0, l);
    }
    const next = parts.join('/') || `/${l}`;
    router.push(next);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
