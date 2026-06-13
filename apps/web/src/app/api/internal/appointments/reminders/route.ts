import { NextRequest, NextResponse } from "next/server";
import { AppointmentReminderService } from "@/server/services/appointment-reminder.service";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await AppointmentReminderService.processDueReminders();
  return NextResponse.json({ success: true, results });
}
