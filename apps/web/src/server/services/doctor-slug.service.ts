import { DoctorProfileModel } from "@zindagi/database";
import {
  isCanonicalDoctorSlug,
  nameToDoctorSlug,
  resolveDoctorSlug,
} from "@/lib/doctors/profile-path";
import { mongoFilter } from "@/lib/mongo/query";

export async function generateUniqueDoctorSlug(
  name: string,
  profileId: string,
): Promise<string> {
  const base = nameToDoctorSlug(name).slice(0, 40);

  let slug = base;
  let counter = 0;
  while (
    await DoctorProfileModel.findOne(
      mongoFilter({ slug, _id: { $ne: profileId } }),
    ).lean()
  ) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

/** Persist a name-based slug when the stored value is missing or non-canonical. */
export async function ensureCanonicalDoctorSlug(
  profileId: string,
  name: string,
  storedSlug?: string | null,
): Promise<string> {
  const stored = storedSlug?.trim().toLowerCase();
  if (stored && isCanonicalDoctorSlug(stored)) return stored;

  const slug = await generateUniqueDoctorSlug(name, profileId);
  if (stored !== slug) {
    await DoctorProfileModel.findByIdAndUpdate(profileId, { $set: { slug } });
  }
  return slug;
}

export { resolveDoctorSlug };
