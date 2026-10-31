import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/metadata";
import { getAllConditionSlugs, conditionDoctorPath } from "@/lib/seo/conditions";
import { getAllSpecialtySlugs, specialtyDoctorPath } from "@/lib/seo/specialties";
import { PublicDoctorService } from "@/server/services/public-doctor.service";
import { PublicConsultProviderService } from "@/server/services/public-consult-provider.service";
import { PublicNurseService } from "@/server/services/public-nurse.service";
import { PublicPhysiotherapistService } from "@/server/services/public-physiotherapist.service";

const MARKETING_ROUTES = [
  "/",
  "/doctors",
  "/doctors/lahore",
  "/sunday-consult",
  "/urgent-care",
  "/home-services",
  "/physiotherapists",
  "/nurses",
  "/herbalists",
  "/nutritionists",
  "/home-care/request",
  "/for-doctors",
  "/for-doctors/guide",
  "/for-nurses",
  "/for-physiotherapists",
  "/for-physiotherapists/guide",
  "/get-app",
  "/reviews",
  "/about",
  "/legal",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/telemedicine-consent",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = MARKETING_ROUTES.map((path) => ({
    url: getSiteUrl(path === "/" ? "" : path),
    lastModified,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : path === "/doctors" ? 0.9 : 0.7,
  }));

  const specialtyEntries: MetadataRoute.Sitemap = getAllSpecialtySlugs().map((slug) => ({
    url: getSiteUrl(specialtyDoctorPath(slug)),
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.75,
  }));

  const conditionEntries: MetadataRoute.Sitemap = getAllConditionSlugs().map((slug) => ({
    url: getSiteUrl(conditionDoctorPath(slug)),
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  let doctorEntries: MetadataRoute.Sitemap = [];
  try {
    const doctors = await PublicDoctorService.listPublicDoctorDirectory();
    doctorEntries = doctors.map((doctor) => ({
      url: getSiteUrl(`/doctors/${doctor.slug}`),
      lastModified: doctor.updatedAt ? new Date(doctor.updatedAt) : lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      // Image sitemap entry so the doctor's photo can surface in image search for their name.
      ...(doctor.avatarUrl
        ? {
            images: [
              doctor.avatarUrl.startsWith("http") ? doctor.avatarUrl : getSiteUrl(doctor.avatarUrl),
            ],
          }
        : {}),
    }));
  } catch {
    // Sitemap still works without DB (e.g. local build without MongoDB).
  }

  let physiotherapistEntries: MetadataRoute.Sitemap = [];
  try {
    const physios = await PublicPhysiotherapistService.list();
    physiotherapistEntries = physios.map((p) => ({
      url: getSiteUrl(`/physiotherapists/${p.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // Sitemap still works without DB.
  }

  // Nurse, herbalist and nutritionist profiles — same shape as the physiotherapist entries.
  const providerSlugSources: { prefix: string; load: () => Promise<string[]> }[] = [
    {
      prefix: "/nurses",
      load: async () => (await PublicNurseService.list()).map((n) => n.slug),
    },
    { prefix: "/herbalists", load: () => PublicConsultProviderService.listSlugs("herbalist") },
    {
      prefix: "/nutritionists",
      load: () => PublicConsultProviderService.listSlugs("nutritionist"),
    },
  ];
  const providerEntries: MetadataRoute.Sitemap = (
    await Promise.all(
      providerSlugSources.map(async ({ prefix, load }) => {
        try {
          return (await load()).map((slug) => ({
            url: getSiteUrl(`${prefix}/${slug}`),
            lastModified,
            changeFrequency: "weekly" as const,
            priority: 0.6,
          }));
        } catch {
          return []; // Sitemap still works without DB.
        }
      }),
    )
  ).flat();

  return [
    ...staticEntries,
    ...specialtyEntries,
    ...conditionEntries,
    ...doctorEntries,
    ...physiotherapistEntries,
    ...providerEntries,
  ];
}
