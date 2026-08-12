/**
 * One-time migration: backfill primarySpecialty / additionalSpecialties from specialties.
 *
 * - Existing specialties[0] → primarySpecialty
 * - Remaining specialties → additionalSpecialties
 * - Approved/listed doctors keep specialties as admin-verified (patient-visible)
 * - Pending/rejected doctors move specialties into claimed fields and clear verified list
 *
 * Usage (from repo root):
 *   npx dotenv -e apps/web/.env.local -- npx tsx apps/web/scripts/migrate-doctor-specialties.ts
 */
import { connectDatabase, DoctorProfileModel } from "@zindagi/database";
import {
  VerificationStatuses,
  normalizeAdditionalSpecialties,
} from "@zindagi/shared";

async function migrate() {
  await connectDatabase();

  const doctors = await DoctorProfileModel.find({});
  let updated = 0;
  let skipped = 0;

  for (const profile of doctors) {
    const existingPrimary = profile.primarySpecialty?.trim();
    const existingAdditional = profile.additionalSpecialties ?? [];
    const legacy = (profile.specialties ?? []).map((s) => s.trim()).filter(Boolean);

    if (existingPrimary && existingAdditional.length >= 0 && legacy.length >= 0) {
      // Already migrated if primary is set.
      if (existingPrimary) {
        // Still normalize additional and pending verified list.
        const nextAdditional = normalizeAdditionalSpecialties(
          existingPrimary,
          existingAdditional.length ? existingAdditional : legacy.slice(1),
        );
        let changed = false;
        if (
          JSON.stringify(profile.additionalSpecialties ?? []) !==
          JSON.stringify(nextAdditional)
        ) {
          profile.additionalSpecialties = nextAdditional;
          changed = true;
        }
        if (
          profile.verificationStatus !== VerificationStatuses.APPROVED &&
          profile.verificationStatus !== VerificationStatuses.RESTRICTED &&
          (profile.specialties?.length ?? 0) > 0
        ) {
          profile.specialties = [];
          changed = true;
        }
        if (changed) {
          await profile.save();
          updated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }
    }

    if (!legacy.length && !existingPrimary) {
      skipped += 1;
      continue;
    }

    const primary = existingPrimary || legacy[0]!;
    const additional = normalizeAdditionalSpecialties(
      primary,
      existingAdditional.length ? existingAdditional : legacy.slice(1),
    );

    profile.primarySpecialty = primary;
    profile.additionalSpecialties = additional;

    const isPatientVisible =
      profile.verificationStatus === VerificationStatuses.APPROVED ||
      profile.verificationStatus === VerificationStatuses.RESTRICTED;

    if (isPatientVisible) {
      // Keep verified list; if empty, treat claimed as verified for legacy live doctors.
      if (!profile.specialties?.length) {
        profile.specialties = [primary, ...additional];
      }
    } else {
      profile.specialties = [];
    }

    await profile.save();
    updated += 1;
  }

  console.log(`Doctor specialty migration complete. updated=${updated} skipped=${skipped}`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
