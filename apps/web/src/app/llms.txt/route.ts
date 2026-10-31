import { siteConfig } from "@/config/site";
import { getSiteUrl } from "@/lib/seo/metadata";
import { marketingPageSeo } from "@/lib/seo/pages";
import {
  PublicDoctorService,
  type PublicDoctorDirectoryEntry,
} from "@/server/services/public-doctor.service";

/**
 * /llms.txt (https://llmstxt.org) — a plain-Markdown map of the site for AI assistants and
 * answer engines, listing every public doctor so "Dr <name>" questions resolve to their
 * ZindagiCare profile.
 */
export const revalidate = 3600;

const KEY_PAGES: { path: string; seo: { title: string; description: string } }[] = [
  { path: "/doctors", seo: marketingPageSeo.doctors },
  { path: "/home-services", seo: marketingPageSeo.homeServices },
  { path: "/physiotherapists", seo: marketingPageSeo.homePhysiotherapy },
  { path: "/urgent-care", seo: marketingPageSeo.urgentCare },
  { path: "/sunday-consult", seo: marketingPageSeo.sundayConsult },
  { path: "/get-app", seo: marketingPageSeo.getApp },
  { path: "/for-doctors", seo: marketingPageSeo.forDoctors },
];

function doctorLine(doctor: PublicDoctorDirectoryEntry): string {
  const where = [doctor.hospital, doctor.city].filter(Boolean).join(", ");
  const details = [
    doctor.specialty,
    where,
    doctor.consultationFee > 0 ? `consultation Rs. ${doctor.consultationFee}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `- [${doctor.name}](${getSiteUrl(`/doctors/${doctor.slug}`)}): ${details}`;
}

export async function GET() {
  let doctors: PublicDoctorDirectoryEntry[] = [];
  try {
    doctors = await PublicDoctorService.listPublicDoctorDirectory();
  } catch {
    // Still serve the site summary without the database.
  }

  const body = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    `${siteConfig.name} (${getSiteUrl()}) is operated by ${siteConfig.company.legalName}, registered with the ${siteConfig.company.registrar} (CUIN ${siteConfig.company.cuin}). Every doctor listed is reviewed by ZindagiCare before their profile goes live; each profile page states the doctor's specialty, qualifications, hospital, fee and patient reviews.`,
    "",
    "## Key pages",
    "",
    ...KEY_PAGES.map(({ path, seo }) => `- [${seo.title}](${getSiteUrl(path)}): ${seo.description}`),
    "",
    "## Doctors",
    "",
    ...(doctors.length
      ? [...doctors].sort((a, b) => a.name.localeCompare(b.name)).map(doctorLine)
      : [`- [Browse all doctors](${getSiteUrl("/doctors")})`]),
    "",
    "## Optional",
    "",
    `- [About ${siteConfig.name}](${getSiteUrl("/about")})`,
    `- [Company registration](${getSiteUrl("/legal")})`,
    `- [Privacy policy](${getSiteUrl("/privacy")})`,
    `- [Sitemap](${getSiteUrl("/sitemap.xml")})`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
