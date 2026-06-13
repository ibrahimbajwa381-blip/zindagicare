/**
 * One-time migration: encrypt existing plaintext PII in MongoDB and verification files.
 *
 * Usage (from repo root, with apps/web/.env.local loaded):
 *   npx dotenv -e apps/web/.env.local -- npx tsx apps/web/scripts/migrate-encrypt-pii.ts
 *
 * Or set FIELD_ENCRYPTION_KEY and MONGODB_URI in the environment before running:
 *   npx tsx apps/web/scripts/migrate-encrypt-pii.ts
 */
import { readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import {
  ChatMessageModel,
  ChatThreadModel,
  connectDatabase,
  DoctorProfileModel,
  FamilyMemberModel,
  HomeVisitModel,
  MedicalIntakeModel,
  NotificationModel,
  PatientProfileModel,
  PrescriptionModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import {
  emailLookupHash,
  encryptField,
  isEncrypted,
  isEncryptedFile,
  phoneLookupHash,
  unwrapEncryptedFile,
  wrapEncryptedFile,
} from "@zindagi/shared/crypto/field-encryption";

const UPLOAD_DIRS = [
  path.join(process.cwd(), ".uploads", "doctor-verification"),
  path.join(process.cwd(), ".uploads", "nurse-verification"),
  path.join(process.cwd(), ".uploads", "home-visit-reports"),
];

async function migrateUsers() {
  const users = await UserModel.find().select("+emailLookup +phoneLookup");
  let count = 0;

  for (const user of users) {
    if (user.email && !isEncrypted(user.email)) {
      user.emailLookup = emailLookupHash(user.email);
      user.email = encryptField(user.email);
    }
    if (user.phone && !isEncrypted(user.phone)) {
      user.phoneLookup = phoneLookupHash(user.phone);
      user.phone = encryptField(user.phone);
    }
    if (user.name && !isEncrypted(user.name)) {
      user.name = encryptField(user.name);
    }
    await user.save();
    count += 1;
  }

  console.log(`Users encrypted: ${count}`);
}

async function migrateCollection(
  label: string,
  model: { find: () => Promise<Array<{ save: () => Promise<unknown> }>> },
) {
  const docs = await model.find();
  for (const doc of docs) {
    await doc.save();
  }
  console.log(`${label}: re-saved ${docs.length} documents (plugin encrypts fields)`);
}

async function encryptFilesInDir(root: string) {
  if (!root.startsWith(path.join(process.cwd(), ".uploads"))) return;

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const raw = await readFile(full);
      if (isEncryptedFile(raw)) continue;
      await writeFile(full, wrapEncryptedFile(raw));
      console.log(`Encrypted file: ${full}`);
    }
  }

  try {
    await walk(root);
  } catch {
    // Directory may not exist yet.
  }
}

async function main() {
  if (!process.env.FIELD_ENCRYPTION_KEY) {
    throw new Error("FIELD_ENCRYPTION_KEY is required");
  }

  await connectDatabase();

  console.log("Migrating users (explicit)…");
  await migrateUsers();

  console.log("Migrating profile / clinical collections…");
  await migrateCollection("PatientProfile", PatientProfileModel);
  await migrateCollection("DoctorProfile", DoctorProfileModel);
  await migrateCollection("StaffProfile", StaffProfileModel);
  await migrateCollection("FamilyMember", FamilyMemberModel);
  await migrateCollection("MedicalIntake", MedicalIntakeModel);
  await migrateCollection("ChatMessage", ChatMessageModel);
  await migrateCollection("ChatThread", ChatThreadModel);
  await migrateCollection("HomeVisit", HomeVisitModel);
  await migrateCollection("Prescription", PrescriptionModel);
  await migrateCollection("Notification", NotificationModel);

  console.log("Encrypting uploaded documents at rest…");
  for (const dir of UPLOAD_DIRS) {
    await encryptFilesInDir(dir);
  }

  console.log("PII encryption migration complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
