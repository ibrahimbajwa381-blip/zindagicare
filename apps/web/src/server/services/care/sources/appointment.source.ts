import { AppointmentModel, PaymentModel } from "@zindagi/database";
import { PaymentStatuses } from "@zindagi/shared";
import { mongoFilter } from "@/lib/mongo/query";
import {
  appointmentAccess,
  CARE_APPOINTMENT_TYPES,
  CARE_VISIBLE_STATUSES,
  type AppointmentAccessRow,
  type CareAccess,
} from "../policy";
import {
  providerProfileIdOf,
  providerProfilesById,
  providerRoleOf,
} from "../provider-registry";
import type { CareEngagement, CareParty } from "../types";

export async function paidStatusByPaymentId(
  paymentIds: string[],
): Promise<Map<string, boolean>> {
  if (paymentIds.length === 0) return new Map();
  const payments = await PaymentModel.find(mongoFilter({ _id: { $in: paymentIds } }))
    .select("status")
    .lean();
  return new Map(
    payments.map((payment) => [
      payment._id.toString(),
      payment.status === PaymentStatuses.PAID,
    ]),
  );
}

export async function accessForAppointment(
  appointment: AppointmentAccessRow,
): Promise<CareAccess> {
  const paymentIds = appointment.paymentId ? [appointment.paymentId.toString()] : [];
  return appointmentAccess(appointment, await paidStatusByPaymentId(paymentIds));
}

/** Patient-side and provider-side match clauses for `self`, optionally narrowed to one counterpart. */
function sideClauses(self: CareParty, other?: CareParty) {
  const clauses: Record<string, unknown>[] = [];
  const otherProfileIds = other?.profiles.map((profile) => profile.profileId);
  if (!otherProfileIds) {
    clauses.push({ patientId: self.userId });
  } else if (otherProfileIds.length > 0) {
    clauses.push({ patientId: self.userId, doctorId: { $in: otherProfileIds } });
  }

  const selfProfileIds = self.profiles.map((profile) => profile.profileId);
  if (selfProfileIds.length > 0) {
    clauses.push(
      other
        ? { patientId: other.userId, doctorId: { $in: selfProfileIds } }
        : { doctorId: { $in: selfProfileIds } },
    );
  }
  return clauses;
}

/** Appointments linking `self` to anyone (or to `other`), in either role. */
export async function appointmentEngagements(
  self: CareParty,
  other?: CareParty,
  now = new Date(),
): Promise<CareEngagement[]> {
  const clauses = sideClauses(self, other);
  if (clauses.length === 0) return [];

  const appointments = await AppointmentModel.find(
    mongoFilter({
      $or: clauses,
      type: { $in: CARE_APPOINTMENT_TYPES },
      status: { $in: CARE_VISIBLE_STATUSES },
      deletedAt: null,
    }),
  )
    .select("type status scheduledStart scheduledEnd paymentId patientId doctorId providerRole providerProfileId")
    .lean();
  if (appointments.length === 0) return [];

  const [paidByPaymentId, profilesById] = await Promise.all([
    paidStatusByPaymentId([
      ...new Set(
        appointments
          .map((appointment) => appointment.paymentId?.toString())
          .filter((id): id is string => !!id),
      ),
    ]),
    providerProfilesById(
      appointments.map((appointment) => ({
        role: providerRoleOf(appointment),
        profileId: providerProfileIdOf(appointment),
      })),
    ),
  ]);

  const engagements: CareEngagement[] = [];
  for (const appointment of appointments) {
    const access = appointmentAccess(appointment, paidByPaymentId, now);
    if (access === "none") continue;
    const provider = profilesById.get(providerProfileIdOf(appointment));
    if (!provider) continue;

    engagements.push({
      patientUserId: appointment.patientId.toString(),
      provider,
      access,
      appointmentId: appointment._id.toString(),
      startsAt: appointment.scheduledStart,
    });
  }
  return engagements;
}
