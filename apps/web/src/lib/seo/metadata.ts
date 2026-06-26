import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

const DEFAULT_OG_IMAGE = "/logo1.png";

export function getSiteUrl(path = ""): string {
  const base = siteConfig.url.replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildRootMetadata(overrides?: Metadata): Metadata {
  const ogImage = getSiteUrl(DEFAULT_OG_IMAGE);

  return {
    metadataBase: new URL(siteConfig.url),
    applicationName: siteConfig.name,
    title: {
      default: siteConfig.seo.defaultTitle,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.seo.defaultDescription,
    keywords: [...siteConfig.seo.keywords],
    authors: [{ name: siteConfig.name, url: siteConfig.url }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    category: "healthcare",
    openGraph: {
      type: "website",
      locale: "en_PK",
      alternateLocale: ["ur_PK"],
      url: siteConfig.url,
      siteName: siteConfig.name,
      title: siteConfig.seo.defaultTitle,
      description: siteConfig.seo.defaultDescription,
      images: [
        {
          url: ogImage,
          width: 512,
          height: 512,
          alt: `${siteConfig.name} logo`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: siteConfig.seo.defaultTitle,
      description: siteConfig.seo.defaultDescription,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    verification: buildSiteVerification(),
    ...overrides,
  };
}

function buildSiteVerification(): Metadata["verification"] {
  const { googleSiteVerification, bingSiteVerification } = siteConfig.seo;
  if (!googleSiteVerification && !bingSiteVerification) return undefined;

  return {
    ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
    ...(bingSiteVerification
      ? { other: { "msvalidate.01": bingSiteVerification } }
      : {}),
  };
}

export function buildPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const canonical = getSiteUrl(path);
  const ogImage = getSiteUrl(DEFAULT_OG_IMAGE);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: siteConfig.name,
      title: `${title} | ${siteConfig.name}`,
      description,
      images: [{ url: ogImage, alt: `${siteConfig.name} logo` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
      images: [ogImage],
    },
    robots: noIndex ? { index: false, follow: false } : undefined,
  };
}

const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

/** App, auth, and transactional routes — never index even if robots.txt is ignored. */
export function buildPrivateMetadata(title?: string): Metadata {
  return {
    ...(title ? { title } : {}),
    robots: PRIVATE_ROBOTS,
  };
}
