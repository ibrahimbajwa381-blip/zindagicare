import { siteConfig } from "@/config/site";
import { doctorPlainName } from "@/lib/seo/doctor-seo";
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
  hospitals: { name: string; city: string; area?: string; address?: string }[];
  pmdcVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  consultationFee: number;
  medicalCollege?: string;
  medicalDegree?: string;
  qualifications?: string[];
  languages?: string[];
  videoConsultEnabled?: boolean;
  reviews?: { rating: number; comment?: string; patientName: string; createdAt: string }[];
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
  const url = getSiteUrl(`/doctors/${doctor.slug}`);
  const plainName = doctorPlainName(doctor.name);
  const credentials = [doctor.medicalDegree, ...(doctor.qualifications ?? [])].filter(
    (c, i, all): c is string => Boolean(c?.trim()) && all.indexOf(c) === i,
  );
  const reviews = (doctor.reviews ?? []).filter((r) => r.comment?.trim()).slice(0, 5);

  return {
    "@context": "https://schema.org",
    "@type": "Physician",
    "@id": `${url}#physician`,
    name: doctor.name,
    ...(plainName && plainName !== doctor.name ? { alternateName: plainName } : {}),
    url,
    image: doctor.avatarUrl?.startsWith("http")
      ? doctor.avatarUrl
      : doctor.avatarUrl
        ? getSiteUrl(doctor.avatarUrl)
        : undefined,
    description:
      doctor.bio ??
      `${doctor.name} is a ${specialty} offering online video consultations across Pakistan via ZindagiCare.`,
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
    ...(credentials.length
      ? {
          hasCredential: credentials.map((name) => ({
            "@type": "EducationalOccupationalCredential",
            credentialCategory: "degree",
            name,
          })),
        }
      : {}),
    ...(doctor.languages?.length ? { knowsLanguage: doctor.languages } : {}),
    ...(doctor.consultationFee > 0 ? { priceRange: `Rs. ${doctor.consultationFee}` } : {}),
    ...(doctor.videoConsultEnabled ? { areaServed: { "@type": "Country", name: "Pakistan" } } : {}),
    ...(hospital
      ? {
          address: {
            "@type": "PostalAddress",
            ...(hospital.address ? { streetAddress: hospital.address } : {}),
            addressLocality: hospital.city,
            addressCountry: "PK",
          },
        }
      : {}),
    ...(reviews.length
      ? {
          review: reviews.map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.patientName },
            datePublished: r.createdAt.slice(0, 10),
            reviewBody: r.comment,
            reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
          })),
        }
      : {}),
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
      url,
    },
    parentOrganization: {
      "@type": "MedicalOrganization",
      "@id": getSiteUrl("/#organization"),
      name: siteConfig.name,
      url: getSiteUrl(),
    },
  };
}

/** Marks a page as the profile of `mainEntityId` (a Physician or other provider node). */
export function buildProfilePageSchema(page: {
  path: string;
  name: string;
  mainEntityId: string;
  dateModified?: string;
}) {
  const url = getSiteUrl(page.path);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": url,
    url,
    name: page.name,
    mainEntity: { "@id": page.mainEntityId },
    isPartOf: { "@id": getSiteUrl("/#website") },
    inLanguage: "en-PK",
    ...(page.dateModified ? { dateModified: page.dateModified } : {}),
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
    areaServed: { "@type": "Country", name: "Pakistan" },
  };
}
