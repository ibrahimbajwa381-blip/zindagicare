/**
 * Dev/testing seed script — populates the (currently empty) database with
 * doctors, patients, and reviews so the app has something to test against.
 *
 * Usage: npx tsx scripts/seed.ts
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
  const {
    connectDatabase,
    UserModel,
    DoctorProfileModel,
    PatientProfileModel,
    ReviewModel,
  } = await import("@zindagi/database");
  const { Roles, VerificationStatuses, emailLookupHash } = await import(
    "@zindagi/shared"
  );

  await connectDatabase();
  console.log("Connected to MongoDB.");

  const BCRYPT_ROUNDS = 12;
  const DEFAULT_PASSWORD = "Testing@123";

  const DEFAULT_WEEKLY_AVAILABILITY = [
    { dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00" },
    { dayOfWeek: 2, startTimeLocal: "09:00", endTimeLocal: "17:00" },
    { dayOfWeek: 3, startTimeLocal: "09:00", endTimeLocal: "17:00" },
    { dayOfWeek: 4, startTimeLocal: "09:00", endTimeLocal: "17:00" },
    { dayOfWeek: 5, startTimeLocal: "09:00", endTimeLocal: "17:00" },
    { dayOfWeek: 6, startTimeLocal: "09:00", endTimeLocal: "13:00" },
  ];

  function slugify(name: string, suffix: string) {
    return (
      name
        .toLowerCase()
        .replace(/^dr\.?\s*/i, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") + `-${suffix}`
    );
  }

  const doctorSeeds = [
    {
      name: "Dr. Ayesha Khan",
      email: "ayesha.khan.doctor@example.com",
      phone: "+923001234501",
      specialties: ["Cardiologist"],
      city: "Lahore",
      fee: 2500,
      bio: "Consultant cardiologist with 12 years of experience in adult cardiology and echocardiography.",
      experienceYears: 12,
      college: "King Edward Medical University",
      degree: "MBBS, FCPS (Cardiology)",
    },
    {
      name: "Dr. Bilal Ahmed",
      email: "bilal.ahmed.doctor@example.com",
      phone: "+923001234502",
      specialties: ["Dermatologist"],
      city: "Lahore",
      fee: 2000,
      bio: "Skin, hair and cosmetic dermatology specialist.",
      experienceYears: 8,
      college: "Allama Iqbal Medical College",
      degree: "MBBS, FCPS (Dermatology)",
    },
    {
      name: "Dr. Sana Malik",
      email: "sana.malik.doctor@example.com",
      phone: "+923001234503",
      specialties: ["Gynecologist"],
      city: "Lahore",
      fee: 3000,
      bio: "Obstetrics & gynecology consultant, high-risk pregnancy management.",
      experienceYears: 15,
      college: "Fatima Jinnah Medical University",
      degree: "MBBS, FCPS (Gynecology & Obstetrics)",
    },
    {
      name: "Dr. Usman Tariq",
      email: "usman.tariq.doctor@example.com",
      phone: "+923001234504",
      specialties: ["Pediatrician"],
      city: "Karachi",
      fee: 1800,
      bio: "Child health specialist focused on newborn and adolescent care.",
      experienceYears: 10,
      college: "Dow Medical College",
      degree: "MBBS, FCPS (Pediatrics)",
    },
    {
      name: "Dr. Hina Raza",
      email: "hina.raza.doctor@example.com",
      phone: "+923001234505",
      specialties: ["General Physician"],
      city: "Islamabad",
      fee: 1500,
      bio: "General physician for everyday illnesses, chronic disease management, and preventive care.",
      experienceYears: 6,
      college: "Rawalpindi Medical University",
      degree: "MBBS",
    },
    {
      name: "Dr. Kamran Sheikh",
      email: "kamran.sheikh.doctor@example.com",
      phone: "+923001234506",
      specialties: ["Orthopedic Surgeon"],
      city: "Lahore",
      fee: 3500,
      bio: "Orthopedic surgeon specializing in joint replacement and sports injuries.",
      experienceYears: 18,
      college: "King Edward Medical University",
      degree: "MBBS, FCPS (Orthopedic Surgery)",
    },
  ];

  const patientSeeds = [
    { name: "Ali Raza", email: "ali.raza.patient@example.com", phone: "+923009876501", city: "Lahore" },
    { name: "Fatima Noor", email: "fatima.noor.patient@example.com", phone: "+923009876502", city: "Lahore" },
    { name: "Zainab Hussain", email: "zainab.hussain.patient@example.com", phone: "+923009876503", city: "Karachi" },
  ];

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  console.log("\nSeeding doctors...");
  const createdDoctorProfileIds: string[] = [];

  for (const seed of doctorSeeds) {
    const existing = await UserModel.findOne({
      emailLookup: emailLookupHash(seed.email),
    });
    if (existing) {
      console.log(`  skip (exists): ${seed.name}`);
      const profile = await DoctorProfileModel.findOne({ userId: existing._id });
      if (profile) createdDoctorProfileIds.push(profile._id.toString());
      continue;
    }

    const user = await UserModel.create({
      name: seed.name,
      email: seed.email,
      phone: seed.phone,
      passwordHash,
      roles: [Roles.DOCTOR],
      authProviders: ["credentials"],
      emailVerified: new Date(),
      onboardingCompleted: true,
      isActive: true,
      metadata: { locale: "en", city: seed.city },
    });

    const profile = (await DoctorProfileModel.create({
      userId: user._id,
      pmdcNumber: `PMDC-${Math.floor(10000 + Math.random() * 89999)}`,
      pmdcVerified: true,
      medicalDegree: seed.degree,
      medicalCollege: seed.college,
      graduationYear: 2024 - seed.experienceYears - 5,
      primarySpecialty: seed.specialties[0],
      additionalSpecialties: seed.specialties.slice(1),
      specialties: seed.specialties,
      experienceYears: seed.experienceYears,
      bio: seed.bio,
      languages: ["English", "Urdu"],
      hospitals: [
        {
          name: `${seed.city} General Hospital`,
          city: seed.city,
          address: `Main Boulevard, ${seed.city}`,
        },
      ],
      consultationFee: seed.fee,
      videoConsultEnabled: true,
      urgentConsultEnabled: false,
      sundayConsultEnabled: false,
      weeklyAvailability: DEFAULT_WEEKLY_AVAILABILITY,
      coverageCities: [seed.city],
      homeVisitEnabled: false,
      verificationStatus: VerificationStatuses.APPROVED,
      verifiedAt: new Date(),
      isListed: true,
      ratingAvg: 0,
      ratingCount: 0,
    } as Record<string, unknown>)) as { _id: { toString(): string } };

    const slug = slugify(seed.name, profile._id.toString().slice(-6));
    await DoctorProfileModel.findByIdAndUpdate(profile._id, { $set: { slug } });

    createdDoctorProfileIds.push(profile._id.toString());
    console.log(`  created: ${seed.name} (${seed.specialties[0]}, ${seed.city})`);
  }

  console.log("\nSeeding patients...");
  const createdPatientUserIds: string[] = [];

  for (const seed of patientSeeds) {
    const existing = await UserModel.findOne({
      emailLookup: emailLookupHash(seed.email),
    });
    if (existing) {
      console.log(`  skip (exists): ${seed.name}`);
      createdPatientUserIds.push(existing._id.toString());
      continue;
    }

    const user = await UserModel.create({
      name: seed.name,
      email: seed.email,
      phone: seed.phone,
      passwordHash,
      roles: [Roles.PATIENT],
      authProviders: ["credentials"],
      emailVerified: new Date(),
      onboardingCompleted: true,
      isActive: true,
      metadata: { locale: "en", city: seed.city },
    });

    await PatientProfileModel.create({
      userId: user._id,
      defaultCity: seed.city,
    });

    createdPatientUserIds.push(user._id.toString());
    console.log(`  created: ${seed.name}`);
  }

  console.log("\nSeeding reviews...");
  const reviewComments = [
    { rating: 5, comment: "Very professional and explained everything clearly." },
    { rating: 4, comment: "Good experience, slight wait time." },
    { rating: 5, comment: "Highly recommend, very caring doctor." },
  ];

  let reviewCount = 0;
  for (let i = 0; i < createdDoctorProfileIds.length; i++) {
    const doctorId = createdDoctorProfileIds[i];
    const patientId = createdPatientUserIds[i % createdPatientUserIds.length];
    const { rating, comment } = reviewComments[i % reviewComments.length];

    const existing = await ReviewModel.findOne({ doctorId, patientId });
    if (existing) continue;

    await ReviewModel.create({
      doctorId,
      patientId,
      providerRole: "doctor",
      providerProfileId: doctorId,
      rating,
      comment,
      isVisible: true,
      source: "patient",
    });

    await DoctorProfileModel.findByIdAndUpdate(doctorId, {
      $inc: { ratingCount: 1 },
      $set: { ratingAvg: rating },
    });

    reviewCount++;
  }
  console.log(`  created ${reviewCount} review(s).`);

  console.log("\nDone. Login password for all seeded accounts:", DEFAULT_PASSWORD);
  console.log(
    "Doctor emails:",
    doctorSeeds.map((d) => d.email).join(", "),
  );
  console.log(
    "Patient emails:",
    patientSeeds.map((p) => p.email).join(", "),
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
