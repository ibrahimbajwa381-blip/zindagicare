import Link from "next/link";
import { ExternalLink, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { DoctorShareCardDialog } from "@/features/doctor/components/doctor-share-card-dialog";
import { HerbalistAvatar } from "@/features/herbalist/components/herbalist-avatar";
import {
  CONSULT_PROVIDER_ROLES,
  type ConsultProviderRole,
} from "@/features/marketing/data/consult-provider-roles";
import { NutritionistAvatar } from "@/features/nutritionist/components/nutritionist-avatar";
import {
  PortfolioChecklist,
  PortfolioProgressBar,
} from "@/features/physiotherapist/components/portfolio/portfolio-progress";

const MIN_BIO_CHARS = 100;

type Props = {
  role: ConsultProviderRole;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  bio?: string;
  degree?: string;
  qualifications: string[];
  experienceYears: number;
  consultationFee: number;
  city: string;
  clinicCount: number;
  availabilityWindowCount: number;
  /** Live public profile path; null until the profile is approved and listed. */
  publicPath: string | null;
  /** Where the provider edits their profile (bio, fee, schedule, locations). */
  editHref: string;
};

/**
 * Overview-page summary of a herbalist's / nutritionist's public profile — the same idea as the
 * physiotherapist portfolio card: a mini preview, the next steps to complete it, and sharing.
 */
export function ConsultProviderPublicProfileCard({
  role,
  name,
  avatarUrl,
  specialties,
  bio,
  degree,
  qualifications,
  experienceYears,
  consultationFee,
  city,
  clinicCount,
  availabilityWindowCount,
  publicPath,
  editHref,
}: Props) {
  const config = CONSULT_PROVIDER_ROLES[role];
  const Avatar = role === "herbalist" ? HerbalistAvatar : NutritionistAvatar;

  const checklist = [
    {
      id: "photo",
      label: "Profile photo",
      hint: "A clear, friendly headshot builds instant trust.",
      done: Boolean(avatarUrl),
    },
    {
      id: "about",
      label: "About you",
      hint: `At least ${MIN_BIO_CHARS} characters about your approach and experience.`,
      done: (bio?.trim().length ?? 0) >= MIN_BIO_CHARS,
    },
    {
      id: "specialties",
      label: "Verified specialties",
      hint: "Admin-verified specialties are what patients filter by.",
      done: specialties.length > 0,
    },
    {
      id: "qualification",
      label: "Qualification",
      hint: "Your degree and any additional qualifications.",
      done: Boolean(degree),
    },
    {
      id: "clinics",
      label: "Practice locations",
      hint: "Where patients can find you in person.",
      done: clinicCount > 0,
    },
    {
      id: "hours",
      label: "Consultation hours",
      hint: "Weekly hours show patients when you consult.",
      done: availabilityWindowCount > 0,
    },
  ];
  const percent = Math.round((checklist.filter((i) => i.done).length / checklist.length) * 100);

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-6 p-0 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="bg-gradient-to-br from-brand-muted/70 via-white to-accent-muted/30 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            Your public profile
          </p>
          <div className="mt-4 flex items-start gap-4">
            <Avatar name={name} avatarUrl={avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-slate-900">{name}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                {specialties.length ? specialties.join(" · ") : config.field}
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { value: experienceYears ? `${experienceYears}+` : "—", label: "years" },
              { value: String(clinicCount), label: "locations" },
              { value: String(availabilityWindowCount), label: "weekly slots" },
            ].map((h) => (
              <div key={h.label} className="rounded-xl bg-white/80 px-1 py-2 shadow-sm">
                <dt className="sr-only">{h.label}</dt>
                <dd className="text-base font-semibold text-slate-900">{h.value}</dd>
                <dd className="text-[11px] leading-tight text-slate-500">{h.label}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={editHref}>
                <Pencil className="h-4 w-4" />
                Edit profile
              </Link>
            </Button>
            {publicPath && (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link href={publicPath} target="_blank">
                    <ExternalLink className="h-4 w-4" />
                    View live
                  </Link>
                </Button>
                <DoctorShareCardDialog
                  triggerLabel="Share profile card"
                  shareText={`Consult ${name} online on ${siteConfig.name}`}
                  card={{
                    name,
                    avatarUrl,
                    specialty: specialties.join(" · ") || config.title,
                    qualifications: [degree, ...qualifications].filter((q): q is string =>
                      Boolean(q),
                    ),
                    location: `Online consultations · ${city}`,
                    experienceYears: experienceYears || undefined,
                    consultationFee,
                    feeLabel: "per consultation",
                    pmdcVerified: true,
                    profileUrl: `${siteConfig.url}${publicPath}`,
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5 pt-0 sm:p-6 md:pl-0">
          <PortfolioProgressBar percent={percent} />
          {percent === 100 ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Your profile is complete. Keep your hours and locations up to date.</p>
            </div>
          ) : (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Next steps
              </p>
              <PortfolioChecklist
                items={checklist}
                showDone={false}
                limit={3}
                itemHref={() => editHref}
              />
            </div>
          )}
          {!publicPath && (
            <p className="text-xs text-slate-500">
              Goes live on {siteConfig.name} once an admin approves and lists your profile.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
