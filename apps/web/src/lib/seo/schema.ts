import { siteConfig } from "@/config/site";
import { getSiteUrl } from "@/lib/seo/metadata";

export type FaqItem = { q: string; a: string };

export type BreadcrumbItem = { name: string; path: string };

export function buildFaqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getSiteUrl(item.path),
    })),
  };
}

export function buildPhysicianSchema(doctor: {
  name: string;
  slug: string;
  specialties: string[];
  bio?: string;
  avatarUrl?: string;
  hospitals: { name: string; city: string }[];
  pmdcVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  consultationFee: number;
  medicalCollege?: string;
  portfolio?: {
    headline?: string;
    conditionsTreated: string[];
    services: { name: string; description?: string }[];
    awards: { title: string }[];
    memberships: string[];
    links: Partial<Record<string, string>>;
  };
}) {
  const specialty = doctor.specialties[0] ?? "Physician";
  const hospital = doctor.hospitals[0];
  const portfolio = doctor.portfolio;
  const sameAs = portfolio ? Object.values(portfolio.links).filter(Boolean) : [];

  return {
    "@context": "https://schema.org",
    "@type": "Physician",
    name: doctor.name,
    url: getSiteUrl(`/doctors/${doctor.slug}`),
    image: doctor.avatarUrl?.startsWith("http")
      ? doctor.avatarUrl
      : doctor.avatarUrl
        ? getSiteUrl(doctor.avatarUrl)
        : undefined,
    description:
      doctor.bio ??
      `${doctor.name} is a ${specialty} offering online video consultations in Lahore, Pakistan via ZindagiCare.`,
    medicalSpecialty: doctor.specialties,
    ...(portfolio?.headline ? { slogan: portfolio.headline } : {}),
    ...(doctor.medicalCollege
      ? { alumniOf: { "@type": "CollegeOrUniversity", name: doctor.medicalCollege } }
      : {}),
    ...(portfolio?.conditionsTreated.length ? { knowsAbout: portfolio.conditionsTreated } : {}),
    ...(portfolio?.services.length
      ? {
          availableService: portfolio.services.map((service) => ({
            "@type": "MedicalProcedure",
            name: service.name,
            ...(service.description ? { description: service.description } : {}),
          })),
        }
      : {}),
    ...(portfolio?.awards.length ? { award: portfolio.awards.map((a) => a.title) } : {}),
    ...(portfolio?.memberships.length
      ? {
          memberOf: portfolio.memberships.map((name) => ({ "@type": "Organization", name })),
        }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(hospital
      ? {
          hospitalAffiliation: {
            "@type": "Hospital",
            name: hospital.name,
            address: {
              "@type": "PostalAddress",
              addressLocality: hospital.city,
              addressCountry: "PK",
            },
          },
        }
      : {}),
    aggregateRating:
      doctor.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: doctor.ratingAvg,
            reviewCount: doctor.ratingCount,
            bestRating: 5,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      price: doctor.consultationFee,
      priceCurrency: "PKR",
      availability: "https://schema.org/InStock",
      url: getSiteUrl(`/doctors/${doctor.slug}`),
    },
    parentOrganization: {
      "@type": "MedicalOrganization",
      name: siteConfig.name,
      url: getSiteUrl(),
    },
  };
}

export function buildMedicalServiceSchema(service: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalService",
    name: service.name,
    description: service.description,
    url: getSiteUrl(service.path),
    provider: {
      "@type": "MedicalOrganization",
      name: siteConfig.name,
      url: getSiteUrl(),
    },
    areaServed: {
      "@type": "City",
      name: siteConfig.launchCity,
      containedInPlace: { "@type": "Country", name: "Pakistan" },
    },
  };
}
