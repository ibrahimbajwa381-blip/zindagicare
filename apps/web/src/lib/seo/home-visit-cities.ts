import { HOME_CARE_PRICING, HomeVisitServiceTypes, SUPPORTED_CITIES } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { citiesMatch, formatCityName, normalizeCityName } from "@/lib/geo/city-match";
import {
  PublicDoctorService,
  type PublicDoctorDirectoryEntry,
} from "@/server/services/public-doctor.service";
import { PublicNurseService, type PublicNurse } from "@/server/services/public-nurse.service";
import {
  PublicPhysiotherapistService,
  type PublicPhysiotherapist,
} from "@/server/services/public-physiotherapist.service";
import type { FaqItem } from "./schema";

/** A main city, or one with at least one provider taking home visits — the only cities that get a landing page. */
export type HomeVisitCity = {
  name: string;
  slug: string;
  /** Main city: requests are fulfilled by our team even when no provider is listed. */
  isMain: boolean;
  doctors: PublicDoctorDirectoryEntry[];
  nurses: PublicNurse[];
  physiotherapists: PublicPhysiotherapist[];
};

export function cityToSlug(city: string): string {
  return normalizeCityName(city)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function homeVisitCityPath(slug: string): string {
  return `/home-services/${slug}`;
}

/** Main cities first, then every other city with a listed home-visit provider, busiest first. */
export async function listHomeVisitCities(): Promise<HomeVisitCity[]> {
  const [doctors, nurseCities, physioCities] = await Promise.all([
    PublicDoctorService.listPublicDoctorDirectory().catch(() => []),
    PublicNurseService.listCities().catch(() => []),
    PublicPhysiotherapistService.listCities().catch(() => []),
  ]);

  const names = new Map<string, string>();
  for (const city of [
    ...SUPPORTED_CITIES,
    ...doctors.flatMap((d) => d.homeVisitCities),
    ...nurseCities,
    ...physioCities,
  ]) {
    const slug = cityToSlug(city);
    if (slug && !names.has(slug)) names.set(slug, formatCityName(city));
  }

  const cities = await Promise.all(
    [...names].map(async ([slug, name]): Promise<HomeVisitCity> => {
      const [nurses, physiotherapists] = await Promise.all([
        PublicNurseService.list({ city: name }).catch(() => []),
        PublicPhysiotherapistService.list({ city: name }).catch(() => []),
      ]);
      return {
        name,
        slug,
        isMain: SUPPORTED_CITIES.some((c) => citiesMatch(c, name)),
        doctors: doctors.filter((d) => d.homeVisitCities.some((c) => citiesMatch(c, name))),
        nurses: nurses.filter((n) => n.homeVisitEnabled),
        physiotherapists: physiotherapists.filter((p) => p.homeVisitEnabled),
      };
    }),
  );

  return cities
    .filter((c) => c.isMain || providerCount(c) > 0)
    .sort(
      (a, b) =>
        Number(b.isMain) - Number(a.isMain) ||
        providerCount(b) - providerCount(a) ||
        a.name.localeCompare(b.name),
    );
}

export async function getHomeVisitCity(slug: string): Promise<HomeVisitCity | undefined> {
  return (await listHomeVisitCities()).find((c) => c.slug === slug);
}

export function providerCount(city: HomeVisitCity): number {
  return city.doctors.length + city.nurses.length + city.physiotherapists.length;
}

/** Lowest listed fee, or undefined when nobody in the list has one set. */
export function lowestFee(fees: number[]): number | undefined {
  const set = fees.filter((f) => f > 0);
  return set.length ? Math.min(...set) : undefined;
}

export const rs = (n: number) => `Rs. ${n.toLocaleString("en-PK")}`;

/** Facts every section and schema block on the page states the same way. */
export function cityFacts(city: HomeVisitCity) {
  // Main cities are fulfilled by our team, so they offer every service at the platform rate.
  const base = (type: keyof typeof HOME_CARE_PRICING) =>
    city.isMain ? [HOME_CARE_PRICING[type]] : [];
  const doctorFee = lowestFee([
    ...city.doctors.map((d) => d.homeVisitFee),
    ...base(HomeVisitServiceTypes.DOCTOR_VISIT),
  ]);
  const nurseFee = lowestFee([
    ...city.nurses.map((n) => n.homeVisitFee),
    ...base(HomeVisitServiceTypes.NURSE),
  ]);
  const physioFee = lowestFee([
    ...city.physiotherapists.map((p) => p.homeVisitFee),
    ...base(HomeVisitServiceTypes.PHYSIOTHERAPY),
  ]);
  const services = [
    city.isMain || city.doctors.length ? "doctors" : null,
    city.isMain || city.nurses.length ? "nurses" : null,
    city.isMain || city.physiotherapists.length ? "physiotherapists" : null,
  ].filter((s): s is string => Boolean(s));
  const serviceList =
    services.length > 1
      ? `${services.slice(0, -1).join(", ")} and ${services.at(-1)}`
      : services[0];
  const prices = [
    doctorFee ? `doctor home visits from ${rs(doctorFee)}` : null,
    nurseFee ? `nursing visits from ${rs(nurseFee)}` : null,
    physioFee ? `home physiotherapy from ${rs(physioFee)}` : null,
  ].filter(Boolean);
  const count = providerCount(city);
  const coverage = [
    count
      ? `${count} verified ${count === 1 ? "provider currently takes" : "providers currently take"} home visits in ${city.name}`
      : null,
    city.isMain
      ? `our care team assigns a verified provider to every request in ${city.name}`
      : null,
  ]
    .filter(Boolean)
    .join(", and ");
  return {
    serviceList,
    prices,
    coverage: coverage.charAt(0).toUpperCase() + coverage.slice(1),
  };
}

export function buildCityFaq(city: HomeVisitCity): FaqItem[] {
  const { serviceList, prices, coverage } = cityFacts(city);
  const procedures =
    city.isMain || city.nurses.length
      ? ` Nurses also do IV drips (${rs(HOME_CARE_PRICING[HomeVisitServiceTypes.IV_DRIP])}), injections (${rs(HOME_CARE_PRICING[HomeVisitServiceTypes.INJECTION])}) and wound care (${rs(HOME_CARE_PRICING[HomeVisitServiceTypes.WOUND_CARE])}) at home.`
      : "";
  return [
    {
      q: `How do I book a doctor home visit in ${city.name}?`,
      a: `Open ${siteConfig.url}${homeVisitCityPath(city.slug)}, choose a verified provider or the service you need, and share your address. ZindagiCare sends the nearest available provider in ${city.name} to your home. You can also book on WhatsApp at ${siteConfig.supportWhatsAppDisplay}.`,
    },
    {
      q: `Who does home visits in ${city.name} on ZindagiCare?`,
      a: `ZindagiCare sends verified ${serviceList}. ${coverage}. Every provider is reviewed by ZindagiCare before their profile goes live, and each profile lists qualifications, specialty and fee.`,
    },
    ...(prices.length
      ? [
          {
            q: `How much does a home visit cost in ${city.name}?`,
            a: `On ZindagiCare, ${prices.join(", ")}. The fee is shown before you book — no hidden charges.${procedures}`,
          },
        ]
      : []),
    {
      q: `Is the visit tracked and safe?`,
      a: `Yes. Every ZindagiCare home visit is geo-tracked from check-in to check-out, and the provider submits a written visit report you can see in your account.`,
    },
  ];
}
