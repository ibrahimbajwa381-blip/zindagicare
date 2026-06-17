import type { Metadata } from "next";
import { Noto_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { AppProviders } from "@/components/providers/app-providers";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { auth } from "@/lib/auth";
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-urdu",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  icons: {
    icon: [
      { url: siteConfig.favicon, sizes: "any" },
      { url: siteConfig.icon, type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang={DEFAULT_LOCALE}
      dir={DEFAULT_LOCALE === "ur" ? "rtl" : "ltr"}
      className={`${jakarta.variable} ${notoArabic.variable} h-full`}
    >
      <body
        className="flex min-h-full flex-col font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        <AppProviders session={session}>{children}</AppProviders>
      </body>
    </html>
  );
}
