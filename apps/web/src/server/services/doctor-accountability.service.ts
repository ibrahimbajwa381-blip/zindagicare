import {
  AppointmentModel,
  AuditLogModel,
  DoctorMissModel,
  DoctorProfileModel,
  VideoSessionModel,
  connectDatabase,
} from "@zindagi/database";
import {
  AppointmentStatuses,
  AppointmentTypes,
  DOCTOR_ACCOUNTABILITY_CONFIG,
  VerificationStatuses,
  withDoctorTitle,
} from "@zindagi/shared";
import { mongoFilter } from "@/lib/mongo/query";
import { resolveMongoRefId } from "@/lib/mongo/resolve-id";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { notifyAdmins as notifyAdminsChannel } from "@/lib/notifications/notify-admins";
import {
  notifyPatientDoctorMissed,
  sendDoctorMissWarning,
  sendDoctorRemovalNotice,
} from "@/lib/notifications/doctor-accountability-notifications";

const TZ = DOCTOR_ACCOUNTABILITY_CONFIG.timezone;
const MS_MINUTE = 60 * 1000;

const ACTIVE_STATUSES = [
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
] as const;

/** YYYY-MM bucket in Asia/Karachi for monthly thresholds. */
function monthKeyKarachi(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${year}-${month}`;
}

/** Human label like "June 2026" for notification copy. */
function monthLabelKarachi(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  }).format(date);
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

type SweepResult = {
  scanned: number;
  missesRecorded: number;
  warningsIssued: number;
  removals: number;
  skippedAttended: number;
};

export class DoctorAccountabilityService {
  /**
   * Sweep online/Sunday consults whose window has passed without the doctor joining,
   * record a strike, and escalate to warning / removal based on the monthly count.
   */
  static async processMissedAppointments(now = new Date()): Promise<SweepResult> {
    await connectDatabase();

    const cutoff = new Date(
      now.getTime() -
        DOCTOR_ACCOUNTABILITY_CONFIG.graceMinutesAfterEnd * MS_MINUTE,
    );

    const appointments = await AppointmentModel.find(
      mongoFilter({
        status: { $in: ACTIVE_STATUSES },
        type: {
          $in: [AppointmentTypes.ONLINE, AppointmentTypes.SUNDAY_FREE],
        },
        scheduledEnd: { $lte: cutoff },
        doctorMissedAt: null,
        deletedAt: null,
      }),
    )
      .populate({
        path: "doctorId",
        populate: { path: "userId", select: "name phone" },
      })
      .populate("patientId", "name phone")
      .lean();

    const result: SweepResult = {
      scanned: appointments.length,
      missesRecorded: 0,
      warningsIssued: 0,
      removals: 0,
      skippedAttended: 0,
    };

    for (const appointment of appointments) {
      const doctor = appointment.doctorId as {
        _id?: { toString(): string };
        userId?: { _id?: { toString(): string }; name?: string; phone?: string };
      } | null;
      const doctorProfileId = doctor?._id?.toString();
      if (!doctorProfileId) continue;

      // Did the doctor join the video session? If so, it's not a miss.
      const session = await VideoSessionModel.findOne(
        mongoFilter({ appointmentId: appointment._id }),
      )
        .select("doctorJoinedAt")
        .lean();
      if (session?.doctorJoinedAt) {
        result.skippedAttended += 1;
        continue;
      }

      const missedAt = now;
      const monthKey = monthKeyKarachi(missedAt);
      const doctorUserId = doctor?.userId
        ? resolveMongoRefId(doctor.userId)
        : null;
      const patientDoc = appointment.patientId as {
        _id?: { toString(): string };
        phone?: string;
      } | null;
      const patientUserId =
        patientDoc?._id?.toString() ??
        (appointment.patientId as { toString(): string } | null)?.toString();

      // Record the strike (idempotent via unique appointmentId).
      try {
        await DoctorMissModel.create({
          doctorId: doctorProfileId,
          doctorUserId: doctorUserId ?? undefined,
          appointmentId: appointment._id,
          patientId: patientUserId,
          appointmentType: appointment.type,
          scheduledStart: appointment.scheduledStart,
          scheduledEnd: appointment.scheduledEnd,
          missedAt,
          monthKey,
          reason: "doctor_no_join",
        } as Record<string, unknown>);
      } catch (err) {
        if (isDuplicateKeyError(err)) continue;
        throw err;
      }

      // Flag the appointment so it isn't scanned again and so dashboards reflect it.
      await AppointmentModel.updateOne(
        mongoFilter({ _id: appointment._id }),
        {
          $set: {
            status: AppointmentStatuses.NO_SHOW,
            missedBy: "doctor",
            doctorMissedAt: missedAt,
            noShowMarkedAt: missedAt,
          },
        },
      );
      result.missesRecorded += 1;

      if (patientUserId) {
        await notifyPatientDoctorMissed({
          patientUserId,
          phone: safeDisplayText(patientDoc?.phone) ?? undefined,
          appointmentId: appointment._id.toString(),
        });
      }

      const escalation = await DoctorAccountabilityService.escalate({
        doctorProfileId,
        doctorUserId,
        doctorPhone: safeDisplayText(doctor?.userId?.phone) ?? undefined,
        doctorName: safeDisplayText(doctor?.userId?.name) ?? "Doctor",
        monthKey,
        missedAt,
      });

      if (escalation.warned) result.warningsIssued += 1;
      if (escalation.removed) result.removals += 1;
    }

    return result;
  }

  /**
   * Recompute the doctor's miss count for the month and apply warning / removal.
   * Idempotent: a warning/removal is only applied once per calendar month.
   */
  private static async escalate(params: {
    doctorProfileId: string;
    doctorUserId: string | null;
    doctorPhone?: string;
    doctorName: string;
    monthKey: string;
    missedAt: Date;
  }): Promise<{ warned: boolean; removed: boolean }> {
    const monthMisses = await DoctorMissModel.countDocuments(
      mongoFilter({
        doctorId: params.doctorProfileId,
        monthKey: params.monthKey,
      }),
    );
    const totalMisses = await DoctorMissModel.countDocuments(
      mongoFilter({ doctorId: params.doctorProfileId }),
    );

    const profile = await DoctorProfileModel.findById(params.doctorProfileId);
    if (!profile) return { warned: false, removed: false };

    type Accountability = {
      totalMisses?: number;
      currentMonthKey?: string;
      currentMonthMisses?: number;
      lastMissAt?: Date;
      lastWarningAt?: Date;
      lastWarningMonthKey?: string;
      autoRestrictedAt?: Date;
      autoRestrictedMonthKey?: string;
    };
    const accountability: Accountability =
      (profile.get("accountability") as Accountability | undefined) ?? {};

    accountability.totalMisses = totalMisses;
    accountability.currentMonthKey = params.monthKey;
    accountability.currentMonthMisses = monthMisses;
    accountability.lastMissAt = params.missedAt;

    const monthLabel = monthLabelKarachi(params.missedAt);
    let warned = false;
    let removed = false;

    // Removal takes priority once the doctor reaches the removal threshold.
    if (
      monthMisses >= DOCTOR_ACCOUNTABILITY_CONFIG.removalThreshold &&
      accountability.autoRestrictedMonthKey !== params.monthKey
    ) {
      profile.verificationStatus = VerificationStatuses.RESTRICTED;
      profile.isListed = false;
      profile.videoConsultEnabled = false;
      profile.sundayConsultEnabled = false;
      profile.homeVisitEnabled = false;
      accountability.autoRestrictedAt = params.missedAt;
      accountability.autoRestrictedMonthKey = params.monthKey;
      removed = true;
    } else if (
      monthMisses >= DOCTOR_ACCOUNTABILITY_CONFIG.warningThreshold &&
      accountability.lastWarningMonthKey !== params.monthKey
    ) {
      accountability.lastWarningAt = params.missedAt;
      accountability.lastWarningMonthKey = params.monthKey;
      warned = true;
    }

    profile.set("accountability", accountability);
    await profile.save();

    if (removed) {
      if (params.doctorUserId) {
        await sendDoctorRemovalNotice({
          doctorUserId: params.doctorUserId,
          phone: params.doctorPhone,
          missCount: monthMisses,
          monthLabel,
        });
      }
      await DoctorAccountabilityService.notifyAdmins({
        doctorName: params.doctorName,
        doctorProfileId: params.doctorProfileId,
        missCount: monthMisses,
        monthLabel,
      });
      await AuditLogModel.create({
        actorRole: "system",
        action: "doctor.auto_restricted",
        entityType: "DoctorProfile",
        entityId: profile._id,
        changes: {
          reason: "missed_consultations",
          monthKey: params.monthKey,
          missCount: monthMisses,
        },
      } as Record<string, unknown>);
    } else if (warned) {
      if (params.doctorUserId) {
        await sendDoctorMissWarning({
          doctorUserId: params.doctorUserId,
          phone: params.doctorPhone,
          missCount: monthMisses,
          removalThreshold: DOCTOR_ACCOUNTABILITY_CONFIG.removalThreshold,
          monthLabel,
        });
      }
      await AuditLogModel.create({
        actorRole: "system",
        action: "doctor.miss_warning",
        entityType: "DoctorProfile",
        entityId: profile._id,
        changes: {
          monthKey: params.monthKey,
          missCount: monthMisses,
        },
      } as Record<string, unknown>);
    }

    return { warned, removed };
  }

  private static async notifyAdmins(params: {
    doctorName: string;
    doctorProfileId: string;
    missCount: number;
    monthLabel: string;
  }) {
    await notifyAdminsChannel({
      title: "Doctor auto-restricted for missed consults",
      body: `${withDoctorTitle(params.doctorName)} was automatically restricted after ${params.missCount} missed consultations in ${params.monthLabel}.`,
      payload: {
        type: "admin_doctor_auto_restricted",
        doctorProfileId: params.doctorProfileId,
        missCount: params.missCount,
      },
    });
  }
}
