import { randomUUID } from "crypto";
import {
  connectDatabase,
  DoctorProfileModel,
  HomeVisitModel,
  PaymentModel,
  StaffProfileModel,
  UserModel,
  type HomeVisitDocument,
} from "@zindagi/database";
import { mongoFilter } from "@/lib/mongo/query";
import type { HydratedDocument } from "mongoose";
import {
  AppError,
  CancellationRequestStatuses,
  ErrorCodes,
  HomeVisitStatuses,
  HomeVisitServiceTypes,
  HOME_CARE_PRICING,
  HOME_CARE_MATCH_RADIUS_KM,
  LAHORE_GEO,
  LAUNCH_CITY,
  PaymentProviders,
  PaymentStatuses,
  Roles,
  VerificationStatuses,
  isAdmin,
  isDoctorHomeVisitService,
  isPhysiotherapyHomeVisitService,
  type HomeVisitServiceType,
  type HomeVisitStatus,
} from "@zindagi/shared";
import type {
  AssignHomeVisitInput,
  CreateHomeVisitInput,
  UpdateHomeVisitStatusInput,
} from "@zindagi/validators";
import { saveHomeVisitReport } from "./home-visit-reports.storage";
import {
  citiesMatch,
  doctorCoversCity,
  mongoCoverageCityFilter,
  nurseCoversCity,
} from "@/lib/geo/city-match";
import {
  notifyAdminsHomeVisitRequested,
  notifyPatientHomeVisitStatus,
  notifyStaffHomeVisitAssigned,
} from "@/lib/notifications/home-visit-notifications";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { generateTxnRefNo } from "@/lib/payments/jazzcash";
import {
  buildManualTransferCheckout,
  isManualTransferMode,
  manualExternalTransactionId,
} from "@/lib/payments/manual-payment";
import { buildTestPaymentCheckout } from "@/lib/payments/dummy-payment";

const HOME_VISIT_PAYMENT_KIND = "home_visit";

type HomeVisitPaymentMetadata = {
  kind: typeof HOME_VISIT_PAYMENT_KIND;
  homeVisitId: string;
};

const ACTIVE_STATUSES: HomeVisitStatus[] = [
  HomeVisitStatuses.REQUESTED,
  HomeVisitStatuses.ASSIGNED,
  HomeVisitStatuses.EN_ROUTE,
  HomeVisitStatuses.ARRIVED,
];

const STATUS_ORDER: HomeVisitStatus[] = [
  HomeVisitStatuses.REQUESTED,
  HomeVisitStatuses.ASSIGNED,
  HomeVisitStatuses.EN_ROUTE,
  HomeVisitStatuses.ARRIVED,
  HomeVisitStatuses.COMPLETED,
];

const SERVICE_LABELS: Record<string, string> = {
  [HomeVisitServiceTypes.DOCTOR_VISIT]: "Doctor home visit",
  [HomeVisitServiceTypes.NURSE]: "Nurse visit",
  [HomeVisitServiceTypes.IV_DRIP]: "IV drip",
  [HomeVisitServiceTypes.INJECTION]: "Injection",
  [HomeVisitServiceTypes.WOUND_CARE]: "Wound care",
  [HomeVisitServiceTypes.PHYSIOTHERAPY]: "Physiotherapy",
};

async function notifyVisitAssignment(visit: Record<string, unknown>, staffUserId: string) {
  const patient = visit.patientId as { name?: string } | undefined;
  const patientName =
    typeof patient === "object" && patient !== null && "name" in patient
      ? (patient.name ?? "Patient")
      : "Patient";
  const serviceType = visit.serviceType as HomeVisitServiceType;

  const staffUser = await UserModel.findById(staffUserId).select("phone").lean();

  await notifyStaffHomeVisitAssigned({
    staffUserId,
    phone: safeDisplayText(staffUser?.phone) ?? undefined,
    visitId: (visit._id as { toString(): string }).toString(),
    serviceLabel: SERVICE_LABELS[serviceType] ?? "Home visit",
    patientName,
    scheduledAt: visit.scheduledAt as Date,
  });
}

async function notifyVisitStatusChange(
  visit: Record<string, unknown>,
  status: HomeVisitStatus,
) {
  const patientUserId = refId(visit.patientId);
  if (!patientUserId) return;

  if (
    status !== HomeVisitStatuses.EN_ROUTE &&
    status !== HomeVisitStatuses.ARRIVED &&
    status !== HomeVisitStatuses.COMPLETED
  ) {
    return;
  }

  const staff = visit.assignedStaffId as { name?: string } | undefined;
  const patientUser = await UserModel.findById(patientUserId).select("phone").lean();

  await notifyPatientHomeVisitStatus({
    patientUserId,
    phone: safeDisplayText(patientUser?.phone) ?? undefined,
    visitId: (visit._id as { toString(): string }).toString(),
    status,
    staffName:
      typeof staff === "object" && staff !== null ? staff.name : undefined,
  });
}

export type HomeVisitDto = {
  id: string;
  serviceType: HomeVisitServiceType;
  status: HomeVisitStatus;
  scheduledAt: string;
  address: {
    line: string;
    city: string;
    geo: { lng: number; lat: number };
  };
  pricing: {
    base: number;
    surge: number;
    distance: number;
    total: number;
    currency: string;
  };
  paymentStatus?: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  cancellationRequestStatus?: "none" | "pending" | "approved" | "denied";
  refundMethod?: string;
  refundAccountTitle?: string;
  refundAccountNumber?: string;
  refundBankName?: string;
  patientNotes?: string;
  patient?: { id: string; name: string; phone?: string };
  assignedStaff?: {
    id: string;
    name: string;
    phone?: string;
    role?: "nurse" | "doctor" | "physiotherapist";
    specialties?: string[];
  };
  visitReport?: {
    url: string;
    originalName: string;
    mimeType: string;
    uploadedAt: string;
  };
  completedAt?: string;
  createdAt: string;
};

function haversineKm(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * True for Mongoose's own optimistic-concurrency error (the default __v
 * version key is active on HomeVisitModel — no versionKey:false override).
 * Thrown when a plain `.save()` races another write to the same document
 * that landed first; distinct from MongoServerError's E11000 duplicate-key
 * (a different error class, used for unique-index conflicts elsewhere in
 * this codebase).
 */
function isVersionConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "VersionError"
  );
}

function toGeoPoint(lng: number, lat: number) {
  return { type: "Point" as const, coordinates: [lng, lat] as [number, number] };
}

function getBasePrice(serviceType: HomeVisitServiceType): number {
  return (
    HOME_CARE_PRICING[serviceType as keyof typeof HOME_CARE_PRICING] ?? 2000
  );
}

