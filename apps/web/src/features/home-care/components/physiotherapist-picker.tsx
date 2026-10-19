"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  isOutsideProviderCoverage,
  bestHomeCareReach,
  cn,
  type HomeCareReach,
} from "@zindagi/shared";
import { MapPin, Navigation, Sparkles } from "lucide-react";
import { PhysiotherapistAvatar } from "@/features/physiotherapist/components/physiotherapist-avatar";
import { physiotherapistProfilePath } from "@/lib/physiotherapists/profile-path";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";
import type { PublicPhysiotherapist } from "@/server/services/public-physiotherapist.service";
import { FarAwayNotice, FarBadge, reachTierDescription } from "./provider-reach";

/** "nearest" lets the system auto-assign the closest available physiotherapist. */
export type PhysiotherapistChoice = "nearest" | string;

type Props = {
  geo: GeoCoordinates | null;
  value: PhysiotherapistChoice;
  onChange: (value: PhysiotherapistChoice) => void;
  /** Physio pre-selected from a profile page (?physio=<userId>). */
  initialPhysioId?: string | null;
  /**
   * Reports the chosen physio's fee. For "nearest" it's the nearest listed physio's fee — the
   * visit is charged at whoever is actually assigned (null until physios have loaded).
   */
  onFeeChange?: (fee: number | null) => void;
};

export function PhysiotherapistPicker({
  geo,
  value,
  onChange,
  initialPhysioId,
  onFeeChange,
}: Props) {
  // Keyed by the location it was fetched for, so "loading" is derived rather than set in the effect.
  const [result, setResult] = useState<{ key: string; rows: PublicPhysiotherapist[] } | null>(
    null,
  );
  const geoKey = geo ? `${geo.lat},${geo.lng}` : null;
  const loading = geoKey !== null && result?.key !== geoKey;
  const [preselected, setPreselected] = useState<PublicPhysiotherapist | null>(null);
  const rows = geoKey && result?.key === geoKey ? result.rows : [];
  // Already ranked by the API: within 15 km, then 30 km, then the patient's city, then anywhere.
  // Distance never rules anyone out — farther physios are flagged, not hidden.
  const bookable = rows.filter((p) => p.homeVisitEnabled && p.isAvailable);
  const tier = bestHomeCareReach(bookable.filter((p): p is RankedPhysio => !!p.reach));
  const primary = bookable.filter((p) => p.reach === tier);
  const farther = bookable.filter((p) => p.reach !== tier);
  const [showFarther, setShowFarther] = useState(false);
  // Prefer the distance-annotated row for a physio chosen from their profile page.
  const preselectedRow = preselected
    ? (rows.find((p) => p.id === preselected.id) ?? preselected)
    : null;

  useEffect(() => {
    if (!initialPhysioId) return;
    let cancelled = false;
    fetch(`/api/v1/public/physiotherapists/${encodeURIComponent(initialPhysioId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) setPreselected(json.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialPhysioId]);

  useEffect(() => {
    if (!geo || !geoKey) return;
    let cancelled = false;
    fetch(`/api/v1/public/physiotherapists?lat=${geo.lat}&lng=${geo.lng}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setResult({ key: geoKey, rows: json.success ? (json.data ?? []) : [] });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: geoKey, rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [geo, geoKey]);

  const selectedRow =
    value === "nearest"
      ? null
      : (bookable.find((p) => p.id === value) ??
        (preselectedRow?.id === value ? preselectedRow : null));
  const selectedFee =
    value === "nearest" ? (bookable[0]?.homeVisitFee ?? null) : (selectedRow?.homeVisitFee ?? null);
  useEffect(() => {
    onFeeChange?.(selectedFee);
  }, [selectedFee, onFeeChange]);

  // Warn (never block) when the chosen physio is outside 15 km or the distance is unknown.
  const selectedFar =
    geo && !loading && selectedRow ? isOutsideProviderCoverage(selectedRow.reach) : false;
  const farWarning = selectedRow && selectedFar ? <FarAwayNotice provider={selectedRow} /> : null;

  // Arriving from a profile page means the patient already picked someone, so show only that
  // physio until they ask to change.
  const [showAll, setShowAll] = useState(!initialPhysioId);
  const collapsed = !showAll && value !== "nearest";

  if (collapsed) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-900">Your physiotherapist</p>
        {selectedRow ? (
          <PhysioOption physio={selectedRow} selected onSelect={() => {}} />
        ) : (
          <p className="text-xs text-slate-500">Loading physiotherapist…</p>
        )}
        {farWarning}
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs font-medium text-brand hover:underline"
        >
          Choose a different physiotherapist
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-900">Choose your physiotherapist</p>
        <p className="text-xs text-slate-500">
          {geo
            ? reachTierDescription(tier, "physiotherapists")
            : "Set your home location above to see physiotherapists near you."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange("nearest")}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
          value === "nearest"
            ? "border-brand bg-brand-muted/50 ring-2 ring-brand/20"
            : "border-white/60 bg-white/80 hover:border-brand/30",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Sparkles className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold">Nearest available (recommended)</span>
          <span className="block text-xs text-slate-500">
            We&apos;ll assign the closest verified physiotherapist who is free at your time. You
            pay that physiotherapist&apos;s own fee.
            {geo && !loading && isOutsideProviderCoverage(tier)
              ? " Nobody free covers your location, so they may be farther away — travel and any extra charges may need to be confirmed."
              : ""}
          </span>
        </span>
      </button>

      {preselectedRow && !bookable.some((p) => p.id === preselectedRow.id) && (
        <PhysioOption
          physio={preselectedRow}
          selected={value === preselectedRow.id}
          onSelect={() => onChange(preselectedRow.id)}
        />
      )}

      {loading && <p className="text-xs text-slate-500">Finding physiotherapists near you…</p>}

      {geo && !loading && bookable.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No physiotherapists are taking home visits right now. Keep &ldquo;Nearest
          available&rdquo; selected and our team will arrange one for you.
        </p>
      )}

      <div className="grid gap-2">
        {primary.map((physio) => (
          <PhysioOption
            key={physio.id}
            physio={physio}
            selected={value === physio.id}
            onSelect={() => onChange(physio.id)}
          />
        ))}
        {(showFarther || farther.some((p) => p.id === value)) &&
          farther.map((physio) => (
            <PhysioOption
              key={physio.id}
              physio={physio}
              selected={value === physio.id}
              onSelect={() => onChange(physio.id)}
            />
          ))}
      </div>

      {farther.length > 0 && !showFarther && !farther.some((p) => p.id === value) && (
        <button
          type="button"
          onClick={() => setShowFarther(true)}
          className="text-xs font-medium text-brand hover:underline"
        >
          Show {farther.length} more physiotherapist{farther.length === 1 ? "" : "s"} farther away
        </button>
      )}

      {farWarning}
    </div>
  );
}

