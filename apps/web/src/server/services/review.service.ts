import {
  AppointmentModel,
  DoctorProfileModel,
  ReviewModel,
  UserModel,
  VideoSessionModel,
  connectDatabase,
} from "@zindagi/database";
import { Types } from "mongoose";
import type { AdminAddReviewInput, SubmitReviewInput } from "@zindagi/validators";
import {
  AppointmentStatuses,
  AppointmentTypes,
  ErrorCodes,
  PaymentStatuses,
  VideoSessionStatuses,
  AppError,
} from "@zindagi/shared";
import type {
  AdminModerationReview,
  AdminModerationReviewList,
  AdminReviewModerationAction,
  AdminReviewVisibility,
} from "@/features/admin/types/admin-reviews";
import type { DoctorReviewDto } from "@/features/marketing/types/doctor-public";
import type { AppointmentPrescriptionLink } from "@/features/prescriptions/types";
import { mongoFilter } from "@/lib/mongo/query";
import { PrescriptionService } from "@/server/services/prescription.service";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";

function formatPatientName(name: string) {
  return name.trim().replace(/\s+/g, " ") || "Patient";
}

export type PatientReviewDto = {
  id: string;
  appointmentId: string;
  rating: number;
  comment?: string;
  createdAt: string;
};

export type PatientReviewState = {
  canReview: boolean;
  doctorName: string;
  review?: PatientReviewDto;
  prescription?: AppointmentPrescriptionLink;
};

export type AdminReviewRow = AdminModerationReview & {
  appointmentId?: string;
  doctorId: string;
};

type AppointmentReviewContext = {
  appointmentId: string;
  type: string;
  status: string;
  scheduledEnd: Date;
  paymentStatus?: string;
};

type ReviewEligibilityOptions = {
  afterVideoLeave?: boolean;
  videoSessionAttended?: boolean;
};

function isPaidOnlineConsult(type: string, paymentStatus?: string) {
  if (type !== AppointmentTypes.ONLINE) return true;
  return paymentStatus === PaymentStatuses.PAID;
}

function isAppointmentReviewEligible(
  appointment: AppointmentReviewContext,
  hasExistingReview: boolean,
  options: ReviewEligibilityOptions = {},
) {
  if (hasExistingReview) return false;

  if (
    appointment.type !== AppointmentTypes.ONLINE &&
    appointment.type !== AppointmentTypes.SUNDAY_FREE &&
    appointment.type !== AppointmentTypes.URGENT_ONLINE
  ) {
    return false;
  }

  if (
    appointment.status === AppointmentStatuses.CANCELLED ||
    appointment.status === AppointmentStatuses.NO_SHOW ||
    appointment.status === AppointmentStatuses.PENDING
  ) {
    return false;
  }

  if (!isPaidOnlineConsult(appointment.type, appointment.paymentStatus)) {
    return false;
  }

  if (
    options.afterVideoLeave &&
    options.videoSessionAttended &&
    (appointment.status === AppointmentStatuses.COMPLETED ||
      appointment.status === AppointmentStatuses.CONFIRMED ||
      appointment.status === AppointmentStatuses.IN_PROGRESS)
  ) {
    return true;
  }

  if (appointment.status === AppointmentStatuses.COMPLETED) {
    return true;
  }

  const consultEnded = new Date() > appointment.scheduledEnd;
  if (
    consultEnded &&
    (appointment.status === AppointmentStatuses.CONFIRMED ||
      appointment.status === AppointmentStatuses.IN_PROGRESS)
  ) {
    return true;
  }

  return false;
}

function videoSessionWasAttended(session: {
  patientJoinedAt?: Date | null;
  startedAt?: Date | null;
  status?: string;
} | null) {
  if (!session) return false;
  return Boolean(
    session.patientJoinedAt ||
      session.startedAt ||
      session.status === VideoSessionStatuses.COMPLETED ||
      session.status === VideoSessionStatuses.ACTIVE,
  );
}

