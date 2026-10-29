/**
 * Brings every account to one role: patient OR one clinical role (doctor, nurse,
 * physiotherapist, herbalist, nutritionist). An account keeps the clinical role
 * that has a live provider profile; otherwise it becomes a patient. Accounts with
 * live profiles for several clinical roles are reported, never changed.
 *
 * Dry run by default (read-only). Writes a JSON report of user ids and roles
 * (no PII) to the current directory; keep it to roll back if needed.
 *
 * Usage (from repo root):
 *   npx dotenv -e apps/web/.env.local -- npx tsx apps/web/scripts/normalize-account-roles.ts
 *   npx dotenv -e apps/web/.env.local -- npx tsx apps/web/scripts/normalize-account-roles.ts --apply
 *
 * Signed-in web sessions keep their old roles until the user signs in again.
 */
import { writeFileSync } from "fs";
import {
  applyAccountRoleFixes,
  planAccountRoleFixes,
} from "../src/server/services/account-roles.service";

async function main() {
  const apply = process.argv.includes("--apply");
  const plan = await planAccountRoleFixes();

  for (const fix of plan.fixes) {
    const flag = fix.patientAppointments > 0 && !fix.after.includes("patient")
      ? `  (has ${fix.patientAppointments} patient booking(s))`
      : "";
    console.log(`${fix.userId}: [${fix.before.join(", ")}] -> [${fix.after.join(", ")}]${flag}`);
  }
  for (const conflict of plan.conflicts) {
    console.warn(`${conflict.userId}: SKIPPED, ${conflict.reason}`);
  }
  console.log(`fixes=${plan.fixes.length} conflicts=${plan.conflicts.length}`);

  const result = apply ? await applyAccountRoleFixes(plan.fixes) : null;
  const reportPath = `role-fix-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(reportPath, JSON.stringify({ apply, ...plan, result }, null, 2));

  if (result) {
    console.log(`applied=${result.applied.length} skipped(changed since plan)=${result.skipped.length}`);
  } else {
    console.log("Dry run, nothing changed. Re-run with --apply to write.");
  }
  console.log(`Report: ${reportPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
