"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { SessionBootstrap } from "@/components/providers/session-bootstrap";

type AuthSessionProviderProps = {
  children: React.ReactNode;
  session: Session | null;
};

export function AuthSessionProvider({ children, session }: AuthSessionProviderProps) {
  const sessionKey = session?.user?.id ?? "guest";

  return (
    <SessionProvider
      key={sessionKey}
      session={session}
      // Avoid a /api/auth/session request on every tab focus when several routes are open.
      refetchOnWindowFocus={false}
      // Session is synced from the server on each navigation and via explicit session.update() calls.
      refetchInterval={0}
    >
      <SessionBootstrap />
      {children}
    </SessionProvider>
  );
}
