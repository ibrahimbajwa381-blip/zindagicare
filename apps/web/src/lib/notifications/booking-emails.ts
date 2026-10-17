import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
  HomeVisitModel,
  UserModel,
} from "@zindagi/database";
import { AppointmentStatuses, resolveDisplaySpecialty, withDoctorTitle } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  doctorNewBookingEmail,
  patientBookingConfirmationEmail,
  type BookingConsultType,
  type BookingEmailDetails,
} from "@/server/lib/email-templates";
import { sendEmail } from "@/server/services/email.service";

export type BookingEmailRecipient = "patient" | "doctor";

export type BookingEmailOutcome =
  | "sent"
  | "not_found"
  | "not_confirmed"
  | "not_doctor_booking"
  | "recipient_mismatch"
  | "no_email"
  | "skipped"
  | "failed";

/** Only bookings that are actually on — never a pending, cancelled or failed one. */
const NOTIFIABLE_STATUSES: readonly string[] = [
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
];

const CONSULT_TYPES: readonly BookingConsultType[] = [
  "online",
  "clinic",
  "sunday_free",
  "home_visit",
  "urgent_online",
];

function absoluteUrl(path: string): string {
  return `${siteConfig.url.replace(/\/+$/, "")}${path}`;
}

function doctorDashboardPath(type: BookingConsultType, appointmentId: string): string {
  const id = encodeURIComponent(appointmentId);
  return type === "urgent_online" ? `/doctor/urgent-calls?requestId=${id}` : `/doctor/intake/${id}`;
}

function joinAddress(parts: (string | null | undefined)[]): string | undefined {
  const text = parts
    .map((part) => safeDisplayText(part)?.trim())
    .filter(Boolean)
    .join(", ");
  return text || undefined;
}

function log(outcome: BookingEmailOutcome, appointmentId: string, recipient: BookingEmailRecipient, extra?: string) {
  // Ids and outcome only — never addresses, names or appointment content.
  const line = `[booking-email] ${outcome} appointment=${appointmentId} recipient=${recipient}${extra ? ` ${extra}` : ""}`;
  if (outcome === "sent") console.info(line);
  else if (outcome === "failed") console.error(line);
  else console.warn(line);
}

/**
 * Send the booking email for one side of a confirmed consultation. Every
 * fact — recipient address, names, schedule, type, status — is read from the
 * saved appointment and its linked records, never from request input.
 *
 * `expectedUserId` is the account the caller believes it is notifying; if it
 * isn't the appointment's patient (or the user behind its assigned doctor
 * profile), nothing is sent.
 *
 * Never throws: email is a side channel and must not affect the booking.
 * "sent" means Resend accepted the message, not that it reached the inbox.
 */
export async function sendBookingEmail(input: {
  appointmentId: string;
  recipient: BookingEmailRecipient;
  expectedUserId: string;
}): Promise<BookingEmailOutcome> {
  const { appointmentId, recipient } = input;
  try {
    await connectDatabase();

    const appointment = await AppointmentModel.findById(appointmentId)
      .select("type status patientId doctorId providerRole scheduledStart timezone clinic homeVisitId deletedAt")
      .lean();
    if (!appointment || appointment.deletedAt) {
      log("not_found", appointmentId, recipient);
      return "not_found";
    }
    if (!NOTIFIABLE_STATUSES.includes(appointment.status)) {
      log("not_confirmed", appointmentId, recipient, `status=${appointment.status}`);
      return "not_confirmed";
    }
    const type = appointment.type as BookingConsultType;
    if ((appointment.providerRole ?? "doctor") !== "doctor" || !CONSULT_TYPES.includes(type)) {
      log("not_doctor_booking", appointmentId, recipient);
      return "not_doctor_booking";
    }

    const doctor = await DoctorProfileModel.findById(appointment.doctorId)
      .select("userId primarySpecialty specialties hospitals")
      .lean();
    if (!doctor?.userId) {
      log("not_found", appointmentId, recipient, "doctor_profile");
      return "not_found";
    }

    const patientId = appointment.patientId.toString();
    const doctorUserId = doctor.userId.toString();
    const recipientUserId = recipient === "patient" ? patientId : doctorUserId;
    if (recipientUserId !== input.expectedUserId) {
      log("recipient_mismatch", appointmentId, recipient);
      return "recipient_mismatch";
    }

    const [patient, doctorUser] = await Promise.all([
      UserModel.findById(patientId).select("name email").lean(),
      UserModel.findById(doctorUserId).select("name email").lean(),
    ]);
    const to = safeDisplayText((recipient === "patient" ? patient : doctorUser)?.email)?.trim();
    if (!to) {
      log("no_email", appointmentId, recipient);
      return "no_email";
    }

    let homeVisitAddress: string | undefined;
    if (type === "home_visit" && appointment.homeVisitId) {
      const visit = await HomeVisitModel.findById(appointment.homeVisitId).select("address").lean();
      homeVisitAddress = joinAddress([visit?.address?.line, visit?.address?.city]);
    }
    const hospital = doctor.hospitals?.[0];
    const clinicAddress =
      type === "clinic"
        ? joinAddress([appointment.clinic?.hospitalName, appointment.clinic?.address, appointment.clinic?.city]) ??
          joinAddress([hospital?.name, hospital?.address, hospital?.area, hospital?.city])
        : undefined;

    const details: BookingEmailDetails = {
      appointmentId,
      type,
      status: appointment.status,
      scheduledStart: new Date(appointment.scheduledStart),
      timezone: appointment.timezone ?? "Asia/Karachi",
      clinicAddress,
      homeVisitAddress,
    };
    const doctorName = withDoctorTitle(safeDisplayText(doctorUser?.name) ?? "Doctor");
    const patientName = safeDisplayText(patient?.name) ?? "Patient";
    const support = { email: siteConfig.supportEmail, phone: siteConfig.supportWhatsAppDisplay };

    const email =
      recipient === "patient"
        ? patientBookingConfirmationEmail({
            patientName: safeDisplayText(patient?.name),
            doctorName,
            doctorSpecialty: resolveDisplaySpecialty({
              primarySpecialty: doctor.primarySpecialty,
              specialties: doctor.specialties,
            }),
            details,
            dashboardUrl: absoluteUrl(siteConfig.links.dashboard),
            joinUrl: ["online", "sunday_free", "urgent_online"].includes(type)
              ? absoluteUrl(`/consult/video/${encodeURIComponent(appointmentId)}`)
              : undefined,
            support,
          })
        : doctorNewBookingEmail({
            doctorName,
            patientName,
            details,
            dashboardUrl: absoluteUrl(doctorDashboardPath(type, appointmentId)),
            support,
          });

    // One recipient per message, so neither side ever sees the other's address.
    const result = await sendEmail({
      to,
      ...email,
      idempotencyKey: `booking-confirmed/${appointmentId}/${recipient}/${recipientUserId}`,
    });
    if (result.ok) {
      log("sent", appointmentId, recipient, result.id ? `id=${result.id}` : undefined);
      return "sent";
    }
    if (result.skipped) {
      log("skipped", appointmentId, recipient, "email_not_configured");
      return "skipped";
    }
    log("failed", appointmentId, recipient, `error=${result.error ?? "unknown"}`);
    return "failed";
  } catch (err) {
    log("failed", appointmentId, recipient, `error=${err instanceof Error ? err.name : "unknown"}`);
    return "failed";
  }
}
