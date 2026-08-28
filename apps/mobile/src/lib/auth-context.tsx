import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { API_URL } from "./config";
import { clearStoredTokens, getStoredTokens, setStoredTokens } from "./token-storage";
import type { AuthUser } from "@/api/client";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
});

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  isSigningIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function exchangeGoogleIdToken(idToken: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/v1/mobile/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message ?? "Google sign-in failed");
  }
  await setStoredTokens(json.data.accessToken, json.data.refreshToken);
  return json.data.user as AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    (async () => {
      const { accessToken } = await getStoredTokens();
      if (!accessToken) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await fetch(`${API_URL}/api/v1/mobile/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());
        if (me.success) setUser(me.data.user);
      } catch {
        // Stay signed out silently — user can retry via signInWithGoogle.
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isSigningIn,
      signInWithGoogle: async () => {
        setIsSigningIn(true);
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();
          if (!isSuccessResponse(response) || !response.data.idToken) {
            return;
          }
          const authedUser = await exchangeGoogleIdToken(response.data.idToken);
          setUser(authedUser);
        } catch (err) {
          console.warn("Google sign-in failed", err);
        } finally {
          setIsSigningIn(false);
        }
      },
      signOut: async () => {
        await clearStoredTokens();
        try {
          await GoogleSignin.signOut();
        } catch {
          // Not signed in via GoogleSignin (e.g. session restored from stored tokens) — fine.
        }
        setUser(null);
      },
    }),
    [user, isLoading, isSigningIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
