/**
 * Shared auth infra behind BE-002: resolveSession(req) must keep BOTH
 * supported clients working — the web cookie session (via next-auth's
 * auth()) and the mobile Bearer access token — without inventing a second
 * auth mechanism. No DB access: every dependency is mocked.
 */
const mockAuth = jest.fn();
const mockVerifyMobileToken = jest.fn();
const mockLoadAuthUserPayload = jest.fn();

jest.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

jest.mock("@/server/api/mobile-jwt", () => ({
  verifyMobileToken: (...args: unknown[]) => mockVerifyMobileToken(...args),
}));

jest.mock("@/server/services/auth.service", () => ({
  loadAuthUserPayload: (...args: unknown[]) => mockLoadAuthUserPayload(...args),
}));

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/doctor/bank-account", { headers });
}

describe("resolveSession(req) — shared web + mobile auth resolver", () => {
  beforeEach(() => {
    jest.resetModules();
    mockAuth.mockReset();
    mockVerifyMobileToken.mockReset();
    mockLoadAuthUserPayload.mockReset();
  });

  test("BE002-T13 support: no Authorization header falls back to the web cookie session", async () => {
    const cookieSession = { user: { id: "web-user-1", roles: ["doctor"] } };
    mockAuth.mockResolvedValue(cookieSession);

    const { resolveSession } = await import("@/server/api/resolve-session");
    const session = await resolveSession(makeRequest());

    expect(session).toEqual(cookieSession);
    expect(mockAuth).toHaveBeenCalledTimes(1);
    expect(mockVerifyMobileToken).not.toHaveBeenCalled();
  });

  test("BE002-T14 support: a Bearer token uses the mobile JWT path, not the cookie session", async () => {
    mockVerifyMobileToken.mockResolvedValue({ sub: "mobile-user-1" });
    mockLoadAuthUserPayload.mockResolvedValue({ id: "mobile-user-1", roles: ["doctor"] });

    const { resolveSession } = await import("@/server/api/resolve-session");
    const session = await resolveSession(makeRequest({ authorization: "Bearer good-token" }));

    expect(session).toEqual({
      user: { id: "mobile-user-1", roles: ["doctor"] },
      expires: expect.any(String),
    });
    expect(mockVerifyMobileToken).toHaveBeenCalledWith("good-token", "access");
    expect(mockAuth).not.toHaveBeenCalled();
  });

  test("an invalid Bearer token returns null and does not fall back to the cookie session", async () => {
    mockVerifyMobileToken.mockRejectedValue(new Error("bad token"));

    const { resolveSession } = await import("@/server/api/resolve-session");
    const session = await resolveSession(makeRequest({ authorization: "Bearer garbage" }));

    expect(session).toBeNull();
    expect(mockAuth).not.toHaveBeenCalled();
  });

  test("a Bearer token for a deleted/inactive user returns null", async () => {
    mockVerifyMobileToken.mockResolvedValue({ sub: "deleted-user" });
    mockLoadAuthUserPayload.mockResolvedValue(null);

    const { resolveSession } = await import("@/server/api/resolve-session");
    const session = await resolveSession(makeRequest({ authorization: "Bearer good-token" }));

    expect(session).toBeNull();
  });

  describe("edge cases: malformed/hostile Authorization headers fail closed", () => {
    test("lowercase 'bearer' prefix is not treated as a mobile token (falls back to cookie session, which is absent here)", async () => {
      mockAuth.mockResolvedValue(null);
      const { resolveSession } = await import("@/server/api/resolve-session");
      const session = await resolveSession(makeRequest({ authorization: "bearer some-token" }));

      expect(session).toBeNull();
      expect(mockVerifyMobileToken).not.toHaveBeenCalled();
      expect(mockAuth).toHaveBeenCalledTimes(1);
    });

    test("'Bearer' with no trailing space/token falls back to cookie session, not the mobile path", async () => {
      mockAuth.mockResolvedValue(null);
      const { resolveSession } = await import("@/server/api/resolve-session");
      const session = await resolveSession(makeRequest({ authorization: "Bearer" }));

      expect(session).toBeNull();
      expect(mockVerifyMobileToken).not.toHaveBeenCalled();
    });

    test("'Bearer ' followed by only whitespace never verifies an empty token as valid", async () => {
      // The Headers implementation strips trailing OWS from header values, so
      // "Bearer    " arrives as "Bearer" and takes the same safe fallback path
      // as the no-token case above. Whichever path it takes, an empty/missing
      // token must never reach a successful mobile verification.
      mockAuth.mockResolvedValue(null);
      mockVerifyMobileToken.mockRejectedValue(new Error("empty token"));

      const { resolveSession } = await import("@/server/api/resolve-session");
      const session = await resolveSession(makeRequest({ authorization: "Bearer    " }));

      expect(session).toBeNull();
      if (mockVerifyMobileToken.mock.calls.length > 0) {
        expect(mockVerifyMobileToken).toHaveBeenCalledWith("", "access");
      }
    });

    test("extra internal whitespace around the token is trimmed before verification", async () => {
      mockVerifyMobileToken.mockResolvedValue({ sub: "mobile-user-1" });
      mockLoadAuthUserPayload.mockResolvedValue({ id: "mobile-user-1", roles: ["doctor"] });

      const { resolveSession } = await import("@/server/api/resolve-session");
      const session = await resolveSession(makeRequest({ authorization: "Bearer   good-token   " }));

      expect(mockVerifyMobileToken).toHaveBeenCalledWith("good-token", "access");
      expect(session?.user).toEqual({ id: "mobile-user-1", roles: ["doctor"] });
    });

    test("an Authorization header with no Bearer scheme at all falls back to cookie auth, not a crash", async () => {
      mockAuth.mockResolvedValue(null);
      const { resolveSession } = await import("@/server/api/resolve-session");
      const session = await resolveSession(makeRequest({ authorization: "raw-token-no-scheme" }));

      expect(session).toBeNull();
      expect(mockVerifyMobileToken).not.toHaveBeenCalled();
    });

    test("a valid-looking token whose downstream user lookup throws is treated as unauthenticated, not a 500", async () => {
      mockVerifyMobileToken.mockResolvedValue({ sub: "some-user" });
      mockLoadAuthUserPayload.mockRejectedValue(new Error("db unavailable"));

      const { resolveSession } = await import("@/server/api/resolve-session");
      const session = await resolveSession(makeRequest({ authorization: "Bearer good-token" }));

      expect(session).toBeNull();
    });

    test("an absurdly long Bearer token does not crash resolution and is still rejected on verify failure", async () => {
      mockVerifyMobileToken.mockRejectedValue(new Error("malformed token"));
      const hugeToken = "a".repeat(50_000);

      const { resolveSession } = await import("@/server/api/resolve-session");
      const session = await resolveSession(makeRequest({ authorization: `Bearer ${hugeToken}` }));

      expect(session).toBeNull();
    });
  });

  describe("stress: repeated/interleaved calls never leak state between requests", () => {
    test("100 sequential unauthorized Bearer attempts all resolve to null, cookie auth is never consulted", async () => {
      mockVerifyMobileToken.mockRejectedValue(new Error("invalid"));
      const { resolveSession } = await import("@/server/api/resolve-session");

      for (let i = 0; i < 100; i++) {
        const session = await resolveSession(makeRequest({ authorization: `Bearer bad-token-${i}` }));
        expect(session).toBeNull();
      }
      expect(mockAuth).not.toHaveBeenCalled();
    });

    test("interleaving two different mobile users never returns the wrong user's session", async () => {
      const { resolveSession } = await import("@/server/api/resolve-session");

      for (let i = 0; i < 50; i++) {
        const userId = i % 2 === 0 ? "mobile-user-A" : "mobile-user-B";
        mockVerifyMobileToken.mockResolvedValueOnce({ sub: userId });
        mockLoadAuthUserPayload.mockResolvedValueOnce({ id: userId, roles: ["doctor"] });

        const session = await resolveSession(makeRequest({ authorization: `Bearer token-for-${userId}` }));
        expect(session?.user?.id).toBe(userId);
      }
    });
  });
});
