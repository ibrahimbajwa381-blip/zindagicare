import { NextResponse } from "next/server";
import {
  connectDatabase,
  UserModel,
  StaffProfileModel,
} from "@zindagi/database";
import { Roles, VerificationStatuses, LAHORE_GEO, emailLookupHash } from "@zindagi/shared";

/** Dev-only seed: demo nurses across Lahore for home care matching */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
    await connectDatabase();

    const demos = [
      { name: "Nurse Fatima Ali", lng: 74.34, lat: 31.52 },
      { name: "Nurse Usman Malik", lng: 74.38, lat: 31.49 },
      { name: "Nurse Amina Shah", lng: 74.31, lat: 31.55 },
    ];

    const created = [];

    for (const demo of demos) {
      const email =
        demo.name.toLowerCase().replace(/\s+/g, ".") + "@nurse.zindagicare.pk";
      let user = await UserModel.findOne({ emailLookup: emailLookupHash(email) });

      if (!user) {
        user = await UserModel.create({
          email,
          name: demo.name,
          roles: [Roles.NURSE, Roles.PATIENT],
          onboardingCompleted: true,
          authProviders: ["credentials"],
        });
      }

      const userId = user._id;
      await StaffProfileModel.updateOne(
        { userId } as Record<string, unknown>,
        {
          $set: {
            staffType: Roles.NURSE,
            isAvailable: true,
            verificationStatus: VerificationStatuses.APPROVED,
            employeeCode: `NRS-${userId.toString().slice(-6).toUpperCase()}`,
            serviceAreas: [
              {
                city: "Lahore",
                geo: {
                  type: "Point",
                  coordinates: [demo.lng, demo.lat],
                },
                radiusKm: 15,
              },
            ],
          },
        },
        { upsert: true },
      );

      created.push({ name: demo.name, email, userId: user._id.toString() });
    }

    return NextResponse.json({
      success: true,
      created,
      lahoreCenter: LAHORE_GEO,
    });
  } catch (e) {
    console.error("[seed-home-care]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 },
    );
  }
}
