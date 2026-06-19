import { Suspense } from "react";
import UrgentSuccessPageClient from "./success-page-client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UrgentSuccessPageClient />
    </Suspense>
  );
}