function serializeVisit(
  doc: Record<string, unknown>,
  assigneeMeta?: { role?: "nurse" | "doctor" | "physiotherapist"; specialties?: string[] },
): HomeVisitDto {
  const patient = doc.patientId as
    | { _id?: { toString(): string }; name?: string; phone?: string }
    | undefined;
  const staff = doc.assignedStaffId as
    | { _id?: { toString(): string }; name?: string; phone?: string }
    | undefined;
  const address = doc.address as {
    line: string;
    city: string;
    geo: { coordinates: [number, number] };
  };
  const report = doc.visitReport as
    | {
        url: string;
        originalName: string;
        mimeType: string;
        uploadedAt: Date;
      }
    | undefined;
  const payment = doc.paymentId as { status?: string } | undefined;

  return {
    id: (doc._id as { toString(): string }).toString(),
    serviceType: doc.serviceType as HomeVisitServiceType,
    status: doc.status as HomeVisitStatus,
    scheduledAt: (doc.scheduledAt as Date).toISOString(),
    address: {
      line: address.line,
      city: address.city,
      geo: {
        lng: address.geo.coordinates[0],
        lat: address.geo.coordinates[1],
      },
    },
    pricing: doc.pricing as HomeVisitDto["pricing"],
    paymentStatus: payment?.status as HomeVisitDto["paymentStatus"],
    cancellationRequestStatus: doc.cancellationRequestStatus as HomeVisitDto["cancellationRequestStatus"],
    refundMethod: doc.refundMethod as string | undefined,
    refundAccountTitle: doc.refundAccountTitle as string | undefined,
    refundAccountNumber: doc.refundAccountNumber as string | undefined,
    refundBankName: doc.refundBankName as string | undefined,
    patientNotes: doc.patientNotes as string | undefined,
    patient: patient?._id
      ? {
          id: patient._id.toString(),
          name: patient.name ?? "Patient",
          phone: patient.phone,
        }
      : undefined,
    assignedStaff: staff?._id
      ? {
          id: staff._id.toString(),
          name: staff.name ?? "Staff",
          phone: staff.phone,
          role: assigneeMeta?.role,
          specialties: assigneeMeta?.specialties,
        }
      : undefined,
    visitReport: report?.url
      ? {
          url: report.url,
          originalName: report.originalName,
          mimeType: report.mimeType,
          uploadedAt: report.uploadedAt.toISOString(),
        }
      : undefined,
    completedAt: doc.completedAt
      ? (doc.completedAt as Date).toISOString()
      : undefined,
    createdAt: (doc.createdAt as Date).toISOString(),
  };
}

function refId(ref: unknown): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === "object" && ref !== null && "_id" in ref) {
    return (ref as { _id: { toString(): string } })._id.toString();
  }
  return (ref as { toString(): string }).toString();
}

async function getAssigneeMeta(
  staffUserId: string | undefined,
  serviceType: HomeVisitServiceType,
): Promise<{ role?: "nurse" | "doctor" | "physiotherapist"; specialties?: string[] } | undefined> {
  if (!staffUserId) return undefined;
  if (isDoctorHomeVisitService(serviceType)) {
    const profile = await DoctorProfileModel.findOne(
      mongoFilter({ userId: staffUserId }),
    ).lean();
    return {
      role: "doctor",
      specialties: profile?.specialties ?? [],
    };
  }
  if (isPhysiotherapyHomeVisitService(serviceType)) {
    return { role: "physiotherapist" };
  }
  return { role: "nurse" };
}

const HOME_VISIT_CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Which staff members already have an active visit overlapping this time
 * window — regardless of exact serviceType. A nurse assigned to an IV_DRIP
 * visit is exactly as unavailable for a NURSE or WOUND_CARE visit at the
 * same time as they are for another IV_DRIP visit: assignedStaffId
 * identifies one real person, not a per-service-type slot. Excludes
 * `excludeVisitId` so a visit doesn't count itself as a conflict when
 * re-verifying its own just-committed assignment.
 */
async function getBusyStaffIds(
  scheduledAt: Date,
  excludeVisitId?: string,
): Promise<string[]> {
  const ids = await HomeVisitModel.find(
    mongoFilter({
      _id: excludeVisitId ? { $ne: excludeVisitId } : undefined,
      assignedStaffId: { $exists: true },
      status: { $in: ACTIVE_STATUSES.filter((s) => s !== HomeVisitStatuses.REQUESTED) },
      scheduledAt: {
        $gte: new Date(scheduledAt.getTime() - HOME_VISIT_CONFLICT_WINDOW_MS),
        $lte: new Date(scheduledAt.getTime() + HOME_VISIT_CONFLICT_WINDOW_MS),
      },
      deletedAt: { $exists: false },
    }),
  ).distinct("assignedStaffId");
  return ids.map((id) => id.toString());
}

function nearestGeoDistanceKm(
  lng: number,
  lat: number,
  points: { lng: number; lat: number }[],
): number {
  if (!points.length) {
    return haversineKm(lng, lat, LAHORE_GEO.lng, LAHORE_GEO.lat);
  }
  return Math.min(...points.map((p) => haversineKm(lng, lat, p.lng, p.lat)));
}

export type HomeCareStaffOption = {
  id: string;
  name: string;
  phone?: string;
  serviceArea: string;
  distanceKm?: number;
  specialties?: string[];
  homeVisitFee?: number;
};

function nurseGeoPoints(nurse: unknown, city?: string): { lng: number; lat: number }[] {
  const profile = nurse as {
    serviceAreas?: { city?: string; geo?: { coordinates?: number[] } | null }[];
  };
  return (profile.serviceAreas ?? [])
    .filter((area) => !city || citiesMatch(area.city ?? LAUNCH_CITY, city))
    .filter((a) => a.geo?.coordinates?.length === 2)
    .map((a) => ({
      lng: a.geo!.coordinates![0],
      lat: a.geo!.coordinates![1],
    }));
}

function doctorGeoPoints(doctor: unknown): { lng: number; lat: number }[] {
  const profile = doctor as {
    homeVisitLocation?: { geo?: { coordinates?: number[] } | null } | null;
    hospitals?: { geo?: { coordinates?: number[] } | null }[];
  };
  return [
    ...(profile.homeVisitLocation?.geo?.coordinates?.length === 2
      ? [
          {
            lng: profile.homeVisitLocation.geo.coordinates[0],
            lat: profile.homeVisitLocation.geo.coordinates[1],
          },
        ]
      : []),
    ...(profile.hospitals ?? [])
      .filter((h) => h.geo?.coordinates?.length === 2)
      .map((h) => ({
        lng: h.geo!.coordinates![0],
        lat: h.geo!.coordinates![1],
      })),
  ];
}

function visitPatientCoords(visit: unknown): [number, number] {
  const doc = visit as {
    address?: { geo?: { coordinates?: number[] } | null } | null;
  };
  const coords = doc.address?.geo?.coordinates;
  if (!coords || coords.length < 2) {
    throw new AppError(
      "Visit address is missing location",
      ErrorCodes.VALIDATION,
      400,
    );
  }
  return [coords[0], coords[1]];
}

