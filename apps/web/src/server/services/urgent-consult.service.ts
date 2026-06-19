import {
  connectDatabase,
  UserModel,
  DoctorProfileModel,
  UrgentCareRequestModel,
} from "@zindagi/database";
import {
  AppError,
  ErrorCodes,
  Roles,
  UrgentCareRequestStatuses,
  VerificationStatuses,
  URGENT_CONSULT_CONFIG,
} from "@zindagi/shared";
import type {
  UrgentCareAssignInput,
  UrgentCareRequestInput,
  UrgentCareStatusInput,
} from "@zindagi/validators";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { publishUrgentEvent } from "@/lib/realtime/urgent-emitter";
import { mongoFilter } from "@/lib/mongo/query";
import { formatPhoneForDisplay, safeDisplayText } from "@/server/lib/decrypt-pii";
import { findOrCreatePhoneUser } from "@/server/services/auth.service";
import type {
  UrgentAvailabilityDto,
  UrgentCareRequestDto,
  UrgentPatientRequestDto,
  UrgentTeamDoctorOption,
} from "@/features/urgent-consult/types";

const ACTIVE_REQUEST_STATUSES = [
  UrgentCareRequestStatuses.REQUESTED,
  UrgentCareRequestStatuses.ASSIGNED,
];

async function notifyAdmins(title: string, body: string, payload: Record<string, unknown>) {
  await connectDatabase();
  const { NotificationModel } = await import("@zindagi/database");
  const { NotificationChannels } = await import("@zindagi/shared");

  const admins = await UserModel.find({
    roles: { $in: [Roles.ADMIN, Roles.SUPER_ADMIN] },
    isActive: { $ne: false },
    deletedAt: null,
  })
    .select("_id")
    .lean();

  for (const admin of admins) {
    await NotificationModel.create({
      userId: admin._id.toString(),
      channel: NotificationChannels.IN_APP,
      title,
      body,
      payload,
      sentAt: new Date(),
    });
  }
}

async function notifyDoctorAssigned(params: {
  doctorUserId: string;
  patientName: string;
  patientPhone: string;
  requestId: string;
}) {
  await connectDatabase();
  const { NotificationModel } = await import("@zindagi/database");
  const { NotificationChannels } = await import("@zindagi/shared");

  await NotificationModel.create({
    userId: params.doctorUserId,
    channel: NotificationChannels.IN_APP,
    title: "Urgent care patient assigned",
    body: `${params.patientName} needs an urgent callback at ${params.patientPhone}. Call them directly.`,
    payload: {
      type: "urgent_care_assigned",
      requestId: params.requestId,
      patientPhone: params.patientPhone,
    },
    sentAt: new Date(),
  });
}

function mapRequestRow(
  doc: {
    _id: { toString(): string };
    patientId: { toString(): string } | { name?: string; phone?: string };
    patientPhone: string;
    patientNotes?: string | null;
    status: string;
    createdAt?: Date;
    assignedAt?: Date | null;
    assignedDoctorId?: { toString(): string } | null | {
      _id?: { toString(): string };
      userId?: { name?: string; avatarUrl?: string } | null;
      specialties?: string[];
      pmdcVerified?: boolean;
    };
  },
  patient?: { name?: string; phone?: string } | null,
): UrgentCareRequestDto {
  const patientUser =
    patient ??
    (typeof doc.patientId === "object" && doc.patientId && "name" in doc.patientId
      ? (doc.patientId as { name?: string; phone?: string })
      : null);

  let doctor: UrgentCareRequestDto["doctor"] | undefined;
  const assigned = doc.assignedDoctorId;
  if (assigned && typeof assigned === "object" && "userId" in assigned) {
    const user = assigned.userId as { name?: string; avatarUrl?: string } | null | undefined;
    const name = user?.name ?? "Doctor";
    doctor = {
      doctorId: assigned._id?.toString() ?? "",
      name,
      avatarUrl: resolveDoctorPortrait(name, user?.avatarUrl),
      specialty: assigned.specialties?.[0] ?? "General Physician",
      pmdcVerified: assigned.pmdcVerified ?? false,
    };
  }

  return {
    requestId: doc._id.toString(),
    patientId:
      typeof doc.patientId === "object" && "toString" in doc.patientId
        ? doc.patientId.toString()
        : "",
    patientName: safeDisplayText(patientUser?.name) ?? "Patient",
    patientPhone: formatPhoneForDisplay(doc.patientPhone) ?? doc.patientPhone,
    patientNotes: doc.patientNotes ?? undefined,
    status: doc.status,
    createdAt: doc.createdAt?.toISOString() ?? new Date().toISOString(),
    assignedAt: doc.assignedAt?.toISOString(),
    doctor,
  };
}

