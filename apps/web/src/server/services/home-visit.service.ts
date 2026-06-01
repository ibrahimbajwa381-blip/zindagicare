import {
  connectDatabase,
  HomeVisitModel,
  StaffProfileModel,
  UserModel,
  type HomeVisitDocument,
} from "@zindagi/database";
<<<<<<< HEAD
import { mongoFilter } from "@/lib/mongo/query";
import type { HydratedDocument } from "mongoose";
=======
>>>>>>> de54e62 (google verification)
import {
  AppError,
  ErrorCodes,
  HomeVisitStatuses,
  HOME_CARE_PRICING,
  HOME_CARE_MATCH_RADIUS_KM,
  LAHORE_GEO,
  LAUNCH_CITY,
  Roles,
  isAdmin,
  type HomeVisitServiceType,
  type HomeVisitStatus,
} from "@zindagi/shared";
import type {
  AssignHomeVisitInput,
  CreateHomeVisitInput,
  UpdateHomeVisitStatusInput,
} from "@zindagi/validators";
import { saveHomeVisitReport } from "./home-visit-reports.storage";

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
  patientNotes?: string;
  patient?: { id: string; name: string; phone?: string };
  assignedStaff?: { id: string; name: string; phone?: string };
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

function toGeoPoint(lng: number, lat: number) {
  return { type: "Point" as const, coordinates: [lng, lat] as [number, number] };
}

function getBasePrice(serviceType: HomeVisitServiceType): number {
  return (
    HOME_CARE_PRICING[serviceType as keyof typeof HOME_CARE_PRICING] ?? 2000
  );
}

