import { Suspense } from "react";
import { OnlineConsultService } from "@/server/services/online-consult.service";
import { DoctorsConsultClient } from "./doctors-consult-client";

type DoctorsConsultSectionProps = {
  initialSpecialty?: string;
  initialCity?: string;
};

/**
 * Server-renders the initial doctor listing into the HTML (crawlable, no
 * post-hydration fetch). Streams behind Suspense so the DB query never delays
 * the page hero; the fallback is the client list in its loading state — the
 * same markup these pages rendered before.
 */
export function DoctorsConsultSection(props: DoctorsConsultSectionProps) {
  return (
    <Suspense fallback={<DoctorsConsultClient {...props} />}>
      <DoctorsConsultWithData {...props} />
    </Suspense>
  );
}

async function DoctorsConsultWithData({ initialSpecialty, initialCity }: DoctorsConsultSectionProps) {
  let initialDoctors;
  try {
    // Same call (and output shape) as the public GET /api/v1/consult/doctors.
    initialDoctors = await OnlineConsultService.listConsultDoctors(initialCity, initialSpecialty);
  } catch (error) {
    // Keep the page up: the client falls back to fetching the listing itself.
    console.error("[doctors] server listing failed; falling back to client fetch", error);
  }

  return (
    <DoctorsConsultClient
      initialSpecialty={initialSpecialty}
      initialCity={initialCity}
      initialDoctors={initialDoctors}
    />
  );
}