export class ReviewService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async listDoctorReviews(
    doctorProfileId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ reviews: DoctorReviewDto[]; total: number; hasMore: boolean }> {
    await ReviewService.ensureConnected();

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 10));
    const skip = (page - 1) * limit;

    const filter = mongoFilter({
      doctorId: doctorProfileId,
      isVisible: true,
      deletedAt: null,
    });

    const [rows, total] = await Promise.all([
      ReviewModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReviewModel.countDocuments(filter),
    ]);

    const patientIds = [...new Set(rows.filter((r) => r.patientId).map((row) => row.patientId!.toString()))];
    const patients = patientIds.length
      ? await UserModel.find(mongoFilter({ _id: { $in: patientIds } }))
          .select("name")
          .lean()
      : [];
    const nameById = new Map(patients.map((p) => [p._id.toString(), p.name]));

    const reviews: DoctorReviewDto[] = rows.map((row) => ({
      id: row._id.toString(),
      rating: row.rating,
      comment: row.comment ?? undefined,
      patientName: formatPatientName(
        row.patientId ? nameById.get(row.patientId.toString()) ?? "Patient" : row.patientName ?? "Patient",
      ),
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      reviews,
      total,
      hasMore: skip + reviews.length < total,
    };
  }

  static async getReviewsForAppointments(
    appointmentIds: string[],
  ): Promise<Map<string, PatientReviewDto>> {
    await ReviewService.ensureConnected();
    if (!appointmentIds.length) return new Map();

    const rows = await ReviewModel.find(
      mongoFilter({
        appointmentId: { $in: appointmentIds },
        deletedAt: null,
      }),
    ).lean();

    const map = new Map<string, PatientReviewDto>();
    for (const row of rows) {
      map.set(row.appointmentId!.toString(), {
        id: row._id.toString(),
        appointmentId: row.appointmentId!.toString(),
        rating: row.rating,
        comment: row.comment ?? undefined,
        createdAt: row.createdAt.toISOString(),
      });
    }
    return map;
  }

  static canReviewAppointment(
    appointment: AppointmentReviewContext,
    hasExistingReview: boolean,
    options?: ReviewEligibilityOptions,
  ) {
    return isAppointmentReviewEligible(appointment, hasExistingReview, options);
  }

  static async getPatientReviewState(
    patientId: string,
    appointmentId: string,
    options: ReviewEligibilityOptions = {},
  ): Promise<PatientReviewState> {
    await ReviewService.ensureConnected();

    const appointment = await AppointmentModel.findOne(
      mongoFilter({
        _id: appointmentId,
        patientId,
        deletedAt: null,
      }),
    )
      .populate({
        path: "doctorId",
        select: "userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("paymentId", "status")
      .lean();

    if (!appointment) {
      throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const doctor = appointment.doctorId as {
      userId?: { name?: string };
    } | null;
    const doctorName = doctor?.userId?.name ?? "Doctor";
    const payment = appointment.paymentId as { status?: string } | null;

    const [existing, prescriptionMap] = await Promise.all([
      ReviewModel.findOne(mongoFilter({ appointmentId, deletedAt: null })).lean(),
      PrescriptionService.getPrescriptionsForAppointments([appointmentId]),
    ]);
    const prescription = prescriptionMap.get(appointmentId);

    if (existing) {
      return {
        canReview: false,
        doctorName,
        prescription,
        review: {
          id: existing._id.toString(),
          appointmentId,
          rating: existing.rating,
          comment: existing.comment ?? undefined,
          createdAt: existing.createdAt.toISOString(),
        },
      };
    }

    let videoSessionAttended = options.videoSessionAttended;
    if (options.afterVideoLeave && videoSessionAttended == null) {
      const session = await VideoSessionModel.findOne(
        mongoFilter({ appointmentId }),
      )
        .select("patientJoinedAt startedAt status")
        .lean();
      videoSessionAttended = videoSessionWasAttended(session);
    }

    const canReview = isAppointmentReviewEligible(
      {
        appointmentId: appointment._id.toString(),
        type: appointment.type,
        status: appointment.status,
        scheduledEnd: appointment.scheduledEnd,
        paymentStatus: payment?.status,
      },
      false,
      {
        afterVideoLeave: options.afterVideoLeave,
        videoSessionAttended,
      },
    );

    return { canReview, doctorName, prescription };
  }

  static async submitReview(
    patientId: string,
    appointmentId: string,
    input: SubmitReviewInput,
    options: ReviewEligibilityOptions = {},
  ): Promise<PatientReviewDto> {
    await ReviewService.ensureConnected();

    const appointment = await AppointmentModel.findOne(
      mongoFilter({
        _id: appointmentId,
        patientId,
        deletedAt: null,
      }),
    )
      .populate("paymentId", "status")
      .lean();

    if (!appointment) {
      throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const existing = await ReviewModel.findOne(
      mongoFilter({ appointmentId, deletedAt: null }),
    ).lean();

    if (existing) {
      throw new AppError("You already reviewed this consultation", ErrorCodes.CONFLICT, 409);
    }

    const payment = appointment.paymentId as { status?: string } | null;

    let videoSessionAttended = options.videoSessionAttended;
    if (options.afterVideoLeave && videoSessionAttended == null) {
      const session = await VideoSessionModel.findOne(
        mongoFilter({ appointmentId }),
      )
        .select("patientJoinedAt startedAt status")
        .lean();
      videoSessionAttended = videoSessionWasAttended(session);
    }

    const eligible = isAppointmentReviewEligible(
      {
        appointmentId: appointment._id.toString(),
        type: appointment.type,
        status: appointment.status,
        scheduledEnd: appointment.scheduledEnd,
        paymentStatus: payment?.status,
      },
      false,
      {
        afterVideoLeave: options.afterVideoLeave,
        videoSessionAttended,
      },
    );

    if (!eligible) {
      throw new AppError(
        "This consultation is not eligible for a review yet",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    const review = (await ReviewModel.create({
      appointmentId: appointment._id.toString(),
      doctorId: appointment.doctorId.toString(),
      patientId,
      rating: input.rating,
      comment: input.comment?.trim() || undefined,
      isVisible: true,
    } as Record<string, unknown>)) as {
      _id: { toString(): string };
      rating: number;
      comment?: string;
      createdAt: Date;
    };

    if (
      appointment.status !== AppointmentStatuses.COMPLETED &&
      (new Date() > appointment.scheduledEnd || options.afterVideoLeave)
    ) {
      await AppointmentModel.updateOne(
        mongoFilter({ _id: appointment._id }),
        {
          $set: {
            status: AppointmentStatuses.COMPLETED,
            completedAt: appointment.completedAt ?? new Date(),
          },
        },
      );
    }

    if (appointment.type === AppointmentTypes.URGENT_ONLINE) {
      await UrgentConsultService.tryCompleteByAppointmentId(appointment._id.toString());
    }

    await ReviewService.refreshDoctorRatingAggregates(appointment.doctorId.toString());

    return {
      id: review._id.toString(),
      appointmentId: appointment._id.toString(),
      rating: review.rating,
      comment: review.comment ?? undefined,
      createdAt: review.createdAt.toISOString(),
    };
  }

  /** Admin logs a review a patient left off-platform (phone/WhatsApp/in person). */
  static async adminAddReview(
    adminUserId: string,
    doctorId: string,
    input: AdminAddReviewInput,
  ): Promise<AdminReviewRow> {
    await ReviewService.ensureConnected();

    const doctor = await DoctorProfileModel.findById(doctorId).populate("userId", "name").lean();
    if (!doctor) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
    }

    const review = await ReviewModel.create({
      doctorId,
      rating: input.rating,
      comment: input.comment?.trim() || undefined,
      patientName: input.patientName.trim(),
      source: "admin",
      isVisible: true,
      isModerated: true,
      moderatedBy: adminUserId,
      createdAt: input.reviewDate ?? new Date(),
    } as Record<string, unknown>);

    await ReviewService.refreshDoctorRatingAggregates(doctorId);

    return {
      id: review._id.toString(),
      doctorId,
      rating: review.rating,
      comment: review.comment ?? undefined,
      isVisible: review.isVisible ?? true,
      isModerated: review.isModerated ?? true,
      createdAt: review.createdAt.toISOString(),
      patientName: review.patientName ?? input.patientName,
      providerName: (doctor.userId as { name?: string } | null)?.name ?? "Doctor",
      source: "admin",
    };
  }

  static async refreshDoctorRatingAggregates(doctorProfileId: string) {
    const [aggregate] = await ReviewModel.aggregate<{ avg: number; count: number }>([
      {
        $match: {
          doctorId: new Types.ObjectId(doctorProfileId),
          isVisible: true,
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: null,
          avg: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    const ratingCount = aggregate?.count ?? 0;
    const ratingAvg =
      ratingCount > 0 ? Math.round((aggregate!.avg + Number.EPSILON) * 10) / 10 : 0;

    await DoctorProfileModel.updateOne(
      mongoFilter({ _id: doctorProfileId }),
      { $set: { ratingAvg, ratingCount } },
    );
  }

  static async listAdminReviews(
    options: { visibility?: AdminReviewVisibility } = {},
  ): Promise<AdminModerationReviewList & { reviews: AdminReviewRow[] }> {
    await ReviewService.ensureConnected();

    const visibility = options.visibility ?? "all";
    const filter = mongoFilter({
      deletedAt: null,
      ...(visibility === "visible" ? { isVisible: true } : {}),
      ...(visibility === "hidden" ? { isVisible: false } : {}),
      ...(visibility === "pending" ? { isModerated: false } : {}),
    });

    const rows = await ReviewModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();

    const patientIds = [
      ...new Set(rows.filter((r) => r.patientId).map((row) => row.patientId!.toString())),
    ];
    const doctorIds = [...new Set(rows.map((row) => row.doctorId.toString()))];

    const [patients, doctors] = await Promise.all([
      patientIds.length
        ? UserModel.find(mongoFilter({ _id: { $in: patientIds } }))
            .select("name")
            .lean()
        : [],
      doctorIds.length
        ? DoctorProfileModel.find(mongoFilter({ _id: { $in: doctorIds } }))
            .populate("userId", "name")
            .lean()
        : [],
    ]);

    const patientNameById = new Map(patients.map((p) => [p._id.toString(), p.name ?? "Patient"]));
    const doctorNameById = new Map(
      doctors.map((d) => {
        const user = d.userId as { name?: string } | null;
        return [d._id.toString(), user?.name ?? "Doctor"];
      }),
    );

    const reviews: AdminReviewRow[] = rows.map((row) => ({
      id: row._id.toString(),
      appointmentId: row.appointmentId?.toString(),
      doctorId: row.doctorId.toString(),
      rating: row.rating,
      comment: row.comment ?? undefined,
      isVisible: row.isVisible ?? true,
      isModerated: row.isModerated ?? false,
      createdAt: row.createdAt.toISOString(),
      patientName: row.patientId
        ? patientNameById.get(row.patientId.toString()) ?? "Patient"
        : row.patientName ?? "Patient",
      providerName: doctorNameById.get(row.doctorId.toString()) ?? "Doctor",
      source: (row.source as "patient" | "admin") ?? "patient",
    }));

    const total = await ReviewModel.countDocuments(filter);
    return { reviews, total };
  }

  static async moderateReview(
    adminUserId: string,
    reviewId: string,
    action: AdminReviewModerationAction,
  ) {
    await ReviewService.ensureConnected();

    const review = await ReviewModel.findOne(mongoFilter({ _id: reviewId, deletedAt: null }));
    if (!review) {
      throw new AppError("Review not found", ErrorCodes.NOT_FOUND, 404);
    }

    const doctorId = review.doctorId.toString();

    if (action === "approve") {
      review.isModerated = true;
      review.moderatedBy = adminUserId as never;
      await review.save();
    } else if (action === "hide") {
      review.isVisible = false;
      review.isModerated = true;
      review.moderatedBy = adminUserId as never;
      await review.save();
    } else if (action === "show") {
      review.isVisible = true;
      review.isModerated = true;
      review.moderatedBy = adminUserId as never;
      await review.save();
    } else {
      review.deletedAt = new Date();
      review.isVisible = false;
      review.isModerated = true;
      review.moderatedBy = adminUserId as never;
      await review.save();
    }

    await ReviewService.refreshDoctorRatingAggregates(doctorId);

    return {
      id: review._id.toString(),
      isVisible: review.isVisible,
      isModerated: review.isModerated,
      deleted: Boolean(review.deletedAt),
    };
  }

  /** Mark every unmoderated review as reviewed (keeps current visibility). */
  static async approveAllPendingReviews(adminUserId: string) {
    await ReviewService.ensureConnected();

    const result = await ReviewModel.updateMany(
      mongoFilter({ deletedAt: null, isModerated: false }),
      {
        $set: {
          isModerated: true,
          moderatedBy: adminUserId as never,
        },
      },
    );

    return { approved: result.modifiedCount ?? 0 };
  }
}
