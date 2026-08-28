import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { API_URL } from "./config";
import { clearStoredTokens, getStoredTokens, setStoredTokens } from "./token-storage";
import type { AuthUser } from "@/api/client";

/**
 * @react-native-google-signin/google-signin is a third-party native module —
 * unlike expo-sharing/expo-location/etc. it's never bundled into the Expo Go
 * client, so importing/calling it there throws "Cannot find native module".
 * Guard it so the rest of the app (email/password auth included) still works
 * when testing in plain Expo Go; only Google sign-in itself is unavailable.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

let GoogleSignin: GoogleSigninModule["GoogleSignin"] | null = null;
let isSuccessResponse: GoogleSigninModule["isSuccessResponse"] | null = null;

if (!isExpoGo) {
  const googleSignInModule = require("@react-native-google-signin/google-signin") as GoogleSigninModule;
  const { GoogleSignin: NativeGoogleSignin, isSuccessResponse: nativeIsSuccessResponse } = googleSignInModule;
  NativeGoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  });
  GoogleSignin = NativeGoogleSignin;
  isSuccessResponse = nativeIsSuccessResponse;
}

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  city: string;
  dateOfBirth: string;
  accountType: string;
};

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  isSigningIn: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithCredentials: (email: string, password: string) => Promise<void>;
  registerWithCredentials: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message ?? "Something went wrong");
  }
  return json.data;
}

async function exchangeGoogleIdToken(idToken: string): Promise<AuthUser> {
  const data = await postJson("/api/v1/mobile/auth/google", { idToken });
  await setStoredTokens(data.accessToken, data.refreshToken);
  return data.user as AuthUser;
}

async function loginWithCredentials(email: string, password: string): Promise<AuthUser> {
  const data = await postJson("/api/v1/mobile/auth/login", { email, password });
  await setStoredTokens(data.accessToken, data.refreshToken);
  return data.user as AuthUser;
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
        if (!GoogleSignin || !isSuccessResponse) {
          throw new Error("Google sign-in isn't available in Expo Go — use email/password, or run a dev client build.");
        }
        setIsSigningIn(true);
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();
          if (!isSuccessResponse(response) || !response.data.idToken) {
            return;
          }
          const authedUser = await exchangeGoogleIdToken(response.data.idToken);
          setUser(authedUser);
        } finally {
          setIsSigningIn(false);
        }
      },
      signInWithCredentials: async (email: string, password: string) => {
        setIsSigningIn(true);
        try {
          const authedUser = await loginWithCredentials(email, password);
          setUser(authedUser);
        } finally {
          setIsSigningIn(false);
        }
      },
      registerWithCredentials: async (input: RegisterInput) => {
        setIsSigningIn(true);
        try {
          await postJson("/api/v1/auth/register", input);
          const authedUser = await loginWithCredentials(input.email, input.password);
          setUser(authedUser);
        } finally {
          setIsSigningIn(false);
        }
      },
      signOut: async () => {
        await clearStoredTokens();
        try {
          await GoogleSignin?.signOut();
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
