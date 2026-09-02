import { connectDatabase } from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";
import { listAllDoctors } from "./admin-doctor.service";
import {
  getPlatformCommissionSettings,
  updatePlatformCommissionSettings,
  type PlatformCommissionSettings,
} from "./system-settings.service";
import { recordAdminActivity } from "./admin-activity.service";

export type AdminFinancesDoctorRow = {
  id: string;
  name: string;
  avatarUrl?: string;
  onlineCommissionPercent: number | null;
  homeVisitCommissionPercent: number | null;
  effectiveOnlineCommissionPercent: number;
  effectiveHomeVisitCommissionPercent: number;
  totalEarnings: number;
  earningsThisMonth: number;
};

export type AdminFinancesOverview = {
  platform: PlatformCommissionSettings;
  doctors: AdminFinancesDoctorRow[];
};

export async function getAdminFinancesOverview(): Promise<AdminFinancesOverview> {
  await connectDatabase();

  const [platform, allDoctors] = await Promise.all([
    getPlatformCommissionSettings(),
    listAllDoctors(),
  ]);

  const doctors: AdminFinancesDoctorRow[] = allDoctors
    .filter((doctor) => doctor.verificationStatus === VerificationStatuses.APPROVED)
    .sort((a, b) => b.stats.totalEarnings - a.stats.totalEarnings)
    .map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      avatarUrl: doctor.avatarUrl,
      onlineCommissionPercent: doctor.onlineCommissionPercent,
      homeVisitCommissionPercent: doctor.homeVisitCommissionPercent,
      effectiveOnlineCommissionPercent: doctor.effectiveOnlineCommissionPercent,
      effectiveHomeVisitCommissionPercent: doctor.effectiveHomeVisitCommissionPercent,
      totalEarnings: doctor.stats.totalEarnings,
      earningsThisMonth: doctor.stats.earningsThisMonth,
    }));

  return { platform, doctors };
}

export async function updateAdminFinancesPlatformSettings(
  patch: Partial<PlatformCommissionSettings>,
  adminUserId: string,
): Promise<PlatformCommissionSettings> {
  const updated = await updatePlatformCommissionSettings(patch);

  await recordAdminActivity({
    actor: adminUserId,
    action: "platform_commission_settings.updated",
    entityType: "SystemSettings",
    entityId: "platform-commission",
    changes: patch,
  });

  return updated;
}
