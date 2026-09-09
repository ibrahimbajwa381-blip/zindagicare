/**
 * Creates two clearly-labeled throwaway doctor fixtures needed to unblock
 * DOC-008 (unverified) and DOC-009 (restricted) integration tests.
 * Explicitly approved by the user for this stress-testing round.
 * Prints the created ids so they can be cleaned up afterward.
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

function loadEnv(envPath: string) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv(path.resolve(__dirname, "../apps/web/.env"));

async function main() {
  const { connectDatabase, UserModel, DoctorProfileModel } = await import("@zindagi/database");
  const { Roles, VerificationStatuses } = await import("@zindagi/shared");

  await connectDatabase();
  const passwordHash = await bcrypt.hash("Testing@123", 12);

  const DEFAULT_WEEKLY_AVAILABILITY = [
    { dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00" },
    { dayOfWeek: 2, startTimeLocal: "09:00", endTimeLocal: "17:00" },
  ];

  // --- Fixture 1: unverified (pending) doctor, deliberately isListed:true
  // to prove verificationStatus filtering alone (not just isListed) keeps
  // it out of discovery — a stronger server-side-enforcement test.
  const unverifiedUser = await UserModel.create({
    name: "TEST-STRESS Unverified Doctor",
    email: "test-stress-unverified-doctor@example.com",
    phone: "+923005550001",
    passwordHash,
    roles: [Roles.DOCTOR],
    authProviders: ["credentials"],
    emailVerified: new Date(),
    onboardingCompleted: true,
    isActive: true,
  });
  const unverifiedProfile = await DoctorProfileModel.create({
    userId: unverifiedUser._id,
    primarySpecialty: "Cardiologist",
    specialties: ["Cardiologist"],
    consultationFee: 2000,
    videoConsultEnabled: true,
    weeklyAvailability: DEFAULT_WEEKLY_AVAILABILITY,
    coverageCities: ["Lahore"],
    verificationStatus: VerificationStatuses.PENDING,
    isListed: true, // intentionally true — tests that verificationStatus filter alone excludes it
  } as Record<string, unknown>);

  // --- Fixture 2: restricted doctor, mirroring exactly what
  // DoctorAccountabilityService.escalate() sets on auto-restriction.
  const restrictedUser = await UserModel.create({
    name: "TEST-STRESS Restricted Doctor",
    email: "test-stress-restricted-doctor@example.com",
    phone: "+923005550002",
    passwordHash,
    roles: [Roles.DOCTOR],
    authProviders: ["credentials"],
    emailVerified: new Date(),
    onboardingCompleted: true,
    isActive: true,
  });
  const restrictedProfile = await DoctorProfileModel.create({
    userId: restrictedUser._id,
    primarySpecialty: "Dermatologist",
    specialties: ["Dermatologist"],
    consultationFee: 2000,
    videoConsultEnabled: false,
    weeklyAvailability: DEFAULT_WEEKLY_AVAILABILITY,
    coverageCities: ["Lahore"],
    verificationStatus: VerificationStatuses.RESTRICTED,
    isListed: false,
    accountability: {
      totalMisses: 3,
      currentMonthMisses: 3,
      autoRestrictedAt: new Date(),
      autoRestrictedMonthKey: "2026-09",
    },
  } as Record<string, unknown>);

  console.log(
    JSON.stringify(
      {
        unverifiedUserId: unverifiedUser._id.toString(),
        unverifiedProfileId: unverifiedProfile._id.toString(),
        restrictedUserId: restrictedUser._id.toString(),
        restrictedProfileId: restrictedProfile._id.toString(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Fixture creation failed:", err);
  process.exit(1);
});
