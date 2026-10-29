import {
  connectDatabase,
  AppointmentModel,
  DoctorProfileModel,
  PatientProfileModel,
  PaymentModel,
  SundaySlotInstanceModel,
  UserModel,
  VideoSessionModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  AppointmentTypes,
  CancellationRequestStatuses,
  PaymentStatuses,
  Roles,
  SlotStatuses,
  phoneLookupHash,
  withDoctorTitle,
} from "@zindagi/shared";
import { normalizePhoneDigits, toPakistaniLocalPhone } from "@zindagi/validators";
import { normalizePhone } from "@/lib/auth/phone";
import { formatPhoneForDisplay, safeDisplayText } from "@/server/lib/decrypt-pii";
import { mongoFilter } from "@/lib/mongo/query";
import { resolveMongoRefId } from "@/lib/mongo/resolve-id";
import { sendBookingEmail } from "@/lib/notifications/booking-emails";
import { getReferredPatientDoctorMap } from "@/server/services/commission.service";
import { ReviewService } from "@/server/services/review.service";
import {
  recordAdminActivity,
  type AdminActivityActor,
} from "@/server/services/admin-activity.service";

/** Doctor display names in the DB are inconsistently stored with/without a "Dr" prefix. */
function normalizeDoctorName(rawName?: string): string {
  return withDoctorTitle(safeDisplayText(rawName) ?? "Doctor");
}

export type AdminAppointmentRow = {
  id: string;
  type: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  isOnline: boolean;
  patient: { id: string; name: string; phone?: string; email?: string };
  doctor: {
    id: string;
    name: string;
    specialty?: string;
    phone?: string;
    email?: string;
    avatarUrl?: string;
  };
  cancellationReason?: string;
  patientNotes?: string;
  clinic?: { hospitalName?: string; address?: string; city?: string };
  amountPkr?: number;
  paymentStatus?: string;
  paymentId?: string;
  paymentProvider?: string;
  paymentCurrency?: string;
  transactionId?: string;
  paidAt?: string;
  refundedAt?: string;
  failureReason?: string;
  receiptUploaded?: boolean;
  createdAt: string;
  /** True when this patient was referred by this doctor via their referral link. */
  isReferred: boolean;
  cancellationRequestStatus?: string;
  cancellationRequestReason?: string;
  cancellationRequestedAt?: string;
  refundMethod?: string;
  refundAccountTitle?: string;
  refundAccountNumber?: string;
  refundBankName?: string;
  patientJoinedAt?: string;
  doctorJoinedAt?: string;
  /** Patient's rating of the doctor for this consult. */
  doctorReview?: { rating: number; comment?: string; createdAt: string };
  /** Patient's rating of ZindagiCare itself for this consult. */
  platformReview?: { rating: number; comment?: string; createdAt: string };
};

const TYPE_FILTERS = {
  online: AppointmentTypes.ONLINE,
  sunday: AppointmentTypes.SUNDAY_FREE,
  home: AppointmentTypes.HOME_VISIT,
  clinic: AppointmentTypes.CLINIC,
} as const;

