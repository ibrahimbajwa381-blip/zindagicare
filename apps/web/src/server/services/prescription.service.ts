import {
  AppointmentModel,
  connectDatabase,
  DoctorProfileModel,
  PrescriptionModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  AppointmentTypes,
  isAdmin,
  Roles,
  VerificationStatuses,
} from "@zindagi/shared";
import type { CreatePrescriptionInput } from "@zindagi/validators";
import type {
  AppointmentPrescriptionLink,
  PrescriptionDetail,
  PrescriptionSummary,
} from "@/features/prescriptions/types";
import { mongoFilter } from "@/lib/mongo/query";
import { mapUserPii, revealPii } from "@/server/lib/decrypt-pii";
import { generatePrescriptionPdf } from "@/server/services/prescription-pdf";
import {
  prescriptionDownloadUrl,
  savePrescriptionPdf,
} from "@/server/services/prescription.storage";
import { VideoSessionService } from "@/server/services/video-session.service";
import { logActivity } from "@/server/services/activity-log.service";
import { sendPrescriptionIssued } from "@/lib/notifications/consult-notifications";

const ALLOWED_APPOINTMENT_STATUSES = new Set<string>([
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
  AppointmentStatuses.COMPLETED,
]);

function appointmentTypeLabel(type: string): string {
  if (type === AppointmentTypes.SUNDAY_FREE) return "Sunday Free Consult";
  if (type === AppointmentTypes.ONLINE) return "Online Consultation";
  if (type === AppointmentTypes.CLINIC) return "Clinic Visit";
  return "Consultation";
}

function mapMedications(
  medications: Array<{
    name?: string | null;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
  }>,
) {
  return medications.map((med) => ({
    name: revealPii(med.name) ?? "",
    dosage: revealPii(med.dosage) ?? "",
    frequency: revealPii(med.frequency) ?? "",
    duration: revealPii(med.duration) ?? "",
  }));
}

function toSummary(doc: {
  _id: { toString(): string };
  appointmentId?: { toString(): string } | null;
  fileKey: string;
  issuedAt?: Date | null;
  createdAt: Date;
  medications?: Array<{
    name?: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
  }>;
  doctorId?: {
    userId?: { name?: string };
  } | null;
  patientId?: { name?: string } | null;
}): PrescriptionSummary {
  const doctorUser = doc.doctorId?.userId;
  const patientUser = doc.patientId;
  const doctorName = doctorUser?.name
    ? mapUserPii({ name: doctorUser.name }).name
    : "Doctor";
  const patientName = patientUser?.name
    ? mapUserPii({ name: patientUser.name }).name
    : "Patient";

  return {
    id: doc._id.toString(),
    appointmentId: doc.appointmentId?.toString(),
    doctorName,
    patientName,
    issuedAt: (doc.issuedAt ?? doc.createdAt).toISOString(),
    medicationCount: doc.medications?.length ?? 0,
    downloadUrl: prescriptionDownloadUrl(doc.fileKey),
  };
}

async function getDoctorProfileForUser(userId: string) {
  await connectDatabase();
  const profile = await DoctorProfileModel.findOne(
    mongoFilter({ userId }),
  ).lean();
  if (!profile) {
    throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  }
  return profile;
}

function resolveRefId(ref: unknown): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === "object" && ref !== null && "_id" in ref) {
    return String((ref as { _id: { toString(): string } })._id);
  }
  if (typeof ref === "object" && ref !== null && "toString" in ref) {
    return (ref as { toString(): string }).toString();
  }
  return String(ref);
}

async function assertPrescriptionAccess(
  prescription: {
    patientId: unknown;
    doctorId?: { userId?: unknown } | null;
  },
  userId: string,
  roles: string[],
) {
  if (isAdmin(roles as never)) return;

  if (resolveRefId(prescription.patientId) === userId) return;

  const doctorUserId = resolveRefId(prescription.doctorId?.userId);
  if (doctorUserId === userId) return;

  throw new AppError("Forbidden", "FORBIDDEN", 403);
}

