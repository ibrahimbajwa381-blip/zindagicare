"use client";

import type { Session } from "next-auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { WhatsAppFloatButton } from "@/components/layout/whatsapp-float-button";
import type { Locale } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/locale-provider";

type AppProvidersProps = {
  children: React.ReactNode;
  session: Session | null;
  initialLocale: Locale;
};

/** Single client boundary so locale context is always available to nested client trees. */
export function AppProviders({ children, session, initialLocale }: AppProvidersProps) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <AuthSessionProvider session={session}>
        {children}
        <WhatsAppFloatButton />
      </AuthSessionProvider>
    </LocaleProvider>
  );
}
