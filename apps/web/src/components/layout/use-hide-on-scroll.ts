"use client";

import { useEffect, useState } from "react";

type Options = {
  /** Stay visible while within this many px of the top. */
  topOffset?: number;
  /** Minimum scroll delta before toggling, to avoid jitter. */
  threshold?: number;
};

function isTouchViewport() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 767px)").matches
  );
}

/**
 * Returns whether a sticky header should be visible based on scroll direction:
 * hides when scrolling down, reveals when scrolling up or near the top.
 *
 * Disabled on touch/mobile — transform + scroll state updates cause GPU ghosting on Android.
 */
export function useHideOnScroll({ topOffset = 80, threshold = 6 }: Options = {}) {
  const [hidden, setHidden] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!isTouchViewport());
  }, []);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }

    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastY;

      if (currentY <= topOffset) {
        setHidden(false);
      } else if (Math.abs(delta) > threshold) {
        setHidden(delta > 0);
      }

      lastY = currentY;
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled, topOffset, threshold]);

  return enabled ? hidden : false;
}
