"use client";

import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      // Avoid a /api/auth/session request on every tab focus when several routes are open.
      refetchOnWindowFocus={false}
      // Session is still refreshed on navigation and via explicit session.update() calls.
      refetchInterval={0}
    >
      {children}
    </SessionProvider>
  );
}
