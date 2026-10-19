"use client";

import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { HOME_CARE_MATCH_RADIUS_KM, LAHORE_GEO } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useIsMountedRef } from "@/hooks/use-is-mounted-ref";
import {
  formatGeoLabel,
  googleMapsLink,
  parseGoogleMapsUrl,
  type GeoCoordinates,
} from "@/lib/geo/parse-google-maps-url";

type GeoLocationPickerProps = {
  value: GeoCoordinates | null;
  onChange: (geo: GeoCoordinates | null) => void;
  required?: boolean;
  id?: string;
  /** Overrides the default provider-oriented help text (e.g. for patient-facing forms). */
  description?: string;
};

export function GeoLocationPicker({
  value,
  onChange,
  required = false,
  id = "geo-location",
  description,
}: GeoLocationPickerProps) {
  const mountedRef = useIsMountedRef();
  const [mapsInput, setMapsInput] = useState("");
  const [parseError, setParseError] = useState<string>();
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading">("idle");
  const [useGpsMode, setUseGpsMode] = useState(false);
  const [resolving, setResolving] = useState(false);

  async function applyParsedLink() {
    setUseGpsMode(false);
    setParseError(undefined);
    const parsed = parseGoogleMapsUrl(mapsInput);
    if (parsed) {
      onChange(parsed);
      return;
    }

    // Short links (maps.app.goo.gl, goo.gl/maps) don't carry coordinates in
    // the URL itself — ask the server to follow the redirect chain.
    if (/^https?:\/\/[^/]*(goo\.gl|google\.com)\//i.test(mapsInput.trim())) {
      setResolving(true);
      try {
        const res = await fetch(
          `/api/geo/resolve-maps-link?url=${encodeURIComponent(mapsInput.trim())}`,
        );
        if (res.ok) {
          const resolved = (await res.json()) as GeoCoordinates;
          onChange(resolved);
          setResolving(false);
          return;
        }
      } catch {
        // fall through to error message below
      }
      setResolving(false);
    }

    setParseError(
      "Could not read coordinates. Paste a Google Maps link or lat,lng (e.g. 31.5204, 74.3587).",
    );
  }

  function detectCurrentLocation() {
    setUseGpsMode(true);
    setGeoStatus("loading");
    setParseError(undefined);

    if (!navigator.geolocation) {
      onChange({ lng: LAHORE_GEO.lng, lat: LAHORE_GEO.lat });
      setGeoStatus("idle");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mountedRef.current) return;
        onChange({
          lng: pos.coords.longitude,
          lat: pos.coords.latitude,
        });
        setGeoStatus("idle");
      },
      () => {
        if (!mountedRef.current) return;
        setUseGpsMode(false);
        setParseError("Could not detect your location. Paste a Google Maps link instead.");
        setGeoStatus("idle");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function clearLocation() {
    setUseGpsMode(false);
    setParseError(undefined);
    onChange(null);
  }

  return (
    <div className="space-y-3">
      {!useGpsMode && (
        <div>
          <Label htmlFor={`${id}-maps-link`}>
            Google Maps location{required ? " *" : ""}
          </Label>
          <p className="mt-0.5 text-xs text-slate-500">
            {description ?? (
              <>
                Open Google Maps, share your clinic or home base location, and paste the link
                below. We use this to match you with in-house visits — patients within{" "}
                {HOME_CARE_MATCH_RADIUS_KM} km first.
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={detectCurrentLocation}
          disabled={geoStatus === "loading"}
        >
          <MapPin className="h-4 w-4" />
          {geoStatus === "loading" ? "Detecting…" : "Use my current location"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={clearLocation}>
            Clear location
          </Button>
        )}
      </div>

      {!useGpsMode && (
        <div>
          <p className="text-xs font-medium text-slate-500">
            Or paste a Google Maps link / coordinates
          </p>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <Input
              id={`${id}-maps-link`}
              value={mapsInput}
              onChange={(e) => setMapsInput(e.target.value)}
              placeholder="https://maps.google.com/… or 31.5204, 74.3587"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={applyParsedLink}
              disabled={resolving}
            >
              {resolving ? "Resolving…" : "Apply link"}
            </Button>
          </div>
          {parseError && <p className="mt-1.5 text-xs text-red-600">{parseError}</p>}
        </div>
      )}

      {useGpsMode && parseError && (
        <p className="text-xs text-red-600">{parseError}</p>
      )}

      {value && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Location saved:</span>
          <span>{formatGeoLabel(value)}</span>
          <a
            href={googleMapsLink(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-emerald-700 underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View on Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
