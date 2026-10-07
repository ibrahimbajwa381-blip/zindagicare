import {
  AppointmentModel,
  connectDatabase,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  AppointmentTypes,
  CancellationRequestStatuses,
  getVideoJoinWindow,
} from "@zindagi/shared";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { mongoFilter } from "@/lib/mongo/query";
import { ReviewService } from "@/server/services/review.service";
import { PrescriptionService } from "@/server/services/prescription.service";
import { VideoSessionService } from "@/server/services/video-session.service";
import type { AppointmentPrescriptionLink } from "@/features/prescriptions/types";
import { cacheKey, cached, patientCacheTags } from "@/server/lib/cache";


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
  /** Can the patient request to cancel + be refunded for this booking right now. */
  canRequestCancellation: boolean;
  cancellationRequestStatus: string;
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

/** The DB-derived part of a history item; time-dependent flags are computed per request. */
type HistoryRow = Omit<
  PatientAppointmentHistoryItem,
  "isMissed" | "canJoin" | "canReview" | "canRequestCancellation"
> & {
  rawType: string;
  paymentStatus?: string;
};

const TERMINAL_STATUSES: string[] = [
  AppointmentStatuses.COMPLETED,
  AppointmentStatuses.CANCELLED,
  AppointmentStatuses.NO_SHOW,
];

export class PatientAppointmentsService {
  static async ensureConnected() {
    await connectDatabase();
  }

  /** Recent and past appointments for the patient dashboard history list. */
  static async listHistory(
    patientId: string,
    options: { limit?: number; types?: string[] } = {},
  ): Promise<PatientAppointmentHistoryItem[]> {
    const limit = options.limit ?? 20;
    const types =
      options.types ??
      [AppointmentTypes.ONLINE, AppointmentTypes.SUNDAY_FREE];

    const rows = await cached(
      cacheKey("patient-history", patientId, limit, [...types].sort().join(",")),
      { ttl: 300, tags: patientCacheTags(patientId), sensitive: true },
      () => PatientAppointmentsService.loadHistoryRows(patientId, limit, types),
    );

    // Join/missed/review/cancel flags depend on the current time, and an
    // attended consult is finalized lazily here — so both run on every
    // request, never from the cache. Finalizing writes the appointment,
    // which invalidates this patient's cached rows.
    return Promise.all(
      rows.map(async ({ rawType, paymentStatus, ...row }) => {
        let status = row.status;
        if (!TERMINAL_STATUSES.includes(status)) {
          const finalized = await VideoSessionService.finalizeAppointmentIfAttended(
            row.appointmentId,
          );
          if (finalized) status = AppointmentStatuses.COMPLETED;
        }

        const scheduledStart = new Date(row.scheduledStart);
        const scheduledEnd = new Date(row.scheduledEnd);
        const { isMissed, canJoin } = resolveHistoryFlags(
          status,
          scheduledStart,
          scheduledEnd,
          row.type,
        );
        const canReview = ReviewService.canReviewAppointment(
          {
            appointmentId: row.appointmentId,
            type: rawType,
            status,
            scheduledEnd,
            paymentStatus,
          },
          Boolean(row.review),
        );

        return {
          ...row,
          status,
          isMissed,
          canJoin,
          canReview,
          canRequestCancellation:
            row.cancellationRequestStatus !== CancellationRequestStatuses.PENDING &&
            row.cancellationRequestStatus !== CancellationRequestStatuses.APPROVED &&
            (status === AppointmentStatuses.PENDING ||
              status === AppointmentStatuses.CONFIRMED) &&
            !isMissed,
        } satisfies PatientAppointmentHistoryItem;
      }),
    );
  }

  private static async loadHistoryRows(
    patientId: string,
    limit: number,
    types: string[],
  ): Promise<HistoryRow[]> {
    await PatientAppointmentsService.ensureConnected();

    const appointments = await AppointmentModel.find(
      mongoFilter({
        patientId,
        type: { $in: types },
        deletedAt: null,
        // Includes upcoming confirmed/pending bookings (so the patient can cancel + request
        // a refund before the visit happens), not just past/resolved ones.
        status: {
          $in: [
            AppointmentStatuses.COMPLETED,
            AppointmentStatuses.NO_SHOW,
            AppointmentStatuses.CANCELLED,
            AppointmentStatuses.CONFIRMED,
            AppointmentStatuses.IN_PROGRESS,
            AppointmentStatuses.PENDING,
          ],
        },
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

    const rows: HistoryRow[] = [];

    for (const appointment of appointments) {
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

      const existingReview = reviewsByAppointment.get(appointment._id.toString());

      rows.push({
        appointmentId: appointment._id.toString(),
        type,
        rawType: appointment.type,
        typeLabel: typeLabel(appointment.type),
        scheduledStart: appointment.scheduledStart.toISOString(),
        scheduledEnd: appointment.scheduledEnd.toISOString(),
        status: appointment.status,
        paymentStatus: payment?.status,
        consultationFee:
          appointment.type === AppointmentTypes.ONLINE ||
          appointment.type === AppointmentTypes.URGENT_ONLINE
            ? payment?.amount
            : 0,
        doctor,
        cancellationRequestStatus:
          appointment.cancellationRequestStatus ?? CancellationRequestStatuses.NONE,
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

    return rows;
  }

  /** Patient requests to cancel a booked appointment and be refunded; admin reviews it. */
  static async requestCancellation(
    appointmentId: string,
    patientId: string,
    input: {
      reason: string;
      refundMethod: string;
      refundAccountTitle: string;
      refundAccountNumber: string;
      refundBankName?: string;
    },
  ) {
    await PatientAppointmentsService.ensureConnected();

    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment || appointment.deletedAt || appointment.patientId.toString() !== patientId) {
      throw new AppError("Appointment not found", "NOT_FOUND", 404);
    }

    if (
      appointment.status !== AppointmentStatuses.PENDING &&
      appointment.status !== AppointmentStatuses.CONFIRMED
    ) {
      throw new AppError(
        "This appointment can no longer be cancelled",
        "CONFLICT",
        409,
      );
    }

    if (appointment.cancellationRequestStatus === CancellationRequestStatuses.PENDING) {
      throw new AppError("A cancellation request is already pending", "CONFLICT", 409);
    }

    // Cancels right away — the refund itself is tracked separately for an admin to send manually.
    appointment.status = AppointmentStatuses.CANCELLED;
    appointment.cancellationReason = input.reason;
    appointment.set("cancelledBy", patientId);
    appointment.cancellationRequestStatus = CancellationRequestStatuses.PENDING;
    appointment.cancellationRequestedAt = new Date();
    appointment.set("cancellationRequestedBy", patientId);
    appointment.cancellationRequestReason = input.reason;
    appointment.set("refundMethod", input.refundMethod);
    appointment.refundAccountTitle = input.refundAccountTitle;
    appointment.refundAccountNumber = input.refundAccountNumber;
    appointment.refundBankName = input.refundBankName;
    await appointment.save();

    return {
      id: appointment._id.toString(),
      cancellationRequestStatus: appointment.cancellationRequestStatus,
    };
  }
}
