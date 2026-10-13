"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  cn,
  HOME_CARE_MATCH_RADIUS_KM,
  MAX_PHYSIOTHERAPY_SPECIALTIES,
  PHYSIO_HOME_VISIT_FEE_MAX,
  PHYSIO_HOME_VISIT_FEE_MIN,
  PHYSIOTHERAPY_SPECIALTIES_ALPHABETICAL,
} from "@zindagi/shared";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CitySelect } from "@/components/forms/city-select";
import { CityAreaSelect } from "@/components/forms/city-area-select";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import { SpecialtyMultiSelect } from "@/components/forms/specialty-multi-select";
import type { PhysiotherapistProfileDto } from "@/server/services/physiotherapist.service";
import { physiotherapistProfilePath } from "@/lib/physiotherapists/profile-path";
import { PhysiotherapistProfilePhotoUpload } from "./physiotherapist-profile-photo-upload";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";

const VERIFICATION_BADGE: Record<string, { label: string; className: string }> = {
  approved: {
    label: "Verified",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  pending: {
    label: "Verification pending",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  rejected: {
    label: "Verification rejected",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

type PhysiotherapistProfileFormProps = {
  profile: PhysiotherapistProfileDto;
};

export function PhysiotherapistProfileForm({ profile }: PhysiotherapistProfileFormProps) {
  const { refresh } = useSafeRouter();
  const { update } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [city, setCity] = useState(profile.staff.serviceArea.city);
  const [area, setArea] = useState(profile.staff.serviceArea.area ?? "");
  const [saved, setSaved] = useState(false);
  const [homeVisitEnabled, setHomeVisitEnabled] = useState(
    profile.staff.homeVisitEnabled,
  );
  const [geo, setGeo] = useState<GeoCoordinates | null>(
    profile.staff.serviceArea.geo ?? null,
  );
  const [specialties, setSpecialties] = useState<string[]>(
    profile.verification.specialties ?? [],
  );
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(profile.user.avatarUrl);
  const publicPath =
    profile.staff.verificationStatus === "approved" && profile.publicProfile.slug
      ? physiotherapistProfilePath(profile.publicProfile.slug, profile.user.id)
      : null;

  const badge =
    VERIFICATION_BADGE[profile.staff.verificationStatus] ??
    VERIFICATION_BADGE.pending;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    setSaved(false);

    if (!city.trim()) {
      setError("Select your city.");
      setPending(false);
      return;
    }

    if (area.trim().length < 2) {
      setError("Select or type your area.");
      setPending(false);
      return;
    }

    if (homeVisitEnabled && !geo) {
      setError("Please add your Google Maps location for in-house visit matching.");
      setPending(false);
      return;
    }

    const form = new FormData(e.currentTarget);
    const radiusRaw = form.get("radiusKm");
    const feeRaw = String(form.get("homeVisitFee") ?? "").trim();
    const body = {
      name: String(form.get("name") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim() || undefined,
      city: city.trim(),
      area: area.trim(),
      radiusKm: radiusRaw ? Number(radiusRaw) : undefined,
      homeVisitEnabled,
      homeVisitFee: feeRaw ? Number(feeRaw) : undefined,
      geo: geo ?? undefined,
      specialties,
      avatarUrl: avatarUrl !== profile.user.avatarUrl ? avatarUrl : undefined,
    };

    try {
      const res = await fetch("/api/v1/physiotherapist/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Could not save profile");
      }
      await update({ name: body.name });
      setSaved(true);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <PhysiotherapistProfilePhotoUpload
              name={profile.user.name}
              value={avatarUrl}
              onUploaded={setAvatarUrl}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={profile.user.name}
                  required
                  minLength={2}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={profile.user.phone ?? ""}
                  placeholder="03XXXXXXXXX"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="city">Service city</Label>
                <CitySelect
                  id="city"
                  value={city}
                  onChange={(next) => {
                    // A new city makes the old area meaningless, so clear it.
                    if (next !== city) setArea("");
                    setCity(next);
                  }}
                  className="mt-1"
                />
              </div>
              {city.trim() && (
                <CityAreaSelect id="area" city={city} value={area} onChange={setArea} required />
              )}
            </div>

            <div>
              <Label htmlFor="radiusKm">Coverage radius (km)</Label>
              <Input
                id="radiusKm"
                name="radiusKm"
                type="number"
                min={1}
                max={50}
                defaultValue={profile.staff.serviceArea.radiusKm}
              />
            </div>

            <div>
              <Label htmlFor="specialties">Specialties</Label>
              <SpecialtyMultiSelect
                id="specialties"
                values={specialties}
                onChange={setSpecialties}
                max={MAX_PHYSIOTHERAPY_SPECIALTIES}
                options={PHYSIOTHERAPY_SPECIALTIES_ALPHABETICAL}
                placeholder="Add your physiotherapy specialties"
              />
              <p className="mt-1 text-xs text-slate-500">
                Up to {MAX_PHYSIOTHERAPY_SPECIALTIES} areas of physiotherapy you specialize in.
              </p>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">
                Your bio, languages, experience, education and training now live in your
                portfolio.
              </p>
              <Link
                href="/physiotherapist/portfolio"
                className="shrink-0 text-sm font-medium text-brand hover:underline"
              >
                Edit portfolio →
              </Link>
            </div>

            <div className="space-y-3 rounded-lg border border-brand-light/30 bg-brand-light/5 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={homeVisitEnabled}
                  onChange={(e) => setHomeVisitEnabled(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Available for in-house visits within {HOME_CARE_MATCH_RADIUS_KM} km
                  </p>
                  <p className="text-xs text-slate-600">
                    Patients near your saved location can book you directly, and admin dispatch
                    uses it to match nearby visits.
                  </p>
                </div>
              </label>

              <div>
                <Label htmlFor="homeVisitFee">Your fee per home visit (Rs.)</Label>
                <Input
                  id="homeVisitFee"
                  name="homeVisitFee"
                  type="number"
                  inputMode="numeric"
                  min={PHYSIO_HOME_VISIT_FEE_MIN}
                  max={PHYSIO_HOME_VISIT_FEE_MAX}
                  step={50}
                  defaultValue={profile.staff.homeVisitFee}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  Patients who book you directly pay this amount. Between Rs.{" "}
                  {PHYSIO_HOME_VISIT_FEE_MIN.toLocaleString("en-PK")} and Rs.{" "}
                  {PHYSIO_HOME_VISIT_FEE_MAX.toLocaleString("en-PK")}.
                </p>
              </div>

              {homeVisitEnabled && (
                <GeoLocationPicker
                  id="Physiotherapist-profile-geo"
                  value={geo}
                  onChange={setGeo}
                  required
                />
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && !error && (
              <p className="text-sm text-emerald-700">Profile saved.</p>
            )}

            <Button type="submit" disabled={pending} loading={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status
            </p>
            <span
              className={cn(
                "mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                badge.className,
              )}
            >
              {badge.label}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Public profile
            </p>
            {publicPath ? (
              <Link
                href={publicPath}
                target="_blank"
                className="mt-1 inline-block break-all font-medium text-brand hover:underline"
              >
                {publicPath}
              </Link>
            ) : (
              <p className="mt-1 text-slate-500">Visible to patients once you&apos;re verified.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Email
            </p>
            <p className="mt-1 text-slate-800">{profile.user.email ?? "—"}</p>
          </div>
          {profile.staff.employeeCode && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Employee code
              </p>
              <p className="mt-1 text-slate-800">{profile.staff.employeeCode}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Member since
            </p>
            <p className="mt-1 text-slate-800">
              {new Date(profile.user.memberSince).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
