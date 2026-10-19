"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import type { Dictionary } from "./dictionaries/en";

/**
 * Only the active locale's dictionary reaches the browser (passed from the root
 * layout). Statically importing both put ~190KB of en+ur strings into the JS
 * every page parses; the other locale is now fetched only when switching.
 */
const loadDictionary: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en").then((m) => m.en),
  ur: () => import("./dictionaries/ur").then((m) => m.ur),
};

/** Last dictionary the provider received — backs the no-provider fallback. */
let lastDictionary: { locale: Locale; dictionary: Dictionary } | null = null;

type LocaleContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
  isPending: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function fallbackLocaleValue(): LocaleContextValue {
  if (!lastDictionary) {
    throw new Error("useLocale/useTranslations must be used inside <LocaleProvider>");
  }
  return {
    ...lastDictionary,
    setLocale: () => {},
    isPending: false,
  };
}

type LocaleProviderProps = {
  initialLocale: Locale;
  /** Dictionary for `initialLocale`, rendered by the server. */
  initialDictionary: Dictionary;
  children: React.ReactNode;
};

function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match?.[1];
  return isLocale(value) ? value : null;
}

export function LocaleProvider({
  initialLocale,
  initialDictionary,
  children,
}: LocaleProviderProps) {
  const router = useRouter();
  const [current, setCurrent] = useState({ locale: initialLocale, dictionary: initialDictionary });
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const requestedLocale = useRef<Locale>(initialLocale);

  // The server is the source of truth: adopt its locale/dictionary whenever the
  // root layout re-renders (e.g. after router.refresh() on a locale switch).
  const [serverDictionary, setServerDictionary] = useState(initialDictionary);
  if (serverDictionary !== initialDictionary) {
    setServerDictionary(initialDictionary);
    setCurrent({ locale: initialLocale, dictionary: initialDictionary });
  }

  const { locale, dictionary } = current;

  useEffect(() => {
    lastDictionary = current;
  }, [current]);

  /** Fetch `next`'s dictionary, then switch to it unless a newer switch superseded it. */
  const loadAndApply = useCallback(async (next: Locale) => {
    requestedLocale.current = next;
    const nextDictionary = await loadDictionary[next]();
    if (requestedLocale.current !== next) return false;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ur" ? "rtl" : "ltr";
    setCurrent({ locale: next, dictionary: nextDictionary });
    return true;
  }, []);

  useEffect(() => {
    const fromCookie = readLocaleCookie();
    if (!fromCookie || fromCookie === initialLocale) return;
    void loadAndApply(fromCookie);
  }, [initialLocale, loadAndApply]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === requestedLocale.current) return;
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${LOCALE_COOKIE_MAX_AGE};SameSite=Lax`;
      setIsLoading(true);
      void loadAndApply(next)
        .then((applied) => {
          if (applied) setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
      startTransition(() => {
        router.refresh();
      });
    },
    [loadAndApply, router],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dictionary,
      setLocale,
      isPending: isPending || isLoading,
    }),
    [locale, dictionary, setLocale, isPending, isLoading],
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
