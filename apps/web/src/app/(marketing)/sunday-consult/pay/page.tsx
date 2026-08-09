import { Suspense } from "react";
import SundayPayPageClient from "./pay-page-client";
import { transactionalMetadata } from "@/lib/seo/transactional";

export const metadata = transactionalMetadata;

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SundayPayPageClient />
    </Suspense>
  );
}
