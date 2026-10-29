import {
  DoctorProfileModel,
  HerbalistProfileModel,
  NutritionistProfileModel,
  StaffProfileModel,
} from "@zindagi/database";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { mongoFilter } from "@/lib/mongo/query";

/**
 * Every provider profile type that can care for a patient. Adding a provider
 * type means adding its profile source here; nothing else in care or chat.
 */
type ProfileRow = {
  _id: { toString(): string };
  userId: { toString(): string };
  specialties?: string[] | null;
  isListed?: boolean | null;
  verificationStatus?: string | null;
  staffType?: string | null;
};

type ProfileFilter = Parameters<typeof mongoFilter>[0];
const PROFILE_FIELDS = "userId specialties isListed verificationStatus";
const STAFF_ROLES = [Roles.NURSE, Roles.PHYSIOTHERAPIST] as const;

/** Bookable (listed + approved) for listed directories; approved for assigned staff. */
const isApproved = (row: ProfileRow) => row.verificationStatus === VerificationStatuses.APPROVED;
const isListedAndApproved = (row: ProfileRow) => !!row.isListed && isApproved(row);

const PROFILE_SOURCES = {
  doctor: {
    find: (filter: ProfileFilter): Promise<ProfileRow[]> =>
      DoctorProfileModel.find(mongoFilter(filter)).select(PROFILE_FIELDS).lean(),
    roleOf: () => "doctor" as const,
    available: isListedAndApproved,
  },
  herbalist: {
    find: (filter: ProfileFilter): Promise<ProfileRow[]> =>
      HerbalistProfileModel.find(mongoFilter(filter)).select(PROFILE_FIELDS).lean(),
    roleOf: () => "herbalist" as const,
    available: isListedAndApproved,
  },
  nutritionist: {
    find: (filter: ProfileFilter): Promise<ProfileRow[]> =>
      NutritionistProfileModel.find(mongoFilter(filter)).select(PROFILE_FIELDS).lean(),
    roleOf: () => "nutritionist" as const,
    available: isListedAndApproved,
  },
  // Nurses and physiotherapists share StaffProfile (riders are excluded).
  staff: {
    find: (filter: ProfileFilter): Promise<ProfileRow[]> =>
      StaffProfileModel.find(mongoFilter({ ...filter, staffType: { $in: STAFF_ROLES } }))
        .select(`${PROFILE_FIELDS} staffType`)
        .lean(),
    roleOf: (row: ProfileRow) =>
      row.staffType === Roles.PHYSIOTHERAPIST ? ("physiotherapist" as const) : ("nurse" as const),
    available: isApproved,
  },
};

type ProfileSourceKey = keyof typeof PROFILE_SOURCES;
const SOURCE_KEYS = Object.keys(PROFILE_SOURCES) as ProfileSourceKey[];

export type ProviderRole = ReturnType<(typeof PROFILE_SOURCES)[ProfileSourceKey]["roleOf"]>;

/** Provider roles that own appointments (`Appointment.providerRole`). */
type AppointmentProviderRole = Exclude<ProfileSourceKey, "staff">;
const APPOINTMENT_PROVIDER_ROLES: readonly string[] = ["doctor", "herbalist", "nutritionist"];

export type ProviderProfile = {
  role: ProviderRole;
  profileId: string;
  userId: string;
  specialties: string[];
  /** Approved (and listed, where the type is listed), so patients may start a conversation. */
  available: boolean;
};

export type AppointmentProviderRef = {
  doctorId: { toString(): string };
  providerRole?: string | null;
  providerProfileId?: { toString(): string } | null;
};

export function providerRoleOf(appointment: AppointmentProviderRef): AppointmentProviderRole {
  const role = appointment.providerRole;
  return role && APPOINTMENT_PROVIDER_ROLES.includes(role)
    ? (role as AppointmentProviderRole)
    : "doctor";
}

/** Owning provider profile id; `doctorId` mirrors it for non-doctor providers. */
export function providerProfileIdOf(appointment: AppointmentProviderRef): string {
  return (appointment.providerProfileId ?? appointment.doctorId).toString();
}

async function findProfiles(
  filterFor: (key: ProfileSourceKey) => ProfileFilter | null,
): Promise<ProviderProfile[]> {
  const batches = await Promise.all(
    SOURCE_KEYS.map(async (key) => {
      const filter = filterFor(key);
      if (!filter) return [];
      const source = PROFILE_SOURCES[key];
      const rows = await source.find(filter);
      return rows.map(
        (row): ProviderProfile => ({
          role: source.roleOf(row),
          profileId: row._id.toString(),
          userId: row.userId.toString(),
          specialties: row.specialties ?? [],
          available: source.available(row),
        }),
      );
    }),
  );
  return batches.flat();
}

/** Every provider profile the given users own (empty for patients). */
export function providerProfilesOfUser(userIds: string[]): Promise<ProviderProfile[]> {
  if (userIds.length === 0) return Promise.resolve([]);
  return findProfiles(() => ({ userId: { $in: userIds } }));
}

/** Profiles for appointment provider refs, keyed by profile id. */
export async function providerProfilesById(
  refs: { role: AppointmentProviderRole; profileId: string }[],
): Promise<Map<string, ProviderProfile>> {
  const idsByRole = new Map<ProfileSourceKey, Set<string>>();
  for (const ref of refs) {
    const ids = idsByRole.get(ref.role) ?? new Set<string>();
    ids.add(ref.profileId);
    idsByRole.set(ref.role, ids);
  }

  const profiles = await findProfiles((key) => {
    const ids = idsByRole.get(key);
    return ids ? { _id: { $in: [...ids] } } : null;
  });
  return new Map(profiles.map((profile) => [profile.profileId, profile]));
}

/** User id behind any provider profile id (deep links may pass a profile id). */
export async function providerUserIdForProfileId(profileId: string): Promise<string | null> {
  const [profile] = await findProfiles(() => ({ _id: profileId }));
  return profile?.userId ?? null;
}

/** Owning provider's user id for an appointment, or null if the profile is gone. */
export async function providerUserIdOf(
  appointment: AppointmentProviderRef,
): Promise<string | null> {
  const profileId = providerProfileIdOf(appointment);
  const profiles = await providerProfilesById([
    { role: providerRoleOf(appointment), profileId },
  ]);
  return profiles.get(profileId)?.userId ?? null;
}
