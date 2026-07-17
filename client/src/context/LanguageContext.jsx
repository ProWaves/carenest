// ==========================================================================
// LanguageContext.jsx — i18n / Language Context
// ==========================================================================
// Provides app-wide localization support. Loads en.json and fr.json locale
// files. t(key) resolves dot-notation keys like 'nav.home' to translated
// strings. Falls back to the key itself if no translation is found.
// User preference is persisted in localStorage under 'lang'.
// ==========================================================================

import { createContext, useContext, useState } from 'react';
import en from '../locales/en.json';
import fr from '../locales/fr.json';

const translations = { en, fr };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('lang') || 'en';
  });

  // Resolve a dot-notation key to a translated string (e.g. 'auth.login')
  const t = (key) => {
    const keys = key.split('.');
    let value = translations[lang];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  const changeLanguage = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
  };

  return (
    <LanguageContext.Provider value={{ lang, t, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
