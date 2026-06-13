"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { cn } from "@zindagi/shared";

type ScrollChainContainerProps = {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

export function ScrollChainContainer({
  children,
  className,
  "aria-label": ariaLabel,
}: ScrollChainContainerProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) return;

    const atTop = scrollTop <= 0;
    const atBottom = scrollTop >= maxScroll - 1;
    const goingDown = event.deltaY > 0;
    const goingUp = event.deltaY < 0;

    if (goingDown && atBottom) {
      window.scrollBy({ top: event.deltaY, behavior: "auto" });
      return;
    }

    if (goingUp && atTop) {
      window.scrollBy({ top: event.deltaY, behavior: "auto" });
      return;
    }

    event.stopPropagation();
  }, []);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={ariaLabel}
      onWheel={onWheel}
      className={cn("overflow-y-auto overscroll-auto", className)}
    >
      {children}
    </div>
  );
}
