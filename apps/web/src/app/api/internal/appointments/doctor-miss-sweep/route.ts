import { NextRequest, NextResponse } from "next/server";
import { DoctorAccountabilityService } from "@/server/services/doctor-accountability.service";
import { ConsultationLifecycleService } from "@/server/services/consultation/consultation-lifecycle.service";

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // External scheduler header OR Vercel Cron's Authorization: Bearer header.
  if (req.headers.get("x-cron-secret") === secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await DoctorAccountabilityService.processMissedAppointments();
  // Same daily run: complete attended consults the provider never finished.
  const finalized = await ConsultationLifecycleService.finalizeStale();
  return NextResponse.json({ success: true, results, finalized });
}

// Allow Vercel Cron (GET) to trigger the same sweep.
export async function GET(req: NextRequest) {
  return POST(req);
}
