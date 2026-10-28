/**
 * Navigation-triggered reminder scans (doctor layout, notifications summary)
 * are throttled to once per minute per server instance and never overlap.
 * processDueReminders itself is mocked: no database is touched.
 */
type Service = typeof import("@/server/services/appointment-reminder.service").AppointmentReminderService;

async function loadService(): Promise<Service> {
  let service!: Service;
  await jest.isolateModulesAsync(async () => {
    service = (await import("@/server/services/appointment-reminder.service")).AppointmentReminderService;
  });
  return service;
}

describe("AppointmentReminderService.triggerFromNavigation", () => {
  afterEach(() => jest.restoreAllMocks());

  it("runs at most once per 60s per instance", async () => {
    const service = await loadService();
    const scan = jest.spyOn(service, "processDueReminders").mockResolvedValue({} as never);

    const t0 = 1_000_000;
    expect(service.triggerFromNavigation(t0)).toBe(true);
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    expect(service.triggerFromNavigation(t0 + 1_000)).toBe(false);
    expect(service.triggerFromNavigation(t0 + 59_999)).toBe(false);
    expect(scan).toHaveBeenCalledTimes(1);

    expect(service.triggerFromNavigation(t0 + 60_000)).toBe(true);
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it("never starts a second scan while one is still running, even after the interval", async () => {
    const service = await loadService();
    let finish!: () => void;
    const scan = jest
      .spyOn(service, "processDueReminders")
      .mockImplementation(() => new Promise((resolve) => (finish = () => resolve({} as never))));

    const t0 = 2_000_000;
    expect(service.triggerFromNavigation(t0)).toBe(true);
    expect(service.triggerFromNavigation(t0 + 120_000)).toBe(false);
    expect(scan).toHaveBeenCalledTimes(1);

    finish();
    await new Promise((r) => setImmediate(r));
    expect(service.triggerFromNavigation(t0 + 120_000)).toBe(true);
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it("swallows scan failures and releases the in-flight guard", async () => {
    const service = await loadService();
    const scan = jest.spyOn(service, "processDueReminders").mockRejectedValue(new Error("db down"));

    const t0 = 3_000_000;
    expect(service.triggerFromNavigation(t0)).toBe(true);
    await new Promise((r) => setImmediate(r));
    expect(service.triggerFromNavigation(t0 + 60_000)).toBe(true);
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it("navigation call sites use the throttled trigger; the cron route still scans directly", () => {
    const fs = jest.requireActual<typeof import("node:fs")>("node:fs");
    const read = (p: string) => fs.readFileSync(`${__dirname}/../../../src/${p}`, "utf8");
    for (const file of ["app/(doctor)/doctor/layout.tsx", "app/api/v1/notifications/summary/route.ts"]) {
      const source = read(file);
      expect(source).toContain("AppointmentReminderService.triggerFromNavigation()");
      expect(source).not.toContain("processDueReminders(");
    }
    expect(read("app/api/internal/appointments/reminders/route.ts")).toContain(
      "AppointmentReminderService.processDueReminders()",
    );
  });
});
