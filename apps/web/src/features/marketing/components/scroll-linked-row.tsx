"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@zindagi/shared";

/**
 * Horizontal row pinned in the vertical centre of the viewport: once it
 * reaches the centre, vertical page scroll slides it sideways until the last
 * item is in view, then the page continues scrolling down. The outer wrapper
 * is made taller by the horizontal distance so there is scroll to consume.
 * Falls back to a native swipeable row for reduced motion.
 */
export function ScrollLinkedRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const sticky = stickyRef.current;
    const track = trackRef.current;
    if (!outer || !sticky || !track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sticky.classList.remove("sticky", "overflow-hidden");
      sticky.classList.add("overflow-x-auto", "snap-x", "snap-mandatory");
      return;
    }

    let frame = 0;
    let distance = 0;
    let pinTop = 0;

    const measure = () => {
      distance = Math.max(0, track.scrollWidth - track.clientWidth);
      pinTop = Math.max(0, (window.innerHeight - sticky.offsetHeight) / 2);
      sticky.style.top = `${pinTop}px`;
      outer.style.height = `${sticky.offsetHeight + distance}px`;
    };
    const update = () => {
      frame = 0;
      const scrolled = pinTop - outer.getBoundingClientRect().top;
      const progress = distance ? Math.min(1, Math.max(0, scrolled / distance)) : 0;
      track.style.transform = `translate3d(${-progress * distance}px, 0, 0)`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const remeasure = () => {
      measure();
      schedule();
    };

    remeasure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(sticky);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", remeasure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", remeasure);
    };
  }, []);

  return (
    <div ref={outerRef} className={cn("relative", className)}>
      <div ref={stickyRef} className="sticky -mx-4 overflow-hidden px-4">
        <div ref={trackRef} className="flex gap-4 will-change-transform">
          {children}
        </div>
      </div>
    </div>
  );
}
