/**
 * callbackUrl survives login → register → login so users land where they were
 * headed, but it is attacker-controllable query input: only same-site paths
 * may be honoured, or auth becomes an open redirect.
 */
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { resolveLoginRedirectPath } from "@/lib/auth/routes";

describe("safeCallbackUrl", () => {
  test.each([
    ["/appointments/book", "/appointments/book"],
    ["/doctors/dr-ali?tab=reviews", "/doctors/dr-ali?tab=reviews"],
    ["/sunday-consult#request", "/sunday-consult#request"],
    ["  /dashboard  ", "/dashboard"],
  ])("accepts same-site path %p", (input, expected) => {
    expect(safeCallbackUrl(input)).toBe(expected);
  });

  test.each([
    "https://evil.com",
    "http://evil.com/dashboard",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "javascript:alert(1)",
    "data:text/html,hi",
    "dashboard",
    "",
    undefined,
    null,
    42,
  ])("rejects %p", (input) => {
    expect(safeCallbackUrl(input)).toBeUndefined();
  });
});

describe("resolveLoginRedirectPath", () => {
  const patient = { roles: ["patient" as const], onboardingCompleted: true, hasPhone: true };

  test("honours a safe callback", () => {
    expect(resolveLoginRedirectPath(patient, "/appointments/book")).toBe("/appointments/book");
  });

  test("falls back to the role default for an off-site callback", () => {
    expect(resolveLoginRedirectPath(patient, "https://evil.com")).toBe(
      resolveLoginRedirectPath(patient),
    );
    expect(resolveLoginRedirectPath(patient, "//evil.com")).not.toContain("evil.com");
  });
});
