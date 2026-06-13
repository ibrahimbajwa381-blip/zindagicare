"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { cn, HOME_CARE_MATCH_RADIUS_KM } from "@zindagi/shared";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import type { NurseProfileDto } from "@/server/services/nurse.service";
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

type NurseProfileFormProps = {
  profile: NurseProfileDto;
};

export function NurseProfileForm({ profile }: NurseProfileFormProps) {
  const { refresh } = useSafeRouter();
  const { update } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [homeVisitEnabled, setHomeVisitEnabled] = useState(
    profile.staff.homeVisitEnabled,
  );
  const [geo, setGeo] = useState<GeoCoordinates | null>(
    profile.staff.serviceArea.geo ?? null,
  );

  const badge =
    VERIFICATION_BADGE[profile.staff.verificationStatus] ??
    VERIFICATION_BADGE.pending;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    setSaved(false);

    if (homeVisitEnabled && !geo) {
      setError("Please add your Google Maps location for in-house visit matching.");
      setPending(false);
      return;
    }

    const form = new FormData(e.currentTarget);
    const radiusRaw = form.get("radiusKm");
    const body = {
      name: String(form.get("name") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim() || undefined,
      city: String(form.get("city") ?? "").trim(),
      area: String(form.get("area") ?? "").trim(),
      radiusKm: radiusRaw ? Number(radiusRaw) : undefined,
      homeVisitEnabled,
      geo: geo ?? undefined,
    };

    try {
      const res = await fetch("/api/v1/nurse/profile", {
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
                <Input
                  id="city"
                  name="city"
                  defaultValue={profile.staff.serviceArea.city}
                  required
                  minLength={2}
                />
              </div>
              <div>
                <Label htmlFor="area">Area / neighborhood</Label>
                <Input
                  id="area"
                  name="area"
                  defaultValue={profile.staff.serviceArea.area ?? ""}
                  placeholder="e.g. DHA Phase 5"
                  required
                  minLength={2}
                />
              </div>
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
                    Admin dispatch uses your saved location to match nearby visits.
                  </p>
                </div>
              </label>

              {homeVisitEnabled && (
                <GeoLocationPicker
                  id="nurse-profile-geo"
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

            <Button type="submit" disabled={pending}>
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
