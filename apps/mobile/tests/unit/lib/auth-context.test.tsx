import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import * as SecureStore from "expo-secure-store";
import { unregisterCurrentPushToken } from "@/lib/push-notifications";
import { okEnvelope, errEnvelope } from "@/test-utils/mock-fetch";

jest.mock("@/lib/push-notifications", () => ({ unregisterCurrentPushToken: jest.fn().mockResolvedValue(undefined) }));

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

function mockFetchResponses(map: Record<string, unknown>) {
  (globalThis.fetch as jest.Mock).mockImplementation((url: string) => {
    for (const [path, body] of Object.entries(map)) {
      if (url.includes(path)) {
        return Promise.resolve({ json: () => Promise.resolve(body) } as Response);
      }
    }
    return Promise.reject(new Error(`Unhandled fetch: ${url}`));
  });
}

describe("AuthProvider", () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync("zc_access_token");
    await SecureStore.deleteItemAsync("zc_refresh_token");
  });

  it("finishes loading with no user when there are no stored tokens", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("restores the session from a stored access token", async () => {
    await SecureStore.setItemAsync("zc_access_token", "token-123");
    mockFetchResponses({
      "/auth/me": okEnvelope({ user: { id: "u1", name: "Ayesha", roles: ["patient"], onboardingCompleted: true, hasPhone: true } }),
    });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user?.name).toBe("Ayesha");
  });

  it("stays signed out silently if restoring the session fails", async () => {
    await SecureStore.setItemAsync("zc_access_token", "expired-token");
    mockFetchResponses({ "/auth/me": errEnvelope("Unauthorized", "AUTH") });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("refreshes an expired access token during session restore instead of silently signing out", async () => {
    await SecureStore.setItemAsync("zc_access_token", "expired-token");
    await SecureStore.setItemAsync("zc_refresh_token", "refresh-1");
    const restoredUser = { id: "u1", name: "Ayesha", roles: ["patient"], onboardingCompleted: true, hasPhone: true };
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockImplementationOnce(() =>
        Promise.resolve({ status: 401, json: () => Promise.resolve(errEnvelope("Unauthorized", "AUTH")) } as Response),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve(okEnvelope({ accessToken: "fresh-access", refreshToken: "fresh-refresh", user: restoredUser })),
        } as Response),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ status: 200, json: () => Promise.resolve(okEnvelope({ user: restoredUser })) } as Response),
      );

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user?.name).toBe("Ayesha");
    expect(await SecureStore.getItemAsync("zc_access_token")).toBe("fresh-access");
    expect(await SecureStore.getItemAsync("zc_refresh_token")).toBe("fresh-refresh");
  });

  it("clears the stale tokens when both the access token and the refresh attempt fail on session restore", async () => {
    await SecureStore.setItemAsync("zc_access_token", "expired-token");
    await SecureStore.setItemAsync("zc_refresh_token", "expired-refresh-token");
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockImplementationOnce(() =>
        Promise.resolve({ status: 401, json: () => Promise.resolve(errEnvelope("Unauthorized", "AUTH")) } as Response),
      )
      .mockImplementationOnce(() =>
        Promise.resolve({ status: 401, json: () => Promise.resolve(errEnvelope("Invalid refresh token", "AUTH")) } as Response),
      );

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(await SecureStore.getItemAsync("zc_access_token")).toBeNull();
    expect(await SecureStore.getItemAsync("zc_refresh_token")).toBeNull();
  });

  it("signs in with credentials, storing tokens and the user", async () => {
    mockFetchResponses({
      "/auth/login": okEnvelope({
        accessToken: "at-1",
        refreshToken: "rt-1",
        user: { id: "u1", name: "Ayesha", roles: ["patient"], onboardingCompleted: true, hasPhone: true },
      }),
    });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signInWithCredentials("ayesha@example.com", "secret1");
    });

    expect(result.current.user?.name).toBe("Ayesha");
    expect(await SecureStore.getItemAsync("zc_access_token")).toBe("at-1");
    expect(await SecureStore.getItemAsync("zc_refresh_token")).toBe("rt-1");
  });

  it("never passes the password or the issued tokens to console logging during sign-in", async () => {
    mockFetchResponses({
      "/auth/login": okEnvelope({
        accessToken: "at-secret-1",
        refreshToken: "rt-secret-1",
        user: { id: "u1", name: "Ayesha", roles: ["patient"], onboardingCompleted: true, hasPhone: true },
      }),
    });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { result } = await renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.signInWithCredentials("ayesha@example.com", "correct-horse-battery-staple");
      });

      for (const spy of [logSpy, warnSpy, errorSpy]) {
        for (const call of spy.mock.calls) {
          const serialized = JSON.stringify(call);
          expect(serialized).not.toContain("correct-horse-battery-staple");
          expect(serialized).not.toContain("at-secret-1");
          expect(serialized).not.toContain("rt-secret-1");
        }
      }
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("throws with the server error message when sign-in fails", async () => {
    mockFetchResponses({ "/auth/login": errEnvelope("Invalid credentials", "BAD_CREDS") });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.signInWithCredentials("ayesha@example.com", "wrong");
      }),
    ).rejects.toThrow("Invalid credentials");
  });

  it("sets isSigningIn while a credential sign-in is in flight", async () => {
    let resolveLogin: (v: unknown) => void = () => {};
    (globalThis.fetch as jest.Mock).mockImplementation(
      () => new Promise((resolve) => (resolveLogin = resolve)),
    );
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let signInPromise!: Promise<void>;
    await act(async () => {
      signInPromise = result.current.signInWithCredentials("a@b.com", "secret1").catch(() => undefined);
    });
    expect(result.current.isSigningIn).toBe(true);

    await act(async () => {
      resolveLogin({ json: () => Promise.resolve(okEnvelope({ accessToken: "at", refreshToken: "rt", user: { id: "u1", roles: [], onboardingCompleted: true, hasPhone: true } })) });
      await signInPromise;
    });
    expect(result.current.isSigningIn).toBe(false);
  });

  it("registers then signs in, posting registration and login separately", async () => {
    mockFetchResponses({
      "/api/v1/auth/register": okEnvelope({ id: "u1" }),
      "/mobile/auth/login": okEnvelope({
        accessToken: "at-1",
        refreshToken: "rt-1",
        user: { id: "u1", name: "Ayesha", roles: ["patient"], onboardingCompleted: true, hasPhone: true },
      }),
    });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.registerWithCredentials({
        name: "Ayesha",
        email: "ayesha@example.com",
        password: "secret1",
        confirmPassword: "secret1",
        phone: "0300",
        city: "Lahore",
        dateOfBirth: "1996-01-01",
        accountType: "patient",
      });
    });

    expect(result.current.user?.name).toBe("Ayesha");
  });

  it("clears tokens and user on sign out", async () => {
    await SecureStore.setItemAsync("zc_access_token", "at-1");
    await SecureStore.setItemAsync("zc_refresh_token", "rt-1");
    mockFetchResponses({
      "/auth/me": okEnvelope({ user: { id: "u1", name: "Ayesha", roles: ["patient"], onboardingCompleted: true, hasPhone: true } }),
    });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.name).toBe("Ayesha"));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
    expect(await SecureStore.getItemAsync("zc_access_token")).toBeNull();
    expect(unregisterCurrentPushToken).toHaveBeenCalled();
  });
});
