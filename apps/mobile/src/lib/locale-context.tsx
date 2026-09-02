import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Alert, DevSettings, I18nManager } from "react-native";
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
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export { interpolate };

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        if (isLocale(stored)) {
          setLocaleState(stored);
          const shouldBeRtl = isRtlLocale(stored);
          if (I18nManager.isRTL !== shouldBeRtl) {
            I18nManager.allowRTL(shouldBeRtl);
            I18nManager.forceRTL(shouldBeRtl);
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, next);

    const shouldBeRtl = isRtlLocale(next);
    if (I18nManager.isRTL !== shouldBeRtl) {
      I18nManager.allowRTL(shouldBeRtl);
      I18nManager.forceRTL(shouldBeRtl);

      const dictionary = getMobileDictionary(next);
      Alert.alert(dictionary.settings.restartTitle, dictionary.settings.restartMessage, [
        { text: dictionary.settings.later, style: "cancel" },
        {
          text: dictionary.settings.restartNow,
          onPress: () => {
            try {
              DevSettings.reload();
            } catch {
              // Not available outside a dev/dev-client build — the user restarts manually.
            }
          },
        },
      ]);
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: getMobileDictionary(locale),
      setLocale,
      isLoading,
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
