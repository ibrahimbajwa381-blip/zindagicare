"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  HOME_CARE_MATCH_RADIUS_KM,
  isOutsideProviderCoverage,
  bestHomeCareReach,
  type HomeCareReach,
} from "@zindagi/shared";
import { MapPin, Navigation, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import { RatingStars } from "@/features/marketing/components/profile-reviews";
import { PhysiotherapistAvatar } from "@/features/physiotherapist/components/physiotherapist-avatar";
import { physiotherapistProfilePath } from "@/lib/physiotherapists/profile-path";
import { nearestCity } from "@/lib/geo/nearest-city";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { PublicPhysiotherapist } from "@/server/services/public-physiotherapist.service";
import { reachLocatedSummary } from "@/features/home-care/components/provider-reach";
import { physiotherapistHomeVisitHref } from "./physiotherapist-profile-view";

type Props = {
  initial: PublicPhysiotherapist[];
  cities: readonly string[];
  specialties: readonly string[];
  /** Active filters from the URL (?city= / ?specialty=); undefined = all. */
  city?: string;
  specialty?: string;
};

const selectClass =
  "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base text-foreground shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:px-3 sm:text-sm";

// Same look as selectClass, but with room for the search icon and clear button.
const searchInputClass =
  "flex h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-11 pr-11 text-base text-foreground shadow-sm placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:pl-10 sm:pr-10 sm:text-sm";

export function PhysiotherapistDirectory({ initial, cities, specialties, city, specialty }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [geo, setGeo] = useState<GeoCoordinates | null>(null);
  // Keyed by the location + filters it was fetched for, so "loading" is derived rather than set in the effect.
  const [sorted, setSorted] = useState<{ key: string; rows: PublicPhysiotherapist[] } | null>(
    null,
  );
  const geoKey = geo ? `${geo.lat},${geo.lng}|${city ?? ""}|${specialty ?? ""}` : null;
  const loading = geoKey !== null && sorted?.key !== geoKey;
  // With a location the API ranks everyone: within 15 km, then 30 km, then the patient's city,
  // then anywhere. Nobody is hidden for distance — farther physios are flagged instead.
  const patientCity = geo ? nearestCity(geo) : undefined;
  const located = sorted !== null && sorted.key === geoKey;
  const sourceRows = located ? sorted.rows : initial;
  const tier = located
    ? bestHomeCareReach(
        sourceRows.filter(
          (r): r is PublicPhysiotherapist & { reach: HomeCareReach } =>
            !!r.reach && r.homeVisitEnabled && r.isAvailable,
        ),
      )
    : null;
  const [query, setQuery] = useState("");
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = terms.length
    ? sourceRows.filter((r) => {
        const haystack = [r.name, r.qualification, r.area, r.city, ...r.specialties]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
    : sourceRows;

  function setFilter(name: "city" | "specialty", value: string) {
    const params = new URLSearchParams();
    const next = { city, specialty, [name]: value || undefined };
    if (next.city) params.set("city", next.city);
    if (next.specialty) params.set("specialty", next.specialty);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (!geo || !geoKey) return;
    let cancelled = false;
    const params = new URLSearchParams({ lat: String(geo.lat), lng: String(geo.lng) });
    if (city) params.set("city", city);
    if (specialty) params.set("specialty", specialty);
    fetch(`/api/v1/public/physiotherapists?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setSorted({ key: geoKey, rows: json.success ? (json.data ?? []) : initial });
      })
      .catch(() => {
        if (!cancelled) setSorted({ key: geoKey, rows: initial });
      });
    return () => {
      cancelled = true;
    };
  }, [geo, geoKey, initial, city, specialty]);


  return (
    <div className="space-y-6">
      <div className={`grid gap-4 p-5 sm:grid-cols-2 ${surfaceCard}`}>
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor="physio-search" className="mb-1.5 block text-sm font-semibold text-slate-900">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="physio-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, specialty, qualification or area"
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
          <label htmlFor="physio-filter-city" className="mb-1.5 block text-sm font-semibold text-slate-900">
            Your city
          </label>
          <select
            id="physio-filter-city"
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
          <label htmlFor="physio-filter-specialty" className="mb-1.5 block text-sm font-semibold text-slate-900">
            Specialty
          </label>
          <select
            id="physio-filter-specialty"
            value={specialty ?? ""}
            onChange={(e) => setFilter("specialty", e.target.value)}
            className={selectClass}
          >
            <option value="">All specialties</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`p-5 ${surfaceCard}`}>
        <p className="text-sm font-semibold text-slate-900">Find physiotherapists near you</p>
        <p className="mb-3 text-xs text-slate-500">
          Share your location to see who is closest. Physiotherapists who cover your location
          are listed first, then those within {HOME_CARE_MATCH_RADIUS_KM} km; you can still book
          someone farther away.
        </p>
        <GeoLocationPicker
          id="physio-directory-geo"
          value={geo}
          onChange={setGeo}
          description={`Tap "Use my current location", or paste a Google Maps link / coordinates of your home.`}
        />
        {geo && !loading && (
          <p className="mt-3 text-xs text-slate-600">{reachLocatedSummary(tier, "physiotherapists", patientCity)}</p>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Sorting by distance…</p>}

      {rows.length === 0 ? (
        <p className={`p-8 text-center text-sm text-slate-500 ${surfaceCard}`}>
          {terms.length
            ? `No physiotherapists match "${query.trim()}"${city ? ` in ${city}` : ""}.`
            : city || specialty
            ? `No verified ${specialty ? `${specialty} ` : ""}physiotherapists${city ? ` in ${city}` : ""} yet.`
            : "No verified physiotherapists listed yet."}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((physio) => {
            const profileHref = physiotherapistProfilePath(physio.slug, physio.id);
            const canBookHome = physio.homeVisitEnabled && physio.isAvailable;
            const far = Boolean(geo) && isOutsideProviderCoverage(physio.reach);
            return (
              <div key={physio.id} className={`flex min-w-0 flex-col gap-4 p-5 ${surfaceCard}`}>
                <Link href={profileHref} className="flex min-w-0 items-start gap-3">
                  <PhysiotherapistAvatar name={physio.name} avatarUrl={physio.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-slate-900 hover:text-brand">
                      {physio.name}
                    </p>
                    {physio.ratingAvg !== undefined && physio.reviewCount ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                        <RatingStars rating={physio.ratingAvg} />
                        <span className="font-semibold text-slate-900">
                          {physio.ratingAvg.toFixed(1)}
                        </span>
                        <span className="text-slate-500">
                          ({physio.reviewCount} review{physio.reviewCount === 1 ? "" : "s"})
                        </span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-slate-400">No reviews yet</p>
                    )}
                    <p className="truncate text-sm text-brand/90">
                      {physio.specialties.slice(0, 2).join(" · ") || "Physiotherapist"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[
                        physio.qualification,
                        physio.experienceYears ? `${physio.experienceYears}+ yrs` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-600">
                      {physio.distanceKm !== undefined && (
                        <span
                          className={
                            physio.withinRadius
                              ? "inline-flex items-center gap-1 font-medium text-brand-dark"
                              : "inline-flex items-center gap-1 text-slate-500"
                          }
                        >
                          <Navigation className="h-3 w-3" />
                          {physio.distanceKm.toFixed(1)} km away
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[physio.area, physio.city].filter(Boolean).join(", ")}
                      </span>
                    </p>
                  </div>
                </Link>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={profileHref}>View profile</Link>
                  </Button>
                  {canBookHome ? (
                    <>
                      <Button size="sm" asChild>
                        <Link href={physiotherapistHomeVisitHref(physio.id)}>Book home visit</Link>
                      </Button>
                      <span className="self-center text-sm font-semibold text-slate-900">
                        Rs. {physio.homeVisitFee.toLocaleString("en-PK")}
                      </span>
                    </>
                  ) : (
                    <span className="self-center text-xs text-slate-500">Not taking home visits</span>
                  )}
                </div>
                {canBookHome && far && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Outside the {physio.coverageRadiusKm} km area they usually cover
                    {physio.inPatientCity === false ? `, in ${physio.city}` : ""}. You can still
                    book — they will need to confirm they can travel, and extra travel charges may
                    apply.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
