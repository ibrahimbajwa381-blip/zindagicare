import { StaffProfileModel } from "@zindagi/database";
import {
  isCanonicalNurseSlug,
  nameToNurseSlug,
  resolveNurseSlug,
} from "@/lib/nurses/profile-path";
import { createProfileSlugService } from "./shared/profile-slug.service";

const service = createProfileSlugService({
  Model: StaffProfileModel,
  nameToSlug: nameToNurseSlug,
  isCanonicalSlug: isCanonicalNurseSlug,
});

export const generateUniqueNurseSlug = service.generateUniqueSlug;
export const ensureCanonicalNurseSlug = service.ensureCanonicalSlug;

export { resolveNurseSlug };
