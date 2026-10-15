import {
  HOME_CARE_EXTENDED_RADIUS_KM,
  HOME_CARE_MATCH_RADIUS_KM,
  HomeCareReaches,
  isOutsideProviderCoverage,
  type HomeCareReach,
} from "@zindagi/shared";

/** One line telling the patient which search tier the list starts from. */
export function reachTierDescription(tier: HomeCareReach | null, nounPlural: string): string {
  switch (tier) {
    case HomeCareReaches.IN_RADIUS:
      return `Showing verified ${nounPlural} who cover your location, nearest first.`;
    case HomeCareReaches.NEAR:
      return `No ${nounPlural} cover your exact location, so we're showing those within ${HOME_CARE_MATCH_RADIUS_KM} km first.`;
    case HomeCareReaches.EXTENDED:
      return `No ${nounPlural} are available within ${HOME_CARE_MATCH_RADIUS_KM} km, so we're showing those within ${HOME_CARE_EXTENDED_RADIUS_KM} km first.`;
    case HomeCareReaches.SAME_CITY:
      return `No ${nounPlural} are available within ${HOME_CARE_EXTENDED_RADIUS_KM} km, so we're showing those in your city first.`;
    case HomeCareReaches.FAR:
      return `No ${nounPlural} are available in your city yet, so we're showing the nearest ones in other cities.`;
    default:
      return `Verified ${nounPlural}, nearest first.`;
  }
}

/** Small label on a provider whose own coverage radius doesn't include the patient. */
export function FarBadge({ reach }: { reach?: HomeCareReach }) {
  if (!isOutsideProviderCoverage(reach)) return null;
  return (
    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
      Outside their area — travel to confirm
    </span>
  );
}

/** Shown when the chosen provider's own radius doesn't cover the patient — booking is still allowed. */
export function FarAwayNotice({
  provider,
}: {
  provider: {
    name: string;
    distanceKm?: number;
    city: string;
    inPatientCity?: boolean;
    coverageRadiusKm: number;
  };
}) {
  const where =
    provider.distanceKm !== undefined
      ? `about ${provider.distanceKm.toFixed(1)} km from your location`
      : "at an unknown distance from your location";
  const otherCity = provider.inPatientCity === false ? ` and based in ${provider.city}` : "";
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      {`${provider.name} is ${where}${otherCity} — outside the ${provider.coverageRadiusKm} km area they usually cover. You can still book. They will need to confirm they can travel to you, and extra travel charges may apply.`}
    </p>
  );
}

/** Directory summary once the patient shares a location: which tier is listed first. */
export function reachLocatedSummary(
  tier: HomeCareReach | null,
  nounPlural: string,
  patientCity?: string,
): string {
  const capitalised = nounPlural.charAt(0).toUpperCase() + nounPlural.slice(1);
  switch (tier) {
    case HomeCareReaches.IN_RADIUS:
      return `${capitalised} who cover your location are listed first, nearest first.`;
    case HomeCareReaches.NEAR:
      return `No ${nounPlural} cover your exact location — those within ${HOME_CARE_MATCH_RADIUS_KM} km are listed first.`;
    case HomeCareReaches.EXTENDED:
      return `No ${nounPlural} are available within ${HOME_CARE_MATCH_RADIUS_KM} km — those within ${HOME_CARE_EXTENDED_RADIUS_KM} km are listed first.`;
    case HomeCareReaches.SAME_CITY:
      return `No ${nounPlural} are available within ${HOME_CARE_EXTENDED_RADIUS_KM} km — those in ${patientCity ?? "your city"} are listed first.`;
    case HomeCareReaches.FAR:
      return `No ${nounPlural} are available in ${patientCity ?? "your city"} yet — the nearest ones in other cities are listed first.`;
    default:
      return "Sorted by distance from your location.";
  }
}
