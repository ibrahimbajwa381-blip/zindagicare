import { StaffProfileModel } from "@zindagi/database";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { hasValidServiceAreaGeo, isPlaceholderServiceAreaGeo } from "./physiotherapist-location";

/** Staff profile IDs only — no names or contact details. */
export type PhysiotherapistHomeVisitBackfillReport = {
  /** Approved physiotherapists with home visits off. */
  scanned: number;
  eligible: string[];
  excludedPlaceholder: string[];
  excludedMissingOrInvalid: string[];
};

export type PhysiotherapistHomeVisitBackfillResult = {
  updated: string[];
  /** Became ineligible between the report and the write (e.g. location removed). */
  skipped: string[];
  failed: { id: string; error: string }[];
};

const CANDIDATE_FILTER = {
  staffType: Roles.PHYSIOTHERAPIST,
  verificationStatus: VerificationStatuses.APPROVED,
  deletedAt: { $exists: false },
  homeVisitEnabled: { $ne: true },
};

/** Read-only: classify approved physiotherapists whose home visits are off. */
export async function reportPhysiotherapistHomeVisitBackfill(): Promise<PhysiotherapistHomeVisitBackfillReport> {
  const profiles = await StaffProfileModel.find(CANDIDATE_FILTER).select("_id serviceAreas").lean();

  const report: PhysiotherapistHomeVisitBackfillReport = {
    scanned: profiles.length,
    eligible: [],
    excludedPlaceholder: [],
    excludedMissingOrInvalid: [],
  };
  for (const profile of profiles) {
    const id = profile._id.toString();
    const coordinates = profile.serviceAreas?.[0]?.geo?.coordinates;
    if (!hasValidServiceAreaGeo(coordinates)) report.excludedMissingOrInvalid.push(id);
    else if (isPlaceholderServiceAreaGeo(coordinates)) report.excludedPlaceholder.push(id);
    else report.eligible.push(id);
  }
  return report;
}

/**
 * Switch home visits on for the given (reviewed) eligible IDs. Each write re-checks
 * approval + home-visits-off and that the stored pin is the one eligibility was based on.
 */
export async function applyPhysiotherapistHomeVisitBackfill(
  ids: string[],
): Promise<PhysiotherapistHomeVisitBackfillResult> {
  const result: PhysiotherapistHomeVisitBackfillResult = { updated: [], skipped: [], failed: [] };

  for (const id of ids) {
    try {
      const profile = await StaffProfileModel.findOne({ ...CANDIDATE_FILTER, _id: id })
        .select("serviceAreas")
        .lean();
      const coordinates = profile?.serviceAreas?.[0]?.geo?.coordinates;
      if (
        !profile ||
        !hasValidServiceAreaGeo(coordinates) ||
        isPlaceholderServiceAreaGeo(coordinates)
      ) {
        result.skipped.push(id);
        continue;
      }
      const { modifiedCount } = await StaffProfileModel.updateOne(
        { ...CANDIDATE_FILTER, _id: id },
        { $set: { homeVisitEnabled: true } },
      );
      if (modifiedCount === 1) result.updated.push(id);
      else result.skipped.push(id);
    } catch (error) {
      result.failed.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}
