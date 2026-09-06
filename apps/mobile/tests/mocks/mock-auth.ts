import type { AuthUser } from "@/api/client";
import type { Role } from "@/lib/domain-types";

export function makeAuthUser(overrides: Partial<AuthUser> & { roles?: Role[] } = {}): AuthUser {
  return {
    id: "user-1",
    email: "patient@example.com",
    name: "Test Patient",
    image: undefined,
    roles: ["patient"],
    onboardingCompleted: true,
    hasPhone: true,
    ...overrides,
  };
}

export function makeMockAuth(overrides: Record<string, unknown> = {}) {
  return {
    user: null,
    isLoading: false,
    isSigningIn: false,
    signInWithGoogle: jest.fn(),
    signInWithCredentials: jest.fn(),
    registerWithCredentials: jest.fn(),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
    ...overrides,
  };
}
