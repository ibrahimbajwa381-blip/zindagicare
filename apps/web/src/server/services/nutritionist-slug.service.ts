import { NutritionistProfileModel } from "@zindagi/database";
import {
  isCanonicalNutritionistSlug,
  nameToNutritionistSlug,
  resolveNutritionistSlug,
} from "@/lib/nutritionists/profile-path";
import { mongoFilter } from "@/lib/mongo/query";

export async function generateUniqueNutritionistSlug(
  name: string,
  profileId: string,
): Promise<string> {
  const base = nameToNutritionistSlug(name).slice(0, 40);

  let slug = base;
  let counter = 0;
  while (
    await NutritionistProfileModel.findOne(
      mongoFilter({ slug, _id: { $ne: profileId } }),
    ).lean()
  ) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

/** Persist a name-based slug when the stored value is missing or non-canonical. */
export async function ensureCanonicalNutritionistSlug(
  profileId: string,
  name: string,
  storedSlug?: string | null,
): Promise<string> {
  const stored = storedSlug?.trim().toLowerCase();
  if (stored && isCanonicalNutritionistSlug(stored)) return stored;

  const slug = await generateUniqueNutritionistSlug(name, profileId);
  if (stored !== slug) {
    await NutritionistProfileModel.findByIdAndUpdate(profileId, { $set: { slug } });
  }
  return slug;
}

export { resolveNutritionistSlug };
