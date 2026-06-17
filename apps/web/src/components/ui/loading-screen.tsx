import * as React from "react";
import { cn } from "@zindagi/shared";
import { Spinner, type SpinnerSize } from "./spinner";

export interface LoadingScreenProps {
  /** Optional message shown beneath the spinner. */
  message?: string;
  /** Spinner size. Defaults to `lg`. */
  size?: SpinnerSize;
  /** When true, fills the viewport height. Otherwise fills the parent. */
  fullScreen?: boolean;
  className?: string;
}

/**
 * Centered spinner with an optional caption. Used by route-level `loading.tsx`
 * files and anywhere an entire region is waiting on data.
 */
export function LoadingScreen({
  message = "Loading…",
  size = "lg",
  fullScreen = false,
  className,
}: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        fullScreen ? "min-h-[60vh]" : "min-h-[240px]",
        className,
      )}
    >
      <Spinner size={size} />
      {message ? (
        <p className="text-sm font-medium text-slate-500">{message}</p>
      ) : null}
    </div>
  );
}

/**
 * Inline spinner + label, sized to flow within text or buttons.
 */
export function LoadingInline({
  message = "Loading…",
  size = "sm",
  className,
}: {
  message?: string;
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-busy="true"
      className={cn("inline-flex items-center gap-2 text-sm text-slate-500", className)}
    >
      <Spinner size={size} />
      {message ? <span>{message}</span> : null}
    </span>
  );
}
