import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

// This file exercises the real LocaleProvider — override the project-wide
// mock installed in jest.setup.ts for every other test file.
jest.unmock("@/lib/locale-context");
const { LocaleProvider, useLocale, interpolate } = jest.requireActual("@/lib/locale-context");

const wrapper = ({ children }: { children: React.ReactNode }) => <LocaleProvider>{children}</LocaleProvider>;

describe("LocaleProvider", () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync("zc_locale");
  });

  it("defaults to English before any stored locale loads", async () => {
    const { result } = await renderHook(() => useLocale(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.locale).toBe("en");
    expect(result.current.t.common.ok).toBe("OK");
  });

  it("restores a previously stored locale", async () => {
    await SecureStore.setItemAsync("zc_locale", "ur");
    const { result } = await renderHook(() => useLocale(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.locale).toBe("ur");
  });

  it("switches locale, persists it, and flips isRTL live (no restart needed)", async () => {
    const { result } = await renderHook(() => useLocale(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRTL).toBe(false);

    await act(async () => {
      await result.current.setLocale("ur");
    });

    expect(result.current.locale).toBe("ur");
    expect(result.current.isRTL).toBe(true);
    expect(await SecureStore.getItemAsync("zc_locale")).toBe("ur");
  });

  it("throws when useLocale is used outside a LocaleProvider", async () => {
    const { result } = await renderHook(() => {
      try {
        return useLocale();
      } catch (e) {
        return e;
      }
    });
    expect(result.current).toEqual(new Error("useLocale must be used within a LocaleProvider"));
  });
});

describe("interpolate", () => {
  it("substitutes named placeholders", () => {
    expect(interpolate("Hello {name}, you have {count} items", { name: "Ayesha", count: 3 })).toBe(
      "Hello Ayesha, you have 3 items",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(interpolate("Hi {name}", {})).toBe("Hi {name}");
  });
});
