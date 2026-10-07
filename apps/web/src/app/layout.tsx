import type { Metadata, Viewport } from "next";
import { Gulzar, Noto_Nastaliq_Urdu, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { theme } from "@/config/theme";
import { AppProviders } from "@/components/providers/app-providers";
import { SiteJsonLd } from "@/components/seo/json-ld";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildRootMetadata } from "@/lib/seo/metadata";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

/** Flowing Nastaleeq for body copy — designed for Urdu screen reading. */
const gulzar = Gulzar({
  subsets: ["arabic"],
  variable: "--font-urdu-body",
  weight: "400",
  display: "swap",
  // Only used under html[lang="ur"]; preloading pushed ~420KB onto every English page load.
  preload: false,
});

/** Nastaleeq with real bold weights for headings and emphasis. */
const notoNastaliqUrdu = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-urdu-display",
  weight: ["400", "600", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = buildRootMetadata({
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.name,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: siteConfig.favicon, sizes: "any" },
      { url: siteConfig.icon, type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: theme.brand.DEFAULT,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);

  return (
    <html
      lang={locale}
      dir={locale === "ur" ? "rtl" : "ltr"}
      className={`${jakarta.variable} ${gulzar.variable} ${notoNastaliqUrdu.variable} h-full`}
    >
      <body
        className="flex min-h-dvh flex-col font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        <SiteJsonLd />
        <AppProviders
          session={session}
          initialLocale={locale}
          initialDictionary={getDictionary(locale)}
        >
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
