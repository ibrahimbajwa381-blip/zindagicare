import { mongoFilter } from "@/lib/mongo/query";

type SlugQueryModel = {
  findOne: (filter: Record<string, unknown>) => { lean: () => Promise<unknown> };
  findByIdAndUpdate: (id: string, update: Record<string, unknown>) => unknown;
};

/**
 * Shared implementation behind each role's `generateUnique*Slug` / `ensureCanonical*Slug`
 * pair — the logic is identical across roles, only the Mongoose model and slug helpers differ.
 */
export function createProfileSlugService(config: {
  Model: SlugQueryModel;
  nameToSlug: (name: string) => string;
  isCanonicalSlug: (slug: string) => boolean;
}) {
  async function generateUniqueSlug(name: string, profileId: string): Promise<string> {
    const base = config.nameToSlug(name).slice(0, 40);

    let slug = base;
    let counter = 0;
    while (
      await config.Model.findOne(
        mongoFilter({ slug, _id: { $ne: profileId } }),
      ).lean()
    ) {
      counter += 1;
      slug = `${base}-${counter}`;
    }
    return slug;
  }

  /** Persist a name-based slug when the stored value is missing or non-canonical. */
  async function ensureCanonicalSlug(
    profileId: string,
    name: string,
    storedSlug?: string | null,
  ): Promise<string> {
    const stored = storedSlug?.trim().toLowerCase();
    if (stored && config.isCanonicalSlug(stored)) return stored;

    const slug = await generateUniqueSlug(name, profileId);
    if (stored !== slug) {
      await config.Model.findByIdAndUpdate(profileId, { $set: { slug } });
    }
    return slug;
  }

  return { generateUniqueSlug, ensureCanonicalSlug };
}
