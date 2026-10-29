import { HomeVisitModel } from "@zindagi/database";
import { homeVisitProviderKind } from "@zindagi/shared";
import { mongoFilter } from "@/lib/mongo/query";
import { HOME_VISIT_VISIBLE_STATUSES, homeVisitAccess } from "../policy";
import { providerProfilesOfUser, type ProviderProfile } from "../provider-registry";
import type { CareEngagement, CareParty } from "../types";

/** Patient-side and staff-side match clauses for `self`, optionally narrowed to one counterpart. */
function sideClauses(self: CareParty, other?: CareParty) {
  return other
    ? [
        { patientId: self.userId, assignedStaffId: other.userId },
        { patientId: other.userId, assignedStaffId: self.userId },
      ]
    : [
        { patientId: self.userId, assignedStaffId: { $exists: true } },
        { assignedStaffId: self.userId },
      ];
}

/** Home visits linking `self` to anyone (or to `other`), as patient or assigned staff. */
export async function homeVisitEngagements(
  self: CareParty,
  other?: CareParty,
  now = new Date(),
): Promise<CareEngagement[]> {
  const visits = await HomeVisitModel.find(
    mongoFilter({
      $or: sideClauses(self, other),
      status: { $in: HOME_VISIT_VISIBLE_STATUSES },
      deletedAt: null,
    }),
  )
    .select("patientId assignedStaffId serviceType status scheduledAt")
    .lean();
  if (visits.length === 0) return [];

  const staffIds = [
    ...new Set(
      visits
        .map((visit) => visit.assignedStaffId?.toString())
        .filter((id): id is string => !!id),
    ),
  ];
  const profilesByUser = new Map<string, ProviderProfile[]>();
  for (const profile of await providerProfilesOfUser(staffIds)) {
    profilesByUser.set(profile.userId, [...(profilesByUser.get(profile.userId) ?? []), profile]);
  }

  const engagements: CareEngagement[] = [];
  for (const visit of visits) {
    const staffId = visit.assignedStaffId?.toString();
    const access = homeVisitAccess(visit, now);
    if (!staffId || access === "none") continue;

    const profiles = profilesByUser.get(staffId) ?? [];
    const kind = homeVisitProviderKind(visit.serviceType);
    const provider = profiles.find((profile) => profile.role === kind) ?? profiles[0];
    if (!provider) continue;

    engagements.push({
      patientUserId: visit.patientId.toString(),
      provider,
      access,
      startsAt: visit.scheduledAt,
    });
  }
  return engagements;
}
