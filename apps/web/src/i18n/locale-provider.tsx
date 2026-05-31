"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
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

type LocaleProviderProps = {
  initialLocale: Locale;
  children: React.ReactNode;
};

export function LocaleProvider({ initialLocale, children }: LocaleProviderProps) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [isPending, startTransition] = useTransition();

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
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

export function useTranslations() {
  return useLocale().dictionary;
}

/** Safe fallback when provider is absent (should not happen in app shell). */
export function useOptionalLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? DEFAULT_LOCALE;
}
