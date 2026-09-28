"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HOME_CARE_MATCH_RADIUS_KM } from "@zindagi/shared";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import { PhysiotherapistAvatar } from "@/features/physiotherapist/components/physiotherapist-avatar";
import { physiotherapistProfilePath } from "@/lib/physiotherapists/profile-path";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { PublicPhysiotherapist } from "@/server/services/public-physiotherapist.service";
import { physiotherapistHomeVisitHref } from "./physiotherapist-profile-view";

type Props = {
  initial: PublicPhysiotherapist[];
};

export function PhysiotherapistDirectory({ initial }: Props) {
  const [geo, setGeo] = useState<GeoCoordinates | null>(null);
  // Keyed by the location it was fetched for, so "loading" is derived rather than set in the effect.
  const [sorted, setSorted] = useState<{ key: string; rows: PublicPhysiotherapist[] } | null>(
    null,
  );
  const geoKey = geo ? `${geo.lat},${geo.lng}` : null;
  const loading = geoKey !== null && sorted?.key !== geoKey;
  const rows = sorted && sorted.key === geoKey ? sorted.rows : initial;

  useEffect(() => {
    if (!geo || !geoKey) return;
    let cancelled = false;
    fetch(`/api/v1/public/physiotherapists?lat=${geo.lat}&lng=${geo.lng}`)
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
  }, [geo, geoKey, initial]);

  const nearbyCount = geo ? rows.filter((r) => r.withinRadius).length : 0;

  return (
    <div className="space-y-6">
      <div className={`p-5 ${surfaceCard}`}>
        <p className="text-sm font-semibold text-slate-900">Find physiotherapists near you</p>
        <p className="mb-3 text-xs text-slate-500">
          Share your location to sort by distance. Home visits are available from physiotherapists
          within {HOME_CARE_MATCH_RADIUS_KM} km.
        </p>
        <GeoLocationPicker
          id="physio-directory-geo"
          value={geo}
          onChange={setGeo}
          description={`Tap "Use my current location", or paste a Google Maps link / coordinates of your home.`}
        />
        {geo && !loading && (
          <p className="mt-3 text-xs text-slate-600">
            {nearbyCount} physiotherapist{nearbyCount === 1 ? "" : "s"} within{" "}
            {HOME_CARE_MATCH_RADIUS_KM} km, nearest first.
          </p>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Sorting by distance…</p>}

      {rows.length === 0 ? (
        <p className={`p-8 text-center text-sm text-slate-500 ${surfaceCard}`}>
          No verified physiotherapists listed yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((physio) => {
            const profileHref = physiotherapistProfilePath(physio.slug, physio.id);
            const canBookHome =
              physio.homeVisitEnabled && physio.isAvailable && (!geo || physio.withinRadius);
            return (
              <div key={physio.id} className={`flex min-w-0 flex-col gap-4 p-5 ${surfaceCard}`}>
                <Link href={profileHref} className="flex min-w-0 items-start gap-3">
                  <PhysiotherapistAvatar name={physio.name} avatarUrl={physio.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-slate-900 hover:text-brand">
                      {physio.name}
                    </p>
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
                    <Button size="sm" asChild>
                      <Link href={physiotherapistHomeVisitHref(physio.id)}>Book home visit</Link>
                    </Button>
                  ) : (
                    <span className="self-center text-xs text-slate-500">
                      {physio.homeVisitEnabled && physio.isAvailable
                        ? `Outside ${HOME_CARE_MATCH_RADIUS_KM} km of you`
                        : "Not taking home visits"}
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