export async function listAdminAppointments(filters?: {
  type?: keyof typeof TYPE_FILTERS;
  status?: string;
  limit?: number;
  patientId?: string;
}): Promise<AdminAppointmentRow[]> {
  await connectDatabase();

  const query: Record<string, unknown> = { deletedAt: null };

  if (filters?.type && TYPE_FILTERS[filters.type]) {
    query.type = TYPE_FILTERS[filters.type];
  }
  if (filters?.status) {
    query.status = filters.status;
  }
  if (filters?.patientId) {
    query.patientId = filters.patientId;
  }

  const appointments = await AppointmentModel.find(mongoFilter(query))
    .populate("patientId", "name phone email")
    .populate({
      path: "doctorId",
      populate: { path: "userId", select: "name phone email avatarUrl" },
      select: "specialties",
    })
    .populate(
      "paymentId",
      "amount status provider currency externalTransactionId paidAt refundedAt failureReason metadata",
    )
    .sort({ scheduledStart: -1 })
    .limit(filters?.limit ?? 100)
    .lean();

  const doctorProfileIds = [
    ...new Set(
      appointments
        .map((a) => (a.doctorId as { _id?: { toString(): string } } | null)?._id?.toString())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const referredPatientDoctorMap = await getReferredPatientDoctorMap(doctorProfileIds);

  const appointmentIds = appointments.map((a) => a._id.toString());
  const [videoSessions, doctorReviews, platformReviews] = await Promise.all([
    appointmentIds.length
      ? VideoSessionModel.find(mongoFilter({ appointmentId: { $in: appointmentIds } }))
          .select("appointmentId patientJoinedAt doctorJoinedAt")
          .lean()
      : Promise.resolve([]),
    ReviewService.getReviewsForAppointments(appointmentIds),
    ReviewService.getPlatformReviewsForAppointments(appointmentIds),
  ]);
  const videoSessionByAppointment = new Map(
    videoSessions.map((session) => [session.appointmentId?.toString(), session]),
  );

  return appointments.map((a) => {
    const patient = a.patientId as {
      _id?: { toString(): string };
      name?: string;
      phone?: string;
      email?: string;
    } | null;
    const doctorProfile = a.doctorId as {
      _id?: { toString(): string };
      userId?: { name?: string; phone?: string; email?: string; avatarUrl?: string };
      specialties?: string[];
    } | null;
    const payment = a.paymentId as {
      _id?: { toString(): string };
      amount?: number;
      status?: string;
      provider?: string;
      currency?: string;
      externalTransactionId?: string;
      paidAt?: Date;
      refundedAt?: Date;
      failureReason?: string;
      metadata?: { receipt?: { transactionId?: string }; transactionId?: string };
    } | null;

    return {
      id: a._id.toString(),
      type: a.type,
      status: a.status,
      scheduledStart: a.scheduledStart.toISOString(),
      scheduledEnd: a.scheduledEnd.toISOString(),
      isOnline: a.isOnline ?? false,
      patient: {
        id: patient?._id?.toString() ?? "",
        name: safeDisplayText(patient?.name) ?? "Patient",
        phone: safeDisplayText(patient?.phone) ?? undefined,
        email: safeDisplayText(patient?.email) ?? undefined,
      },
      doctor: {
        id: doctorProfile?._id?.toString() ?? "",
        name: normalizeDoctorName(doctorProfile?.userId?.name),
        specialty: doctorProfile?.specialties?.[0] ?? undefined,
        phone: formatPhoneForDisplay(doctorProfile?.userId?.phone),
        email: safeDisplayText(doctorProfile?.userId?.email),
        avatarUrl: doctorProfile?.userId?.avatarUrl ?? undefined,
      },
      cancellationReason: a.cancellationReason ?? undefined,
      patientNotes: a.patientNotes ?? undefined,
      clinic:
        a.clinic && (a.clinic.hospitalName || a.clinic.address || a.clinic.city)
          ? {
              hospitalName: a.clinic.hospitalName ?? undefined,
              address: a.clinic.address ?? undefined,
              city: a.clinic.city ?? undefined,
            }
          : undefined,
      amountPkr: payment?.amount ?? undefined,
      paymentStatus: payment?.status ?? undefined,
      paymentId: payment?._id?.toString() ?? undefined,
      paymentProvider: payment?.provider ?? undefined,
      paymentCurrency: payment?.currency ?? undefined,
      transactionId:
        payment?.externalTransactionId ??
        payment?.metadata?.receipt?.transactionId ??
        payment?.metadata?.transactionId ??
        undefined,
      paidAt: payment?.paidAt ? new Date(payment.paidAt).toISOString() : undefined,
      refundedAt: payment?.refundedAt ? new Date(payment.refundedAt).toISOString() : undefined,
      failureReason: payment?.failureReason ?? undefined,
      receiptUploaded: Boolean(payment?.metadata?.receipt),
      createdAt: (a.createdAt as Date | undefined)?.toISOString() ?? a.scheduledStart.toISOString(),
      isReferred:
        referredPatientDoctorMap.get(patient?._id?.toString() ?? "") ===
        doctorProfile?._id?.toString(),
      cancellationRequestStatus: a.cancellationRequestStatus ?? undefined,
      cancellationRequestReason: a.cancellationRequestReason ?? undefined,
      cancellationRequestedAt: a.cancellationRequestedAt
        ? new Date(a.cancellationRequestedAt).toISOString()
        : undefined,
      refundMethod: a.refundMethod ?? undefined,
      refundAccountTitle: a.refundAccountTitle ?? undefined,
      refundAccountNumber: a.refundAccountNumber ?? undefined,
      refundBankName: a.refundBankName ?? undefined,
      patientJoinedAt: videoSessionByAppointment
        .get(a._id.toString())
        ?.patientJoinedAt?.toISOString(),
      doctorJoinedAt: videoSessionByAppointment
        .get(a._id.toString())
        ?.doctorJoinedAt?.toISOString(),
      doctorReview: (() => {
        const review = doctorReviews.get(a._id.toString());
        return review
          ? { rating: review.rating, comment: review.comment, createdAt: review.createdAt }
          : undefined;
      })(),
      platformReview: platformReviews.get(a._id.toString()),
    };
  });
}

export async function adminCancelAppointment(
  appointmentId: string,
  adminUserId: string,
  reason?: string,
  actor?: AdminActivityActor,
) {
  await connectDatabase();

  const appointment = await AppointmentModel.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", "NOT_FOUND", 404);

  if (
    appointment.status === AppointmentStatuses.CANCELLED ||
    appointment.status === AppointmentStatuses.COMPLETED
  ) {
    throw new AppError("Appointment cannot be cancelled", "CONFLICT", 409);
  }

  appointment.status = AppointmentStatuses.CANCELLED;
  appointment.cancellationReason = reason ?? "Cancelled by admin";
  appointment.set("cancelledBy", adminUserId);
  await appointment.save();

  if (actor) {
    await recordAdminActivity({
      actor,
      action: "appointment.cancelled",
      entityType: "Appointment",
      entityId: appointmentId,
      targetLabel: appointment.cancellationReason,
      changes: { reason: appointment.cancellationReason },
    });
  }

  if (
    appointment.type === AppointmentTypes.SUNDAY_FREE &&
    appointment.sundaySlotInstanceId &&
    appointment.sundaySlotId
  ) {
    await SundaySlotInstanceModel.updateOne(
      {
        _id: appointment.sundaySlotInstanceId,
        "slots.slotId": appointment.sundaySlotId,
      } as Record<string, unknown>,
      {
        $set: {
          "slots.$.status": SlotStatuses.CANCELLED,
          "slots.$.patientId": undefined,
          "slots.$.appointmentId": undefined,
        },
      },
    );
  }

  return { id: appointment._id.toString(), status: appointment.status };
}

/**
 * Admin resolves a patient's pending refund request for an already-cancelled appointment:
 * "approve" fully refunds its payment; "deny" leaves the payment as paid.
 */
export async function adminResolveCancellationRequest(
  appointmentId: string,
  adminUserId: string,
  action: "approve" | "deny",
  reason?: string,
  actor?: AdminActivityActor,
) {
  await connectDatabase();

  const appointment = await AppointmentModel.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", "NOT_FOUND", 404);

  if (appointment.cancellationRequestStatus !== CancellationRequestStatuses.PENDING) {
    throw new AppError("No pending cancellation request", "CONFLICT", 409);
  }

  if (action === "deny") {
    appointment.cancellationRequestStatus = CancellationRequestStatuses.DENIED;
    appointment.cancellationRequestResolvedAt = new Date();
    appointment.set("cancellationRequestResolvedBy", adminUserId);
    await appointment.save();
    if (actor) {
      await recordAdminActivity({
        actor,
        action: "appointment.cancellation_request_denied",
        entityType: "Appointment",
        entityId: appointmentId,
        changes: { reason },
      });
    }
    return { id: appointment._id.toString(), cancellationRequestStatus: appointment.cancellationRequestStatus };
  }

  appointment.cancellationRequestStatus = CancellationRequestStatuses.APPROVED;
  appointment.cancellationRequestResolvedAt = new Date();
  appointment.set("cancellationRequestResolvedBy", adminUserId);
  await appointment.save();

  if (actor) {
    await recordAdminActivity({
      actor,
      action: "appointment.cancellation_request_approved",
      entityType: "Appointment",
      entityId: appointmentId,
    });
  }

  if (appointment.paymentId) {
    const payment = await PaymentModel.findById(appointment.paymentId);
    if (payment && payment.status === PaymentStatuses.PAID) {
      payment.status = PaymentStatuses.REFUNDED;
      payment.refundedAt = new Date();
      await payment.save();
    }
  }

  return {
    id: appointment._id.toString(),
    status: AppointmentStatuses.CANCELLED,
    cancellationRequestStatus: CancellationRequestStatuses.APPROVED,
  };
}

export async function adminReassignAppointment(
  appointmentId: string,
  newDoctorProfileId: string,
  actor?: AdminActivityActor,
) {
  await connectDatabase();

  const appointment = await AppointmentModel.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", "NOT_FOUND", 404);

  if (
    appointment.status === AppointmentStatuses.CANCELLED ||
    appointment.status === AppointmentStatuses.COMPLETED
  ) {
    throw new AppError("Appointment cannot be reassigned", "CONFLICT", 409);
  }

  const previousDoctorId = appointment.doctorId?.toString();

  const doctor = await DoctorProfileModel.findById(newDoctorProfileId).populate(
    "userId",
    "name",
  );
  if (!doctor?.isListed) {
    throw new AppError("Doctor not available", "NOT_FOUND", 404);
  }

  await AppointmentModel.findByIdAndUpdate(appointmentId, {
    $set: { doctorId: newDoctorProfileId },
  });

  const doctorUser = doctor.userId as { name?: string } | null;
  const doctorName = doctorUser?.name ?? "Doctor";

  if (actor) {
    await recordAdminActivity({
      actor,
      action: "appointment.reassigned",
      entityType: "Appointment",
      entityId: appointmentId,
      targetLabel: doctorName,
      changes: { previousDoctorId, newDoctorId: newDoctorProfileId },
    });
  }

  return {
    id: appointmentId,
    doctor: {
      id: doctor._id.toString(),
      name: doctorName,
    },
  };
}

export async function adminRescheduleAppointment(
  appointmentId: string,
  scheduledStart: string,
  scheduledEnd: string,
) {
  await connectDatabase();

  const appointment = await AppointmentModel.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", "NOT_FOUND", 404);

  if (
    appointment.status === AppointmentStatuses.CANCELLED ||
    appointment.status === AppointmentStatuses.COMPLETED
  ) {
    throw new AppError("Appointment cannot be rescheduled", "CONFLICT", 409);
  }

  appointment.scheduledStart = new Date(scheduledStart);
  appointment.scheduledEnd = new Date(scheduledEnd);
  if (appointment.status === AppointmentStatuses.PENDING) {
    appointment.status = AppointmentStatuses.CONFIRMED;
  }
  await appointment.save();

  return {
    id: appointment._id.toString(),
    status: appointment.status,
    scheduledStart: appointment.scheduledStart.toISOString(),
    scheduledEnd: appointment.scheduledEnd.toISOString(),
  };
}

/**
 * Admin marks (or unmarks) this appointment's patient as referred by this appointment's
 * doctor. This is a PATIENT-level change: `PatientProfile.referredByDoctorId` drives the
 * referral commission bonus for *every* appointment between this patient and this doctor,
 * not just the one being viewed — the caller/UI must make that scope clear.
 */
export async function adminSetAppointmentReferral(
  appointmentId: string,
  isReferral: boolean,
  actor: AdminActivityActor,
): Promise<{ isReferred: boolean }> {
  await connectDatabase();

  const appointment = await AppointmentModel.findById(appointmentId)
    .populate("patientId", "name")
    .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });
  if (!appointment) throw new AppError("Appointment not found", "NOT_FOUND", 404);

  if (appointment.providerRole !== "doctor") {
    throw new AppError(
      "Only doctor appointments support the referral toggle",
      "UNSUPPORTED",
      400,
    );
  }

  const patient = appointment.patientId as { _id?: { toString(): string }; name?: string } | null;
  const doctorProfile = appointment.doctorId as {
    _id?: { toString(): string };
    userId?: { name?: string };
  } | null;
  const doctorProfileId = doctorProfile?._id?.toString();
  if (!patient?._id || !doctorProfileId) {
    throw new AppError("Appointment is missing patient or doctor", "CONFLICT", 409);
  }

  const patientProfile = await PatientProfileModel.findOne(
    mongoFilter({ userId: patient._id.toString() }),
  );
  if (!patientProfile) throw new AppError("Patient profile not found", "NOT_FOUND", 404);

  const previousReferredByDoctorId = patientProfile.referredByDoctorId?.toString() ?? null;
  const patientName = safeDisplayText(patient.name) ?? "Patient";
  const doctorName = normalizeDoctorName(doctorProfile?.userId?.name);

  let isReferred: boolean;
  if (isReferral) {
    patientProfile.set("referredByDoctorId", doctorProfileId as never);
    patientProfile.set("referredAt", new Date());
    await patientProfile.save();
    isReferred = true;
  } else if (previousReferredByDoctorId === doctorProfileId) {
    patientProfile.set("referredByDoctorId", null);
    patientProfile.set("referredAt", null);
    await patientProfile.save();
    isReferred = false;
  } else {
    // Nothing to clear — this patient isn't currently marked as referred by this doctor.
    isReferred = false;
  }

  await recordAdminActivity({
    actor,
    action: isReferral ? "appointment.referral_set" : "appointment.referral_cleared",
    entityType: "Appointment",
    entityId: appointmentId,
    targetLabel: `${patientName} ↔ ${doctorName}`,
    changes: {
      patientProfileId: patientProfile._id.toString(),
      doctorProfileId,
      previousReferredByDoctorId,
      newReferredByDoctorId: isReferred ? doctorProfileId : null,
    },
  });

  return { isReferred };
}

