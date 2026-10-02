'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  createFormatters,
  createTranslator,
  isLocale,
  type Formatters,
  type Locale,
  type Translator,
} from './core';

export interface I18n {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  readonly t: Translator;
  readonly fmt: Formatters;
}

function i18nFor(locale: Locale, setLocale: (locale: Locale) => void): I18n {
  return { locale, setLocale, t: createTranslator(locale), fmt: createFormatters(locale) };
}

/** Without a provider (isolated component tests) the interface is English. */
const I18nContext = createContext<I18n>(i18nFor(DEFAULT_LOCALE, () => {}));

export function useI18n(): I18n {
  return useContext(I18nContext);
}

function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Holds the interface language. A new visitor gets English; a choice is kept in localStorage and
 * restored after reload. The server render is English, the stored choice applies on mount.
 */
export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    if (initialLocale) return;
    const stored = readStoredLocale();
    if (stored) setLocaleState(stored);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode): the choice then lasts for this page only.
    }
  }, []);

  const value = useMemo(() => i18nFor(locale, setLocale), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
