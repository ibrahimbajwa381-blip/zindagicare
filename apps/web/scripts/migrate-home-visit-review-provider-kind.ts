/**
 * One-time migration: stamp `providerKind` (doctor / physiotherapist / nurse) on home-visit
 * reviews created before the field existed, from each review's visit service type. The admin
 * review queues filter on this field, so unstamped reviews don't appear there.
 *
 * Safe to re-run — only reviews still missing the field are touched.
 *
 * Usage (from repo root):
 *   npx dotenv -e apps/web/.env.local -- npx tsx apps/web/scripts/migrate-home-visit-review-provider-kind.ts
 */
import { connectDatabase, HomeVisitModel, HomeVisitReviewModel } from "@zindagi/database";
import { homeVisitProviderKind } from "@zindagi/shared";

async function migrate() {
  await connectDatabase();

  const reviews = await HomeVisitReviewModel.find({ providerKind: { $exists: false } })
    .select("homeVisitId")
    .lean();

  if (reviews.length === 0) {
    console.log("Home visit review provider kind migration: nothing to update.");
    return;
  }

  const visits = await HomeVisitModel.find({
    _id: { $in: reviews.map((review) => review.homeVisitId) },
  })
    .select("serviceType")
    .lean();
  const serviceTypeByVisit = new Map(
    visits.map((visit) => [visit._id.toString(), String(visit.serviceType)]),
  );

  const operations = [];
  let skipped = 0;
  for (const review of reviews) {
    const serviceType = serviceTypeByVisit.get(review.homeVisitId.toString());
    if (!serviceType) {
      skipped += 1;
      continue;
    }
    operations.push({
      updateOne: {
        filter: { _id: review._id },
        update: { $set: { providerKind: homeVisitProviderKind(serviceType) } },
      },
    });
  }

  const result = operations.length
    ? await HomeVisitReviewModel.bulkWrite(operations)
    : { modifiedCount: 0 };

  console.log(
    `Home visit review provider kind migration complete. updated=${result.modifiedCount} skipped=${skipped} (visit missing)`,
  );
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
