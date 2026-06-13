"use client";

import { startTransition, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Navigate without racing the App Router during hydration.
 * Prefer push-only — avoid refresh immediately after push.
 */
export function useSafeRouter() {
  const router = useRouter();

  const push = useCallback((href: string) => {
    startTransition(() => {
      router.push(href);
    });
  }, [router]);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  return { push, refresh, router };
}
