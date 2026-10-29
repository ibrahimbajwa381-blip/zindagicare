import { AppointmentStatuses, AppointmentTypes, HomeVisitStatuses } from "@zindagi/shared";

/**
 * Single rule set for patient ↔ provider access, shared by every consult type
 * (paid, Sunday free, urgent, clinic, home visit) and every provider role.
 * Pure — callers load the rows and payment statuses.
 */

/** Consult types that link a patient and a provider. */
export const CARE_APPOINTMENT_TYPES = [
  AppointmentTypes.ONLINE,
  AppointmentTypes.URGENT_ONLINE,
  AppointmentTypes.CLINIC,
  AppointmentTypes.HOME_VISIT,
  AppointmentTypes.SUNDAY_FREE,
] as const;

/** Statuses while the consult is still running; chat is writable. */
const OPEN_STATUSES: readonly string[] = [
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
];

/** Statuses that keep the conversation visible (open ones plus finished). */
export const CARE_VISIBLE_STATUSES = [
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
  AppointmentStatuses.COMPLETED,
] as const;

/** Types that only count once their payment is PAID; the rest are free or pay later. */
const PREPAID_TYPES: readonly string[] = [
  AppointmentTypes.ONLINE,
  AppointmentTypes.URGENT_ONLINE,
];

/** An unfinished consult stays writable this long after its scheduled end. */
export const CARE_GRACE_MS = 72 * 60 * 60 * 1000;

export type CareAccess = "none" | "read" | "write";

export type AppointmentAccessRow = {
  type: string;
  status: string;
  scheduledEnd: Date;
  paymentId?: { toString(): string } | null;
};

export function appointmentAccess(
  appointment: AppointmentAccessRow,
  paidByPaymentId: ReadonlyMap<string, boolean>,
  now = new Date(),
): CareAccess {
  if (!(CARE_APPOINTMENT_TYPES as readonly string[]).includes(appointment.type)) return "none";
  if (!(CARE_VISIBLE_STATUSES as readonly string[]).includes(appointment.status)) return "none";

  const paid = appointment.paymentId
    ? (paidByPaymentId.get(appointment.paymentId.toString()) ?? false)
    : !PREPAID_TYPES.includes(appointment.type);
  if (!paid) return "none";

  const open =
    OPEN_STATUSES.includes(appointment.status) &&
    now.getTime() <= appointment.scheduledEnd.getTime() + CARE_GRACE_MS;
  return open ? "write" : "read";
}

/** Home visits from staff assignment until completed; payment may come later. */
const HOME_VISIT_OPEN_STATUSES: readonly string[] = [
  HomeVisitStatuses.ASSIGNED,
  HomeVisitStatuses.EN_ROUTE,
  HomeVisitStatuses.ARRIVED,
];

export const HOME_VISIT_VISIBLE_STATUSES = [
  HomeVisitStatuses.ASSIGNED,
  HomeVisitStatuses.EN_ROUTE,
  HomeVisitStatuses.ARRIVED,
  HomeVisitStatuses.COMPLETED,
] as const;

export type HomeVisitAccessRow = {
  status: string;
  scheduledAt: Date;
  assignedStaffId?: unknown;
};

export function homeVisitAccess(visit: HomeVisitAccessRow, now = new Date()): CareAccess {
  if (!visit.assignedStaffId) return "none";
  if (!(HOME_VISIT_VISIBLE_STATUSES as readonly string[]).includes(visit.status)) return "none";

  const open =
    HOME_VISIT_OPEN_STATUSES.includes(visit.status) &&
    now.getTime() <= visit.scheduledAt.getTime() + CARE_GRACE_MS;
  return open ? "write" : "read";
}
