import { AppointmentStatuses, AppointmentTypes, HomeVisitStatuses } from "@zindagi/shared";
import {
  appointmentAccess,
  CARE_GRACE_MS,
  homeVisitAccess,
} from "@/server/services/care/policy";

const NOW = new Date("2026-10-29T12:00:00Z");
const PAID = "pay-paid";
const PENDING = "pay-pending";
const payments = new Map([
  [PAID, true],
  [PENDING, false],
]);

function access(
  overrides: Partial<{ type: string; status: string; paymentId: string; scheduledEnd: Date }>,
) {
  return appointmentAccess(
    {
      type: AppointmentTypes.ONLINE,
      status: AppointmentStatuses.CONFIRMED,
      scheduledEnd: new Date(NOW.getTime() + 3_600_000),
      paymentId: PAID,
      ...overrides,
    },
    payments,
    NOW,
  );
}

describe("care policy — appointmentAccess", () => {
  test.each([AppointmentStatuses.CONFIRMED, AppointmentStatuses.IN_PROGRESS])(
    "paid online %s consult is writable",
    (status) => {
      expect(access({ status })).toBe("write");
    },
  );

  test("Sunday free follows the same rules as paid: writable, then read-only once completed", () => {
    const sunday = { type: AppointmentTypes.SUNDAY_FREE, paymentId: undefined };
    expect(access(sunday)).toBe("write");
    expect(access({ ...sunday, status: AppointmentStatuses.COMPLETED })).toBe("read");
    expect(access({ status: AppointmentStatuses.COMPLETED })).toBe("read");
  });

  test.each([AppointmentStatuses.CANCELLED, AppointmentStatuses.NO_SHOW, AppointmentStatuses.PENDING])(
    "%s consult grants no access",
    (status) => {
      expect(access({ status })).toBe("none");
    },
  );

  test("prepaid types need a PAID payment; pay-later types do not", () => {
    expect(access({ paymentId: PENDING })).toBe("none");
    expect(access({ paymentId: undefined })).toBe("none");
    expect(access({ type: AppointmentTypes.URGENT_ONLINE, paymentId: undefined })).toBe("none");
    expect(access({ type: AppointmentTypes.CLINIC, paymentId: undefined })).toBe("write");
    expect(access({ type: AppointmentTypes.CLINIC, paymentId: PENDING })).toBe("none");
  });

  test("unfinished consult turns read-only after the grace period", () => {
    const endedAt = (msAgo: number) => new Date(NOW.getTime() - msAgo);
    expect(access({ scheduledEnd: endedAt(CARE_GRACE_MS) })).toBe("write");
    expect(access({ scheduledEnd: endedAt(CARE_GRACE_MS + 1) })).toBe("read");
  });

  test("non-consult appointment types grant no access", () => {
    expect(access({ type: "lab_test" })).toBe("none");
  });
});

describe("care policy — homeVisitAccess", () => {
  const visit = (overrides: Partial<{ status: string; scheduledAt: Date; assignedStaffId: unknown }>) =>
    homeVisitAccess(
      {
        status: HomeVisitStatuses.ASSIGNED,
        scheduledAt: new Date(NOW.getTime() + 3_600_000),
        assignedStaffId: "staff-1",
        ...overrides,
      },
      NOW,
    );

  test.each([HomeVisitStatuses.ASSIGNED, HomeVisitStatuses.EN_ROUTE, HomeVisitStatuses.ARRIVED])(
    "%s visit is writable",
    (status) => {
      expect(visit({ status })).toBe("write");
    },
  );

  test("completed visit is read-only", () => {
    expect(visit({ status: HomeVisitStatuses.COMPLETED })).toBe("read");
  });

  test.each([HomeVisitStatuses.REQUESTED, HomeVisitStatuses.CANCELLED])(
    "%s visit grants no access",
    (status) => {
      expect(visit({ status })).toBe("none");
    },
  );

  test("no assigned staff means no access", () => {
    expect(visit({ assignedStaffId: undefined })).toBe("none");
  });

  test("open visit turns read-only after the grace period", () => {
    const slotAgo = (ms: number) => new Date(NOW.getTime() - ms);
    expect(visit({ scheduledAt: slotAgo(CARE_GRACE_MS) })).toBe("write");
    expect(visit({ scheduledAt: slotAgo(CARE_GRACE_MS + 1) })).toBe("read");
  });
});
