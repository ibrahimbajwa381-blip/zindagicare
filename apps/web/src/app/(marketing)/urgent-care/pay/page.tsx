import { Suspense } from "react";
import UrgentPayPageClient from "./pay-page-client";
import { transactionalMetadata } from "@/lib/seo/transactional";

export const metadata = transactionalMetadata;

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UrgentPayPageClient />
    </Suspense>
  );
}
