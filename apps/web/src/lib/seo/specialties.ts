import { allSpecialties } from "@/features/marketing/data/browse-catalog";
import { slugifySpecialty } from "@/features/marketing/data/specialty-utils";

export function getSpecialtyBySlug(slug: string) {
  const normalized = slug.trim().toLowerCase();
  return allSpecialties.find((item) => item.slug === normalized) ?? null;
}

export function getAllSpecialtySlugs(): string[] {
  return allSpecialties.map((item) => item.slug);
}

export function specialtyDoctorPath(slug: string) {
  return `/doctors/specialty/${slug}`;
}

export function specialtySeoTitle(label: string) {
  return `Best ${label} in Pakistan — Online Consultation | ZindagiCare`;
}

export function specialtySeoDescription(label: string) {
  return `Book an online consultation with PMDC-verified ${label} doctors in Pakistan on ZindagiCare. Compare fees, read reviews, and join a secure video consult from home.`;
}

export { slugifySpecialty };
