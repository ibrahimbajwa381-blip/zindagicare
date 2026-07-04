import { NextResponse } from "next/server";
import {
  getConfiguredLiveProviders,
  isLivePaymentsEnabled,
} from "@/lib/payments/payment-gateway";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      livePaymentsEnabled: isLivePaymentsEnabled(),
      providers: getConfiguredLiveProviders(),
    },
  });
}
