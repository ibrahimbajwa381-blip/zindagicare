import {
  connectDatabase,
  UserModel,
  DoctorProfileModel,
  PatientProfileModel,
  AppointmentModel,
  HomeVisitModel,
  SundaySlotInstanceModel,
  SundayFreeRequestModel,
  UrgentCareRequestModel,
  StaffProfileModel,
  ReviewModel,
} from "@zindagi/database";
import {
  AppointmentStatuses,
  AppointmentTypes,
  HomeVisitStatuses,
  Roles,
  STAFF_ROLES,
  SundayFreeRequestStatuses,
  UrgentCareRequestStatuses,
  VerificationStatuses,
} from "@zindagi/shared";
import { getSystemSettings } from "./system-settings.service";
import { HomeVisitService } from "./home-visit.service";
import {
  formatSundayDateKey,
  getActiveOrNextSundayDate,
  getNextSundayDate,
} from "@/lib/sunday/date-utils";
import type { AdminNavCounts } from "@/features/admin/types/admin-nav";

export type { AdminNavCounts };

export type AdminDashboardStats = {
  pendingDoctorVerifications: number;
  activeDoctors: number;
  totalPatients: number;
  appointmentsToday: number;
  pendingHomeVisits: number;
  pendingUrgentCare: number;
  sundayBookingsThisWeek: number;
  systemHealth: {
    database: "ok" | "error";
    sundayConsultEnabled: boolean;
    maintenanceMode: boolean;
  };
};

export async function getAdminNavCounts(): Promise<AdminNavCounts> {
  await connectDatabase();

  const sundayDateKey = formatSundayDateKey(getActiveOrNextSundayDate());

  const [
    doctors,
    nurses,
    physiotherapists,
    reviews,
    sundayConsult,
    urgentCare,
    homeVisits,
  ] = await Promise.all([
    DoctorProfileModel.countDocuments({
      verificationStatus: VerificationStatuses.PENDING,
      verificationSubmittedAt: { $exists: true },
    }),
    StaffProfileModel.countDocuments({
      staffType: Roles.NURSE,
      verificationStatus: VerificationStatuses.PENDING,
      verificationSubmittedAt: { $exists: true },
    }),
    StaffProfileModel.countDocuments({
      staffType: Roles.PHYSIOTHERAPIST,
      verificationStatus: VerificationStatuses.PENDING,
      verificationSubmittedAt: { $exists: true },
    }),
    ReviewModel.countDocuments({
      deletedAt: null,
      isModerated: false,
    }),
    SundayFreeRequestModel.countDocuments({
      sundayDateKey,
      status: SundayFreeRequestStatuses.REQUESTED,
    }),
    UrgentCareRequestModel.countDocuments({
      status: {
        $in: [UrgentCareRequestStatuses.REQUESTED, UrgentCareRequestStatuses.ASSIGNED],
      },
    }),
    HomeVisitService.countOpenVisitsByProvider(),
  ]);

  return {
    doctors,
    nurses,
    physiotherapists,
    reviews,
    sundayConsult,
    urgentCare,
    homeVisitsDoctor: homeVisits.doctor,
    homeVisitsPhysiotherapist: homeVisits.physiotherapist,
    homeVisitsNurse: homeVisits.nurse,
  };
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  await connectDatabase();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const sundayDate = getNextSundayDate();
  const sundayEnd = new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000);

  const settings = await getSystemSettings();

  const [
    pendingDoctorVerifications,
    activeDoctors,
    totalPatients,
    appointmentsToday,
    pendingHomeVisits,
    pendingUrgentCare,
    sundayBookingsThisWeek,
  ] = await Promise.all([
    DoctorProfileModel.countDocuments({
      verificationStatus: VerificationStatuses.PENDING,
      verificationSubmittedAt: { $exists: true },
    }),
    DoctorProfileModel.countDocuments({
      verificationStatus: VerificationStatuses.APPROVED,
      isListed: true,
    }),
    UserModel.countDocuments({
      roles: { $all: [Roles.PATIENT], $nin: STAFF_ROLES },
      isActive: { $ne: false },
    }),
    AppointmentModel.countDocuments({
      scheduledStart: { $gte: todayStart, $lt: todayEnd },
      status: {
        $in: [
          AppointmentStatuses.PENDING,
          AppointmentStatuses.CONFIRMED,
          AppointmentStatuses.IN_PROGRESS,
          AppointmentStatuses.COMPLETED,
        ],
      },
    }),
    HomeVisitModel.countDocuments({
      status: { $in: [HomeVisitStatuses.REQUESTED, HomeVisitStatuses.ASSIGNED] },
    }),
    UrgentCareRequestModel.countDocuments({
      status: {
        $in: [UrgentCareRequestStatuses.REQUESTED, UrgentCareRequestStatuses.ASSIGNED],
      },
    }),
    AppointmentModel.countDocuments({
      type: AppointmentTypes.SUNDAY_FREE,
      scheduledStart: { $gte: sundayDate, $lt: sundayEnd },
      status: {
        $nin: [AppointmentStatuses.CANCELLED, AppointmentStatuses.NO_SHOW],
      },
    }),
  ]);

  let database: "ok" | "error" = "ok";
  try {
    await UserModel.findOne().select("_id").lean();
  } catch {
    database = "error";
  }

  return {
    pendingDoctorVerifications,
    activeDoctors,
    totalPatients,
    appointmentsToday,
    pendingHomeVisits,
    pendingUrgentCare,
    sundayBookingsThisWeek,
    systemHealth: {
      database,
      sundayConsultEnabled: settings.sundayConsultEnabled,
      maintenanceMode: settings.maintenanceMode,
    },
  };
}
