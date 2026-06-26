import { Suspense } from "react";
import ConsultTestPaymentPage from "./pay-page-client";
import { transactionalMetadata } from "@/lib/seo/transactional";

export const metadata = transactionalMetadata;

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConsultTestPaymentPage />
    </Suspense>
  );
}
