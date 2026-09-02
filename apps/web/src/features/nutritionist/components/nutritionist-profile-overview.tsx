import { BadgeCheck, Clock, MapPin } from "lucide-react";
import { formatDayOfWeek, formatPkr } from "@/features/nutritionist/types";
import { NutritionistAvatar } from "@/features/nutritionist/components/nutritionist-avatar";
import type { NutritionistProfileDto } from "@/server/services/nutritionist-profile.service";

function Field({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value || "—"}</p>
    </div>
  );
}

export function NutritionistProfileOverview({
  profile,
}: {
  profile: NutritionistProfileDto;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <NutritionistAvatar
            name={profile.user.name}
            avatarUrl={profile.user.avatarUrl}
            size="xl"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold text-slate-900">
              {profile.user.name}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {profile.primarySpecialty ?? "Nutrition & diet planning"} ·{" "}
              {profile.experienceYears} yr experience
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                >
                  <BadgeCheck className="h-3 w-3" />
                  {specialty}
                </span>
              ))}
              {profile.additionalSpecialties
                .filter((s) => !profile.specialties.includes(s))
                .map((specialty) => (
                  <span
                    key={specialty}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                  >
                    {specialty} · awaiting verification
                  </span>
                ))}
            </div>
          </div>
        </div>

        {profile.bio && (
          <p className="mt-4 text-sm leading-relaxed text-slate-700">
            {profile.bio}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Credentials</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Council number" value={profile.licenseNumber} />
          <Field label="Qualification" value={profile.degree} />
          <Field label="Institute" value={profile.institute} />
          <Field label="Graduation year" value={profile.graduationYear} />
          <Field
            label="Consultation fee"
            value={formatPkr(profile.consultationFee)}
          />
          <Field label="Languages" value={profile.languages.join(", ")} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MapPin className="h-4 w-4 text-slate-500" />
          Practice locations
        </h3>
        {profile.clinics.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No locations added yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {profile.clinics.map((clinic, index) => (
              <li key={index} className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">{clinic.name}</span>
                {" · "}
                {clinic.city}
                {clinic.address ? ` · ${clinic.address}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Clock className="h-4 w-4 text-slate-500" />
          Weekly availability
        </h3>
        {profile.weeklyAvailability.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No availability windows added yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {profile.weeklyAvailability.map((slot, index) => (
              <li key={index} className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">
                  {formatDayOfWeek(slot.dayOfWeek)}
                </span>
                {" · "}
                {slot.startTimeLocal} – {slot.endTimeLocal}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
