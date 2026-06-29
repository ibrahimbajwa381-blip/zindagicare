"use client";

import type { Session } from "next-auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { SerwistProvider } from "@/components/providers/serwist-provider";
import { WhatsAppFloatButton } from "@/components/layout/whatsapp-float-button";
import { NavigationLoadingProvider } from "@/components/providers/navigation-loading";
import { InstallPrompt } from "@/components/pwa/install-prompt";
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
    <SerwistProvider swUrl="/serwist/sw.js">
      <LocaleProvider initialLocale={initialLocale}>
        <AuthSessionProvider session={session}>
          <NavigationLoadingProvider>
            {children}
          </NavigationLoadingProvider>
          <WhatsAppFloatButton />
          <InstallPrompt />
        </AuthSessionProvider>
      </LocaleProvider>
    </SerwistProvider>
  );
}
