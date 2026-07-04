import {
  connectDatabase,
  UserModel,
  DoctorProfileModel,
  UrgentCareRequestModel,
  PaymentModel,
  AppointmentModel,
  VideoSessionModel,
} from "@zindagi/database";
import { PrescriptionService } from "@/server/services/prescription.service";
import {
  AppError,
  ErrorCodes,
  Roles,
  UrgentCareRequestStatuses,
  VerificationStatuses,
  URGENT_CONSULT_CONFIG,
  PaymentProviders,
  PaymentStatuses,
  AppointmentTypes,
  AppointmentStatuses,
  VideoSessionStatuses,
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
import { randomUUID } from "crypto";
import {
  buildDummyPaymentPreview,
  buildTestPaymentCheckout,
  dummyExternalTransactionId,
  isDummyPaymentMode,
  type DummyPaymentPreview,
  type TestPaymentCheckout,
} from "@/lib/payments/dummy-payment";
import {
  sendDoctorConsultBooked,
  sendUrgentConsultConfirmation,
} from "@/lib/notifications/consult-notifications";
import { ChatService } from "@/server/services/chat.service";
import { generateTxnRefNo } from "@/lib/payments/jazzcash";
import {
  buildGatewayCheckout,
  gatewayIntegrationLabel,
  resolveCheckoutProvider,
  type GatewayRedirectForm,
  type LivePaymentProvider,
} from "@/lib/payments/payment-gateway";
import type {
  UrgentAvailabilityDto,
  UrgentCareRequestDto,
  UrgentCheckoutResult,
  UrgentPatientRequestDto,
  UrgentTeamDoctorOption,
} from "@/features/urgent-consult/types";

const ACTIVE_REQUEST_STATUSES = [
  UrgentCareRequestStatuses.REQUESTED,
  UrgentCareRequestStatuses.ASSIGNED,
];

/** Show recently finished urgent consults on the patient dashboard. */
const COMPLETED_REQUEST_DISPLAY_MS = 7 * 24 * 60 * 60 * 1000;

const URGENT_PAYMENT_KIND = "urgent_care";

type UrgentPaymentMetadata = {
  kind: typeof URGENT_PAYMENT_KIND;
  patientPhone: string;
  patientNotes?: string;
  txnRefNo?: string;
  expiresAt?: string;
  integration?: string;
  gatewayPreview?: DummyPaymentPreview;
};

const EXPIRE_SWEEP_INTERVAL_MS = 60_000;
let lastExpireSweepAt = 0;

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

function mapRequestRow(
  doc: {
    _id: { toString(): string };
    patientId: { toString(): string } | { name?: string; phone?: string };
    patientPhone: string;
    patientNotes?: string | null;
    status: string;
    createdAt?: Date;
    assignedAt?: Date | null;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
    cancellationReason?: string | null;
    paymentId?:
      | { toString(): string }
      | null
      | { amount?: number; status?: string };
    appointmentId?:
      | { toString(): string }
      | null
      | {
          _id?: { toString(): string };
          scheduledStart?: Date;
          scheduledEnd?: Date;
        };
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

  let appointmentId: string | undefined;
  let scheduledStart: string | undefined;
  let scheduledEnd: string | undefined;
  const appointment = doc.appointmentId;
  if (appointment && typeof appointment === "object") {
    if ("scheduledStart" in appointment) {
      appointmentId = appointment._id?.toString();
      scheduledStart = appointment.scheduledStart?.toISOString();
      scheduledEnd = appointment.scheduledEnd?.toISOString();
    } else if ("toString" in appointment) {
      appointmentId = appointment.toString();
    }
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
    completedAt: doc.completedAt?.toISOString(),
    cancelledAt: doc.cancelledAt?.toISOString(),
    cancellationReason: doc.cancellationReason ?? undefined,
    feePkr:
      doc.paymentId &&
      typeof doc.paymentId === "object" &&
      "amount" in doc.paymentId &&
      typeof doc.paymentId.amount === "number"
        ? doc.paymentId.amount
        : undefined,
    appointmentId,
    scheduledStart,
    scheduledEnd,
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

  static async expireStalePendingPayments() {
    await UrgentConsultService.ensureConnected();
    const now = Date.now();
    if (now - lastExpireSweepAt < EXPIRE_SWEEP_INTERVAL_MS) return;
    lastExpireSweepAt = now;

    const cutoff = new Date(Date.now() - URGENT_CONSULT_CONFIG.paymentHoldDurationMs);
    await PaymentModel.updateMany(
      mongoFilter({
        status: PaymentStatuses.PENDING,
        "metadata.kind": URGENT_PAYMENT_KIND,
        createdAt: { $lt: cutoff },
      }),
      { $set: { status: PaymentStatuses.CANCELLED } },
    );
  }

  static async initiateCheckout(
    patientId: string,
    input: UrgentCareRequestInput,
  ): Promise<UrgentCheckoutResult> {
    await UrgentConsultService.ensureConnected();
    await UrgentConsultService.expireStalePendingPayments();

    const existing = await UrgentCareRequestModel.findOne(
      mongoFilter({
        patientId,
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

    const pendingPayment = await PaymentModel.findOne(
      mongoFilter({
        userId: patientId,
        status: PaymentStatuses.PENDING,
        "metadata.kind": URGENT_PAYMENT_KIND,
      }),
    ).lean();

    if (pendingPayment) {
      throw new AppError(
        "You already have a pending payment. Complete or wait for it to expire.",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    const amount = URGENT_CONSULT_CONFIG.defaultFeePkr;
    const txnRefNo = generateTxnRefNo();
    const idempotencyKey = randomUUID();
    const checkoutRef = randomUUID();
    const expiresAt = new Date(Date.now() + URGENT_CONSULT_CONFIG.paymentHoldDurationMs);
    const useDummy = isDummyPaymentMode();
    let liveProvider: LivePaymentProvider | null = null;

    if (!useDummy) {
      try {
        liveProvider = resolveCheckoutProvider(input.paymentProvider);
      } catch (error) {
        throw new AppError(
          error instanceof Error ? error.message : "Payment gateway unavailable",
          ErrorCodes.VALIDATION,
          503,
        );
      }
    }

    const dummyPreview = buildDummyPaymentPreview({
      paymentId: "pending",
      appointmentId: checkoutRef,
      amountPkr: amount,
      description: "Urgent care — video consult within 10 minutes",
      txnRefNo: `DUMMY-${txnRefNo}`,
    });

    const payment = (await PaymentModel.create({
      userId: patientId,
      provider: useDummy ? PaymentProviders.DUMMY : liveProvider!,
      status: PaymentStatuses.PENDING,
      amount,
      currency: "PKR",
      idempotencyKey,
      externalTransactionId: useDummy ? dummyPreview.txnRefNo : txnRefNo,
      metadata: {
        kind: URGENT_PAYMENT_KIND,
        patientPhone: input.patientPhone,
        patientNotes: input.patientNotes,
        txnRefNo: dummyPreview.txnRefNo,
        expiresAt: expiresAt.toISOString(),
        integration: useDummy ? "dummy_mvp" : gatewayIntegrationLabel(liveProvider!),
        gatewayPreview: useDummy ? dummyPreview : undefined,
      } satisfies UrgentPaymentMetadata,
    } as Record<string, unknown>)) as { _id: { toString(): string } };

    const paymentId = payment._id.toString();

    if (useDummy) {
      return {
        paymentId,
        amount,
        testMode: true,
        testPayment: buildTestPaymentCheckout({
          paymentId,
          appointmentId: checkoutRef,
          amountPkr: amount,
          description: "Urgent care — video consult within 10 minutes",
          txnRefNo: dummyPreview.txnRefNo,
          payPath: `/urgent-care/pay?paymentId=${paymentId}`,
        }),
      };
    }

    const gatewayRedirect = buildGatewayCheckout(liveProvider!, {
      amountPkr: amount,
      txnRefNo,
      billReference: paymentId.slice(-12),
      description: "ZindagiCare urgent care",
      paymentId,
      customerMobile: input.patientPhone,
    });

    return { paymentId, amount, gatewayRedirect, jazzcash: gatewayRedirect };
  }

  static async completeTestPayment(paymentId: string, userId: string) {
    await UrgentConsultService.ensureConnected();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment || payment.userId.toString() !== userId) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if ((payment.metadata as UrgentPaymentMetadata | undefined)?.kind !== URGENT_PAYMENT_KIND) {
      throw new AppError("Not an urgent care payment", ErrorCodes.VALIDATION, 400);
    }

    if (payment.provider !== PaymentProviders.DUMMY) {
      throw new AppError("Not a test payment", ErrorCodes.VALIDATION, 400);
    }

    const metadata = payment.metadata as UrgentPaymentMetadata;
    const txnRefNo = metadata.txnRefNo ?? paymentId;

    return UrgentConsultService.confirmAfterPayment(
      paymentId,
      dummyExternalTransactionId(txnRefNo),
    );
  }

  static async confirmAfterPayment(paymentId: string, externalTransactionId?: string) {
    await UrgentConsultService.ensureConnected();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const metadata = payment.metadata as UrgentPaymentMetadata | undefined;
    if (metadata?.kind !== URGENT_PAYMENT_KIND) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (payment.status === PaymentStatuses.PAID && payment.urgentCareRequestId) {
      return UrgentConsultService.getPatientRequest(payment.userId.toString());
    }

    if (payment.status === PaymentStatuses.PAID) {
      const linked = await UrgentCareRequestModel.findOne(
        mongoFilter({ paymentId }),
      ).lean();
      if (linked) {
        return UrgentConsultService.mapDocToPatientRequest(
          linked as Parameters<typeof mapRequestRow>[0],
        );
      }
    }

    if (payment.status !== PaymentStatuses.PENDING && payment.status !== PaymentStatuses.PAID) {
      throw new AppError("Payment is not pending", ErrorCodes.VALIDATION, 400);
    }

    const patientId = payment.userId.toString();
    const request = await UrgentConsultService.createRequestInternal(
      {
        patientPhone: metadata.patientPhone,
        patientNotes: metadata.patientNotes,
      },
      patientId,
      paymentId,
    );

    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      {
        $set: {
          status: PaymentStatuses.PAID,
          paidAt: new Date(),
          urgentCareRequestId: request.requestId,
          ...(externalTransactionId ? { externalTransactionId } : {}),
        },
      },
    );

    return request;
  }

  static async failPayment(paymentId: string, reason?: string) {
    await UrgentConsultService.ensureConnected();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (
      !payment ||
      payment.status !== PaymentStatuses.PENDING ||
      (payment.metadata as UrgentPaymentMetadata | undefined)?.kind !== URGENT_PAYMENT_KIND
    ) {
      return;
    }

    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      {
        $set: {
          status: PaymentStatuses.FAILED,
          failureReason: reason,
        },
      },
    );
  }

  static async getPaymentStatus(paymentId: string, userId: string) {
    await UrgentConsultService.ensureConnected();
    await UrgentConsultService.expireStalePendingPayments();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (
      !payment ||
      payment.userId.toString() !== userId ||
      (payment.metadata as UrgentPaymentMetadata | undefined)?.kind !== URGENT_PAYMENT_KIND
    ) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const metadata = payment.metadata as UrgentPaymentMetadata;

    let testPayment: TestPaymentCheckout | null = null;
    if (
      payment.provider === PaymentProviders.DUMMY &&
      payment.status === PaymentStatuses.PENDING
    ) {
      testPayment = buildTestPaymentCheckout({
        paymentId,
        appointmentId: paymentId,
        amountPkr: payment.amount,
        description: "Urgent care — video consult within 10 minutes",
        txnRefNo: metadata.txnRefNo,
        payPath: `/urgent-care/pay?paymentId=${paymentId}`,
      });
    }

    let booking: UrgentPatientRequestDto | null = null;
    if (payment.status === PaymentStatuses.PAID) {
      const requestId = payment.urgentCareRequestId?.toString();
      const doc = requestId
        ? await UrgentCareRequestModel.findById(requestId)
        : await UrgentCareRequestModel.findOne(mongoFilter({ paymentId }));
      const populated = doc
        ? await UrgentCareRequestModel.findById(doc._id)
            .populate("appointmentId", "scheduledStart scheduledEnd")
            .populate({
              path: "assignedDoctorId",
              populate: { path: "userId", select: "name avatarUrl" },
            })
            .lean()
        : null;
      if (populated) {
        booking = UrgentConsultService.mapDocToPatientRequest(
          populated as Parameters<typeof mapRequestRow>[0],
        );
      }
    }

    return {
      paymentId,
      status: payment.status,
      provider: payment.provider,
      amount: payment.amount,
      testMode: payment.provider === PaymentProviders.DUMMY,
      testPayment,
      booking,
    };
  }

  private static mapDocToPatientRequest(
    doc: Parameters<typeof mapRequestRow>[0],
    prescription?: UrgentPatientRequestDto["prescription"],
  ): UrgentPatientRequestDto {
    const row = mapRequestRow(doc);
    return {
      requestId: row.requestId,
      status: row.status,
      patientPhone: row.patientPhone,
      patientNotes: row.patientNotes,
      createdAt: row.createdAt,
      assignedAt: row.assignedAt,
      completedAt: row.completedAt,
      appointmentId: row.appointmentId,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      doctor: row.doctor,
      prescription,
    };
  }

  /** Close stale urgent requests when the linked video consult already ended. */
  private static async reconcileAssignedRequest(requestId: string): Promise<void> {
    const request = await UrgentCareRequestModel.findById(requestId).lean();
    if (
      !request ||
      request.status !== UrgentCareRequestStatuses.ASSIGNED ||
      !request.appointmentId
    ) {
      return;
    }

    const appointmentId = request.appointmentId.toString();
    const appointment = await AppointmentModel.findById(appointmentId)
      .select("status")
      .lean();

    if (appointment?.status === AppointmentStatuses.COMPLETED) {
      await UrgentConsultService.updateStatus(requestId, { status: "completed" });
      return;
    }

    const session = await VideoSessionModel.findOne(
      mongoFilter({ appointmentId }),
    )
      .select("status")
      .lean();

    if (session?.status === VideoSessionStatuses.COMPLETED) {
      await UrgentConsultService.tryCompleteByAppointmentId(appointmentId);
    }
  }

  static async tryCompleteByAppointmentId(appointmentId: string): Promise<boolean> {
    await UrgentConsultService.ensureConnected();

    const request = await UrgentCareRequestModel.findOne(
      mongoFilter({
        appointmentId,
        status: UrgentCareRequestStatuses.ASSIGNED,
      }),
    ).lean();

    if (!request) return false;

    await UrgentConsultService.updateStatus(request._id.toString(), { status: "completed" });
    return true;
  }

  private static async createRequestInternal(
    input: UrgentCareRequestInput,
    patientId: string,
    paymentId: string,
  ): Promise<UrgentPatientRequestDto> {
    const existing = await UrgentCareRequestModel.findOne(
      mongoFilter({
        patientId,
        status: { $in: ACTIVE_REQUEST_STATUSES },
      }),
    ).lean();

    if (existing) {
      return UrgentConsultService.mapDocToPatientRequest(
        existing as Parameters<typeof mapRequestRow>[0],
      );
    }

    const doc = await UrgentCareRequestModel.create({
      patientId,
      patientPhone: input.patientPhone,
      patientNotes: input.patientNotes,
      status: UrgentCareRequestStatuses.REQUESTED,
      paymentId,
    });

    const patient = await UserModel.findById(patientId).lean();
    const requestId = doc._id.toString();

    await notifyAdmins(
      "New urgent care request",
      `${patient?.name ?? "A patient"} paid for urgent care — assign a doctor for an in-app video consult within 10 minutes.`,
      { type: "urgent_care_requested", requestId },
    ).catch((err) => {
      console.error("[urgent-care] admin notification failed", err);
    });

    publishUrgentEvent({
      type: "booking_updated",
      appointmentId: requestId,
      patientId,
      status: UrgentCareRequestStatuses.REQUESTED,
    });

    const populated = await UrgentCareRequestModel.findById(doc._id)
      .populate("appointmentId", "scheduledStart scheduledEnd")
      .populate({
        path: "assignedDoctorId",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .lean();

    return UrgentConsultService.mapDocToPatientRequest(
      populated as Parameters<typeof mapRequestRow>[0],
    );
  }

  static async createRequest(
    _input: UrgentCareRequestInput,
    _patientId?: string | null,
  ): Promise<UrgentPatientRequestDto> {
    throw new AppError(
      "Urgent care requires payment. Use POST /api/v1/urgent/checkout.",
      ErrorCodes.VALIDATION,
      400,
    );
  }

  static async getPatientRequest(patientId: string): Promise<UrgentPatientRequestDto | null> {
    await UrgentConsultService.ensureConnected();

    let doc = await UrgentCareRequestModel.findOne(
      mongoFilter({
        patientId,
        status: { $in: ACTIVE_REQUEST_STATUSES },
      }),
    )
      .sort({ createdAt: -1 })
      .lean();

    if (
      doc &&
      doc.status === UrgentCareRequestStatuses.ASSIGNED &&
      !doc.appointmentId &&
      doc.assignedDoctorId
    ) {
      await UrgentConsultService.ensureAssignedVideoAppointment(doc._id.toString());
      doc = await UrgentCareRequestModel.findById(doc._id).lean();
    }

    if (doc?.status === UrgentCareRequestStatuses.ASSIGNED) {
      await UrgentConsultService.reconcileAssignedRequest(doc._id.toString());
      doc = await UrgentCareRequestModel.findById(doc._id).lean();
    }

    if (!doc) {
      const completedCutoff = new Date(Date.now() - COMPLETED_REQUEST_DISPLAY_MS);
      doc = await UrgentCareRequestModel.findOne(
        mongoFilter({
          patientId,
          status: UrgentCareRequestStatuses.COMPLETED,
          completedAt: { $gte: completedCutoff },
        }),
      )
        .sort({ completedAt: -1 })
        .lean();
    }

    if (!doc) return null;

    const populated = await UrgentCareRequestModel.findById(doc._id)
      .populate("patientId", "name phone")
      .populate("appointmentId", "scheduledStart scheduledEnd")
      .populate({
        path: "assignedDoctorId",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .lean();

    if (!populated) return null;

    return UrgentConsultService.mapPopulatedPatientRequest(
      populated as Parameters<typeof mapRequestRow>[0],
    );
  }

  private static async mapPopulatedPatientRequest(
    doc: Parameters<typeof mapRequestRow>[0],
  ): Promise<UrgentPatientRequestDto> {
    const row = mapRequestRow(doc);
    let prescription: UrgentPatientRequestDto["prescription"];

    if (row.appointmentId) {
      const prescriptions = await PrescriptionService.getPrescriptionsForAppointments([
        row.appointmentId,
      ]);
      prescription = prescriptions.get(row.appointmentId);
    }

    return UrgentConsultService.mapDocToPatientRequest(doc, prescription);
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
      .populate("appointmentId", "scheduledStart scheduledEnd")
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

  static async listAdminRequestHistory(): Promise<UrgentCareRequestDto[]> {
    await UrgentConsultService.ensureConnected();

    const docs = await UrgentCareRequestModel.find(
      mongoFilter({
        status: {
          $in: [
            UrgentCareRequestStatuses.COMPLETED,
            UrgentCareRequestStatuses.CANCELLED,
          ],
        },
      }),
    )
      .sort({ updatedAt: -1 })
      .limit(200)
      .populate("patientId", "name phone")
      .populate("paymentId", "amount status")
      .populate("appointmentId", "scheduledStart scheduledEnd status")
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

  /** Backfill video appointment for requests assigned before in-app video was enabled. */
  private static async ensureAssignedVideoAppointment(requestId: string): Promise<void> {
    const request = await UrgentCareRequestModel.findById(requestId);
    if (
      !request ||
      request.status !== UrgentCareRequestStatuses.ASSIGNED ||
      !request.assignedDoctorId ||
      request.appointmentId
    ) {
      return;
    }

    const assignedAt = request.assignedAt ?? new Date();
    const scheduledStart = assignedAt;
    const scheduledEnd = new Date(
      assignedAt.getTime() + URGENT_CONSULT_CONFIG.consultDurationMins * 60_000,
    );

    const appointment = (await AppointmentModel.create({
      type: AppointmentTypes.URGENT_ONLINE,
      status: AppointmentStatuses.CONFIRMED,
      patientId: request.patientId,
      doctorId: request.assignedDoctorId,
      scheduledStart,
      scheduledEnd,
      timezone: URGENT_CONSULT_CONFIG.timezone,
      isOnline: true,
      paymentId: request.paymentId,
      patientNotes: request.patientNotes,
    } as Record<string, unknown>)) as { _id: { toString(): string } };

    const appointmentId = appointment._id.toString();
    request.appointmentId = appointment._id as unknown as typeof request.appointmentId;
    await request.save();

    await ChatService.ensureAppointmentThread(appointmentId);

    if (request.paymentId) {
      await PaymentModel.updateOne(
        mongoFilter({ _id: request.paymentId }),
        { $set: { appointmentId } },
      );
    }
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

    const assignedAt = new Date();
    const scheduledStart = assignedAt;
    const scheduledEnd = new Date(
      assignedAt.getTime() + URGENT_CONSULT_CONFIG.consultDurationMins * 60_000,
    );

    let appointmentId = request.appointmentId?.toString();

    if (!appointmentId) {
      const appointment = (await AppointmentModel.create({
        type: AppointmentTypes.URGENT_ONLINE,
        status: AppointmentStatuses.CONFIRMED,
        patientId: request.patientId,
        doctorId: doctor._id,
        scheduledStart,
        scheduledEnd,
        timezone: URGENT_CONSULT_CONFIG.timezone,
        isOnline: true,
        paymentId: request.paymentId,
        patientNotes: request.patientNotes,
      } as Record<string, unknown>)) as { _id: { toString(): string } };

      appointmentId = appointment._id.toString();
      request.appointmentId = appointment._id as unknown as typeof request.appointmentId;

      await ChatService.ensureAppointmentThread(appointmentId);

      if (request.paymentId) {
        await PaymentModel.updateOne(
          mongoFilter({ _id: request.paymentId }),
          { $set: { appointmentId } },
        );
      }
    } else {
      await AppointmentModel.updateOne(
        mongoFilter({ _id: appointmentId }),
        {
          $set: {
            doctorId: doctor._id,
            scheduledStart,
            scheduledEnd,
            status: AppointmentStatuses.CONFIRMED,
          },
        },
      );
    }

    request.status = UrgentCareRequestStatuses.ASSIGNED;
    request.assignedDoctorId = doctor._id as unknown as typeof request.assignedDoctorId;
    request.assignedBy = adminUserId as unknown as typeof request.assignedBy;
    request.assignedAt = assignedAt;
    if (input.adminNotes) {
      request.adminNotes = input.adminNotes;
    }
    await request.save();

    const patient = await UserModel.findById(request.patientId).lean();
    const doctorUser = doctor.userId as {
      _id?: { toString(): string };
      name?: string;
      phone?: string;
    } | null;
    const doctorName = doctorUser?.name ?? "Doctor";
    const payment = request.paymentId
      ? await PaymentModel.findById(request.paymentId).lean()
      : null;
    const amount = payment?.amount ?? URGENT_CONSULT_CONFIG.defaultFeePkr;

    if (doctorUser?._id) {
      await sendDoctorConsultBooked({
        userId: doctorUser._id.toString(),
        phone: doctorUser.phone ?? undefined,
        patientName: patient?.name ?? "Patient",
        slotStart: scheduledStart,
        appointmentId,
        type: "urgent_online",
      }).catch((err) => {
        console.error("[urgent-care] doctor notification failed", err);
      });
    }

    await sendUrgentConsultConfirmation({
      userId: request.patientId.toString(),
      phone: patient?.phone ?? undefined,
      doctorName,
      slotStart: scheduledStart,
      amount,
      appointmentId,
    }).catch((err) => {
      console.error("[urgent-care] patient notification failed", err);
    });

    publishUrgentEvent({
      type: "doctor_assigned",
      appointmentId,
      patientId: request.patientId.toString(),
      doctorId: doctor._id.toString(),
      status: UrgentCareRequestStatuses.ASSIGNED,
    });

    const populated = await UrgentCareRequestModel.findById(requestId)
      .populate("patientId", "name phone")
      .populate("appointmentId", "scheduledStart scheduledEnd")
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

  static async listDoctorUrgentCalls(doctorUserId: string): Promise<UrgentCareRequestDto[]> {
    await UrgentConsultService.ensureConnected();

    const profile = await DoctorProfileModel.findOne(
      mongoFilter({ userId: doctorUserId }),
    ).lean();
    if (!profile) {
      throw new AppError("Doctor profile not found", ErrorCodes.NOT_FOUND, 404);
    }

    const docs = await UrgentCareRequestModel.find(
      mongoFilter({
        assignedDoctorId: profile._id,
        status: UrgentCareRequestStatuses.ASSIGNED,
      }),
    )
      .sort({ assignedAt: -1, createdAt: -1 })
      .limit(50)
      .lean();

    for (const doc of docs) {
      if (!doc.appointmentId && doc.assignedDoctorId) {
        await UrgentConsultService.ensureAssignedVideoAppointment(doc._id.toString());
      } else if (doc.status === UrgentCareRequestStatuses.ASSIGNED) {
        await UrgentConsultService.reconcileAssignedRequest(doc._id.toString());
      }
    }

    const populated = await UrgentCareRequestModel.find(
      mongoFilter({
        assignedDoctorId: profile._id,
        status: UrgentCareRequestStatuses.ASSIGNED,
      }),
    )
      .sort({ assignedAt: -1, createdAt: -1 })
      .limit(50)
      .populate("patientId", "name phone")
      .populate("appointmentId", "scheduledStart scheduledEnd")
      .populate({
        path: "assignedDoctorId",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .lean();

    return populated.map((doc) =>
      mapRequestRow(
        doc as Parameters<typeof mapRequestRow>[0],
        doc.patientId as { name?: string; phone?: string } | null,
      ),
    );
  }

  static async completeDoctorUrgentCall(doctorUserId: string, requestId: string) {
    await UrgentConsultService.ensureConnected();

    const profile = await DoctorProfileModel.findOne(
      mongoFilter({ userId: doctorUserId }),
    ).lean();
    if (!profile) {
      throw new AppError("Doctor profile not found", ErrorCodes.NOT_FOUND, 404);
    }

    const request = await UrgentCareRequestModel.findById(requestId);
    if (
      !request ||
      request.status !== UrgentCareRequestStatuses.ASSIGNED ||
      request.assignedDoctorId?.toString() !== profile._id.toString()
    ) {
      throw new AppError("Request not found", ErrorCodes.NOT_FOUND, 404);
    }

    return UrgentConsultService.updateStatus(requestId, { status: "completed" });
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
      if (request.appointmentId) {
        await AppointmentModel.updateOne(
          mongoFilter({ _id: request.appointmentId }),
          { $set: { status: AppointmentStatuses.COMPLETED, completedAt: new Date() } },
        );
      }
    } else {
      request.status = UrgentCareRequestStatuses.CANCELLED;
      request.cancelledAt = new Date();
      request.cancellationReason = input.cancellationReason;
      if (request.appointmentId) {
        await AppointmentModel.updateOne(
          mongoFilter({ _id: request.appointmentId }),
          {
            $set: {
              status: AppointmentStatuses.CANCELLED,
              cancellationReason: input.cancellationReason,
            },
          },
        );
      }
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
