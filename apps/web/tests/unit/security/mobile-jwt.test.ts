/**
 * Edge-case / attack-surface tests for verifyMobileToken, the primitive that
 * resolveSession's Bearer-token branch trusts. Pure crypto (jose) — no DB,
 * no network, no mocks of the function under test itself.
 */
import { SignJWT } from "jose";

const AUTH_SECRET = "unit-test-auth-secret-value-please-ignore";
const OTHER_SECRET = "a-completely-different-secret-value";

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

async function signToken(
  claims: Record<string, unknown>,
  opts: {
    secret?: string;
    subject?: string;
    expiresIn?: string | number;
    issuedInPast?: boolean;
    alg?: string;
  } = {},
) {
  let builder = new SignJWT(claims).setProtectedHeader({ alg: opts.alg ?? "HS256" });
  if (opts.subject !== undefined) builder = builder.setSubject(opts.subject);
  builder = builder.setIssuedAt();
  builder = builder.setExpirationTime(opts.expiresIn ?? "1h");
  return builder.sign(key(opts.secret ?? AUTH_SECRET));
}

describe("verifyMobileToken — edge cases that could break mobile Bearer auth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, AUTH_SECRET };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("a correctly signed access token verifies and returns its subject", async () => {
    const { verifyMobileToken } = await import("@/server/api/mobile-jwt");
    const token = await signToken({ typ: "access" }, { subject: "doctor-a-id" });
    const payload = await verifyMobileToken(token, "access");
    expect(payload.sub).toBe("doctor-a-id");
  });

  test("a refresh token presented where an access token is expected is rejected", async () => {
    const { verifyMobileToken } = await import("@/server/api/mobile-jwt");
    const token = await signToken({ typ: "refresh" }, { subject: "doctor-a-id" });
    await expect(verifyMobileToken(token, "access")).rejects.toThrow();
  });

  test("an expired access token is rejected", async () => {
    const { verifyMobileToken } = await import("@/server/api/mobile-jwt");
    const token = await signToken(
      { typ: "access" },
      { subject: "doctor-a-id", expiresIn: Math.floor(Date.now() / 1000) - 60 },
    );
    await expect(verifyMobileToken(token, "access")).rejects.toThrow();
  });

  test("a token signed with the wrong secret (forged) is rejected", async () => {
    const { verifyMobileToken } = await import("@/server/api/mobile-jwt");
    const token = await signToken(
      { typ: "access" },
      { subject: "doctor-a-id", secret: OTHER_SECRET },
    );
    await expect(verifyMobileToken(token, "access")).rejects.toThrow();
  });

  test("a token missing a subject claim is rejected", async () => {
    const { verifyMobileToken } = await import("@/server/api/mobile-jwt");
    const token = await signToken({ typ: "access" }); // no setSubject(...)
    await expect(verifyMobileToken(token, "access")).rejects.toThrow();
  });

  test("a tampered payload (signature no longer matches) is rejected", async () => {
    const { verifyMobileToken } = await import("@/server/api/mobile-jwt");
    const token = await signToken({ typ: "access" }, { subject: "doctor-a-id" });
    const [h, , s] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ typ: "access", sub: "doctor-b-id" }),
    ).toString("base64url");
    const tampered = `${h}.${tamperedPayload}.${s}`;
    await expect(verifyMobileToken(tampered, "access")).rejects.toThrow();
  });

  test("garbage / non-JWT input is rejected without throwing an unhandled type error", async () => {
    const { verifyMobileToken } = await import("@/server/api/mobile-jwt");
    await expect(verifyMobileToken("not-a-jwt-at-all", "access")).rejects.toThrow();
    await expect(verifyMobileToken("", "access")).rejects.toThrow();
    await expect(verifyMobileToken("a.b.c", "access")).rejects.toThrow();
  });

  test("an unsigned 'alg: none' token is rejected", async () => {
    const { verifyMobileToken } = await import("@/server/api/mobile-jwt");
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    );
    const payload = Buffer.from(
      JSON.stringify({ typ: "access", sub: "doctor-a-id" }),
    ).toString("base64url");
    const unsigned = `${header}.${payload}.`;
    await expect(verifyMobileToken(unsigned, "access")).rejects.toThrow();
  });

  test("stress: 100 forged/garbage tokens in a row are all rejected, none ever verify", async () => {
    const { verifyMobileToken } = await import("@/server/api/mobile-jwt");
    const attempts = Array.from({ length: 100 }, (_, i) =>
      i % 2 === 0 ? `garbage-token-${i}` : signToken({ typ: "access" }, { subject: `x${i}`, secret: OTHER_SECRET }),
    );
    const results = await Promise.allSettled(
      attempts.map(async (t) => verifyMobileToken(await t, "access")),
    );
    expect(results.every((r) => r.status === "rejected")).toBe(true);
  });
});
