import {
  AppointmentModel,
  connectDatabase,
} from "@zindagi/database";
import {
  AppointmentStatuses,
  AppointmentTypes,
  VIDEO_CONSULT_CONFIG,
  getVideoJoinWindow,
} from "@zindagi/shared";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { mongoFilter } from "@/lib/mongo/query";
import { ReviewService } from "@/server/services/review.service";
import { PrescriptionService } from "@/server/services/prescription.service";
import { VideoSessionService } from "@/server/services/video-session.service";
import type { AppointmentPrescriptionLink } from "@/features/prescriptions/types";


export type PatientAppointmentHistoryItem = {
  appointmentId: string;
  type: "online" | "sunday_free" | "urgent_online";
  typeLabel: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  consultationFee?: number;
  doctor: {
    doctorId: string;
    name: string;
    avatarUrl?: string;
    specialty: string;
  };
  isMissed: boolean;
  canJoin: boolean;
  canReview: boolean;
  review?: {
    rating: number;
    comment?: string;
    createdAt: string;
  };
  prescription?: AppointmentPrescriptionLink;
};

function mapDoctor(
  doctor: {
    _id?: { toString(): string };
    specialties?: string[];
    userId?: { name?: string; avatarUrl?: string };
  } | null,
) {
  if (!doctor?._id) return null;

  const name = doctor.userId?.name ?? "Doctor";
  return {
    doctorId: doctor._id.toString(),
    name,
    avatarUrl: resolveDoctorPortrait(name, doctor.userId?.avatarUrl),
    specialty: doctor.specialties?.[0] ?? "General Physician",
  };
}

function typeLabel(type: string) {
  if (type === AppointmentTypes.SUNDAY_FREE) return "Sunday Free Consult";
  if (type === AppointmentTypes.URGENT_ONLINE) return "Urgent care";
  if (type === AppointmentTypes.ONLINE) return "Online consultation";
  return "Consultation";
}

function resolveHistoryFlags(
  status: string,
  scheduledStart: Date,
  scheduledEnd: Date,
  type: "online" | "sunday_free" | "urgent_online",
) {
  const now = new Date();
  const { joinClosesAt, canJoin: withinJoinWindow } = getVideoJoinWindow(
    scheduledStart,
    scheduledEnd,
    now,
  );

  if (status === AppointmentStatuses.NO_SHOW) {
    return { isMissed: true, canJoin: false };
  }

  if (
    status === AppointmentStatuses.COMPLETED ||
    status === AppointmentStatuses.CANCELLED ||
    status === AppointmentStatuses.PENDING ||
    status === AppointmentStatuses.IN_PROGRESS
  ) {
    return { isMissed: false, canJoin: false };
  }

  if (now > joinClosesAt) {
    return { isMissed: true, canJoin: false };
  }

  const canJoin =
    type === "online" &&
    withinJoinWindow &&
    (status === AppointmentStatuses.CONFIRMED ||
      status === AppointmentStatuses.IN_PROGRESS);

  return { isMissed: false, canJoin };
}

export class PatientAppointmentsService {
  static async ensureConnected() {
    await connectDatabase();
  }

  /** Recent and past appointments for the patient dashboard history list. */
  static async listHistory(
    patientId: string,
    options: { limit?: number; types?: string[] } = {},
  ): Promise<PatientAppointmentHistoryItem[]> {
    await PatientAppointmentsService.ensureConnected();

    const limit = options.limit ?? 20;
    const types =
      options.types ??
      [AppointmentTypes.ONLINE, AppointmentTypes.SUNDAY_FREE];

    const now = new Date();
    const joinWindowClosedBefore = new Date(
      now.getTime() - VIDEO_CONSULT_CONFIG.joinLateMinutes * 60_000,
    );

    const appointments = await AppointmentModel.find(
      mongoFilter({
        patientId,
        type: { $in: types },
        deletedAt: null,
        $or: [
          {
            status: {
              $in: [
                AppointmentStatuses.COMPLETED,
                AppointmentStatuses.NO_SHOW,
                AppointmentStatuses.CANCELLED,
              ],
            },
          },
          {
            status: {
              $in: [
                AppointmentStatuses.CONFIRMED,
                AppointmentStatuses.IN_PROGRESS,
                AppointmentStatuses.PENDING,
              ],
            },
            // Join window has closed — show as history (including recent no-shows
            // before the accountability sweep marks them NO_SHOW).
            scheduledEnd: { $lt: joinWindowClosedBefore },
          },
        ],
      }),
    )
      .sort({ scheduledStart: -1 })
      .limit(limit)
      .populate({
        path: "doctorId",
        select: "specialties",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .populate("paymentId", "amount status")
      .lean();

    const appointmentIds = appointments.map((a) => a._id.toString());
    const [reviewsByAppointment, prescriptionsByAppointment] = await Promise.all([
      ReviewService.getReviewsForAppointments(appointmentIds),
      PrescriptionService.getPrescriptionsForAppointments(appointmentIds),
    ]);

    const items: PatientAppointmentHistoryItem[] = [];

    for (const appointment of appointments) {
      const finalized = await VideoSessionService.finalizeAppointmentIfAttended(
        appointment._id.toString(),
      );
      if (finalized) {
        appointment.status = AppointmentStatuses.COMPLETED;
      }

      const doctor = mapDoctor(
        appointment.doctorId as Parameters<typeof mapDoctor>[0],
      );
      if (!doctor) continue;

      const payment = appointment.paymentId as { amount?: number; status?: string } | null;
      const type =
        appointment.type === AppointmentTypes.SUNDAY_FREE
          ? ("sunday_free" as const)
          : appointment.type === AppointmentTypes.URGENT_ONLINE
            ? ("urgent_online" as const)
            : ("online" as const);
      const { isMissed, canJoin } = resolveHistoryFlags(
        appointment.status,
        appointment.scheduledStart,
        appointment.scheduledEnd,
        type,
      );

      const existingReview = reviewsByAppointment.get(appointment._id.toString());
      const canReview = ReviewService.canReviewAppointment(
        {
          appointmentId: appointment._id.toString(),
          type: appointment.type,
          status: appointment.status,
          scheduledEnd: appointment.scheduledEnd,
          paymentStatus: payment?.status,
        },
        Boolean(existingReview),
      );

      items.push({
        appointmentId: appointment._id.toString(),
        type,
        typeLabel: typeLabel(appointment.type),
        scheduledStart: appointment.scheduledStart.toISOString(),
        scheduledEnd: appointment.scheduledEnd.toISOString(),
        status: appointment.status,
        consultationFee:
          appointment.type === AppointmentTypes.ONLINE ||
          appointment.type === AppointmentTypes.URGENT_ONLINE
            ? payment?.amount
            : 0,
        doctor,
        isMissed,
        canJoin,
        canReview,
        review: existingReview
          ? {
              rating: existingReview.rating,
              comment: existingReview.comment,
              createdAt: existingReview.createdAt,
            }
          : undefined,
        prescription: prescriptionsByAppointment.get(appointment._id.toString()),
      });
    }

    return items;
  }
}
