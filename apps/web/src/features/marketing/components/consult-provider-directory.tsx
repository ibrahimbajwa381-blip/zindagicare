"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HerbalistAvatar } from "@/features/herbalist/components/herbalist-avatar";
import { RatingStars } from "@/features/marketing/components/profile-reviews";
import {
  CONSULT_PROVIDER_ROLES,
  type ConsultProviderRole,
} from "@/features/marketing/data/consult-provider-roles";
import { NutritionistAvatar } from "@/features/nutritionist/components/nutritionist-avatar";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { PublicConsultProvider } from "@/server/services/public-consult-provider.service";

type Props = {
  role: ConsultProviderRole;
  initial: PublicConsultProvider[];
  cities: readonly string[];
  /** Active filters from the URL (?city= / ?specialty=); undefined = all. */
  city?: string;
  specialty?: string;
};

const selectClass =
  "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base text-foreground shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:px-3 sm:text-sm";

/** Herbalist / nutritionist directory — mirrors the physiotherapist directory, minus distance. */
export function ConsultProviderDirectory({ role, initial, cities, city, specialty }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const config = CONSULT_PROVIDER_ROLES[role];
  const Avatar = role === "herbalist" ? HerbalistAvatar : NutritionistAvatar;

  function setFilter(name: "city" | "specialty", value: string) {
    const params = new URLSearchParams();
    const next = { city, specialty, [name]: value || undefined };
    if (next.city) params.set("city", next.city);
    if (next.specialty) params.set("specialty", next.specialty);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className={`grid gap-4 p-5 sm:grid-cols-2 ${surfaceCard}`}>
        <div className="min-w-0">
          <label htmlFor={`${role}-filter-city`} className="mb-1.5 block text-sm font-semibold text-slate-900">
            City
          </label>
          <select
            id={`${role}-filter-city`}
            value={city ?? ""}
            onChange={(e) => setFilter("city", e.target.value)}
            className={selectClass}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${role}-filter-specialty`} className="mb-1.5 block text-sm font-semibold text-slate-900">
            Specialty
          </label>
          <select
            id={`${role}-filter-specialty`}
            value={specialty ?? ""}
            onChange={(e) => setFilter("specialty", e.target.value)}
            className={selectClass}
          >
            <option value="">All specialties</option>
            {config.specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {initial.length === 0 ? (
        <p className={`p-8 text-center text-sm text-slate-500 ${surfaceCard}`}>
          {city || specialty
            ? `No verified ${specialty ? `${specialty} ` : ""}${config.nounPlural}${city ? ` in ${city}` : ""} yet.`
            : `No verified ${config.nounPlural} listed yet.`}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {initial.map((provider) => {
            const profileHref = config.profilePath(provider.slug, provider.id);
            return (
              <div key={provider.id} className={`flex min-w-0 flex-col gap-4 p-5 ${surfaceCard}`}>
                <Link href={profileHref} className="flex min-w-0 items-start gap-3">
                  <Avatar name={provider.name} avatarUrl={provider.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-slate-900 hover:text-brand">
                      {provider.name}
                    </p>
                    {provider.ratingAvg !== undefined && provider.reviewCount ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                        <RatingStars rating={provider.ratingAvg} />
                        <span className="font-semibold text-slate-900">
                          {provider.ratingAvg.toFixed(1)}
                        </span>
                        <span className="text-slate-500">
                          ({provider.reviewCount} review{provider.reviewCount === 1 ? "" : "s"})
                        </span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-400">No reviews yet</p>
                    )}
                    <p className="truncate text-sm text-brand/90">
                      {provider.specialties.slice(0, 2).join(" · ") || config.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[
                        provider.degree,
                        provider.experienceYears ? `${provider.experienceYears}+ yrs` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {provider.city}
                      </span>
                      {provider.videoConsultEnabled && (
                        <span className="inline-flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          Online consults
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <Button size="sm" asChild>
                    <Link href={profileHref}>View profile</Link>
                  </Button>
                  {provider.consultationFee > 0 && (
                    <span className="text-sm font-semibold text-slate-900">
                      Rs. {provider.consultationFee.toLocaleString("en-PK")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
