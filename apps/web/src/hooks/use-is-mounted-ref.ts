"use client";

import { useEffect, useRef } from "react";

/** Guards async callbacks from updating state after unmount. */
export function useIsMountedRef() {
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
}
