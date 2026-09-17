import { NutritionistProfileModel } from "@zindagi/database";
import {
  isCanonicalNutritionistSlug,
  nameToNutritionistSlug,
  resolveNutritionistSlug,
} from "@/lib/nutritionists/profile-path";
import { createProfileSlugService } from "./shared/profile-slug.service";

const service = createProfileSlugService({
  Model: NutritionistProfileModel,
  nameToSlug: nameToNutritionistSlug,
  isCanonicalSlug: isCanonicalNutritionistSlug,
});

export const generateUniqueNutritionistSlug = service.generateUniqueSlug;
export const ensureCanonicalNutritionistSlug = service.ensureCanonicalSlug;

export { resolveNutritionistSlug };
