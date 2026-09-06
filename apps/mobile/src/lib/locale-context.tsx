import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { I18nManager } from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  DEFAULT_LOCALE,
  getMobileDictionary,
  interpolate,
  isLocale,
  isRtlLocale,
  type Locale,
  type MobileDictionary,
} from "@zindagi/i18n";

const LOCALE_STORAGE_KEY = "zc_locale";

type LocaleContextValue = {
  locale: Locale;
  t: MobileDictionary;
  setLocale: (locale: Locale) => Promise<void>;
  isLoading: boolean;
  isRTL: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export { interpolate };

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Alignment is handled entirely in JS (see components/ui/text.tsx), so the
    // app never calls forceRTL. Clear any native RTL flag left over from
    // earlier builds that did — otherwise Android/iOS keep mirroring row
    // layouts (icons, flex order) on every language regardless of `locale`,
    // which is what "everything's stuck on the same side" looks like.
    if (I18nManager.isRTL) {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    }

    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        if (isLocale(stored)) {
          setLocaleState(stored);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: getMobileDictionary(locale),
      setLocale,
      isLoading,
      isRTL: isRtlLocale(locale),
    }),
    [locale, setLocale, isLoading],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}

export function useTranslations() {
  return useLocale().t;
}
