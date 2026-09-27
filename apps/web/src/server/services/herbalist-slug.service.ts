import { HerbalistProfileModel } from "@zindagi/database";
import {
  isCanonicalHerbalistSlug,
  nameToHerbalistSlug,
  resolveHerbalistSlug,
} from "@/lib/herbalists/profile-path";
import { createProfileSlugService } from "./shared/profile-slug.service";

const service = createProfileSlugService({
  Model: HerbalistProfileModel,
  nameToSlug: nameToHerbalistSlug,
  isCanonicalSlug: isCanonicalHerbalistSlug,
});

export const generateUniqueHerbalistSlug = service.generateUniqueSlug;
export const ensureCanonicalHerbalistSlug = service.ensureCanonicalSlug;

export { resolveHerbalistSlug };
