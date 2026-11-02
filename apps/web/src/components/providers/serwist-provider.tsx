"use client";

import type { ComponentProps } from "react";
import { SerwistProvider as BaseSerwistProvider } from "@serwist/turbopack/react";

/**
 * Serwist defaults `reloadOnOnline` to true, which hard-reloads the page on every
 * `online` event — flaky mobile data made patients' pages reload and lose input.
 */
export function SerwistProvider(props: ComponentProps<typeof BaseSerwistProvider>) {
  return <BaseSerwistProvider reloadOnOnline={false} {...props} />;
}
