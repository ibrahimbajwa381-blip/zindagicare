import { Suspense } from "react";
import UrgentPayPageClient from "./pay-page-client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UrgentPayPageClient />
    </Suspense>
  );
}