function serializeVisit(doc: Record<string, unknown>): HomeVisitDto {
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

    const lng = input.geo?.lng ?? LAHORE_GEO.lng;
    const lat = input.geo?.lat ?? LAHORE_GEO.lat;
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

  static async listVisits(
    userId: string,
    roles: string[],
    scope?: string,
    status?: string,
  ) {
    await HomeVisitService.ensureConnected();

    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };

    if (status) filter.status = status;

    if (isAdmin(roles as never) && (scope === "all" || scope === "pending")) {
      if (scope === "pending") {
        filter.status = HomeVisitStatuses.REQUESTED;
      }
    } else if (roles.includes(Roles.NURSE) && scope === "assigned") {
      filter.assignedStaffId = userId;
      filter.status = { $in: ACTIVE_STATUSES };
    } else {
      filter.patientId = userId;
    }

    const visits = await HomeVisitModel.find(filter)
      .sort({ scheduledAt: 1 })
      .populate("patientId", "name phone")
      .populate("assignedStaffId", "name phone")
      .lean();

    return visits.map((v) => serializeVisit(v as Record<string, unknown>));
  }

  static async getById(
    visitId: string,
    userId: string,
    roles: string[],
  ): Promise<HomeVisitDto> {
    await HomeVisitService.ensureConnected();

<<<<<<< HEAD
    const visit = await HomeVisitModel.findOne(
      mongoFilter({
        _id: visitId,
        deletedAt: { $exists: false },
      }),
    )
=======
    const visit = await HomeVisitModel.findOne({
      _id: visitId,
      deletedAt: { $exists: false },
    })
>>>>>>> de54e62 (google verification)
      .populate("patientId", "name phone")
      .populate("assignedStaffId", "name phone")
      .lean();

    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }

    HomeVisitService.assertCanAccess(visit as HomeVisitDocument, userId, roles);

    return serializeVisit(visit as Record<string, unknown>);
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

  static async findNearestAvailableStaff(lng: number, lat: number) {
    const nurses = await StaffProfileModel.find({
      staffType: Roles.NURSE,
      isAvailable: true,
      verificationStatus: "approved",
      deletedAt: { $exists: false },
    })
      .populate("userId", "name phone")
      .lean();

    let best: { userId: string; distanceKm: number; name: string } | null = null;

    for (const nurse of nurses) {
      const areas = nurse.serviceAreas ?? [];
      for (const area of areas) {
        if (!area.geo?.coordinates) continue;
        const [areaLng, areaLat] = area.geo.coordinates;
        const dist = haversineKm(lng, lat, areaLng, areaLat);
        const radius = area.radiusKm ?? HOME_CARE_MATCH_RADIUS_KM;
        if (dist <= radius && (!best || dist < best.distanceKm)) {
          const user = nurse.userId as { _id?: { toString(): string }; name?: string };
          if (user?._id) {
            best = {
              userId: user._id.toString(),
              distanceKm: dist,
              name: user.name ?? "Nurse",
            };
          }
        }
      }
    }

    return best;
  }

  static async autoAssignStaff(visitId: string) {
    await HomeVisitService.ensureConnected();

<<<<<<< HEAD
    const visit = (await HomeVisitModel.findById(visitId)) as HydratedDocument<
      HomeVisitDocument
    > | null;
=======
    const visit = await HomeVisitModel.findById(visitId);
>>>>>>> de54e62 (google verification)
    if (!visit) {
      throw new AppError("Visit not found", ErrorCodes.NOT_FOUND, 404);
    }
    if (visit.status !== HomeVisitStatuses.REQUESTED) {
      throw new AppError("Visit is not pending assignment", ErrorCodes.CONFLICT, 409);
    }

<<<<<<< HEAD
    const coords = visit.address?.geo?.coordinates;
    if (!coords || coords.length < 2) {
      throw new AppError("Visit address is missing location", ErrorCodes.VALIDATION, 400);
    }
    const [lng, lat] = coords;
=======
    const [lng, lat] = visit.address.geo.coordinates;
>>>>>>> de54e62 (google verification)
    const match = await HomeVisitService.findNearestAvailableStaff(lng, lat);

    if (!match) {
      throw new AppError(
        "No available nurse found in your area",
        ErrorCodes.NOT_FOUND,
        404,
      );
    }

    visit.assignedStaffId = match.userId as never;
    visit.status = HomeVisitStatuses.ASSIGNED;
<<<<<<< HEAD
    if (visit.pricing) {
      visit.pricing.distance = Math.round(match.distanceKm * 100) / 100;
    }
=======
    visit.pricing.distance = Math.round(match.distanceKm * 100) / 100;
>>>>>>> de54e62 (google verification)
    await visit.save();

    return { staffId: match.userId, staffName: match.name, distanceKm: match.distanceKm };
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

    const staff = await UserModel.findById(input.staffId);
    if (!staff?.roles?.includes(Roles.NURSE)) {
      throw new AppError("Invalid nurse", ErrorCodes.VALIDATION, 400);
    }

    visit.assignedStaffId = input.staffId as never;
    visit.status = HomeVisitStatuses.ASSIGNED;
    await visit.save();

    return { staffId: input.staffId, staffName: staff.name ?? "Nurse" };
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
        admin || (isPatient && visit.status === HomeVisitStatuses.REQUESTED);
      if (!canCancel) {
        throw new AppError("Cannot cancel at this stage", ErrorCodes.FORBIDDEN, 403);
      }
      visit.status = HomeVisitStatuses.CANCELLED;
      visit.cancelledAt = new Date();
      visit.cancellationReason = input.cancellationReason;
    } else {
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

    await visit.save();

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

    return HomeVisitService.getById(visitId, userId, roles);
  }

  static async listAvailableStaff() {
    await HomeVisitService.ensureConnected();

    const profiles = await StaffProfileModel.find({
      staffType: Roles.NURSE,
      isAvailable: true,
      verificationStatus: "approved",
      deletedAt: { $exists: false },
    })
      .populate("userId", "name phone")
      .lean();

    return profiles.map((p) => {
      const user = p.userId as { _id?: { toString(): string }; name?: string; phone?: string };
      const area = p.serviceAreas?.[0];
      return {
        id: user?._id?.toString() ?? "",
        name: user?.name ?? "Nurse",
        phone: user?.phone,
        serviceArea: area?.city ?? LAUNCH_CITY,
        radiusKm: area?.radiusKm ?? HOME_CARE_MATCH_RADIUS_KM,
      };
    });
  }
}
