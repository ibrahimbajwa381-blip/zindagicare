/**
 * The forgot-password / phone-OTP sign-in flow was removed. Any route, provider,
 * model or schema left behind is an unmaintained way into an account, so this
 * guards against parts of it surviving or quietly coming back.
 * No DB access: static checks over the source tree plus pure route helpers.
 */
import fs from "fs";
import path from "path";
import { AUTH_ROUTES, PUBLIC_PATH_PREFIXES } from "@/lib/auth/routes";
import * as authSchemas from "@zindagi/validators/auth.schema";

const WEB_ROOT = path.resolve(__dirname, "../../..");
const REPO_ROOT = path.resolve(WEB_ROOT, "../..");
const SCANNED_DIRS = [
  path.join(WEB_ROOT, "src"),
  path.join(REPO_ROOT, "packages/database/src"),
  path.join(REPO_ROOT, "packages/validators/src"),
  path.join(REPO_ROOT, "packages/shared/src"),
];

function sourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const files = SCANNED_DIRS.flatMap(sourceFiles);

describe("removed forgot-password / OTP flow", () => {
  it("scans a real source tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each([
    "src/app/(auth)/login/forgot-password",
    "src/app/(auth)/login/phone",
    "src/app/api/v1/auth/otp",
    "src/features/auth/components/phone-otp-form.tsx",
    "src/server/services/otp.service.ts",
  ])("%s no longer exists", (relative) => {
    expect(fs.existsSync(path.join(WEB_ROOT, relative))).toBe(false);
  });

  it("the OTP challenge model is gone from the database package", () => {
    const modelsDir = path.join(REPO_ROOT, "packages/database/src/models");
    expect(fs.existsSync(path.join(modelsDir, "otp-challenge.model.ts"))).toBe(false);
    expect(fs.readFileSync(path.join(modelsDir, "index.ts"), "utf8")).not.toMatch(/otp/i);
  });

  it("no source file references the removed flow", () => {
    const forbidden =
      /forgot-?password|forgotPassword|login\/phone|auth\/otp|phoneLogin|OtpChallenge|otp\.service|phone-otp|resetPassword|passwordReset/;
    const offenders = files.filter((file) => forbidden.test(fs.readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(REPO_ROOT, file))).toEqual([]);
  });

  it("no auth route or public path points at the removed pages or API", () => {
    const routes = Object.values(AUTH_ROUTES) as string[];
    for (const value of [...routes, ...PUBLIC_PATH_PREFIXES]) {
      expect(value).not.toMatch(/forgot|otp|\/login\/phone/i);
    }
    expect(AUTH_ROUTES).not.toHaveProperty("forgotPassword");
    expect(AUTH_ROUTES).not.toHaveProperty("phoneLogin");
  });

  it("auth validators export no OTP or password-reset schemas", () => {
    const names = Object.keys(authSchemas);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => /otp|reset|forgot/i.test(name))).toEqual([]);
  });

  it("Auth.js signs in only with email+password credentials or Google", () => {
    const authSource = fs.readFileSync(path.join(WEB_ROOT, "src/lib/auth/auth.ts"), "utf8");
    expect(authSource.match(/Credentials\(/g)).toHaveLength(1);
    expect([...authSource.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1])).toEqual([
      "credentials",
    ]);
    expect(authSource).not.toMatch(/otp|phoneLogin|phone-otp|credentials\.phone/i);
  });

  it("the login form has no forgot-password link", () => {
    const form = fs.readFileSync(
      path.join(WEB_ROOT, "src/features/auth/components/login-form.tsx"),
      "utf8",
    );
    expect(form).not.toMatch(/forgot|otp/i);
  });
});
