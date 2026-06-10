import type { Metadata } from "next";
import { Noto_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/locale-provider";
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
    icon: siteConfig.logo,
    apple: siteConfig.logo,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <LocaleProvider initialLocale={DEFAULT_LOCALE}>
          <AuthSessionProvider>{children}</AuthSessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