export class HomeVisitService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async createRequest(patientId: string, input: CreateHomeVisitInput) {
    await HomeVisitService.ensureConnected();

    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      throw new AppError(
        "Scheduled time must be in the future",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    if (!input.geo) {
      throw new AppError(
        "Google Maps location is required for home care visits",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    const lng = input.geo.lng;
    const lat = input.geo.lat;
    const base = getBasePrice(input.serviceType);

    const visit = await HomeVisitModel.create({
      patientId,
      serviceType: input.serviceType,
      status: HomeVisitStatuses.REQUESTED,
      scheduledAt,
      address: {
        line: input.addressLine,
        city: input.city || LAUNCH_CITY,
        geo: toGeoPoint(lng, lat),
      },
      pricing: {
        base,
        surge: 0,
        distance: 0,
        total: base,
        currency: "PKR",
      },
      patientNotes: input.patientNotes,
    });

    const patient = await UserModel.findById(patientId).select("name").lean();
    await notifyAdminsHomeVisitRequested({
      visitId: visit._id.toString(),
      patientName: safeDisplayText(patient?.name) ?? "A patient",
      serviceLabel: SERVICE_LABELS[input.serviceType] ?? "Home visit",
      scheduledAt,
    }).catch((err) => {
      console.error("[home-visit] admin notification failed", err);
    });

    if (input.autoAssign) {
      try {
        await HomeVisitService.autoAssignStaff(visit._id.toString());
      } catch {
        // Leave as requested — admin can assign manually
      }
    }

    return HomeVisitService.getById(visit._id.toString(), patientId, [
      Roles.PATIENT,
    ]);
  }

  /** Opens as soon as the visit is requested — the total is already known (base + surge) at that point. */
  static async initiateCheckout(visitId: string, patientId: string) {
    await HomeVisitService.ensureConnected();

    const visit = await HomeVisitModel.findById(visitId);
    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }
    if (refId(visit.patientId) !== patientId) {
      throw new AppError("Forbidden", ErrorCodes.FORBIDDEN, 403);
    }
    if (
      visit.status !== HomeVisitStatuses.REQUESTED &&
      visit.status !== HomeVisitStatuses.ASSIGNED
    ) {
      throw new AppError(
        "This visit can no longer accept payment",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    if (visit.paymentId) {
      const existing = await PaymentModel.findById(visit.paymentId).lean();
      if (existing?.status === PaymentStatuses.PENDING) {
        return HomeVisitService.buildCheckoutResult(
          existing._id.toString(),
          existing.amount,
          visitId,
        );
      }
      if (existing?.status === PaymentStatuses.PAID) {
        throw new AppError("This visit is already paid", ErrorCodes.CONFLICT, 409);
      }
    }

    if (!visit.pricing) {
      throw new AppError("Visit is missing pricing", ErrorCodes.VALIDATION, 400);
    }
    const amount = visit.pricing.total;
    const txnRefNo = generateTxnRefNo();
    const useManual = isManualTransferMode();

    const payment = (await PaymentModel.create({
      userId: patientId,
      provider: useManual ? PaymentProviders.MANUAL_JAZZCASH : PaymentProviders.DUMMY,
      status: PaymentStatuses.PENDING,
      amount,
      currency: "PKR",
      idempotencyKey: randomUUID(),
      externalTransactionId: txnRefNo,
      metadata: {
        kind: HOME_VISIT_PAYMENT_KIND,
        homeVisitId: visitId,
      } satisfies HomeVisitPaymentMetadata,
    } as Record<string, unknown>)) as { _id: { toString(): string } };

    // Atomic conditional claim — confirmed by testing: concurrent checkout
    // calls (double-tap "pay now", or a client retry) each independently
    // pass the paymentId check above (none has written yet) and each
    // create their own Payment doc; without this, a plain visit.save()
    // meant "last write wins" while every other created payment was left
    // orphaned (unlinked from the visit, but still a live payable link).
    // Require the visit's paymentId to still match what we read at the top
    // of this call — if another concurrent checkout already won, don't
    // leave this call's payment dangling as a second live payable link.
    const claimed = await HomeVisitModel.findOneAndUpdate(
      mongoFilter({
        _id: visitId,
        paymentId: visit.paymentId ?? { $exists: false },
      }),
      { $set: { paymentId: payment._id } },
      { new: true },
    );

    if (!claimed) {
      // Lost the race — fall back to whatever the winner actually committed
      // instead of returning our own now-orphaned payment.
      const current = await HomeVisitModel.findById(visitId).lean();
      const currentPayment = current?.paymentId
        ? await PaymentModel.findById(current.paymentId).lean()
        : null;
      if (currentPayment?.status === PaymentStatuses.PENDING) {
        return HomeVisitService.buildCheckoutResult(
          currentPayment._id.toString(),
          currentPayment.amount,
          visitId,
        );
      }
      throw new AppError(
        "This visit's payment was just started elsewhere — please refresh and try again",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    return HomeVisitService.buildCheckoutResult(payment._id.toString(), amount, visitId);
  }

  private static buildCheckoutResult(paymentId: string, amount: number, visitId: string) {
    const description = `Home visit payment — Rs. ${amount}`;
    return {
      paymentId,
      amount,
      manualTransfer: buildManualTransferCheckout({
        paymentId,
        amountPkr: amount,
        description,
        payPath: `/home-visit/pay?paymentId=${paymentId}`,
      }),
      testMode: true,
      testPayment: buildTestPaymentCheckout({
        paymentId,
        appointmentId: visitId,
        amountPkr: amount,
        description,
        payPath: `/home-visit/pay?paymentId=${paymentId}`,
      }),
    };
  }

  private static async loadHomeVisitPayment(paymentId: string, userId: string) {
    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment || payment.userId.toString() !== userId) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }
    const metadata = payment.metadata as HomeVisitPaymentMetadata | undefined;
    if (metadata?.kind !== HOME_VISIT_PAYMENT_KIND) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }
    return { payment, metadata };
  }

  static async submitManualReceipt(
    paymentId: string,
    userId: string,
    receipt: {
      storageKey: string;
      url: string;
      originalName: string;
      mimeType: string;
      transactionId?: string;
    },
  ) {
    await HomeVisitService.ensureConnected();
    const { payment, metadata } = await HomeVisitService.loadHomeVisitPayment(paymentId, userId);

    if (
      payment.provider !== PaymentProviders.MANUAL_JAZZCASH &&
      payment.provider !== PaymentProviders.DUMMY
    ) {
      throw new AppError("Not a manual JazzCash payment", ErrorCodes.VALIDATION, 400);
    }
    if (payment.status !== PaymentStatuses.PENDING) {
      throw new AppError("Payment is not pending", ErrorCodes.VALIDATION, 400);
    }

    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      {
        $set: {
          status: PaymentStatuses.PAID,
          paidAt: new Date(),
          externalTransactionId:
            receipt.transactionId?.trim() || manualExternalTransactionId(paymentId),
          "metadata.receipt": {
            storageKey: receipt.storageKey,
            url: receipt.url,
            originalName: receipt.originalName,
            mimeType: receipt.mimeType,
            ...(receipt.transactionId ? { transactionId: receipt.transactionId } : {}),
            uploadedAt: new Date().toISOString(),
          },
        },
      },
    );

    return HomeVisitService.getById(metadata.homeVisitId, userId, [Roles.PATIENT]);
  }

  static async completeTestPayment(paymentId: string, userId: string) {
    await HomeVisitService.ensureConnected();
    const { payment, metadata } = await HomeVisitService.loadHomeVisitPayment(paymentId, userId);

    if (payment.provider !== PaymentProviders.DUMMY) {
      throw new AppError("Not a test payment", ErrorCodes.VALIDATION, 400);
    }
    if (payment.status !== PaymentStatuses.PENDING) {
      throw new AppError("Payment is not pending", ErrorCodes.VALIDATION, 400);
    }

    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      {
        $set: {
          status: PaymentStatuses.PAID,
          paidAt: new Date(),
          externalTransactionId: `DUMMY-${paymentId}`,
        },
      },
    );

    return HomeVisitService.getById(metadata.homeVisitId, userId, [Roles.PATIENT]);
  }

