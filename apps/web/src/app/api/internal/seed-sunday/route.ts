import { NextResponse } from "next/server";
import { connectDatabase, UserModel, DoctorProfileModel } from "@zindagi/database";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { getDemoDoctorImage } from "@/features/marketing/data/demo-doctor-images";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

/** Dev-only seed: demo Sunday doctors in Lahore */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
  await connectDatabase();

  // Drop legacy compound indexes that MongoDB rejects (parallel arrays).
  const doctorIndexes = await DoctorProfileModel.collection.indexes();
  for (const idx of doctorIndexes) {
    const keys = Object.keys(idx.key ?? {});
    if (
      idx.name &&
      keys.includes("specialties") &&
      keys.some((k) => k.startsWith("hospitals"))
    ) {
      await DoctorProfileModel.collection.dropIndex(idx.name).catch(() => undefined);
    }
  }
  const demos = [
    { name: "Dr. Ayesha Khan", specialty: "General Physician" },
    { name: "Dr. Hassan Raza", specialty: "Cardiologist" },
    { name: "Dr. Sara Ahmed", specialty: "Dermatologist" },
  ];

  const created = [];

  for (const demo of demos) {
    const email = demo.name.toLowerCase().replace(/\s+/g, ".") + "@demo.zindagicare.pk";
    let user = await UserModel.findOne({ email });
    const avatarUrl = getDemoDoctorImage(demo.name);

    if (!user) {
      user = await UserModel.create({
        email,
        name: demo.name,
        avatarUrl,
        roles: [Roles.DOCTOR, Roles.PATIENT],
        onboardingCompleted: true,
        authProviders: ["credentials"],
      });
    } else if (avatarUrl) {
      user.avatarUrl = avatarUrl;
      await user.save();
    }

    let profile = await DoctorProfileModel.findOne({
      userId: user._id,
    } as Record<string, unknown>);
    if (!profile) {
      // Omit hospitals on create — legacy DB index on specialties + hospitals.city
      // rejects documents with both array fields until that index is dropped.
      profile = await DoctorProfileModel.create({
        userId: user._id,
        specialties: [demo.specialty],
        pmdcVerified: true,
        verificationStatus: VerificationStatuses.APPROVED,
        sundayConsultEnabled: true,
        isListed: true,
        coverageCities: ["Lahore"],
        slug: demo.name.toLowerCase().replace(/\s+/g, "-"),
        ratingAvg: 4.8,
        ratingCount: 100,
      } as never);
    } else {
      await DoctorProfileModel.updateOne(
        { _id: profile._id },
        {
          $set: {
            sundayConsultEnabled: true,
            isListed: true,
            verificationStatus: VerificationStatuses.APPROVED,
            coverageCities: profile.coverageCities?.includes("Lahore")
              ? profile.coverageCities
              : [...(profile.coverageCities ?? []), "Lahore"],
          },
        },
      );
      profile = await DoctorProfileModel.findById(profile._id);
      if (!profile) continue;
    }

    await SundayConsultService.upsertTemplate(user._id.toString(), {
      startTimeLocal: "09:00",
      endTimeLocal: "13:00",
      slotDurationMins: 10,
      maxSlots: 16,
      isActive: true,
    });

    created.push({ doctorId: profile._id.toString(), name: demo.name });
  }

  return NextResponse.json({ success: true, created });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Seed failed";
    console.error("[seed-sunday]", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