/**
 * Permanently deletes an appointment and its linked payment record. This is a hard delete
 * (not the `deletedAt` soft-delete used elsewhere) intended for admin cleanup of dummy/test
 * data — it cannot be undone, so the API layer must require explicit confirmation.
 */
export async function adminDeleteAppointment(appointmentId: string, actor: AdminActivityActor) {
  await connectDatabase();

  const appointment = await AppointmentModel.findById(appointmentId)
    .populate("patientId", "name")
    .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });
  if (!appointment) throw new AppError("Appointment not found", "NOT_FOUND", 404);

  const patient = appointment.patientId as { name?: string } | null;
  const doctorProfile = appointment.doctorId as { userId?: { name?: string } } | null;
  const patientName = safeDisplayText(patient?.name) ?? "Patient";
  const doctorName = normalizeDoctorName(doctorProfile?.userId?.name);
  const paymentId = appointment.paymentId?.toString();

  if (paymentId) {
    await PaymentModel.findByIdAndDelete(paymentId);
  }
  await AppointmentModel.findByIdAndDelete(appointmentId);

  await recordAdminActivity({
    actor,
    action: "appointment.deleted",
    entityType: "Appointment",
    entityId: appointmentId,
    targetLabel: `${patientName} ↔ ${doctorName}`,
    changes: { paymentId, scheduledStart: appointment.scheduledStart.toISOString() },
  });

  return { id: appointmentId, deleted: true };
}

