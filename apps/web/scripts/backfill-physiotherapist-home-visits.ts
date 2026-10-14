/**
 * One-time rollout backfill: switch home visits ON for physiotherapists who were approved
 * before approval started enabling them automatically.
 *
 * Eligible: approved, non-deleted physiotherapists with home visits off AND a genuine saved
 * Google Maps location. Excluded (reported, never changed): missing/invalid coordinates and
 * the Lahore city-centre placeholder pin (74.3587, 31.5204). Doctors and nurses are never
 * touched. Business decision for this rollout: eligible profiles are switched on even if
 * their OFF setting was deliberate.
 *
 * Dry run is the default and only reads. --apply needs --expect=<eligible count from the
 * reviewed dry run>; it refuses if the count has drifted. Output lists staff profile IDs only.
 * Never wired into deploy or app startup. Index auto-builds are disabled so a dry run does
 * not write to the database.
 *
 * Usage (from repo root):
 *   # 1. Dry run (read-only)
 *   npx tsx --env-file=apps/web/.env apps/web/scripts/backfill-physiotherapist-home-visits.ts
 *   # 2. Apply after reviewing the dry run
 *   npx tsx --env-file=apps/web/.env apps/web/scripts/backfill-physiotherapist-home-visits.ts --apply --expect=<N>
 */
import mongoose from "mongoose";
import { connectDatabase } from "@zindagi/database";
import {
  applyPhysiotherapistHomeVisitBackfill,
  reportPhysiotherapistHomeVisitBackfill,
} from "../src/server/services/physiotherapist-home-visit-backfill";

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const expectArg = argv.find((arg) => arg.startsWith("--expect="));
  const expected = expectArg ? Number(expectArg.slice("--expect=".length)) : undefined;
  return { apply, expected };
}

function printIds(label: string, ids: string[]) {
  console.log(`  ${label}: ${ids.length}`);
  for (const id of ids) console.log(`    ${id}`);
}

async function backfill() {
  const { apply, expected } = parseArgs(process.argv.slice(2));
  if (apply && (expected === undefined || !Number.isInteger(expected) || expected < 0)) {
    throw new Error("--apply requires --expect=<eligible count from the reviewed dry run>.");
  }

  // Connecting must not build indexes or collections — this script only touches homeVisitEnabled.
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await connectDatabase();

  const report = await reportPhysiotherapistHomeVisitBackfill();
  console.log(`Approved physiotherapists with home visits OFF: ${report.scanned}`);
  printIds("eligible (genuine location)", report.eligible);
  printIds("excluded — Lahore placeholder pin", report.excludedPlaceholder);
  printIds("excluded — missing/invalid location", report.excludedMissingOrInvalid);

  if (!apply) {
    console.log(
      `\nDry run — nothing written. To apply: --apply --expect=${report.eligible.length}`,
    );
    return;
  }

  if (report.eligible.length !== expected) {
    throw new Error(
      `Eligible count is now ${report.eligible.length}, expected ${expected}. Re-run the dry run and review again.`,
    );
  }

  const result = await applyPhysiotherapistHomeVisitBackfill(report.eligible);
  console.log(
    `\nApplied. updated=${result.updated.length} skipped=${result.skipped.length} failed=${result.failed.length}`,
  );
  for (const id of result.skipped) console.log(`  skipped (no longer eligible): ${id}`);
  for (const failure of result.failed) console.log(`  failed: ${failure.id} — ${failure.error}`);
  if (result.failed.length) process.exitCode = 1;
}

backfill()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
