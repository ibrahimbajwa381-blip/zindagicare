"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HOME_CARE_MATCH_RADIUS_KM, cn } from "@zindagi/shared";
import { MapPin, Navigation, Sparkles } from "lucide-react";
import { NurseAvatar } from "@/features/nurse/components/nurse-avatar";
import { nurseProfilePath } from "@/lib/nurses/profile-path";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";
import type { PublicNurse } from "@/server/services/public-nurse.service";

/** "nearest" leaves the visit for our team to assign the closest available nurse. */
export type NurseChoice = "nearest" | string;

type Props = {
  geo: GeoCoordinates | null;
  value: NurseChoice;
  onChange: (value: NurseChoice) => void;
  /** Nurse pre-selected from a profile page (?nurse=<userId>). */
  initialNurseId?: string | null;
  /**
   * True for a general nursing visit, which is charged at the chosen nurse's own fee. Procedure
   * visits (IV drip, injection, wound care) always use the standard rate, so no fee is shown.
   */
  usesNurseFee: boolean;
  /** Reports the chosen nurse's fee, or null when the standard rate applies. */
  onFeeChange?: (fee: number | null) => void;
};

export function NursePicker({
  geo,
  value,
  onChange,
  initialNurseId,
  usesNurseFee,
  onFeeChange,
}: Props) {
  // Keyed by the location it was fetched for, so "loading" is derived rather than set in the effect.
  const [result, setResult] = useState<{ key: string; rows: PublicNurse[] } | null>(
    null,
  );
  const geoKey = geo ? `${geo.lat},${geo.lng}` : null;
  const loading = geoKey !== null && result?.key !== geoKey;
  const [preselected, setPreselected] = useState<PublicNurse | null>(null);
  const rows = geoKey && result?.key === geoKey ? result.rows : [];
  const nearby = rows.filter((p) => p.withinRadius && p.homeVisitEnabled && p.isAvailable);
  // Prefer the distance-annotated row for a nurse chosen from their profile page.
  const preselectedRow = preselected
    ? (rows.find((p) => p.id === preselected.id) ?? preselected)
    : null;

  useEffect(() => {
    if (!initialNurseId) return;
    let cancelled = false;
    fetch(`/api/v1/public/nurses/${encodeURIComponent(initialNurseId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) setPreselected(json.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialNurseId]);

  useEffect(() => {
    if (!geo || !geoKey) return;
    let cancelled = false;
    fetch(`/api/v1/public/nurses?lat=${geo.lat}&lng=${geo.lng}`)
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

  const selectedFee =
    !usesNurseFee || value === "nearest"
      ? null
      : ([...nearby, ...(preselectedRow ? [preselectedRow] : [])].find((p) => p.id === value)
          ?.homeVisitFee ?? null);
  useEffect(() => {
    onFeeChange?.(selectedFee);
  }, [selectedFee, onFeeChange]);

  const selectedIsNearby = value === "nearest" || nearby.some((p) => p.id === value);
  const selectedOutsideRadius =
    geo && !loading && value !== "nearest" && !selectedIsNearby;

  // Arriving from a profile page means the patient already picked someone, so show only that
  // nurse until they ask to change. Expand automatically if the pick can't visit this location.
  const [showAll, setShowAll] = useState(!initialNurseId);
  const selectedRow =
    value === "nearest"
      ? null
      : (nearby.find((p) => p.id === value) ??
        (preselectedRow?.id === value ? preselectedRow : null));
  const collapsed = !showAll && value !== "nearest" && !selectedOutsideRadius;

  if (collapsed) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-900">Your nurse</p>
        {selectedRow ? (
          <NurseOption nurse={selectedRow} showFee={usesNurseFee} selected onSelect={() => {}} />
        ) : (
          <p className="text-xs text-slate-500">Loading nurse…</p>
        )}
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs font-medium text-brand hover:underline"
        >
          Choose a different nurse
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-900">Choose your nurse</p>
        <p className="text-xs text-slate-500">
          {geo
            ? `Showing verified nurses within ${HOME_CARE_MATCH_RADIUS_KM} km of your location, nearest first.`
            : "Set your home location above to see nurses near you."}
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
            Our team will assign the closest verified nurse who is free at your time, at the
            standard rate.
          </span>
        </span>
      </button>

      {preselectedRow && !nearby.some((p) => p.id === preselectedRow.id) && (
        <NurseOption
          nurse={preselectedRow}
          showFee={usesNurseFee}
          selected={value === preselectedRow.id}
          onSelect={() => onChange(preselectedRow.id)}
        />
      )}

      {loading && <p className="text-xs text-slate-500">Finding nurses near you…</p>}

      {geo && !loading && nearby.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No nurses are available within {HOME_CARE_MATCH_RADIUS_KM} km right now. Keep
          &ldquo;Nearest available&rdquo; selected and our team will arrange one for you.
        </p>
      )}

      <div className="grid gap-2">
        {nearby.map((nurse) => (
          <NurseOption
            key={nurse.id}
            nurse={nurse}
            showFee={usesNurseFee}
            selected={value === nurse.id}
            onSelect={() => onChange(nurse.id)}
          />
        ))}
      </div>

      {selectedOutsideRadius && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {`${preselected?.name ?? "This nurse"} is more than ${HOME_CARE_MATCH_RADIUS_KM} km from the location you set, so they can't visit. Choose someone from the list or “Nearest available”.`}
        </p>
      )}
    </div>
  );
}

function NurseOption({
  nurse,
  showFee,
  selected,
  onSelect,
}: {
  nurse: PublicNurse;
  showFee: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition",
        selected
          ? "border-brand bg-brand-muted/50 ring-2 ring-brand/20"
          : "border-white/60 bg-white/80 hover:border-brand/30",
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <NurseAvatar name={nurse.name} avatarUrl={nurse.avatarUrl} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{nurse.name}</span>
          <span className="block truncate text-xs text-slate-500">
            {[nurse.qualification, nurse.specialties.slice(0, 2).join(", ")]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-600">
            {nurse.distanceKm !== undefined && (
              <span className="inline-flex items-center gap-1 font-medium text-brand-dark">
                <Navigation className="h-3 w-3" />
                {nurse.distanceKm.toFixed(1)} km away
              </span>
            )}
            {nurse.area && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {nurse.area}
              </span>
            )}
            {showFee && (
              <span className="font-semibold text-slate-800">
                Rs. {nurse.homeVisitFee.toLocaleString("en-PK")}
              </span>
            )}
          </span>
        </span>
      </button>
      <Link
        href={nurseProfilePath(nurse.slug, nurse.id)}
        target="_blank"
        className="shrink-0 text-xs font-medium text-brand hover:underline"
      >
        Profile
      </Link>
    </div>
  );
}
