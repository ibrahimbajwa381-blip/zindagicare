/**
 * End-to-end callbackUrl hand-off through the auth server actions:
 * protected page → login → (no account) register → login → original page.
 * No DB access: every dependency is mocked.
 */
const mockSignIn = jest.fn();
const mockFindUserByEmail = jest.fn();
const mockIsEmailRegistered = jest.fn();
const mockVerifyCredentialsLogin = jest.fn();
const mockLoadAuthUserPayload = jest.fn();
const mockRegisterWithCredentials = jest.fn();

// next-auth ships ESM-only; a minimal stand-in keeps the error classes the actions check.
jest.mock("next-auth", () => {
  class AuthError extends Error {
    type = "AuthError";
  }
  class CredentialsSignin extends AuthError {
    type = "CredentialsSignin";
  }
  return { AuthError, CredentialsSignin };
});
jest.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
jest.mock("@/lib/auth", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));
jest.mock("@/server/lib/visitor-id", () => ({ readVisitorId: async () => undefined }));
jest.mock("@/i18n/server", () => ({ getLocale: async () => "en" }));
jest.mock("@/server/services/doctor-referral.service", () => ({
  REFERRAL_COOKIE_NAME: "ref",
  resolveReferralDoctorId: async () => undefined,
}));
jest.mock("@/server/services/auth.service", () => ({
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  isEmailRegistered: (...args: unknown[]) => mockIsEmailRegistered(...args),
  verifyCredentialsLogin: (...args: unknown[]) => mockVerifyCredentialsLogin(...args),
  loadAuthUserPayload: (...args: unknown[]) => mockLoadAuthUserPayload(...args),
  registerWithCredentials: (...args: unknown[]) => mockRegisterWithCredentials(...args),
}));

import { CredentialsSignin } from "next-auth";
import {
  loginWithCredentialsAction,
  registerAction,
} from "@/server/actions/auth.actions";

function form(fields: Record<string, string | undefined>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

/** Runs a server action and returns the URL it redirected to (or throws). */
async function redirectTarget(run: () => Promise<unknown>): Promise<string> {
  try {
    const result = await run();
    throw new Error(`Expected a redirect, got ${JSON.stringify(result)}`);
  } catch (e) {
    const digest = (e as { digest?: string }).digest;
    if (!digest?.startsWith("NEXT_REDIRECT")) throw e;
    return digest.split(";")[2];
  }
}

function callbackOf(url: string) {
  return new URL(url, "http://x").searchParams.get("callbackUrl");
}

const login = (email: string, callbackUrl?: string) =>
  form({ email, password: "secret123", callbackUrl });

const registration = (callbackUrl?: string) =>
  form({
    name: "New Patient",
    email: "new@example.com",
    password: "secret123",
    confirmPassword: "secret123",
    phone: "03001234567",
    city: "Lahore",
    dateOfBirth: "1990-01-01",
    termsAccepted: "true",
    accountType: "patient",
    callbackUrl,
  });

const existingPatient = { _id: "u1" };
const freshPatient = { roles: ["patient"], onboardingCompleted: false, hasPhone: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockRegisterWithCredentials.mockResolvedValue(undefined);
});

describe("no-account redirect flow", () => {
  test("unknown email → register, carrying the original destination", async () => {
    mockSignIn.mockRejectedValue(new CredentialsSignin());
    mockIsEmailRegistered.mockResolvedValue(false);

    const url = await redirectTarget(() =>
      loginWithCredentialsAction(undefined, login("nobody@example.com", "/appointments/book?doctor=7")),
    );

    expect(url.startsWith("/register?")).toBe(true);
    expect(new URL(url, "http://x").searchParams.get("reason")).toBe("no-account");
    expect(callbackOf(url)).toBe("/appointments/book?doctor=7");
  });

  test("unknown email with an off-site callback → register without it", async () => {
    mockSignIn.mockRejectedValue(new CredentialsSignin());
    mockIsEmailRegistered.mockResolvedValue(false);

    const url = await redirectTarget(() =>
      loginWithCredentialsAction(undefined, login("nobody@example.com", "https://evil.com")),
    );

    expect(url).toBe("/register?reason=no-account");
  });

  test("wrong password on an existing account still shows the error (unchanged)", async () => {
    mockSignIn.mockRejectedValue(new CredentialsSignin());
    mockIsEmailRegistered.mockResolvedValue(true);

    const result = await loginWithCredentialsAction(undefined, login("me@example.com", "/x"));

    expect(result).toEqual({ error: expect.any(String) });
  });

  test("deactivated or deleted account shows the login error, not register", async () => {
    // findUserByEmail hides these accounts, but their email still blocks signup.
    mockSignIn.mockRejectedValue(new CredentialsSignin());
    mockFindUserByEmail.mockResolvedValue(null);
    mockIsEmailRegistered.mockResolvedValue(true);

    const result = await loginWithCredentialsAction(undefined, login("gone@example.com", "/x"));

    expect(result).toEqual({ error: expect.any(String) });
  });
});

describe("signup flow", () => {
  test("register → login keeps the destination", async () => {
    const url = await redirectTarget(() => registerAction(undefined, registration("/appointments/book")));
    expect(url).toBe("/login?callbackUrl=%2Fappointments%2Fbook");
  });

  test("register without a destination → plain login (unchanged)", async () => {
    const url = await redirectTarget(() => registerAction(undefined, registration()));
    expect(url).toBe("/login");
  });

  test.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)"])(
    "register drops unsafe callback %p",
    async (callbackUrl) => {
      const url = await redirectTarget(() => registerAction(undefined, registration(callbackUrl)));
      expect(url).toBe("/login");
    },
  );

  test("login after signup lands on the original destination", async () => {
    mockSignIn.mockResolvedValue(undefined);
    mockFindUserByEmail.mockResolvedValue(existingPatient);
    mockLoadAuthUserPayload.mockResolvedValue(freshPatient);
    mockVerifyCredentialsLogin.mockResolvedValue(freshPatient);

    const url = await redirectTarget(() =>
      loginWithCredentialsAction(undefined, login("new@example.com", "/appointments/book")),
    );

    expect(url).toBe("/appointments/book");
  });

  test("login with an off-site callback falls back to the default path", async () => {
    mockSignIn.mockResolvedValue(undefined);
    mockFindUserByEmail.mockResolvedValue(existingPatient);
    mockLoadAuthUserPayload.mockResolvedValue(freshPatient);
    mockVerifyCredentialsLogin.mockResolvedValue(freshPatient);

    const url = await redirectTarget(() =>
      loginWithCredentialsAction(undefined, login("new@example.com", "https://evil.com")),
    );

    expect(url).toBe("/onboarding");
  });
});