type RankedPhysio = PublicPhysiotherapist & { reach: HomeCareReach };

function PhysioOption({
  physio,
  selected,
  onSelect,
}: {
  physio: PublicPhysiotherapist;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl border p-3 transition",
        selected
          ? "border-brand bg-brand-muted/50 ring-2 ring-brand/20"
          : "border-white/60 bg-white/80 hover:border-brand/30",
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <PhysiotherapistAvatar name={physio.name} avatarUrl={physio.avatarUrl} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{physio.name}</span>
          <span className="block truncate text-xs text-slate-500">
            {[physio.qualification, physio.specialties.slice(0, 2).join(", ")]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-600">
            {physio.distanceKm !== undefined && (
              <span className="inline-flex items-center gap-1 font-medium text-brand-dark">
                <Navigation className="h-3 w-3" />
                {physio.distanceKm.toFixed(1)} km away
              </span>
            )}
            <FarBadge reach={physio.reach} />
            {physio.area && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {physio.area}
              </span>
            )}
            <span className="font-semibold text-slate-800">
              Rs. {physio.homeVisitFee.toLocaleString("en-PK")}
            </span>
          </span>
        </span>
      </button>
      <Link
        href={physiotherapistProfilePath(physio.slug, physio.id)}
        target="_blank"
        className="shrink-0 text-xs font-medium text-brand hover:underline"
      >
        Profile
      </Link>
    </div>
  );
}
