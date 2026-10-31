import {
  monthlyCostTotal,
  planningBoardToText,
  type PlanningBoard,
  type PlanningItemRow,
} from "@/features/admin/lib/planning";

function row(overrides: Partial<PlanningItemRow>): PlanningItemRow {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "plan",
    title: "Untitled",
    status: "planned",
    priority: "medium",
    createdByName: "Admin",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const board: PlanningBoard = {
  live: {
    month: "2026-10",
    newPatients: 1234,
    newProviders: 5,
    completedConsults: 42,
    byCity: [{ city: "Lahore", newPatients: 1000, newProviders: 4 }],
  },
  items: [
    row({
      kind: "target",
      title: "500 new patients in Lahore",
      city: "Lahore",
      month: "2026-10",
      metric: "New patients",
      unit: "patients",
      targetValue: 500,
      currentValue: 120,
      status: "in_progress",
    }),
    row({
      kind: "plan",
      title: "Launch in Islamabad",
      priority: "high",
      dueDate: "2026-12-01",
      owner: "Ops team",
      description: "Hire 10 doctors\n\nRun launch campaign",
    }),
    row({
      kind: "partnership",
      title: "Services Hospital",
      city: "Lahore",
      partnerType: "hospital",
      stage: "negotiating",
      contactName: "Dr. Contact",
      contactPhone: "03001234567",
    }),
    row({ kind: "achievement", title: "First hospital signed", achievedAt: "2026-03-01" }),
    row({ kind: "expense", title: "Hosting", metric: "Hosting & servers", budget: 15000, status: "in_progress" }),
    row({ kind: "expense", title: "Office rent", budget: 60000, status: "planned" }),
    row({ kind: "expense", title: "Old CRM", budget: 9000, status: "cancelled" }),
  ],
};

describe("monthlyCostTotal", () => {
  test("sums active monthly costs only, skipping cancelled ones and other kinds", () => {
    expect(monthlyCostTotal(board.items)).toBe(75000);
  });
});

describe("planningBoardToText", () => {
  const text = planningBoardToText(board, new Date("2026-10-29T08:00:00Z"));

  test("includes the live numbers for the month", () => {
    expect(text).toContain("LIVE ON THE PLATFORM · October 2026");
    expect(text).toContain("- New patients: 1,234");
    expect(text).toContain("  · Lahore: 1000 patients, 4 providers");
  });

  test("includes every entry with the details for its kind", () => {
    expect(text).toContain(
      "- [October 2026] 500 new patients in Lahore — 120/500 patients (24%) · New patients · Lahore · In progress · Medium priority",
    );
    expect(text).toMatch(/- Launch in Islamabad — Nationwide · Planned · High priority · Due .*2026 · Owner: Ops team/);
    expect(text).toContain(
      "Services Hospital — Hospital · Negotiating · Lahore · Planned · Medium priority · Contact: Dr. Contact, 03001234567",
    );
    expect(text).toMatch(/- .*Mar.*2026 — First hospital signed — Nationwide/);
  });

  test("lists monthly costs with their total", () => {
    expect(text).toContain("MONTHLY COSTS (3)\nTotal: PKR 75,000 / month (active only)");
    expect(text).toContain("- Hosting — Hosting & servers · Nationwide · In progress · Medium priority · PKR 15,000 / month");
  });

  test("keeps multi-line notes, dropping blank lines", () => {
    expect(text).toContain("    Hire 10 doctors\n    Run launch campaign");
  });

  test("lists empty sections so nothing looks missing", () => {
    expect(text).toContain("CAMPAIGNS (0)\n- None yet");
    expect(text).toContain("CHALLENGES (0)\n- None yet");
  });
});
