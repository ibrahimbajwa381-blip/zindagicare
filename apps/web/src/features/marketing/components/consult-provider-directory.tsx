"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, MessageCircle, Search, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HerbalistAvatar } from "@/features/herbalist/components/herbalist-avatar";
import { RatingStars } from "@/features/marketing/components/profile-reviews";
import {
  CONSULT_PROVIDER_ROLES,
  consultMatchWhatsAppHref,
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

// Same look as selectClass, but with room for the search icon and clear button.
const searchInputClass =
  "flex h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-11 pr-11 text-base text-foreground shadow-sm placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:pl-10 sm:pr-10 sm:text-sm";

/** Herbalist / nutritionist directory — mirrors the physiotherapist directory, minus distance. */
export function ConsultProviderDirectory({ role, initial, cities, city, specialty }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const config = CONSULT_PROVIDER_ROLES[role];
  const Avatar = role === "herbalist" ? HerbalistAvatar : NutritionistAvatar;
  const [query, setQuery] = useState("");
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = terms.length
    ? initial.filter((p) => {
        const haystack = [
          p.name,
          p.degree,
          p.institute,
          p.city,
          ...p.qualifications,
          ...p.specialties,
          ...p.coverageCities,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
    : initial;

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
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor={`${role}-search`} className="mb-1.5 block text-sm font-semibold text-slate-900">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id={`${role}-search`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, specialty, qualification or city"
              autoComplete="off"
              className={`${searchInputClass} [&::-webkit-search-cancel-button]:hidden`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
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

      {rows.length === 0 ? (
        <div className={`flex flex-col items-center gap-4 p-8 text-center ${surfaceCard}`}>
          <p className="text-sm text-slate-500">
            {terms.length
              ? `No ${config.nounPlural} match "${query.trim()}"${city ? ` in ${city}` : ""}.`
              : city || specialty
                ? `No verified ${specialty ? `${specialty} ` : ""}${config.nounPlural}${city ? ` in ${city}` : ""} yet.`
                : `No verified ${config.nounPlural} listed yet.`}
          </p>
          {!terms.length && (
            <>
              <p className="max-w-md text-sm text-slate-600">
                New {config.nounPlural} are being verified. Message us and our team will arrange an
                online consultation with a suitable {config.noun} for you.
              </p>
              <Button asChild>
                <a
                  href={consultMatchWhatsAppHref(role, specialty)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" />
                  Request a {config.noun} on WhatsApp
                </a>
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((provider) => {
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
