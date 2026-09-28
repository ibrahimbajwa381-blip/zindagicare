import { StaffProfileModel } from "@zindagi/database";
import {
  isCanonicalPhysiotherapistSlug,
  nameToPhysiotherapistSlug,
  resolvePhysiotherapistSlug,
} from "@/lib/physiotherapists/profile-path";
import { createProfileSlugService } from "./shared/profile-slug.service";

const service = createProfileSlugService({
  Model: StaffProfileModel,
  nameToSlug: nameToPhysiotherapistSlug,
  isCanonicalSlug: isCanonicalPhysiotherapistSlug,
});

export const generateUniquePhysiotherapistSlug = service.generateUniqueSlug;
export const ensureCanonicalPhysiotherapistSlug = service.ensureCanonicalSlug;

export { resolvePhysiotherapistSlug };
