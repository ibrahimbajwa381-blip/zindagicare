import { Suspense } from "react";
import ConsultBookingSuccessPage from "./success-page-client";
import { transactionalMetadata } from "@/lib/seo/transactional";

export const metadata = transactionalMetadata;

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConsultBookingSuccessPage />
    </Suspense>
  );
}
