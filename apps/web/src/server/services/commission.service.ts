import {
  connectDatabase,
  DoctorProfileModel,
  StaffProfileModel,
} from "@zindagi/database";
import {
  STAFF_COMMISSION_CONFIG,
  type DoctorCommissionChannel,
} from "@zindagi/shared";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { getSystemSettings } from "./system-settings.service";

export type DoctorCommissionRates = {
  online: number;
  homeVisit: number;
};

type DoctorCommissionProfile = {
  onlineCommissionPercent?: number | null;
  homeVisitCommissionPercent?: number | null;
  commissionPercent?: number | null;
};

export function resolveCommissionPercent(
  profileOverride: number | null | undefined,
  platformDefault: number,
): number {
  if (profileOverride != null && !Number.isNaN(profileOverride)) {
    return profileOverride;
  }
  return platformDefault;
}

function resolveDoctorChannelOverride(
  profile: DoctorCommissionProfile | null | undefined,
  channel: DoctorCommissionChannel,
): number | null | undefined {
  if (!profile) return undefined;

  const channelOverride =
    channel === "online"
      ? profile.onlineCommissionPercent
      : profile.homeVisitCommissionPercent;

  if (channelOverride != null && !Number.isNaN(channelOverride)) {
    return channelOverride;
  }

  return profile.commissionPercent;
}

export async function getDoctorCommissionRatesByProfileId(
  profileId: string,
): Promise<DoctorCommissionRates> {
  await connectDatabase();
  const [settings, profile] = await Promise.all([
    getSystemSettings(),
    DoctorProfileModel.findById(profileId)
      .select("onlineCommissionPercent homeVisitCommissionPercent commissionPercent")
      .lean(),
  ]);

  return {
    online: resolveCommissionPercent(
      resolveDoctorChannelOverride(profile, "online"),
      settings.defaultDoctorOnlineCommissionPercent,
    ),
    homeVisit: resolveCommissionPercent(
      resolveDoctorChannelOverride(profile, "home_visit"),
      settings.defaultDoctorHomeVisitCommissionPercent,
    ),
  };
}

export async function getDoctorCommissionRatesByProfileIds(
  profileIds: string[],
): Promise<Map<string, DoctorCommissionRates>> {
  const map = new Map<string, DoctorCommissionRates>();
  if (!profileIds.length) return map;

  await connectDatabase();
  const settings = await getSystemSettings();
  const profiles = await DoctorProfileModel.find(
    mongoFilter({ _id: { $in: mongoObjectIds(profileIds) } }),
  )
    .select("onlineCommissionPercent homeVisitCommissionPercent commissionPercent")
    .lean();

  for (const profile of profiles) {
    map.set(profile._id.toString(), {
      online: resolveCommissionPercent(
        resolveDoctorChannelOverride(profile, "online"),
        settings.defaultDoctorOnlineCommissionPercent,
      ),
      homeVisit: resolveCommissionPercent(
        resolveDoctorChannelOverride(profile, "home_visit"),
        settings.defaultDoctorHomeVisitCommissionPercent,
      ),
    });
  }

  for (const id of profileIds) {
    if (!map.has(id)) {
      map.set(id, {
        online: settings.defaultDoctorOnlineCommissionPercent,
        homeVisit: settings.defaultDoctorHomeVisitCommissionPercent,
      });
    }
  }

  return map;
}

/** @deprecated Use getDoctorCommissionRatesByProfileId */
export async function getDoctorCommissionPercentByProfileId(
  profileId: string,
): Promise<number> {
  const rates = await getDoctorCommissionRatesByProfileId(profileId);
  return rates.online;
}

/** @deprecated Use getDoctorCommissionRatesByProfileIds */
export async function getDoctorCommissionPercentsByProfileIds(
  profileIds: string[],
): Promise<Map<string, number>> {
  const rates = await getDoctorCommissionRatesByProfileIds(profileIds);
  return new Map([...rates.entries()].map(([id, value]) => [id, value.online]));
}

export async function getNurseCommissionPercentByUserId(
  userId: string,
): Promise<number> {
  await connectDatabase();
  const [settings, staff] = await Promise.all([
    getSystemSettings(),
    StaffProfileModel.findOne({ userId }).select("commissionPercent").lean(),
  ]);
  return resolveCommissionPercent(
    staff?.commissionPercent,
    settings.defaultNurseCommissionPercent,
  );
}

export { calculateStaffNetEarnings } from "@zindagi/shared";

export function getPlatformCommissionDefaults() {
  return {
    defaultDoctorOnlineCommissionPercent: STAFF_COMMISSION_CONFIG.defaultDoctorOnlinePercent,
    defaultDoctorHomeVisitCommissionPercent:
      STAFF_COMMISSION_CONFIG.defaultDoctorHomeVisitPercent,
    defaultNurseCommissionPercent: STAFF_COMMISSION_CONFIG.defaultNursePercent,
  };
}
