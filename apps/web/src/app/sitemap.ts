import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/metadata";
import { getAllConditionSlugs, conditionDoctorPath } from "@/lib/seo/conditions";
import { getAllSpecialtySlugs, specialtyDoctorPath } from "@/lib/seo/specialties";
import { PublicDoctorService } from "@/server/services/public-doctor.service";

const MARKETING_ROUTES = [
  "/",
  "/doctors",
  "/doctors/lahore",
  "/sunday-consult",
  "/urgent-care",
  "/home-services",
  "/home-physiotherapy",
  "/home-care/request",
  "/for-doctors",
  "/for-doctors/guide",
  "/for-nurses",
  "/for-physiotherapists",
  "/get-app",
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
    const slugs = await PublicDoctorService.listPublicDoctorSlugs();
    doctorEntries = slugs.map((slug) => ({
      url: getSiteUrl(`/doctors/${slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // Sitemap still works without DB (e.g. local build without MongoDB).
  }

  return [...staticEntries, ...specialtyEntries, ...conditionEntries, ...doctorEntries];
}
