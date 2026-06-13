"use client";

import { useEffect } from "react";
import { getSession } from "next-auth/react";

/** Ensure client session matches the auth cookie after login/logout navigations. */
export function SessionBootstrap() {
  useEffect(() => {
    void getSession();
  }, []);

  return null;
}
