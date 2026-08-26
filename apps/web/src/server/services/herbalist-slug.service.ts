import { HerbalistProfileModel } from "@zindagi/database";
import {
  isCanonicalHerbalistSlug,
  nameToHerbalistSlug,
  resolveHerbalistSlug,
} from "@/lib/herbalists/profile-path";
import { mongoFilter } from "@/lib/mongo/query";

export async function generateUniqueHerbalistSlug(
  name: string,
  profileId: string,
): Promise<string> {
  const base = nameToHerbalistSlug(name).slice(0, 40);

  let slug = base;
  let counter = 0;
  while (
    await HerbalistProfileModel.findOne(
      mongoFilter({ slug, _id: { $ne: profileId } }),
    ).lean()
  ) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

/** Persist a name-based slug when the stored value is missing or non-canonical. */
export async function ensureCanonicalHerbalistSlug(
  profileId: string,
  name: string,
  storedSlug?: string | null,
): Promise<string> {
  const stored = storedSlug?.trim().toLowerCase();
  if (stored && isCanonicalHerbalistSlug(stored)) return stored;

  const slug = await generateUniqueHerbalistSlug(name, profileId);
  if (stored !== slug) {
    await HerbalistProfileModel.findByIdAndUpdate(profileId, { $set: { slug } });
  }
  return slug;
}

export { resolveHerbalistSlug };