export class UrgentConsultService {
  private static async ensureConnected() {
    await connectDatabase();
  }

  static async getAvailability(): Promise<UrgentAvailabilityDto> {
    return {
      available: true,
      doctorsOnline: 0,
      estimatedWaitMinutes: URGENT_CONSULT_CONFIG.minWaitMinutes,
      estimatedWaitMaxMinutes: URGENT_CONSULT_CONFIG.maxWaitMinutes,
      consultDurationMins: URGENT_CONSULT_CONFIG.consultDurationMins,
      feePkr: URGENT_CONSULT_CONFIG.defaultFeePkr,
      targetCallWithinMinutes: URGENT_CONSULT_CONFIG.targetCallWithinMinutes,
    };
  }

  static async createRequest(
    input: UrgentCareRequestInput,
    patientId?: string | null,
  ) {
    await UrgentConsultService.ensureConnected();

    const resolvedPatientId =
      patientId ?? (await findOrCreatePhoneUser(input.patientPhone))._id.toString();

    const existing = await UrgentCareRequestModel.findOne(
      mongoFilter({
        patientId: resolvedPatientId,
        status: { $in: ACTIVE_REQUEST_STATUSES },
      }),
    ).lean();

    if (existing) {
      throw new AppError(
        "You already have an active urgent care request. Our team is handling it.",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    const doc = await UrgentCareRequestModel.create({
      patientId: resolvedPatientId,
      patientPhone: input.patientPhone,
      patientNotes: input.patientNotes,
      status: UrgentCareRequestStatuses.REQUESTED,
    });

    const patient = await UserModel.findById(resolvedPatientId).lean();
    const requestId = doc._id.toString();

    await notifyAdmins(
      "New urgent care request",
      `${patient?.name ?? "A patient"} requested urgent care — assign a doctor and arrange a callback.`,
      { type: "urgent_care_requested", requestId },
    ).catch((err) => {
      console.error("[urgent-care] admin notification failed", err);
    });

    publishUrgentEvent({
      type: "booking_updated",
      appointmentId: requestId,
      patientId: resolvedPatientId,
      status: UrgentCareRequestStatuses.REQUESTED,
    });

    return UrgentConsultService.getPatientRequest(resolvedPatientId);
  }

  static async getPatientRequest(patientId: string): Promise<UrgentPatientRequestDto | null> {
    await UrgentConsultService.ensureConnected();

    const doc = await UrgentCareRequestModel.findOne(
      mongoFilter({
        patientId,
        status: { $in: ACTIVE_REQUEST_STATUSES },
      }),
    )
      .sort({ createdAt: -1 })
      .populate({
        path: "assignedDoctorId",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .lean();

    if (!doc) return null;

    const row = mapRequestRow(doc as Parameters<typeof mapRequestRow>[0]);
    return {
      requestId: row.requestId,
      status: row.status,
      patientPhone: row.patientPhone,
      patientNotes: row.patientNotes,
      createdAt: row.createdAt,
      assignedAt: row.assignedAt,
      doctor: row.doctor,
    };
  }

  static async listAdminRequests(): Promise<UrgentCareRequestDto[]> {
    await UrgentConsultService.ensureConnected();

    const docs = await UrgentCareRequestModel.find(
      mongoFilter({
        status: {
          $in: [
            UrgentCareRequestStatuses.REQUESTED,
            UrgentCareRequestStatuses.ASSIGNED,
          ],
        },
      }),
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("patientId", "name phone")
      .populate({
        path: "assignedDoctorId",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .lean();

    return docs.map((doc) =>
      mapRequestRow(
        doc as Parameters<typeof mapRequestRow>[0],
        doc.patientId as { name?: string; phone?: string } | null,
      ),
    );
  }

  static async listTeamDoctors(): Promise<UrgentTeamDoctorOption[]> {
    await UrgentConsultService.ensureConnected();

    const doctors = await DoctorProfileModel.find({
      isListed: true,
      verificationStatus: VerificationStatuses.APPROVED,
    })
      .populate("userId", "name")
      .sort({ ratingAvg: -1, ratingCount: -1 })
      .lean();

    return doctors.map((doc) => {
      const user = doc.userId as { name?: string } | null;
      const name = user?.name ?? "Doctor";
      return {
        doctorId: doc._id.toString(),
        name,
        specialties: doc.specialties ?? [],
        pmdcVerified: doc.pmdcVerified ?? false,
      };
    });
  }

  static async assignDoctor(
    requestId: string,
    adminUserId: string,
    input: UrgentCareAssignInput,
  ) {
    await UrgentConsultService.ensureConnected();

    const request = await UrgentCareRequestModel.findById(requestId);
    if (!request || !ACTIVE_REQUEST_STATUSES.includes(request.status as (typeof ACTIVE_REQUEST_STATUSES)[number])) {
      throw new AppError("Request not found", ErrorCodes.NOT_FOUND, 404);
    }

    const doctor = await DoctorProfileModel.findById(input.doctorId)
      .populate("userId", "name phone")
      .lean();
    if (!doctor?.isListed || doctor.verificationStatus !== VerificationStatuses.APPROVED) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
    }

    request.status = UrgentCareRequestStatuses.ASSIGNED;
    request.assignedDoctorId = doctor._id as unknown as typeof request.assignedDoctorId;
    request.assignedBy = adminUserId as unknown as typeof request.assignedBy;
    request.assignedAt = new Date();
    if (input.adminNotes) {
      request.adminNotes = input.adminNotes;
    }
    await request.save();

    const patient = await UserModel.findById(request.patientId).lean();
    const doctorUser = doctor.userId as { _id?: { toString(): string }; name?: string } | null;

    if (doctorUser?._id) {
      await notifyDoctorAssigned({
        doctorUserId: doctorUser._id.toString(),
        patientName: patient?.name ?? "Patient",
        patientPhone: formatPhoneForDisplay(request.patientPhone) ?? request.patientPhone,
        requestId,
      });
    }

    publishUrgentEvent({
      type: "doctor_assigned",
      appointmentId: requestId,
      patientId: request.patientId.toString(),
      doctorId: doctor._id.toString(),
      status: UrgentCareRequestStatuses.ASSIGNED,
    });

    const populated = await UrgentCareRequestModel.findById(requestId)
      .populate("patientId", "name phone")
      .populate({
        path: "assignedDoctorId",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .lean();

    return mapRequestRow(
      populated as Parameters<typeof mapRequestRow>[0],
      populated?.patientId as { name?: string; phone?: string } | null,
    );
  }

  static async updateStatus(requestId: string, input: UrgentCareStatusInput) {
    await UrgentConsultService.ensureConnected();

    const request = await UrgentCareRequestModel.findById(requestId);
    if (!request) {
      throw new AppError("Request not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (input.status === "completed") {
      request.status = UrgentCareRequestStatuses.COMPLETED;
      request.completedAt = new Date();
    } else {
      request.status = UrgentCareRequestStatuses.CANCELLED;
      request.cancelledAt = new Date();
      request.cancellationReason = input.cancellationReason;
    }
    await request.save();

    publishUrgentEvent({
      type: "status_changed",
      appointmentId: requestId,
      patientId: request.patientId.toString(),
      status: request.status,
    });

    return { requestId, status: request.status };
  }
}