export class PrescriptionService {
  static async createForAppointment(
    doctorUserId: string,
    input: CreatePrescriptionInput,
  ): Promise<PrescriptionDetail> {
    await connectDatabase();

    const doctorProfile = await getDoctorProfileForUser(doctorUserId);
    if (doctorProfile.verificationStatus !== VerificationStatuses.APPROVED) {
      throw new AppError(
        "Doctor verification must be approved",
        "FORBIDDEN",
        403,
      );
    }

    const appointment = await AppointmentModel.findOne(
      mongoFilter({
        _id: input.appointmentId,
        doctorId: doctorProfile._id,
        deletedAt: null,
      }),
    ).lean();

    if (!appointment) {
      throw new AppError("Appointment not found", "NOT_FOUND", 404);
    }

    if (!ALLOWED_APPOINTMENT_STATUSES.has(appointment.status)) {
      throw new AppError(
        "Prescriptions can only be issued for confirmed, in-progress, or completed appointments",
        "VALIDATION",
        400,
      );
    }

    const existing = await PrescriptionModel.findOne(
      mongoFilter({
        appointmentId: appointment._id,
        deletedAt: null,
      }),
    ).lean();

    if (existing) {
      throw new AppError(
        "A prescription already exists for this appointment. Contact support to reissue.",
        "CONFLICT",
        409,
      );
    }

    const [doctorUser, patientUser] = await Promise.all([
      UserModel.findById(doctorUserId).lean(),
      UserModel.findById(appointment.patientId).lean(),
    ]);

    if (!doctorUser || !patientUser) {
      throw new AppError("User not found", "NOT_FOUND", 404);
    }

    const doctorPii = mapUserPii(doctorUser);
    const patientPii = mapUserPii(patientUser);
    const issuedAt = new Date();

    const pdfBuffer = await generatePrescriptionPdf({
      doctorName: doctorPii.name,
      pmdcNumber: revealPii(doctorProfile.pmdcNumber),
      specialty: doctorProfile.specialties?.[0] ?? "General Physician",
      hospital: doctorProfile.hospitals?.[0]?.name,
      patientName: patientPii.name,
      patientPhone: patientPii.phone,
      appointmentType: appointmentTypeLabel(appointment.type),
      consultDate: appointment.scheduledStart,
      issuedAt,
      medications: input.medications,
      notes: input.notes,
    });

    const stored = await savePrescriptionPdf(
      appointment._id.toString(),
      pdfBuffer,
    );

    const prescription = (await PrescriptionModel.create({
      patientId: appointment.patientId,
      doctorId: doctorProfile._id,
      appointmentId: appointment._id,
      fileUrl: stored.url,
      fileKey: stored.storageKey,
      mimeType: stored.mimeType,
      fileSizeBytes: stored.fileSizeBytes,
      issuedAt,
      medications: input.medications,
      notes: input.notes,
    } as Record<string, unknown>)) as { _id: { toString(): string } };

    await VideoSessionService.finalizeAppointmentIfAttended(appointment._id.toString());

    await sendPrescriptionIssued({
      userId: appointment.patientId.toString(),
      phone: patientPii.phone,
      doctorName: doctorPii.name,
      prescriptionId: prescription._id.toString(),
      appointmentId: appointment._id.toString(),
    }).catch((err) => {
      console.error("[prescription] failed to notify patient", err);
    });

    await logActivity({
      userId: doctorUserId,
      userRole: Roles.DOCTOR,
      action: "prescription.issued",
      entityType: "Prescription",
      entityId: prescription._id.toString(),
      metadata: { appointmentId: appointment._id.toString() },
    });

    return {
      id: prescription._id.toString(),
      appointmentId: appointment._id.toString(),
      doctorName: doctorPii.name,
      patientName: patientPii.name,
      issuedAt: issuedAt.toISOString(),
      medicationCount: input.medications.length,
      downloadUrl: stored.url,
      medications: input.medications,
      notes: input.notes,
      mimeType: stored.mimeType,
      fileSizeBytes: stored.fileSizeBytes,
    };
  }

