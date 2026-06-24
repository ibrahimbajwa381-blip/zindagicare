import { siteConfig } from "@/config/site";
import { getSiteUrl } from "@/lib/seo/metadata";

type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SiteJsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "@id": `${getSiteUrl()}/#organization`,
    name: siteConfig.name,
    alternateName: [...siteConfig.seo.alternateNames],
    url: getSiteUrl(),
    logo: getSiteUrl(siteConfig.logo),
    image: getSiteUrl(siteConfig.logo),
    description: siteConfig.seo.defaultDescription,
    email: siteConfig.supportEmail,
    telephone: `+${siteConfig.supportWhatsApp}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: siteConfig.launchCity,
      addressCountry: "PK",
    },
    areaServed: {
      "@type": "City",
      name: siteConfig.launchCity,
    },
    sameAs: [...siteConfig.seo.sameAs],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${getSiteUrl()}/#website`,
    name: siteConfig.name,
    alternateName: [...siteConfig.seo.alternateNames],
    url: getSiteUrl(),
    publisher: { "@id": `${getSiteUrl()}/#organization` },
    inLanguage: ["en-PK", "ur-PK"],
  };

  return <JsonLd data={[organization, website]} />;
}
