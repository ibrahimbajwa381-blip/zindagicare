/**
 * One-time migration: fix physiotherapist verification document URLs that were
 * saved with an incorrect path casing (`/api/v1/Physiotherapist/...` instead of
 * `/api/v1/physiotherapist/...`), which 404s and shows as a broken image in the
 * admin review page.
 *
 * Usage (from repo root):
 *   npx dotenv -e apps/web/.env.local -- npx tsx apps/web/scripts/migrate-physiotherapist-document-urls.ts
 */
import { connectDatabase, StaffProfileModel } from "@zindagi/database";
import { Roles } from "@zindagi/shared";

const BAD_PREFIX = "/api/v1/Physiotherapist/verification/documents/";
const GOOD_PREFIX = "/api/v1/physiotherapist/verification/documents/";

const DOCUMENT_KEYS = ["licenseCertificate", "cnicFront", "cnicBack"] as const;

async function migrate() {
  await connectDatabase();

  const profiles = await StaffProfileModel.find({
    staffType: Roles.PHYSIOTHERAPIST,
  });

  let updated = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const docs = profile.verificationDocuments as Record<string, string | undefined> | undefined;
    if (!docs) {
      skipped += 1;
      continue;
    }

    let changed = false;
    for (const key of DOCUMENT_KEYS) {
      const url = docs[key];
      if (url && url.startsWith(BAD_PREFIX)) {
        docs[key] = GOOD_PREFIX + url.slice(BAD_PREFIX.length);
        changed = true;
      }
    }

    if (changed) {
      profile.set("verificationDocuments", docs);
      profile.markModified("verificationDocuments");
      await profile.save();
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(
    `Physiotherapist document URL migration complete. updated=${updated} skipped=${skipped}`,
  );
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
