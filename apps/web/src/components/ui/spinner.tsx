import * as React from "react";
import { cn } from "@zindagi/shared";

const sizeMap = {
  xs: "size-3.5 border-2",
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-9 border-[3px]",
  xl: "size-12 border-4",
} as const;

export type SpinnerSize = keyof typeof sizeMap;

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  /** Accessible label announced to screen readers. */
  label?: string;
}

/**
 * Brand-coloured ring spinner. Use `currentColor` by setting a text color on a
 * parent or via className (e.g. `text-white`) to recolour the moving arc.
 */
const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size = "md", label = "Loading", ...props }, ref) => {
    return (
      <span
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          "inline-block animate-spin rounded-full border-current border-t-transparent text-brand",
          sizeMap[size],
          className,
        )}
        {...props}
      >
        <span className="sr-only">{label}</span>
      </span>
    );
  },
);
Spinner.displayName = "Spinner";

export { Spinner };