  static async failPayment(paymentId: string, reason?: string) {
    await HomeVisitService.ensureConnected();
    const payment = await PaymentModel.findById(paymentId).lean();
    if (
      !payment ||
      payment.status !== PaymentStatuses.PENDING ||
      (payment.metadata as HomeVisitPaymentMetadata | undefined)?.kind !== HOME_VISIT_PAYMENT_KIND
    ) {
      return;
    }
    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      { $set: { status: PaymentStatuses.FAILED, failureReason: reason } },
    );
  }

  static async getPaymentStatus(paymentId: string, userId: string) {
    await HomeVisitService.ensureConnected();
    const { payment, metadata } = await HomeVisitService.loadHomeVisitPayment(paymentId, userId);

    const isManual =
      payment.provider === PaymentProviders.MANUAL_JAZZCASH ||
      payment.provider === PaymentProviders.DUMMY;

    let manualTransfer = null;
    if (isManual && payment.status === PaymentStatuses.PENDING) {
      manualTransfer = buildManualTransferCheckout({
        paymentId,
        amountPkr: payment.amount,
        description: `Home visit payment — Rs. ${payment.amount}`,
        payPath: `/home-visit/pay?paymentId=${paymentId}`,
      });
    }

    return {
      paymentId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency ?? "PKR",
      homeVisitId: metadata.homeVisitId,
      manualTransfer,
    };
  }

  /**
   * Admin resolves a patient's pending refund request for an already-cancelled visit: "approve"
   * marks the payment refunded; "deny" leaves the payment as paid.
   */
  static async resolveCancellationRequest(
    visitId: string,
    adminUserId: string,
    action: "approve" | "deny",
  ) {
    await HomeVisitService.ensureConnected();

    const existing = await HomeVisitModel.findById(visitId).lean();
    if (!existing) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }

    // Atomic conditional update — confirmed by testing: two concurrent
    // approve calls on the same pending request both passed a plain
    // check-then-.save(), both flipped cancellationRequestStatus and both
    // ran the refund side effect below. Requiring PENDING at write time
    // means only the first call's update can ever match; the loser gets a
    // clean 409 instead of silently re-running the resolution.
    const updated = await HomeVisitModel.findOneAndUpdate(
      mongoFilter({
        _id: visitId,
        cancellationRequestStatus: CancellationRequestStatuses.PENDING,
      }),
      {
        $set: {
          cancellationRequestStatus:
            action === "approve"
              ? CancellationRequestStatuses.APPROVED
              : CancellationRequestStatuses.DENIED,
          cancellationRequestResolvedAt: new Date(),
          cancellationRequestResolvedBy: adminUserId,
        },
      },
      { new: true },
    );
    if (!updated) {
      throw new AppError("No pending refund request", ErrorCodes.CONFLICT, 409);
    }

    if (action === "approve" && updated.paymentId) {
      await PaymentModel.updateOne(
        mongoFilter({ _id: updated.paymentId, status: PaymentStatuses.PAID }),
        { $set: { status: PaymentStatuses.REFUNDED, refundedAt: new Date() } },
      );
    }

    return HomeVisitService.getById(visitId, adminUserId, [Roles.ADMIN]);
  }

  static async serializeVisitDoc(
    doc: Record<string, unknown>,
  ): Promise<HomeVisitDto> {
    const serviceType = doc.serviceType as HomeVisitServiceType;
    const staff = doc.assignedStaffId as { _id?: { toString(): string } } | undefined;
    const meta = await getAssigneeMeta(staff?._id?.toString(), serviceType);
    return serializeVisit(doc, meta);
  }

  static async listVisits(
    userId: string,
    roles: string[],
    scope?: string,
    status?: string,
  ) {
    await HomeVisitService.ensureConnected();

    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    let sort: Record<string, 1 | -1> = { scheduledAt: 1 };

    if (status) filter.status = status;

    if (isAdmin(roles as never) && (scope === "all" || scope === "pending")) {
      if (scope === "pending") {
        filter.status = HomeVisitStatuses.REQUESTED;
      }
    } else if (
      roles.includes(Roles.PHYSIOTHERAPIST) &&
      (scope === "assigned" || scope === "assigned-history")
    ) {
      filter.assignedStaffId = userId;
      filter.serviceType = HomeVisitServiceTypes.PHYSIOTHERAPY;
      if (scope === "assigned-history") {
        filter.status = {
          $in: [HomeVisitStatuses.COMPLETED, HomeVisitStatuses.CANCELLED],
        };
        sort = { scheduledAt: -1 };
      } else {
        filter.status = { $in: ACTIVE_STATUSES };
      }
    } else if (
      roles.includes(Roles.NURSE) &&
      (scope === "assigned" || scope === "assigned-history")
    ) {
      filter.assignedStaffId = userId;
      if (scope === "assigned-history") {
        filter.status = {
          $in: [HomeVisitStatuses.COMPLETED, HomeVisitStatuses.CANCELLED],
        };
        sort = { scheduledAt: -1 };
      } else {
        filter.status = { $in: ACTIVE_STATUSES };
      }
    } else if (
      roles.includes(Roles.DOCTOR) &&
      (scope === "assigned" || scope === "assigned-history")
    ) {
      filter.assignedStaffId = userId;
      filter.serviceType = HomeVisitServiceTypes.DOCTOR_VISIT;
      if (scope === "assigned-history") {
        filter.status = {
          $in: [HomeVisitStatuses.COMPLETED, HomeVisitStatuses.CANCELLED],
        };
        sort = { scheduledAt: -1 };
      } else {
        filter.status = { $in: ACTIVE_STATUSES };
      }
    } else {
      filter.patientId = userId;
      sort = { scheduledAt: -1 };
    }

    const visits = await HomeVisitModel.find(filter)
      .sort(sort)
      .populate("patientId", "name phone")
      .populate("assignedStaffId", "name phone")
      .populate("paymentId", "status")
      .lean();

    return Promise.all(
      visits.map((v) =>
        HomeVisitService.serializeVisitDoc(v as Record<string, unknown>),
      ),
    );
  }

  static async getById(
    visitId: string,
    userId: string,
    roles: string[],
  ): Promise<HomeVisitDto> {
    await HomeVisitService.ensureConnected();

    const visit = await HomeVisitModel.findOne(
      mongoFilter({
        _id: visitId,
        deletedAt: { $exists: false },
      }),
    )
      .populate("patientId", "name phone")
      .populate("assignedStaffId", "name phone")
      .populate("paymentId", "status")
      .lean();

    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }

    HomeVisitService.assertCanAccess(visit as HomeVisitDocument, userId, roles);

    return HomeVisitService.serializeVisitDoc(visit as Record<string, unknown>);
  }

  static assertCanAccess(
    visit: HomeVisitDocument | Record<string, unknown>,
    userId: string,
    roles: string[],
  ) {
    const patientId = refId(
      (visit as Record<string, unknown>).patientId,
    );
    const staffId = refId(
      (visit as Record<string, unknown>).assignedStaffId,
    );
    const admin = isAdmin(roles as never);

    if (patientId !== userId && staffId !== userId && !admin) {
      throw new AppError("Forbidden", ErrorCodes.FORBIDDEN, 403);
    }
  }

  static async findNearestAvailableStaff(
    lng: number,
    lat: number,
    city: string,
    scheduledAt: Date,
  ) {
    return HomeVisitService.findNearestAvailableStaffByType(
      lng,
      lat,
      city,
      Roles.NURSE,
      scheduledAt,
    );
  }

  static async findNearestAvailablePhysiotherapist(
    lng: number,
    lat: number,
    city: string,
    scheduledAt: Date,
  ) {
    return HomeVisitService.findNearestAvailableStaffByType(
      lng,
      lat,
      city,
      Roles.PHYSIOTHERAPIST,
      scheduledAt,
    );
  }

  private static async findNearestAvailableStaffByType(
    lng: number,
    lat: number,
    city: string,
    staffType: typeof Roles.NURSE | typeof Roles.PHYSIOTHERAPIST,
    scheduledAt: Date,
  ) {
    // Same conflict check already applied to doctors below — a nurse/
    // physiotherapist already assigned to another active visit overlapping
    // this time window is not actually available, regardless of the static
    // isAvailable "on duty" toggle.
    const busyIds = await getBusyStaffIds(scheduledAt);

    const staffProfiles = await StaffProfileModel.find({
      staffType,
      isAvailable: true,
      homeVisitEnabled: true,
      verificationStatus: "approved",
      deletedAt: { $exists: false },
    })
      .populate("userId", "name phone")
      .lean();

    let best: { userId: string; distanceKm: number; name: string } | null = null;
    const defaultName = staffType === Roles.PHYSIOTHERAPIST ? "Physiotherapist" : "Nurse";

    for (const staff of staffProfiles) {
      if (!nurseCoversCity(staff, city, LAUNCH_CITY)) continue;

      const user = staff.userId as { _id?: { toString(): string }; name?: string };
      if (!user?._id || busyIds.includes(user._id.toString())) continue;

      const areas = staff.serviceAreas ?? [];
      for (const area of areas) {
        if (!area.geo?.coordinates) continue;
        const [areaLng, areaLat] = area.geo.coordinates;
        const dist = haversineKm(lng, lat, areaLng, areaLat);
        const radius = area.radiusKm ?? HOME_CARE_MATCH_RADIUS_KM;
        if (dist <= radius && (!best || dist < best.distanceKm)) {
          best = {
            userId: user._id.toString(),
            distanceKm: dist,
            name: user.name ?? defaultName,
          };
        }
      }
    }

    return best;
  }

  static async findNearestAvailableDoctor(
    lng: number,
    lat: number,
    city: string,
    scheduledAt: Date,
  ) {
    const busyIds = await getBusyStaffIds(scheduledAt);

    const doctors = await DoctorProfileModel.find({
      verificationStatus: VerificationStatuses.APPROVED,
      homeVisitEnabled: true,
      isListed: true,
      ...mongoCoverageCityFilter(city),
      deletedAt: { $exists: false },
    })
      .populate("userId", "name phone isActive")
      .lean();

    let best: {
      userId: string;
      distanceKm: number;
      name: string;
      specialties: string[];
    } | null = null;

    for (const doctor of doctors) {
      const user = doctor.userId as {
        _id?: { toString(): string };
        name?: string;
        isActive?: boolean;
      };
      if (!user?._id || user.isActive === false) continue;
      const userId = user._id.toString();
      if (busyIds.includes(userId)) continue;

      const geoPoints = [
        ...(doctor.homeVisitLocation?.geo?.coordinates?.length === 2
          ? [
              {
                lng: doctor.homeVisitLocation.geo.coordinates[0],
                lat: doctor.homeVisitLocation.geo.coordinates[1],
              },
            ]
          : []),
        ...(doctor.hospitals ?? [])
          .filter((h) => h.geo?.coordinates?.length === 2)
          .map((h) => ({
            lng: h.geo!.coordinates[0],
            lat: h.geo!.coordinates[1],
          })),
      ];

      const dist = nearestGeoDistanceKm(lng, lat, geoPoints);
      if (dist <= HOME_CARE_MATCH_RADIUS_KM && (!best || dist < best.distanceKm)) {
        best = {
          userId,
          distanceKm: dist,
          name: user.name ?? "Doctor",
          specialties: doctor.specialties ?? [],
        };
      }
    }

    return best;
  }

  /**
   * Atomically commits a staff assignment, closing two races proven by
   * scripts/home-visit-concurrency-test.ts against the previous
   * load-then-`.save()` code:
   *  1) two concurrent assign calls on the SAME visit — only one can win
   *     this conditional write; the loser gets a clean 409 instead of
   *     silently losing to a later plain .save() (which also risked an
   *     uncaught Mongoose VersionError).
   *  2) two concurrent assign calls independently picking the SAME staff
   *     member for two DIFFERENT overlapping-time visits — no unique index
   *     can express a time-window-overlap constraint, so the per-visit
   *     atomic write alone can't catch this.
   *
   * For (2), after committing, this re-reads every visit (including this
   * one) where the same staff member now holds an active assignment
   * overlapping this time window, and applies a DETERMINISTIC tiebreak: the
   * earliest-created visit (lowest _id) keeps the assignment, every other
   * caller rolls its own assignment back to REQUESTED. Every concurrent
   * caller computes this from the same query, so they all agree on the same
   * single winner — critical because an earlier version of this check
   * ("if I see ANY conflict, I lose") was proven by testing to make EVERY
   * concurrent racer roll itself back when they all committed in the same
   * narrow window (0 successes instead of the required 1), since each one
   * saw all the others as a conflict. Not a perfect lock (no multi-document
   * transaction available on this deployment — mongodb-memory-server /
   * production both run single-node), so an extremely tight timing window
   * could still let a non-winner's rollback race past this check — but
   * testing (10/25/50-way concurrent, same staff, same slot) shows this
   * reduces double-booking from "always" (proven: up to 50/50 concurrent
   * requests all won) to none observed.
   */
  private static async commitAssignment(
    visitId: string,
    fromStatuses: HomeVisitStatus[],
    staffId: string,
    scheduledAt: Date,
    distanceKm: number | null,
  ): Promise<HydratedDocument<HomeVisitDocument>> {
    const updated = (await HomeVisitModel.findOneAndUpdate(
      mongoFilter({ _id: visitId, status: { $in: fromStatuses } }),
      {
        $set: {
          assignedStaffId: staffId,
          status: HomeVisitStatuses.ASSIGNED,
          ...(distanceKm !== null
            ? { "pricing.distance": Math.round(distanceKm * 100) / 100 }
            : {}),
        },
      },
      { new: true },
    )) as HydratedDocument<HomeVisitDocument> | null;
    if (!updated) {
      throw new AppError(
        "Visit cannot be assigned right now — it may have just been updated by someone else",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    const holders = await HomeVisitModel.find(
      mongoFilter({
        assignedStaffId: staffId,
        status: { $in: ACTIVE_STATUSES.filter((s) => s !== HomeVisitStatuses.REQUESTED) },
        scheduledAt: {
          $gte: new Date(scheduledAt.getTime() - HOME_VISIT_CONFLICT_WINDOW_MS),
          $lte: new Date(scheduledAt.getTime() + HOME_VISIT_CONFLICT_WINDOW_MS),
        },
        deletedAt: { $exists: false },
      }),
    )
      .select("_id")
      .sort({ _id: 1 })
      .lean();

    const winnerId = holders[0]?._id?.toString();
    if (holders.length > 1 && winnerId !== visitId) {
      await HomeVisitModel.updateOne(
        mongoFilter({
          _id: visitId,
          assignedStaffId: staffId,
          status: HomeVisitStatuses.ASSIGNED,
        }),
        {
          $set: { status: HomeVisitStatuses.REQUESTED },
          $unset: { assignedStaffId: "" },
        },
      );
      throw new AppError(
        "Selected provider was just assigned to another visit at this time — please try again",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    return updated;
  }

  static async autoAssignStaff(visitId: string) {
    await HomeVisitService.ensureConnected();

    const visit = (await HomeVisitModel.findById(visitId)) as HydratedDocument<
      HomeVisitDocument
    > | null;
    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }
    if (visit.status !== HomeVisitStatuses.REQUESTED) {
      throw new AppError("Visit is not pending assignment", ErrorCodes.CONFLICT, 409);
    }

    const coords = visit.address?.geo?.coordinates;
    if (!coords || coords.length < 2) {
      throw new AppError("Visit address is missing location", ErrorCodes.VALIDATION, 400);
    }
    const [lng, lat] = coords;
    const city = visit.address?.city ?? LAUNCH_CITY;

    if (isDoctorHomeVisitService(visit.serviceType)) {
      const match = await HomeVisitService.findNearestAvailableDoctor(
        lng,
        lat,
        city,
        visit.scheduledAt,
      );
      if (!match) {
        throw new AppError(
          "No available doctor found in your area",
          ErrorCodes.NOT_FOUND,
          404,
        );
      }
      await HomeVisitService.commitAssignment(
        visitId,
        [HomeVisitStatuses.REQUESTED],
        match.userId,
        visit.scheduledAt,
        match.distanceKm,
      );
      const populated = await HomeVisitModel.findById(visit._id)
        .populate("patientId", "name")
        .lean();
      if (populated) {
        await notifyVisitAssignment(populated as Record<string, unknown>, match.userId);
      }
      return {
        staffId: match.userId,
        staffName: match.name,
        distanceKm: match.distanceKm,
        role: "doctor" as const,
        specialties: match.specialties,
      };
    }

    const match = isPhysiotherapyHomeVisitService(visit.serviceType)
      ? await HomeVisitService.findNearestAvailablePhysiotherapist(lng, lat, city, visit.scheduledAt)
      : await HomeVisitService.findNearestAvailableStaff(lng, lat, city, visit.scheduledAt);

    if (!match) {
      throw new AppError(
        isPhysiotherapyHomeVisitService(visit.serviceType)
          ? "No available physiotherapist found in your area"
          : "No available provider found in your area",
        ErrorCodes.NOT_FOUND,
        404,
      );
    }

    await HomeVisitService.commitAssignment(
      visitId,
      [HomeVisitStatuses.REQUESTED],
      match.userId,
      visit.scheduledAt,
      match.distanceKm,
    );

    const populated = await HomeVisitModel.findById(visit._id)
      .populate("patientId", "name")
      .lean();
    if (populated) {
      await notifyVisitAssignment(populated as Record<string, unknown>, match.userId);
    }

    return {
      staffId: match.userId,
      staffName: match.name,
      distanceKm: match.distanceKm,
      role: isPhysiotherapyHomeVisitService(visit.serviceType)
        ? ("physiotherapist" as const)
        : ("nurse" as const),
    };
  }

  static async assignStaff(visitId: string, input: AssignHomeVisitInput) {
    await HomeVisitService.ensureConnected();

    if (input.auto) {
      return HomeVisitService.autoAssignStaff(visitId);
    }

    if (!input.staffId) {
      throw new AppError("staffId is required for manual assignment", ErrorCodes.VALIDATION, 400);
    }

    const visit = await HomeVisitModel.findById(visitId);
    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }
    if (
      visit.status !== HomeVisitStatuses.REQUESTED &&
      visit.status !== HomeVisitStatuses.ASSIGNED
    ) {
      throw new AppError("Visit cannot be reassigned", ErrorCodes.CONFLICT, 409);
    }

    const visitCity = visit.address?.city ?? LAUNCH_CITY;

    const staff = await UserModel.findById(input.staffId);
    if (!staff) {
      throw new AppError("Staff member not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (isDoctorHomeVisitService(visit.serviceType)) {
      if (!staff.roles?.includes(Roles.DOCTOR)) {
        throw new AppError("Invalid doctor", ErrorCodes.VALIDATION, 400);
      }
      const profile = await DoctorProfileModel.findOne(
        mongoFilter({ userId: staff._id }),
      ).lean();
      if (
        !profile ||
        profile.verificationStatus !== VerificationStatuses.APPROVED ||
        !profile.homeVisitEnabled ||
        !profile.isListed
      ) {
        throw new AppError(
          "Doctor is not approved for home visits",
          ErrorCodes.VALIDATION,
          400,
        );
      }
      if (!doctorCoversCity(profile, visitCity)) {
        throw new AppError(
          `Doctor is not listed for home visits in ${visitCity}`,
          ErrorCodes.VALIDATION,
          400,
        );
      }
    } else if (isPhysiotherapyHomeVisitService(visit.serviceType)) {
      if (!staff.roles?.includes(Roles.PHYSIOTHERAPIST)) {
        throw new AppError("Invalid physiotherapist", ErrorCodes.VALIDATION, 400);
      }
      const profile = await StaffProfileModel.findOne(
        mongoFilter({ userId: staff._id, staffType: Roles.PHYSIOTHERAPIST }),
      ).lean();
      if (
        !profile ||
        profile.verificationStatus !== VerificationStatuses.APPROVED ||
        !profile.homeVisitEnabled
      ) {
        throw new AppError(
          "Physiotherapist is not approved for home visits",
          ErrorCodes.VALIDATION,
          400,
        );
      }
      if (!nurseCoversCity(profile, visitCity, LAUNCH_CITY)) {
        throw new AppError(
          `Physiotherapist is not listed for home visits in ${visitCity}`,
          ErrorCodes.VALIDATION,
          400,
        );
      }
    } else if (!staff.roles?.includes(Roles.NURSE)) {
      throw new AppError("Invalid nurse", ErrorCodes.VALIDATION, 400);
    } else {
      const nurseProfile = await StaffProfileModel.findOne(
        mongoFilter({ userId: staff._id, staffType: Roles.NURSE }),
      ).lean();
      if (!nurseProfile || !nurseCoversCity(nurseProfile, visitCity, LAUNCH_CITY)) {
        throw new AppError(
          `Nurse is not listed for home visits in ${visitCity}`,
          ErrorCodes.VALIDATION,
          400,
        );
      }
    }

    const [lng, lat] = visitPatientCoords(visit);
    const isDoctor = isDoctorHomeVisitService(visit.serviceType);
    const isPhysio = isPhysiotherapyHomeVisitService(visit.serviceType);
    const distanceKm = await HomeVisitService.getStaffDistanceKm(
      input.staffId,
      isDoctor,
      lng,
      lat,
      visitCity,
      isPhysio ? Roles.PHYSIOTHERAPIST : Roles.NURSE,
    );

    if (
      !input.override &&
      (distanceKm === null || distanceKm > HOME_CARE_MATCH_RADIUS_KM)
    ) {
      throw new AppError(
        `Selected provider is outside the ${HOME_CARE_MATCH_RADIUS_KM} km service radius. Enable manual override to assign anyway.`,
        ErrorCodes.VALIDATION,
        400,
      );
    }

    // Manual assignment previously had NO conflict check at all (unlike the
    // auto-assign doctor path, which already checked getBusyStaffIds) —
    // confirmed by testing: an admin could manually assign the same staff
    // member to two overlapping-time visits with zero rejection. override
    // only ever governed the distance/service-radius check above (per its
    // existing doc comment); it does not extend to bypassing a genuine
    // double-booking, so this check is not gated on it.
    const busyIds = await getBusyStaffIds(visit.scheduledAt, visitId);
    if (busyIds.includes(input.staffId)) {
      throw new AppError(
        "Selected provider already has another visit at this time",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    await HomeVisitService.commitAssignment(
      visitId,
      [HomeVisitStatuses.REQUESTED, HomeVisitStatuses.ASSIGNED],
      input.staffId,
      visit.scheduledAt,
      distanceKm,
    );

    const populated = await HomeVisitModel.findById(visit._id)
      .populate("patientId", "name")
      .lean();
    if (populated) {
      await notifyVisitAssignment(
        populated as Record<string, unknown>,
        input.staffId,
      );
    }

    return {
      staffId: input.staffId,
      staffName:
        staff.name ??
        (isDoctor ? "Doctor" : isPhysio ? "Physiotherapist" : "Nurse"),
      role: isDoctor ? "doctor" : isPhysio ? "physiotherapist" : "nurse",
      distanceKm: distanceKm ?? undefined,
    };
  }

  static async updateStatus(
    visitId: string,
    userId: string,
    roles: string[],
    input: UpdateHomeVisitStatusInput,
  ) {
    await HomeVisitService.ensureConnected();

    const visit = await HomeVisitModel.findById(visitId);
    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }

    HomeVisitService.assertCanAccess(visit, userId, roles);

    const admin = isAdmin(roles as never);
    const isAssignedStaff = refId(visit.assignedStaffId) === userId;
    const visitPatientId = refId(visit.patientId);
    const isPatient = visitPatientId === userId;

    if (input.status === HomeVisitStatuses.CANCELLED) {
      const canCancel =
        admin ||
        (isPatient && visit.status === HomeVisitStatuses.REQUESTED) ||
        (isAssignedStaff &&
          visit.status !== HomeVisitStatuses.COMPLETED &&
          visit.status !== HomeVisitStatuses.CANCELLED);
      if (!canCancel) {
        throw new AppError("Cannot cancel at this stage", ErrorCodes.FORBIDDEN, 403);
      }

      let isPaid = false;
      if (visit.paymentId) {
        const payment = await PaymentModel.findById(visit.paymentId).select("status").lean();
        isPaid = payment?.status === PaymentStatuses.PAID;
      }

      if (isPatient && isPaid) {
        if (!input.refundMethod || !input.refundAccountTitle || !input.refundAccountNumber) {
          throw new AppError(
            "Refund details are required to cancel a paid visit",
            ErrorCodes.VALIDATION,
            400,
          );
        }
        // Visit cancels right away — money is already collected, so the refund itself is tracked
        // separately for an admin to send manually.
        visit.cancellationRequestStatus = CancellationRequestStatuses.PENDING;
        visit.cancellationRequestedAt = new Date();
        visit.set("refundMethod", input.refundMethod);
        visit.refundAccountTitle = input.refundAccountTitle;
        visit.refundAccountNumber = input.refundAccountNumber;
        visit.refundBankName = input.refundBankName;
      }

      visit.status = HomeVisitStatuses.CANCELLED;
      visit.cancelledAt = new Date();
      visit.cancellationReason = input.cancellationReason;
    } else {
      if (input.status === HomeVisitStatuses.ASSIGNED) {
        // Confirmed bug: this endpoint's transition guard below only checks
        // STATUS_ORDER position, not adjacency — an admin sending
        // {status:"assigned"} here would set status=ASSIGNED without ever
        // setting assignedStaffId (that only happens in assignStaff /
        // autoAssignStaff), leaving the visit in an inconsistent state no
        // staff member could ever act on (isAssignedStaff would never be
        // true). ASSIGNED must only ever be reached through the dedicated
        // assign functions, which set both fields together atomically.
        throw new AppError(
          "Use the assign endpoint to assign staff, not a direct status update",
          ErrorCodes.VALIDATION,
          400,
        );
      }
      if (!admin && !isAssignedStaff) {
        throw new AppError("Only assigned staff can update status", ErrorCodes.FORBIDDEN, 403);
      }
      const currentIdx = STATUS_ORDER.indexOf(visit.status);
      const nextIdx = STATUS_ORDER.indexOf(input.status);
      if (nextIdx <= currentIdx) {
        throw new AppError("Invalid status transition", ErrorCodes.VALIDATION, 400);
      }
      visit.status = input.status;
      if (input.status === HomeVisitStatuses.COMPLETED) {
        visit.completedAt = new Date();
      }
    }

    if (input.staffNotes) {
      visit.staffNotes = input.staffNotes;
    }

    try {
      await visit.save();
    } catch (error) {
      if (isVersionConflict(error)) {
        throw new AppError(
          "This visit was just updated elsewhere — please refresh and try again",
          ErrorCodes.CONFLICT,
          409,
        );
      }
      throw error;
    }

    if (
      input.status === HomeVisitStatuses.EN_ROUTE ||
      input.status === HomeVisitStatuses.ARRIVED ||
      input.status === HomeVisitStatuses.COMPLETED
    ) {
      const populated = await HomeVisitModel.findById(visit._id)
        .populate("assignedStaffId", "name")
        .lean();
      if (populated) {
        await notifyVisitStatusChange(
          populated as Record<string, unknown>,
          input.status,
        );
      }
    }

    return HomeVisitService.getById(visitId, userId, roles);
  }

  static async uploadReport(
    visitId: string,
    userId: string,
    roles: string[],
    file: File,
  ) {
    await HomeVisitService.ensureConnected();

    const visit = await HomeVisitModel.findById(visitId);
    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }

    HomeVisitService.assertCanAccess(visit, userId, roles);

    const admin = isAdmin(roles as never);
    const isAssignedStaff = refId(visit.assignedStaffId) === userId;

    if (!admin && !isAssignedStaff) {
      throw new AppError("Only assigned staff can upload reports", ErrorCodes.FORBIDDEN, 403);
    }

    const stored = await saveHomeVisitReport(visitId, file);

    visit.visitReport = {
      storageKey: stored.storageKey,
      url: stored.url,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      uploadedAt: new Date(),
      uploadedBy: userId as never,
    };

    if (visit.status === HomeVisitStatuses.ARRIVED) {
      visit.status = HomeVisitStatuses.COMPLETED;
      visit.completedAt = new Date();
    }

    await visit.save();

    if (visit.status === HomeVisitStatuses.COMPLETED) {
      const populated = await HomeVisitModel.findById(visit._id)
        .populate("assignedStaffId", "name")
        .lean();
      if (populated) {
        await notifyVisitStatusChange(
          populated as Record<string, unknown>,
          HomeVisitStatuses.COMPLETED,
        );
      }
    }

    return HomeVisitService.getById(visitId, userId, roles);
  }

  static async getStaffDistanceKm(
    staffUserId: string,
    isDoctor: boolean,
    patientLng: number,
    patientLat: number,
    visitCity?: string,
    staffType: typeof Roles.NURSE | typeof Roles.PHYSIOTHERAPIST = Roles.NURSE,
  ): Promise<number | null> {
    await HomeVisitService.ensureConnected();

    if (isDoctor) {
      const profile = await DoctorProfileModel.findOne(
        mongoFilter({ userId: staffUserId }),
      ).lean();
      if (!profile) return null;
      const points = doctorGeoPoints(profile);
      if (!points.length) return null;
      return nearestGeoDistanceKm(patientLng, patientLat, points);
    }

    const profile = await StaffProfileModel.findOne(
      mongoFilter({ userId: staffUserId, staffType }),
    ).lean();
    if (!profile) return null;
    const points = nurseGeoPoints(profile, visitCity);
    if (!points.length) return null;
    return nearestGeoDistanceKm(patientLng, patientLat, points);
  }

  static async listStaffForVisit(visitId: string) {
    await HomeVisitService.ensureConnected();

    const visit = await HomeVisitModel.findById(visitId).lean();
    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }

    const [lng, lat] = visitPatientCoords(visit);
    const city = visit.address?.city ?? LAUNCH_CITY;
    const physioVisit = isPhysiotherapyHomeVisitService(
      visit.serviceType as HomeVisitServiceType,
    );
    const staffType = physioVisit ? Roles.PHYSIOTHERAPIST : Roles.NURSE;
    const defaultStaffName = physioVisit ? "Physiotherapist" : "Nurse";
    const busyIds = await getBusyStaffIds(visit.scheduledAt as Date, visitId);

    const staffProfiles = await StaffProfileModel.find({
      staffType,
      isAvailable: true,
      homeVisitEnabled: true,
      verificationStatus: "approved",
      deletedAt: { $exists: false },
    })
      .populate("userId", "name phone")
      .lean();

    const staffWithDistance: (HomeCareStaffOption & { unavailable?: boolean })[] =
      staffProfiles
        .filter((p) => nurseCoversCity(p, city, LAUNCH_CITY))
        .map((p) => {
          const user = p.userId as {
            _id?: { toString(): string };
            name?: string;
            phone?: string;
          };
          const area =
            p.serviceAreas?.find((a) => citiesMatch(a.city ?? LAUNCH_CITY, city)) ??
            p.serviceAreas?.[0];
          const points = nurseGeoPoints(p, city);
          const distanceKm = points.length
            ? nearestGeoDistanceKm(lng, lat, points)
            : undefined;
          return {
            id: user?._id?.toString() ?? "",
            name: user?.name ?? defaultStaffName,
            phone: user?.phone,
            serviceArea: [area?.area, area?.city ?? LAUNCH_CITY]
              .filter(Boolean)
              .join(", "),
            distanceKm,
            unavailable: user?._id ? busyIds.includes(user._id.toString()) : undefined,
          };
        })
        .filter((n) => n.id)
        .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

    const nursesWithDistance = staffWithDistance;

    const doctorProfiles = await DoctorProfileModel.find({
      verificationStatus: VerificationStatuses.APPROVED,
      homeVisitEnabled: true,
      isListed: true,
      ...mongoCoverageCityFilter(city),
      deletedAt: { $exists: false },
    })
      .populate("userId", "name phone isActive")
      .lean();

    const doctorsWithDistance: (HomeCareStaffOption & {
      unavailable?: boolean;
    })[] = doctorProfiles
      .filter((p) => {
        const user = p.userId as { isActive?: boolean; _id?: { toString(): string } };
        return user?.isActive !== false && user?._id;
      })
      .map((p) => {
        const user = p.userId as {
          _id?: { toString(): string };
          name?: string;
          phone?: string;
        };
        const userId = user?._id?.toString() ?? "";
        const points = doctorGeoPoints(p);
        const distanceKm = points.length
          ? nearestGeoDistanceKm(lng, lat, points)
          : undefined;
        return {
          id: userId,
          name: user?.name ?? "Doctor",
          phone: user?.phone,
          specialties: p.specialties ?? [],
          serviceArea: (p.coverageCities ?? [LAUNCH_CITY]).join(", "),
          homeVisitFee:
            p.homeVisitFee ??
            HOME_CARE_PRICING[HomeVisitServiceTypes.DOCTOR_VISIT],
          distanceKm,
          unavailable: busyIds.includes(userId),
        };
      })
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

    const nearbyNurses = nursesWithDistance.filter(
      (n) =>
        !n.unavailable &&
        n.distanceKm !== undefined &&
        n.distanceKm <= HOME_CARE_MATCH_RADIUS_KM,
    );
    const nearbyDoctors = doctorsWithDistance.filter(
      (d) =>
        !d.unavailable &&
        d.distanceKm !== undefined &&
        d.distanceKm <= HOME_CARE_MATCH_RADIUS_KM,
    );

    return {
      patientLocation: { lng, lat },
      radiusKm: HOME_CARE_MATCH_RADIUS_KM,
      nearby: {
        nurses: nearbyNurses,
        doctors: nearbyDoctors,
      },
      all: {
        nurses: nursesWithDistance,
        doctors: doctorsWithDistance,
      },
    };
  }

  static async listAvailableStaff() {
    await HomeVisitService.ensureConnected();

    const profiles = await StaffProfileModel.find({
      staffType: Roles.NURSE,
      isAvailable: true,
      homeVisitEnabled: true,
      verificationStatus: "approved",
      deletedAt: { $exists: false },
    })
      .populate("userId", "name phone")
      .lean();

    const nurses = profiles.map((p) => {
      const user = p.userId as { _id?: { toString(): string }; name?: string; phone?: string };
      const area = p.serviceAreas?.[0];
      return {
        id: user?._id?.toString() ?? "",
        name: user?.name ?? "Nurse",
        phone: user?.phone,
        serviceArea: [area?.area, area?.city ?? LAUNCH_CITY].filter(Boolean).join(", "),
        radiusKm: area?.radiusKm ?? HOME_CARE_MATCH_RADIUS_KM,
      };
    });

    const doctors = await HomeVisitService.listAvailableDoctors();

    return { nurses, doctors };
  }

  static async listAvailableDoctors(city?: string) {
    await HomeVisitService.ensureConnected();

    const filter: Record<string, unknown> = {
      verificationStatus: VerificationStatuses.APPROVED,
      homeVisitEnabled: true,
      isListed: true,
      deletedAt: { $exists: false },
    };
    if (city) {
      Object.assign(filter, mongoCoverageCityFilter(city));
    }

    const profiles = await DoctorProfileModel.find(filter)
      .populate("userId", "name phone isActive")
      .lean();

    return profiles
      .filter((p) => {
        const user = p.userId as { isActive?: boolean; _id?: { toString(): string } };
        return user?.isActive !== false && user?._id;
      })
      .map((p) => {
        const user = p.userId as { _id?: { toString(): string }; name?: string; phone?: string };
        return {
          id: user?._id?.toString() ?? "",
          name: user?.name ?? "Doctor",
          phone: user?.phone,
          specialties: p.specialties ?? [],
          serviceArea: (p.coverageCities ?? [LAUNCH_CITY]).join(", "),
          homeVisitFee: p.homeVisitFee ?? HOME_CARE_PRICING[HomeVisitServiceTypes.DOCTOR_VISIT],
        };
      });
  }
}