  static async listForPatient(patientUserId: string): Promise<PrescriptionSummary[]> {
    await connectDatabase();

    const docs = await PrescriptionModel.find(
      mongoFilter({ patientId: patientUserId, deletedAt: null }),
    )
      .sort({ createdAt: -1 })
      .populate({
        path: "doctorId",
        select: "userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("patientId", "name")
      .lean();

    return docs.map((doc) => toSummary(doc as Parameters<typeof toSummary>[0]));
  }

  static async listForDoctor(
    doctorUserId: string,
    filters?: { patientId?: string; appointmentId?: string },
  ): Promise<PrescriptionSummary[]> {
    await connectDatabase();
    const doctorProfile = await getDoctorProfileForUser(doctorUserId);

    const query: Record<string, unknown> = {
      doctorId: doctorProfile._id,
      deletedAt: null,
    };
    if (filters?.patientId) query.patientId = filters.patientId;
    if (filters?.appointmentId) query.appointmentId = filters.appointmentId;

    const docs = await PrescriptionModel.find(mongoFilter(query))
      .sort({ createdAt: -1 })
      .populate({
        path: "doctorId",
        select: "userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("patientId", "name")
      .lean();

    return docs.map((doc) => toSummary(doc as Parameters<typeof toSummary>[0]));
  }

  static async getById(
    userId: string,
    roles: string[],
    prescriptionId: string,
  ): Promise<PrescriptionDetail> {
    await connectDatabase();

    const doc = await PrescriptionModel.findOne(
      mongoFilter({ _id: prescriptionId, deletedAt: null }),
    )
      .populate({
        path: "doctorId",
        select: "userId",
        populate: { path: "userId", select: "name" },
      })
      .populate("patientId", "name")
      .lean();

    if (!doc) {
      throw new AppError("Prescription not found", "NOT_FOUND", 404);
    }

    await assertPrescriptionAccess(
      doc as Parameters<typeof assertPrescriptionAccess>[0],
      userId,
      roles,
    );

    const summary = toSummary(doc as Parameters<typeof toSummary>[0]);
    return {
      ...summary,
      medications: mapMedications(doc.medications ?? []),
      notes: revealPii(doc.notes),
      mimeType: doc.mimeType ?? undefined,
      fileSizeBytes: doc.fileSizeBytes ?? undefined,
    };
  }

  static async getByFileKey(
    storageKey: string,
    userId: string,
    roles: string[],
  ) {
    await connectDatabase();

    const doc = await PrescriptionModel.findOne(
      mongoFilter({ fileKey: storageKey, deletedAt: null }),
    )
      .populate({
        path: "doctorId",
        select: "userId",
      })
      .populate("patientId", "name")
      .lean();

    if (!doc) {
      throw new AppError("Prescription not found", "NOT_FOUND", 404);
    }

    await assertPrescriptionAccess(
      doc as Parameters<typeof assertPrescriptionAccess>[0],
      userId,
      roles,
    );

    return doc;
  }

  static async getPrescriptionsForAppointments(
    appointmentIds: string[],
  ): Promise<Map<string, AppointmentPrescriptionLink>> {
    if (appointmentIds.length === 0) return new Map();

    await connectDatabase();

    const docs = await PrescriptionModel.find(
      mongoFilter({
        appointmentId: { $in: appointmentIds },
        deletedAt: null,
      }),
    )
      .select("_id appointmentId fileKey")
      .lean();

    const map = new Map<string, AppointmentPrescriptionLink>();
    for (const doc of docs) {
      const appointmentId = doc.appointmentId?.toString();
      if (!appointmentId) continue;
      map.set(appointmentId, {
        id: doc._id.toString(),
        downloadUrl: prescriptionDownloadUrl(doc.fileKey),
      });
    }
    return map;
  }

  static async getAppointmentContextForDoctor(
    doctorUserId: string,
    appointmentId: string,
  ) {
    await connectDatabase();
    const doctorProfile = await getDoctorProfileForUser(doctorUserId);

    const appointment = await AppointmentModel.findOne(
      mongoFilter({
        _id: appointmentId,
        doctorId: doctorProfile._id,
        deletedAt: null,
      }),
    )
      .populate("patientId", "name phone")
      .lean();

    if (!appointment) {
      throw new AppError("Appointment not found", "NOT_FOUND", 404);
    }

    const patient = appointment.patientId as { name?: string; phone?: string } | null;
    const patientPii = patient
      ? mapUserPii(patient)
      : { name: "Patient", email: undefined, phone: undefined };

    const existing = await PrescriptionModel.findOne(
      mongoFilter({ appointmentId: appointment._id, deletedAt: null }),
    )
      .select("_id fileKey")
      .lean();

    return {
      appointmentId: appointment._id.toString(),
      appointmentType: appointmentTypeLabel(appointment.type),
      scheduledStart: appointment.scheduledStart.toISOString(),
      patientName: patientPii.name,
      patientPhone: patientPii.phone,
      status: appointment.status,
      canIssue: ALLOWED_APPOINTMENT_STATUSES.has(appointment.status),
      existingPrescription: existing
        ? {
            id: existing._id.toString(),
            downloadUrl: prescriptionDownloadUrl(existing.fileKey),
          }
        : undefined,
    };
  }
}
