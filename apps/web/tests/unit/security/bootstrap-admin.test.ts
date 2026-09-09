/**
 * BE-001: /api/internal/bootstrap-admin must not be a public admin-takeover
 * door. These tests describe the required behavior BEFORE the route is
 * fixed — run them first and expect failures against the current code.
 *
 * No DB access: bootstrapAdminUser is mocked, never the real service.
 */
import fs from "fs";
import path from "path";

const mockBootstrapAdminUser = jest.fn();

jest.mock("@/server/services/notification.service", () => ({
  bootstrapAdminUser: (...args: unknown[]) => mockBootstrapAdminUser(...args),
}));

const SECRET_HEADER = "x-bootstrap-secret";
const SECRET_ENV = "BOOTSTRAP_ADMIN_SECRET";
const VALID_SECRET = "unit-test-bootstrap-secret";
const HARDCODED_PASSWORD = "Admin@12345";
const ROUTE_SOURCE_PATH = path.join(
  __dirname,
  "../../../src/app/api/internal/bootstrap-admin/route.ts",
);

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/internal/bootstrap-admin", {
    method: "POST",
    headers,
  });
}

async function loadRoute() {
  return import("@/app/api/internal/bootstrap-admin/route");
}

describe("BE-001: bootstrap-admin security", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    mockBootstrapAdminUser.mockReset();
    mockBootstrapAdminUser.mockResolvedValue({
      created: true,
      email: "admin@zindagicare.pk",
      userId: "mock-admin-id",
      message: "Admin created.",
    });

    process.env = { ...originalEnv };
    delete process.env.ALLOW_BOOTSTRAP_ADMIN;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    process.env[SECRET_ENV] = VALID_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("BE001-T01: GET must not exist (no credential-disclosure endpoint)", async () => {
    const route = await loadRoute();
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });

  test("BE001-T02: POST without a secret is rejected and never bootstraps", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest());
    expect([401, 403]).toContain(res.status);
    expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
  });

  test("BE001-T03: POST with an incorrect secret is rejected and never bootstraps", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ [SECRET_HEADER]: "totally-wrong" }));
    expect([401, 403]).toContain(res.status);
    expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
  });

  test("BE001-T04: POST with the correct secret reaches the real bootstrap logic", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ [SECRET_HEADER]: VALID_SECRET }));
    expect(res.status).toBe(200);
    expect(mockBootstrapAdminUser).toHaveBeenCalledTimes(1);
  });

  test("BE001-T05: source contains no hardcoded fallback password", () => {
    const source = fs.readFileSync(ROUTE_SOURCE_PATH, "utf8");
    expect(source).not.toContain(HARDCODED_PASSWORD);
  });

  test("BE001-T06: a successful response never contains the admin password", async () => {
    process.env.BOOTSTRAP_ADMIN_PASSWORD = "configured-secret-password-1";
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ [SECRET_HEADER]: VALID_SECRET }));
    const text = await res.text();
    expect(text).not.toContain("configured-secret-password-1");
    expect(text.toLowerCase()).not.toContain("password");
  });

  test("BE001-T06b: a rejected response never contains the admin password", async () => {
    process.env.BOOTSTRAP_ADMIN_PASSWORD = "configured-secret-password-2";
    const { POST } = await loadRoute();
    const res = await POST(makeRequest());
    const text = await res.text();
    expect(text).not.toContain("configured-secret-password-2");
    expect(text).not.toContain(HARDCODED_PASSWORD);
  });

  test("BE001-T07: NODE_ENV alone must not authorize bootstrap (outside production)", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    const { POST } = await loadRoute();
    const res = await POST(makeRequest()); // no secret
    expect([401, 403]).toContain(res.status);
    expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
  });

  test("BE001-T07b: NODE_ENV=development with the correct secret still works", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ [SECRET_HEADER]: VALID_SECRET }));
    expect(res.status).toBe(200);
    expect(mockBootstrapAdminUser).toHaveBeenCalledTimes(1);
  });

  test("BE001-T08: ALLOW_BOOTSTRAP_ADMIN cannot substitute for the secret", async () => {
    process.env.ALLOW_BOOTSTRAP_ADMIN = "true";
    const { POST } = await loadRoute();
    const res = await POST(makeRequest()); // no secret header
    expect([401, 403]).toContain(res.status);
    expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
  });

  test("BE001-T09: repeated unauthorized attempts never invoke the bootstrap function", async () => {
    const { POST } = await loadRoute();
    await POST(makeRequest());
    await POST(makeRequest({ [SECRET_HEADER]: "" }));
    await POST(makeRequest({ [SECRET_HEADER]: "still-wrong" }));
    expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
  });

  describe("edge cases: secret comparison cannot be bypassed", () => {
    test("secret comparison is case-sensitive — different case is rejected", async () => {
      const { POST } = await loadRoute();
      const res = await POST(makeRequest({ [SECRET_HEADER]: VALID_SECRET.toUpperCase() }));
      expect([401, 403]).toContain(res.status);
      expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
    });

    test("a secret with internal-but-wrong padding does not match (exact string comparison)", async () => {
      const { POST } = await loadRoute();
      const res = await POST(makeRequest({ [SECRET_HEADER]: `${VALID_SECRET}x` }));
      expect([401, 403]).toContain(res.status);
      expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
    });

    test("CRLF header injection in the secret is rejected by the platform before the route ever sees it", () => {
      // The Headers API itself throws on an invalid (CR/LF-containing) header
      // value, so this attack can't reach the route's comparison logic at all.
      expect(() => makeRequest({ [SECRET_HEADER]: "x\r\nInjected: true" })).toThrow();
    });

    test("a secret that is merely a prefix/substring of the real one is rejected", async () => {
      const { POST } = await loadRoute();
      const res = await POST(makeRequest({ [SECRET_HEADER]: VALID_SECRET.slice(0, -1) }));
      expect([401, 403]).toContain(res.status);
      expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
    });

    test("passing the secret as a query parameter instead of the header is rejected", async () => {
      const { POST } = await loadRoute();
      const req = new Request(
        `http://localhost/api/internal/bootstrap-admin?${SECRET_HEADER}=${VALID_SECRET}`,
        { method: "POST" },
      );
      const res = await POST(req);
      expect([401, 403]).toContain(res.status);
      expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
    });

    test("an unset BOOTSTRAP_ADMIN_SECRET (empty string) fails closed even if the header is also empty", async () => {
      process.env[SECRET_ENV] = "";
      const { POST } = await loadRoute();
      const res = await POST(makeRequest({ [SECRET_HEADER]: "" }));
      expect([401, 403]).toContain(res.status);
      expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
    });

    test("a very large garbage secret does not crash the handler and is still rejected", async () => {
      const { POST } = await loadRoute();
      const res = await POST(makeRequest({ [SECRET_HEADER]: "x".repeat(100_000) }));
      expect([401, 403]).toContain(res.status);
      expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
    });
  });

  describe("stress: unauthorized attempts never slip through under load", () => {
    test("50 rapid sequential requests with varying wrong/missing secrets never call bootstrap, valid one still works after", async () => {
      const { POST } = await loadRoute();
      for (let i = 0; i < 50; i++) {
        const headers: Record<string, string> = i % 2 === 0 ? {} : { [SECRET_HEADER]: `attempt-${i}` };
        const res = await POST(makeRequest(headers));
        expect([401, 403]).toContain(res.status);
      }
      expect(mockBootstrapAdminUser).not.toHaveBeenCalled();

      const res = await POST(makeRequest({ [SECRET_HEADER]: VALID_SECRET }));
      expect(res.status).toBe(200);
      expect(mockBootstrapAdminUser).toHaveBeenCalledTimes(1);
    });

    test("50 concurrent (Promise.all) unauthorized requests never call bootstrap", async () => {
      const { POST } = await loadRoute();
      const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) => POST(makeRequest({ [SECRET_HEADER]: `bad-${i}` }))),
      );
      for (const res of results) {
        expect([401, 403]).toContain(res.status);
      }
      expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
    });
  });

  describe("hardening: response shape and secret comparison", () => {
    test("a successful response never leaks fields the service happens to return, even a literal 'password' key", async () => {
      mockBootstrapAdminUser.mockResolvedValue({
        created: true,
        email: "admin@zindagicare.pk",
        userId: "mock-admin-id",
        message: "should be ignored",
        password: "leaked-if-spread-blindly",
      });

      const { POST } = await loadRoute();
      const res = await POST(makeRequest({ [SECRET_HEADER]: VALID_SECRET }));
      const body = await res.json();

      expect(body).toEqual({
        success: true,
        created: true,
        email: "admin@zindagicare.pk",
        userId: "mock-admin-id",
        message: expect.any(String),
        loginUrl: "/login?callbackUrl=/admin",
      });
    });

    test("secret comparison of differing lengths does not throw and is still rejected", async () => {
      const { POST } = await loadRoute();
      const res = await POST(makeRequest({ [SECRET_HEADER]: VALID_SECRET + "-extra-long-tail" }));
      expect([401, 403]).toContain(res.status);
      expect(mockBootstrapAdminUser).not.toHaveBeenCalled();
    });

    test("a correct secret of matching length still authorizes (constant-time compare didn't break the happy path)", async () => {
      const { POST } = await loadRoute();
      const res = await POST(makeRequest({ [SECRET_HEADER]: VALID_SECRET }));
      expect(res.status).toBe(200);
      expect(mockBootstrapAdminUser).toHaveBeenCalledTimes(1);
    });
  });
});
