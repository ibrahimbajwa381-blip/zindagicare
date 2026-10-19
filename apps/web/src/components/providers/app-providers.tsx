"use client";

import type { Session } from "next-auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { SerwistProvider } from "@/components/providers/serwist-provider";
import { WhatsAppFloatButton } from "@/components/layout/whatsapp-float-button";
// Temporarily hidden — restore agent float mic later
// import { AgentFloatButton } from "@/components/layout/agent-float-button";
import { NavigationLoadingProvider } from "@/components/providers/navigation-loading";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { LocaleProvider } from "@/i18n/locale-provider";

type AppProvidersProps = {
  children: React.ReactNode;
  session: Session | null;
  initialLocale: Locale;
  initialDictionary: Dictionary;
};

/** Single client boundary so locale context is always available to nested client trees. */
export function AppProviders({
  children,
  session,
  initialLocale,
  initialDictionary,
}: AppProvidersProps) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js">
      <LocaleProvider initialLocale={initialLocale} initialDictionary={initialDictionary}>
        <AuthSessionProvider session={session}>
          <NavigationLoadingProvider>
            {children}
          </NavigationLoadingProvider>
          <PageViewTracker />
          <WhatsAppFloatButton />
          {/* Temporarily hidden — restore agent float mic later */}
          {/* <AgentFloatButton /> */}
          <InstallPrompt />
        </AuthSessionProvider>
      </LocaleProvider>
    </SerwistProvider>
  );
}
