"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  type Locale,
} from "./config";
import { getDictionary, type Dictionary } from "./index";

type LocaleContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
  isPending: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function fallbackLocaleValue(): LocaleContextValue {
  return {
    locale: DEFAULT_LOCALE,
    dictionary: getDictionary(DEFAULT_LOCALE),
    setLocale: () => {},
    isPending: false,
  };
}

type LocaleProviderProps = {
  initialLocale: Locale;
  children: React.ReactNode;
};

function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match?.[1];
  return isLocale(value) ? value : null;
}

export function LocaleProvider({ initialLocale, children }: LocaleProviderProps) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const fromCookie = readLocaleCookie();
    if (!fromCookie || fromCookie === initialLocale) return;
    setLocaleState(fromCookie);
    document.documentElement.lang = fromCookie;
    document.documentElement.dir = fromCookie === "ur" ? "rtl" : "ltr";
  }, [initialLocale]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${LOCALE_COOKIE_MAX_AGE};SameSite=Lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ur" ? "rtl" : "ltr";
      setLocaleState(next);
      startTransition(() => {
        router.refresh();
      });
    },
    [locale, router],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dictionary: getDictionary(locale),
      setLocale,
      isPending,
    }),
    [locale, setLocale, isPending],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  return ctx ?? fallbackLocaleValue();
}

export function useTranslations() {
  return useLocale().dictionary;
}

/** Safe fallback when provider is absent (should not happen in app shell). */
export function useOptionalLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? DEFAULT_LOCALE;
}
