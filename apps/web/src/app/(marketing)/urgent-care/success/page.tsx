import { Suspense } from "react";
import UrgentSuccessPageClient from "./success-page-client";
import { transactionalMetadata } from "@/lib/seo/transactional";

export const metadata = transactionalMetadata;

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UrgentSuccessPageClient />
    </Suspense>
  );
}
