import { siteConfig } from "@/config/site";
import { getSiteUrl } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";

type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

/**
 * `JSON.stringify` never escapes `<`, so any field flowing into JSON-LD that
 * ultimately comes from user input (e.g. a doctor's own bio) can contain a
 * literal `</script>` and break out of this tag into a real, executing
 * `<script>` — a stored XSS against every visitor of that page. Escaping
 * `<` as `<` keeps the JSON value identical (still valid inside a JSON
 * string) while making that impossible to form in the raw HTML source.
 */
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

const CORE_SERVICES = [
  {
    name: "Online Doctor Consultation",
    description: marketingPageSeo.doctors.description,
    path: "/doctors",
  },
  {
    name: "In-House Medical Services",
    description: marketingPageSeo.homeServices.description,
    path: "/home-services",
  },
  {
    name: "Home Physiotherapy",
    description: marketingPageSeo.homePhysiotherapy.description,
    path: "/physiotherapists",
  },
  {
    name: "Urgent Care",
    description: marketingPageSeo.urgentCare.description,
    path: "/urgent-care",
  },
  {
    name: "Sunday Free Consult",
    description: marketingPageSeo.sundayConsult.description,
    path: "/sunday-consult",
  },
] as const;

export function SiteJsonLd() {
  const baseUrl = getSiteUrl();

  const organization = {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "@id": `${baseUrl}/#organization`,
    name: siteConfig.name,
    alternateName: [...siteConfig.seo.alternateNames],
    url: baseUrl,
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
    areaServed: [
      { "@type": "Country", name: "Pakistan" },
      { "@type": "City", name: siteConfig.launchCity },
    ],
    sameAs: [...siteConfig.seo.sameAs],
    knowsAbout: [
      "Telemedicine",
      "Online doctor consultation",
      "In-house medical services",
      "Home nursing",
      "Home physiotherapy",
      "Urgent care",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "ZindagiCare Healthcare Services",
      itemListElement: CORE_SERVICES.map((service, index) => ({
        "@type": "Offer",
        position: index + 1,
        itemOffered: {
          "@type": "MedicalProcedure",
          name: service.name,
          description: service.description,
          url: getSiteUrl(service.path),
        },
      })),
    },
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: siteConfig.name,
    alternateName: [...siteConfig.seo.alternateNames],
    url: baseUrl,
    publisher: { "@id": `${baseUrl}/#organization` },
    inLanguage: ["en-PK", "ur-PK"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/doctors/specialty/{search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const homePage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${baseUrl}/#webpage`,
    url: baseUrl,
    name: siteConfig.seo.defaultTitle,
    description: siteConfig.seo.defaultDescription,
    isPartOf: { "@id": `${baseUrl}/#website` },
    about: { "@id": `${baseUrl}/#organization` },
    inLanguage: "en-PK",
  };

  return <JsonLd data={[organization, website, homePage]} />;
}
