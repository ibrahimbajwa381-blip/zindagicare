/// <reference types="jest" />
import "@testing-library/react-native";
import React from "react";

// Almost every screen calls useTranslations()/useLocale() — provide the real
// English dictionary synchronously so screens render without needing to be
// wrapped in a real (async-loading) LocaleProvider. Tests that specifically
// exercise language switching override this with their own jest.mock call.
jest.mock("@/lib/locale-context", () => {
  const { mobileEn, interpolate } = jest.requireActual("@zindagi/i18n");
  return {
    useTranslations: () => mobileEn,
    useLocale: () => ({ locale: "en", t: mobileEn, setLocale: jest.fn(), isLoading: false }),
    LocaleProvider: ({ children }: { children: React.ReactNode }) => children,
    interpolate,
  };
});

// Every test starts with no network calls having happened; individual tests
// (or their describe blocks) install the fetch responses they need.
globalThis.fetch = jest.fn(() =>
  Promise.reject(new Error("fetch was not mocked for this test")),
) as unknown as typeof fetch;

jest.mock("expo-font", () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
  loadAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@expo-google-fonts/plus-jakarta-sans", () => ({
  useFonts: () => [true, null],
  PlusJakartaSans_400Regular: "PlusJakartaSans_400Regular",
  PlusJakartaSans_500Medium: "PlusJakartaSans_500Medium",
  PlusJakartaSans_600SemiBold: "PlusJakartaSans_600SemiBold",
  PlusJakartaSans_700Bold: "PlusJakartaSans_700Bold",
}));
