import { Suspense } from "react";
import ConsultBookingSuccessPage from "./success-page-client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConsultBookingSuccessPage />
    </Suspense>
  );
}
