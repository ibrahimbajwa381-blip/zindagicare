import {
  connectDatabase,
  DoctorProfileModel,
  PatientProfileModel,
  StaffProfileModel,
} from "@zindagi/database";
import {
  applyReferralBonus,
  STAFF_COMMISSION_CONFIG,
  Roles,
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
    StaffProfileModel.findOne({ userId, staffType: Roles.NURSE })
      .select("commissionPercent")
      .lean(),
  ]);
  return resolveCommissionPercent(
    staff?.commissionPercent,
    settings.defaultNurseCommissionPercent,
  );
}

export async function getPhysiotherapistCommissionPercentByUserId(
  userId: string,
): Promise<number> {
  await connectDatabase();
  const [settings, staff] = await Promise.all([
    getSystemSettings(),
    StaffProfileModel.findOne({ userId, staffType: Roles.PHYSIOTHERAPIST })
      .select("commissionPercent")
      .lean(),
  ]);
  return resolveCommissionPercent(
    staff?.commissionPercent,
    settings.defaultPhysiotherapistCommissionPercent,
  );
}

export { calculateStaffNetEarnings } from "@zindagi/shared";

/**
 * Patient ids (from the given set) that were referred by this doctor via their
 * personal referral link. Used to grant the lifetime referral commission bonus.
 */
export async function getReferredPatientIdSet(
  doctorProfileId: string,
  patientIds: string[],
): Promise<Set<string>> {
  const set = new Set<string>();
  if (!patientIds.length) return set;

  await connectDatabase();
  const referred = await PatientProfileModel.find(
    mongoFilter({
      _id: { $in: mongoObjectIds(patientIds) },
      referredByDoctorId: doctorProfileId,
    }),
  )
    .select("_id")
    .lean();

  for (const patient of referred) {
    set.add(patient._id.toString());
  }
  return set;
}

/**
 * Bulk lookup for admin/platform-wide earnings views: maps each referred patient id to
 * the doctor profile id that referred them, scoped to the given doctors.
 */
export async function getReferredPatientDoctorMap(
  doctorProfileIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!doctorProfileIds.length) return map;

  await connectDatabase();
  const referred = await PatientProfileModel.find(
    mongoFilter({
      referredByDoctorId: { $in: mongoObjectIds(doctorProfileIds) },
    }),
  )
    .select("_id referredByDoctorId")
    .lean();

  for (const patient of referred) {
    if (patient.referredByDoctorId) {
      map.set(patient._id.toString(), patient.referredByDoctorId.toString());
    }
  }
  return map;
}

/** Number of patients referred by each of the given doctors, keyed by doctor profile id. */
export async function getReferredPatientCountsByDoctorIds(
  doctorProfileIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const referredPatientDoctorMap = await getReferredPatientDoctorMap(doctorProfileIds);
  for (const doctorId of referredPatientDoctorMap.values()) {
    counts.set(doctorId, (counts.get(doctorId) ?? 0) + 1);
  }
  return counts;
}

/** Adds the referral bonus (if applicable) on top of a resolved base commission %. */
export function resolveEffectiveCommissionPercent(
  basePercent: number,
  isReferred: boolean,
): number {
  return applyReferralBonus(basePercent, isReferred);
}

export function getPlatformCommissionDefaults() {
  return {
    defaultDoctorOnlineCommissionPercent: STAFF_COMMISSION_CONFIG.defaultDoctorOnlinePercent,
    defaultDoctorHomeVisitCommissionPercent:
      STAFF_COMMISSION_CONFIG.defaultDoctorHomeVisitPercent,
    defaultNurseCommissionPercent: STAFF_COMMISSION_CONFIG.defaultNursePercent,
    defaultPhysiotherapistCommissionPercent:
      STAFF_COMMISSION_CONFIG.defaultPhysiotherapistPercent,
  };
}
