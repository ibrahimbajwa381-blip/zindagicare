"use client";

import { useCallback, useEffect, useState } from "react";

/** Hydration-safe read/write of a localStorage boolean flag (`"1"` = true). */
export function useLocalStorageFlag(key: string, defaultValue = false) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    try {
      setValue(localStorage.getItem(key) === "1");
    } catch {
      // Private mode / blocked storage — keep default.
    }
  }, [key]);

  const setFlag = useCallback(
    (next: boolean) => {
      try {
        if (next) localStorage.setItem(key, "1");
        else localStorage.removeItem(key);
      } catch {
        // ignore
      }
      setValue(next);
    },
    [key],
  );

  return [value, setFlag] as const;
}
