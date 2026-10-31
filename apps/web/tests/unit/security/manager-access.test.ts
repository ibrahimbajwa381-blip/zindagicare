/**
 * Manager role: admin panel access without finances or admin management.
 * Covers the role helpers, the finance redaction, withApiHandler's manager
 * handling, and a source scan that keeps money/admin routes admin-only.
 */
import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import {
  ADMIN_PANEL_ROLES,
  Roles,
  isAdmin,
  isAdminPanelUser,
  isManagerOnly,
  type Role,
} from "@zindagi/shared";

const mockResolveSession = jest.fn();
jest.mock("@/server/api/resolve-session", () => ({
  resolveSession: (...args: unknown[]) => mockResolveSession(...args),
}));

import { withApiHandler } from "@/server/api/with-api-handler";
import { assertNoFinanceWrite, redactFinance } from "@/server/lib/manager-access";

const MANAGER = { user: { id: "manager-id", roles: [Roles.MANAGER] as Role[] } };
const ADMIN = { user: { id: "admin-id", roles: [Roles.ADMIN] as Role[] } };

const row = {
  id: "a1",
  paymentStatus: "paid",
  amountPkr: 2500,
  transactionId: "TX-1",
  refundAccountNumber: "PK00BANK",
  doctor: { name: "Dr A", stats: { completedTotal: 4, totalEarnings: 9000, earningsThisMonth: 100 } },
  onlineCommissionPercent: null,
};

function call(url: string, init?: RequestInit) {
  return new Request(url, init) as unknown as NextRequest;
}

beforeEach(() => mockResolveSession.mockReset());

describe("role helpers", () => {
  test("a manager can open the panel but is not an admin", () => {
    expect(isAdminPanelUser([Roles.MANAGER])).toBe(true);
    expect(isAdmin([Roles.MANAGER])).toBe(false);
    expect(isManagerOnly([Roles.MANAGER])).toBe(true);
    expect(isManagerOnly([Roles.MANAGER, Roles.PATIENT])).toBe(true);
  });

  test("an admin who also holds manager is not restricted", () => {
    expect(isManagerOnly([Roles.MANAGER, Roles.ADMIN])).toBe(false);
    expect(isManagerOnly([Roles.ADMIN])).toBe(false);
    expect(isAdminPanelUser([Roles.PATIENT, Roles.DOCTOR])).toBe(false);
  });
});

describe("redactFinance", () => {
  test("drops money fields at any depth and keeps payment status", () => {
    const out = redactFinance([row])[0] as Record<string, unknown>;
    expect(out).toEqual({
      id: "a1",
      paymentStatus: "paid",
      doctor: { name: "Dr A", stats: { completedTotal: 4 } },
    });
  });

  test("serializes values like the JSON response would (ObjectId/Date via toJSON)", () => {
    const id = { toJSON: () => "507f1f77bcf86cd799439011" };
    const when = new Date("2026-01-02T03:04:05.000Z");
    expect(redactFinance({ id, when })).toEqual({
      id: "507f1f77bcf86cd799439011",
      when: "2026-01-02T03:04:05.000Z",
    });
    expect(redactFinance(undefined)).toBeUndefined();
  });

  test("assertNoFinanceWrite blocks fee and commission edits only", () => {
    expect(() => assertNoFinanceWrite({ isListed: true })).not.toThrow();
    expect(() => assertNoFinanceWrite({ consultationFee: undefined })).not.toThrow();
    expect(() => assertNoFinanceWrite({ homeVisitFee: 1500 })).toThrow(/fees or commission/);
    expect(() => assertNoFinanceWrite({ onlineCommissionPercent: null })).toThrow();
  });
});

describe("withApiHandler for managers", () => {
  const panelRoute = withApiHandler(async () => ({ appointments: [row] }), {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
  });
  const adminOnlyRoute = withApiHandler(async () => ({ ok: true }), {
    auth: true,
    roles: [Roles.ADMIN, Roles.SUPER_ADMIN],
  });

  test("manager gets admin-panel data without finance fields", async () => {
    mockResolveSession.mockResolvedValue(MANAGER);
    const res = await panelRoute(call("http://localhost/api/v1/admin/appointments"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.appointments[0].amountPkr).toBeUndefined();
    expect(json.data.appointments[0].paymentStatus).toBe("paid");
  });

  test("admin still gets the full data", async () => {
    mockResolveSession.mockResolvedValue(ADMIN);
    const res = await panelRoute(call("http://localhost/api/v1/admin/appointments"));
    expect((await res.json()).data.appointments[0].amountPkr).toBe(2500);
  });

  test("manager is refused on admin-only routes", async () => {
    mockResolveSession.mockResolvedValue(MANAGER);
    const res = await adminOnlyRoute(call("http://localhost/api/v1/admin/finances"));
    expect(res.status).toBe(403);
  });

  test("manager cannot send fee or commission changes", async () => {
    const { z } = await import("zod");
    const handler = jest.fn(async () => ({ updated: true }));
    const route = withApiHandler(handler, {
      auth: true,
      roles: ADMIN_PANEL_ROLES,
      bodySchema: z.object({ onlineCommissionPercent: z.number().optional() }),
    });
    mockResolveSession.mockResolvedValue(MANAGER);
    const res = await route(
      call("http://localhost/api/v1/admin/herbalists/manage", {
        method: "POST",
        body: JSON.stringify({ onlineCommissionPercent: 90 }),
      }),
    );
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  test("a manager's own non-admin API data is not redacted", async () => {
    mockResolveSession.mockResolvedValue(MANAGER);
    const own = withApiHandler(async () => ({ amountPkr: 2500 }), { auth: true });
    const res = await own(call("http://localhost/api/v1/payments/mine"));
    expect((await res.json()).data.amountPkr).toBe(2500);
  });
});

describe("admin-only routes stay closed to managers", () => {
  const adminApi = path.join(__dirname, "../../../src/app/api/v1/admin");
  const blocked = [
    "finances",
    "platform-earnings",
    "platform-settings",
    "admins",
    "admin-activity",
    "planning",
    "users",
    "doctor-stats",
    "patient-stats",
    "appointments/[id]/cancellation-request",
    "appointments/[id]/referral",
    "appointments/[id]/chat",
  ];

  function routeFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return routeFiles(full);
      return entry.name === "route.ts" ? [full] : [];
    });
  }

  const files = [
    ...blocked.flatMap((dir) => routeFiles(path.join(adminApi, dir))),
    ...routeFiles(adminApi).filter((f) => f.split(path.sep).includes("finance")),
  ];

  test("found the route files to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  test.each(files.map((f) => [path.relative(adminApi, f)]))("%s does not admit managers", (rel) => {
    const src = fs.readFileSync(path.join(adminApi, rel), "utf8");
    expect(src).not.toMatch(/ADMIN_PANEL_ROLES|isAdminPanelUser|Roles\.MANAGER/);
  });
});
