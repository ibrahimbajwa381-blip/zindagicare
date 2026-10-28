import {
  AppointmentModel,
  UserModel,
  connectDatabase,
} from "@zindagi/database";
import {
  AppointmentStatuses,
  AppointmentTypes,
} from "@zindagi/shared";
import {
  sendAppointmentReminder1h,
  sendAppointmentReminder24h,
  sendAppointmentStartNow,
  sendDoctorAppointmentReminder1h,
  sendDoctorAppointmentReminder24h,
  sendDoctorAppointmentStartNow,
  sendDoctorSundayMorningReminder,
  sendSundayMorningReminder,
} from "@/lib/notifications/appointment-reminders";
import { formatSundayDateKey } from "@/lib/sunday/date-utils";
import { mongoFilter } from "@/lib/mongo/query";
import { resolveMongoRefId } from "@/lib/mongo/resolve-id";
import { safeDisplayText } from "@/server/lib/decrypt-pii";

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;
/** Grace window after scheduledStart to still deliver "starts now" if cron/page load is slightly late. */
const MS_START_GRACE = 15 * 60 * 1000;

const ACTIVE_STATUSES = [
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
] as const;

type ReminderAppointmentType = "online" | "clinic" | "sunday_free";

function toReminderType(type: string): ReminderAppointmentType | null {
  if (type === AppointmentTypes.ONLINE) return "online";
  if (type === AppointmentTypes.CLINIC) return "clinic";
  if (type === AppointmentTypes.SUNDAY_FREE) return "sunday_free";
  return null;
}

function isSundayMorningKarachi(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return weekday === "Sun" && hour >= 7 && hour < 11;
}

/** Navigation-triggered scans run at most this often per server instance. */
const NAVIGATION_SCAN_INTERVAL_MS = 60_000;
let lastNavigationScanAt = 0;
let navigationScan: Promise<unknown> | null = null;

export class AppointmentReminderService {
  /**
   * Fire-and-forget reminder scan for page/API traffic: skipped when one ran in
   * the last minute or is still running, so overlapping scans on this instance
   * can't both see a reminder as unsent. The internal cron route calls
   * processDueReminders() directly and is not throttled.
   */
  static triggerFromNavigation(now = Date.now()): boolean {
    if (navigationScan || now - lastNavigationScanAt < NAVIGATION_SCAN_INTERVAL_MS) {
      return false;
    }
    lastNavigationScanAt = now;
    navigationScan = AppointmentReminderService.processDueReminders()
      .catch(() => null)
      .finally(() => {
        navigationScan = null;
      });
    return true;
  }

