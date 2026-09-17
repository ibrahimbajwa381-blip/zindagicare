import { DoctorProfileModel } from "@zindagi/database";
import {
  isCanonicalDoctorSlug,
  nameToDoctorSlug,
  resolveDoctorSlug,
} from "@/lib/doctors/profile-path";
import { createProfileSlugService } from "./shared/profile-slug.service";

const service = createProfileSlugService({
  Model: DoctorProfileModel,
  nameToSlug: nameToDoctorSlug,
  isCanonicalSlug: isCanonicalDoctorSlug,
});

export const generateUniqueDoctorSlug = service.generateUniqueSlug;
export const ensureCanonicalDoctorSlug = service.ensureCanonicalSlug;

export { resolveDoctorSlug };
