"use client";

import { useEffect, useRef } from "react";

/** Guards async callbacks from updating state after unmount. */
export function useIsMountedRef() {
  // Start true so effects that fire in the same commit as mount can proceed;
  // cleanup flips to false when the component actually unmounts.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
}
