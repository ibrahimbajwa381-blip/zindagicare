/**
 * One-time migration: doctors/nurses/physiotherapists/herbalists/nutritionists no
 * longer get a bundled patient account — strip the patient role from any existing
 * account that holds both, and delete its now-orphaned PatientProfile.
 *
 * Usage (from repo root):
 *   npx dotenv -e apps/web/.env.local -- npx tsx apps/web/scripts/migrate-strip-patient-role-from-staff.ts
 */
import { connectDatabase, PatientProfileModel, UserModel } from "@zindagi/database";
import { Roles } from "@zindagi/shared";

const CLINICAL_STAFF_ROLES = [
  Roles.DOCTOR,
  Roles.NURSE,
  Roles.PHYSIOTHERAPIST,
  Roles.HERBALIST,
  Roles.NUTRITIONIST,
];

async function migrate() {
  await connectDatabase();

  const users = await UserModel.find({
    $and: [{ roles: Roles.PATIENT }, { roles: { $in: CLINICAL_STAFF_ROLES } }],
  }).select("_id");

  let usersUpdated = 0;
  let profilesDeleted = 0;
  let profilesMissing = 0;

  for (const user of users) {
    await UserModel.updateOne({ _id: user._id }, { $pull: { roles: Roles.PATIENT } });
    usersUpdated += 1;

    const result = await PatientProfileModel.deleteOne({ userId: user._id.toString() });
    if (result.deletedCount > 0) {
      profilesDeleted += 1;
    } else {
      profilesMissing += 1;
      console.warn(`No PatientProfile found for user ${user._id.toString()}`);
    }
  }

  console.log(
    `Migration complete. usersUpdated=${usersUpdated} profilesDeleted=${profilesDeleted} profilesMissing=${profilesMissing}`,
  );
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
