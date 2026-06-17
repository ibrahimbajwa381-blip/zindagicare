import * as React from "react";
import { cn } from "@zindagi/shared";

/** Shimmering placeholder block used while content loads. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-slate-200/70", className)}
      {...props}
    />
  );
}

export { Skeleton };
