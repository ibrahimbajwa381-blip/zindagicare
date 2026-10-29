import { providerProfilesOfUser } from "./provider-registry";
import { appointmentEngagements } from "./sources/appointment.source";
import { homeVisitEngagements } from "./sources/home-visit.source";
import type { CareEngagement, CareLink, CareParty } from "./types";

/**
 * Who may talk to whom, derived only from consults and home visits (never from
 * account roles, never from stored open/closed flags). Chat and other features
 * read this. Adding a source means adding it to `engagementsFor`.
 */

async function loadParties(userIds: string[]): Promise<CareParty[]> {
  const profiles = await providerProfilesOfUser(userIds);
  return userIds.map((userId) => ({
    userId,
    profiles: profiles.filter((profile) => profile.userId === userId),
  }));
}

async function engagementsFor(self: CareParty, other?: CareParty): Promise<CareEngagement[]> {
  const batches = await Promise.all([
    appointmentEngagements(self, other),
    homeVisitEngagements(self, other),
  ]);
  return batches.flat();
}

/** Open engagements first, then the most recent. */
function isBetter(candidate: CareEngagement, current: CareEngagement | undefined) {
  if (!current) return true;
  if (candidate.access !== current.access) return candidate.access === "write";
  return candidate.startsAt.getTime() > current.startsAt.getTime();
}

function toLinks(userId: string, engagements: CareEngagement[]): Map<string, CareLink> {
  const best = new Map<string, { any?: CareEngagement; appointment?: CareEngagement }>();
  for (const engagement of engagements) {
    const isPatient = engagement.patientUserId === userId;
    const counterpartUserId = isPatient ? engagement.provider.userId : engagement.patientUserId;
    if (counterpartUserId === userId) continue;

    const entry = best.get(counterpartUserId) ?? {};
    if (isBetter(engagement, entry.any)) entry.any = engagement;
    if (engagement.appointmentId && isBetter(engagement, entry.appointment)) {
      entry.appointment = engagement;
    }
    best.set(counterpartUserId, entry);
  }

  const links = new Map<string, CareLink>();
  for (const [counterpartUserId, { any, appointment }] of best) {
    if (!any) continue;
    links.set(counterpartUserId, {
      counterpartUserId,
      provider: any.provider,
      counterpartIsProvider: any.patientUserId === userId,
      writable: any.access === "write",
      appointmentId: appointment?.appointmentId,
    });
  }
  return links;
}

export class CareService {
  /** Every counterpart the user has consulted with, keyed by their user id. */
  static async linksFor(userId: string): Promise<Map<string, CareLink>> {
    const [self] = await loadParties([userId]);
    return toLinks(userId, await engagementsFor(self));
  }

  /** The link between two users from `userId`'s side, or null when they share no consult. */
  static async linkBetween(userId: string, otherUserId: string): Promise<CareLink | null> {
    if (userId === otherUserId) return null;
    const [self, other] = await loadParties([userId, otherUserId]);
    return toLinks(userId, await engagementsFor(self, other)).get(otherUserId) ?? null;
  }
}
