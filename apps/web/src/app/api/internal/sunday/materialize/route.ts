import { NextRequest, NextResponse } from "next/server";
import { connectDatabase, DoctorProfileModel } from "@zindagi/database";
import { SundayConsultService } from "@/server/services/sunday-consult.service";
import { getSundayDateForOffset } from "@/lib/sunday/date-utils";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDatabase();
  const doctors = await DoctorProfileModel.find({
    sundayConsultEnabled: true,
  }).select("_id");

  const results = [];
  for (let week = 0; week < 4; week++) {
    const sundayDate = getSundayDateForOffset(week);
    for (const doc of doctors) {
      try {
        await SundayConsultService.materializeInstance(
          doc._id.toString(),
          sundayDate,
        );
        results.push({ doctorId: doc._id.toString(), week, ok: true });
      } catch {
        results.push({ doctorId: doc._id.toString(), week, ok: false });
      }
    }
  }

  await SundayConsultService.releaseExpiredHolds();

  return NextResponse.json({ success: true, results });
}