async function findOrCreatePatientByPhone(phone: string, name?: string) {
  const normalized = normalizePhone(phone);
  const phoneLocal = toPakistaniLocalPhone(normalizePhoneDigits(phone));

  const existing = await UserModel.findOne({
    $or: [{ phoneLookup: phoneLookupHash(normalized) }, { phoneLookup: phoneLookupHash(phoneLocal) }],
  });
  if (existing) return existing;

  return UserModel.create({
    name: name?.trim() || "WhatsApp Patient",
    phone: normalized,
    roles: [Roles.PATIENT],
    authProviders: ["credentials"],
    onboardingCompleted: false,
    isActive: true,
  });
}

const MANUAL_APPOINTMENT_TYPE_MAP = {
  clinic: AppointmentTypes.CLINIC,
  online: AppointmentTypes.ONLINE,
  home_visit: AppointmentTypes.HOME_VISIT,
} as const;

export async function adminCreateManualAppointment(input: {
  patientId?: string;
  patientPhone?: string;
  patientName?: string;
  doctorId: string;
  type: keyof typeof MANUAL_APPOINTMENT_TYPE_MAP;
  scheduledStart: string;
  scheduledEnd: string;
  patientNotes?: string;
  source?: string;
}) {
  await connectDatabase();

  const doctor = await DoctorProfileModel.findById(input.doctorId).populate(
    "userId",
    "name phone",
  );
  if (!doctor?.isListed) {
    throw new AppError("Doctor not available", "NOT_FOUND", 404);
  }

  const patient = input.patientId
    ? await UserModel.findById(input.patientId)
    : input.patientPhone
      ? await findOrCreatePatientByPhone(input.patientPhone, input.patientName)
      : null;
  if (!patient) throw new AppError("Patient not found", "NOT_FOUND", 404);

  const scheduledStart = new Date(input.scheduledStart);
  const scheduledEnd = new Date(input.scheduledEnd);

  // Reuse an existing unfinished appointment for the same patient/doctor/slot
  // instead of inserting a duplicate document — otherwise a stale PENDING
  // record left behind gets auto-cancelled later and lingers in the
  // patient's history as an unexplained "Cancelled" entry alongside the
  // new confirmed booking.
  const duplicates = await AppointmentModel.find(
    mongoFilter({
      patientId: patient._id,
      doctorId: doctor._id,
      scheduledStart,
      scheduledEnd,
      deletedAt: null,
    }),
  );

  const reusable = duplicates.find(
    (a) =>
      a.status !== AppointmentStatuses.CANCELLED &&
      a.status !== AppointmentStatuses.COMPLETED,
  );

  for (const stale of duplicates) {
    if (reusable && stale._id.toString() === reusable._id.toString()) continue;
    stale.deletedAt = new Date();
    await stale.save();
  }

  let appointment: {
    _id: { toString(): string };
    status: string;
    scheduledStart: Date;
    scheduledEnd: Date;
  };

  if (reusable) {
    reusable.type = MANUAL_APPOINTMENT_TYPE_MAP[input.type];
    reusable.status = AppointmentStatuses.CONFIRMED;
    reusable.isOnline = input.type === "online";
    reusable.patientNotes = input.source
      ? `[${input.source}] ${input.patientNotes ?? ""}`.trim()
      : input.patientNotes;
    await reusable.save();
    appointment = reusable;
  } else {
    appointment = (await AppointmentModel.create({
      type: MANUAL_APPOINTMENT_TYPE_MAP[input.type],
      status: AppointmentStatuses.CONFIRMED,
      patientId: patient._id,
      doctorId: doctor._id,
      scheduledStart,
      scheduledEnd,
      isOnline: input.type === "online",
      patientNotes: input.source
        ? `[${input.source}] ${input.patientNotes ?? ""}`.trim()
        : input.patientNotes,
    } as Record<string, unknown>)) as {
      _id: { toString(): string };
      status: string;
      scheduledStart: Date;
      scheduledEnd: Date;
    };
  }

  // Confirmed and saved — tell both sides. Never throws; a reused slot that
  // was already emailed is deduplicated by the email idempotency key.
  const appointmentId = appointment._id.toString();
  await Promise.all([
    sendBookingEmail({ appointmentId, recipient: "patient", expectedUserId: patient._id.toString() }),
    ...(doctor.userId
      ? [
          sendBookingEmail({
            appointmentId,
            recipient: "doctor",
            expectedUserId: resolveMongoRefId(doctor.userId),
          }),
        ]
      : []),
  ]);

  const doctorUser = doctor.userId as { name?: string; phone?: string } | null;
  return {
    id: appointment._id.toString(),
    status: appointment.status,
    scheduledStart: appointment.scheduledStart.toISOString(),
    scheduledEnd: appointment.scheduledEnd.toISOString(),
    type: input.type,
    patient: {
      id: patient._id.toString(),
      name: safeDisplayText(patient.name) ?? "Patient",
      phone: formatPhoneForDisplay(patient.phone),
    },
    doctor: {
      id: doctor._id.toString(),
      name: doctorUser?.name ?? "Doctor",
      phone: formatPhoneForDisplay(doctorUser?.phone),
      specialty: doctor.specialties?.[0],
    },
  };
}
