import { Suspense } from "react";
import ConsultTestPaymentPage from "./pay-page-client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConsultTestPaymentPage />
    </Suspense>
  );
}