  static async processDueReminders() {
    await connectDatabase();

    const now = new Date();
    const appointments = await AppointmentModel.find(
      mongoFilter({
        status: { $in: ACTIVE_STATUSES },
        scheduledStart: { $gte: new Date(now.getTime() - MS_START_GRACE) },
        deletedAt: null,
        type: {
          $in: [
            AppointmentTypes.ONLINE,
            AppointmentTypes.SUNDAY_FREE,
            AppointmentTypes.CLINIC,
          ],
        },
      }),
    )
      .populate({
        path: "doctorId",
        populate: { path: "userId", select: "name phone" },
      })
      .populate("patientId", "name phone")
      .lean();

    const results = {
      scanned: appointments.length,
      sent24h: 0,
      sent1h: 0,
      sentStartNow: 0,
      sentSundayMorning: 0,
      sentDoctor24h: 0,
      sentDoctor1h: 0,
      sentDoctorStartNow: 0,
      sentDoctorSundayMorning: 0,
    };

    for (const appointment of appointments) {
      const msUntil = appointment.scheduledStart.getTime() - now.getTime();
      const patientDoc = appointment.patientId as {
        _id?: { toString(): string };
        name?: string;
        phone?: string;
      } | null;
      const patientId =
        patientDoc?._id?.toString() ??
        (appointment.patientId as { toString(): string }).toString();
      const patientName = safeDisplayText(patientDoc?.name) ?? "Patient";
      const doctor = appointment.doctorId as {
        userId?: { _id?: { toString(): string }; name?: string; phone?: string };
      } | null;
      const doctorUserId = doctor?.userId
        ? resolveMongoRefId(doctor.userId)
        : null;
      const doctorUser = doctor?.userId;
      const doctorName = safeDisplayText(doctorUser?.name) ?? "Doctor";
      const appointmentId = appointment._id.toString();
      const reminderType = toReminderType(appointment.type);
      if (!reminderType) continue;

      const remindersSent = appointment.remindersSent ?? {
        h24: false,
        h1: false,
        startNow: false,
        sundayMorning: false,
        doctorH24: false,
        doctorH1: false,
        doctorStartNow: false,
        doctorSundayMorning: false,
      };

      const isPatientReminderType =
        appointment.type === AppointmentTypes.ONLINE ||
        appointment.type === AppointmentTypes.SUNDAY_FREE;
      const patientReminderType =
        appointment.type === AppointmentTypes.SUNDAY_FREE ? "sunday_free" : "online";

      if (isPatientReminderType && msUntil > 0 && msUntil <= MS_DAY && !remindersSent.h24) {
        await sendAppointmentReminder24h({
          userId: patientId,
          phone: safeDisplayText(patientDoc?.phone) ?? undefined,
          doctorName,
          slotStart: appointment.scheduledStart,
          appointmentId,
          type: patientReminderType,
        });
        await AppointmentModel.updateOne(
          mongoFilter({ _id: appointment._id }),
          { $set: { "remindersSent.h24": true } },
        );
        results.sent24h += 1;
      }

      if (isPatientReminderType && msUntil > 0 && msUntil <= MS_HOUR && !remindersSent.h1) {
        await sendAppointmentReminder1h({
          userId: patientId,
          phone: safeDisplayText(patientDoc?.phone) ?? undefined,
          doctorName,
          slotStart: appointment.scheduledStart,
          appointmentId,
          type: patientReminderType,
        });
        await AppointmentModel.updateOne(
          mongoFilter({ _id: appointment._id }),
          { $set: { "remindersSent.h1": true } },
        );
        results.sent1h += 1;
      }

      if (
        isPatientReminderType &&
        msUntil <= 0 &&
        msUntil >= -MS_START_GRACE &&
        !remindersSent.startNow
      ) {
        await sendAppointmentStartNow({
          userId: patientId,
          phone: safeDisplayText(patientDoc?.phone) ?? undefined,
          doctorName,
          appointmentId,
          type: patientReminderType,
        });
        await AppointmentModel.updateOne(
          mongoFilter({ _id: appointment._id }),
          { $set: { "remindersSent.startNow": true } },
        );
        results.sentStartNow += 1;
      }

      if (
        appointment.type === AppointmentTypes.SUNDAY_FREE &&
        !remindersSent.sundayMorning &&
        isSundayMorningKarachi(now) &&
        formatSundayDateKey(appointment.scheduledStart) ===
          formatSundayDateKey(now)
      ) {
        await sendSundayMorningReminder({
          userId: patientId,
          phone: safeDisplayText(patientDoc?.phone) ?? undefined,
          doctorName,
          slotStart: appointment.scheduledStart,
          appointmentId,
        });
        await AppointmentModel.updateOne(
          mongoFilter({ _id: appointment._id }),
          { $set: { "remindersSent.sundayMorning": true } },
        );
        results.sentSundayMorning += 1;
      }

      if (doctorUserId && msUntil > 0 && msUntil <= MS_DAY && !remindersSent.doctorH24) {
        await sendDoctorAppointmentReminder24h({
          userId: doctorUserId,
          phone: safeDisplayText(doctorUser?.phone) ?? undefined,
          patientName,
          slotStart: appointment.scheduledStart,
          appointmentId,
          type: reminderType,
          patientId,
        });
        await AppointmentModel.updateOne(
          mongoFilter({ _id: appointment._id }),
          { $set: { "remindersSent.doctorH24": true } },
        );
        results.sentDoctor24h += 1;
      }

      if (doctorUserId && msUntil > 0 && msUntil <= MS_HOUR && !remindersSent.doctorH1) {
        await sendDoctorAppointmentReminder1h({
          userId: doctorUserId,
          phone: safeDisplayText(doctorUser?.phone) ?? undefined,
          patientName,
          slotStart: appointment.scheduledStart,
          appointmentId,
          type: reminderType,
          patientId,
        });
        await AppointmentModel.updateOne(
          mongoFilter({ _id: appointment._id }),
          { $set: { "remindersSent.doctorH1": true } },
        );
        results.sentDoctor1h += 1;
      }

      if (
        doctorUserId &&
        msUntil <= 0 &&
        msUntil >= -MS_START_GRACE &&
        !remindersSent.doctorStartNow
      ) {
        await sendDoctorAppointmentStartNow({
          userId: doctorUserId,
          phone: safeDisplayText(doctorUser?.phone) ?? undefined,
          patientName,
          appointmentId,
          type: reminderType,
        });
        await AppointmentModel.updateOne(
          mongoFilter({ _id: appointment._id }),
          { $set: { "remindersSent.doctorStartNow": true } },
        );
        results.sentDoctorStartNow += 1;
      }

      if (
        doctorUserId &&
        appointment.type === AppointmentTypes.SUNDAY_FREE &&
        !remindersSent.doctorSundayMorning &&
        isSundayMorningKarachi(now) &&
        formatSundayDateKey(appointment.scheduledStart) ===
          formatSundayDateKey(now)
      ) {
        await sendDoctorSundayMorningReminder({
          userId: doctorUserId,
          phone: safeDisplayText(doctorUser?.phone) ?? undefined,
          patientName,
          slotStart: appointment.scheduledStart,
          appointmentId,
          patientId,
        });
        await AppointmentModel.updateOne(
          mongoFilter({ _id: appointment._id }),
          { $set: { "remindersSent.doctorSundayMorning": true } },
        );
        results.sentDoctorSundayMorning += 1;
      }
    }

    return results;
  }
}
