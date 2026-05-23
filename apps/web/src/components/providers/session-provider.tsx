"use client";

import { SessionProvider } from "next-auth/react";
// jnkjbj
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
