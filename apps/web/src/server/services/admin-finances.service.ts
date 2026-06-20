import { connectDatabase, DoctorProfileModel, UserModel } from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { mapUserPii } from "@/server/lib/decrypt-pii";
import {
  getDoctorCommissionRatesByProfileIds,
  type DoctorCommissionRates,
} from "./commission.service";
import {
  getPlatformCommissionSettings,
  updatePlatformCommissionSettings,
  type PlatformCommissionSettings,
} from "./system-settings.service";

export type AdminFinancesDoctorRow = {
  id: string;
  name: string;
  onlineCommissionPercent: number | null;
  homeVisitCommissionPercent: number | null;
  effectiveOnlineCommissionPercent: number;
  effectiveHomeVisitCommissionPercent: number;
};

export type AdminFinancesOverview = {
  platform: PlatformCommissionSettings;
  doctors: AdminFinancesDoctorRow[];
};

export async function getAdminFinancesOverview(): Promise<AdminFinancesOverview> {
  await connectDatabase();

  const [platform, profiles] = await Promise.all([
    getPlatformCommissionSettings(),
    DoctorProfileModel.find(
      mongoFilter({
        verificationStatus: VerificationStatuses.APPROVED,
        $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
      }),
    )
      .select("userId onlineCommissionPercent homeVisitCommissionPercent commissionPercent")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const profileIds = profiles.map((p) => p._id.toString());
  const userIds = profiles.map((p) => p.userId?.toString()).filter(Boolean) as string[];
  const users = userIds.length
    ? await UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } }))
        .select("name")
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const ratesByProfile = await getDoctorCommissionRatesByProfileIds(profileIds);

  const doctors: AdminFinancesDoctorRow[] = profiles.map((profile) => {
    const id = profile._id.toString();
    const user = userMap.get(profile.userId?.toString() ?? "");
    const rates: DoctorCommissionRates = ratesByProfile.get(id) ?? {
      online: platform.defaultDoctorOnlineCommissionPercent,
      homeVisit: platform.defaultDoctorHomeVisitCommissionPercent,
    };

    return {
      id,
      name: mapUserPii(user ?? {}).name,
      onlineCommissionPercent: profile.onlineCommissionPercent ?? null,
      homeVisitCommissionPercent: profile.homeVisitCommissionPercent ?? null,
      effectiveOnlineCommissionPercent: rates.online,
      effectiveHomeVisitCommissionPercent: rates.homeVisit,
    };
  });

  return { platform, doctors };
}

export async function updateAdminFinancesPlatformSettings(
  patch: Partial<PlatformCommissionSettings>,
): Promise<PlatformCommissionSettings> {
  return updatePlatformCommissionSettings(patch);
}
