"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Droplets,
  Globe,
  HeartPulse,
  Mail,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  ShieldCheck,
  User,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { pakistaniPhoneSchema } from "@zindagi/validators";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import type { PatientProfileDto } from "@/server/services/patient-profile.service";
import { surfaceCard } from "@/lib/ui/surfaces";

type Props = {
  initialProfile: PatientProfileDto;
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const selectClassName =
  "flex h-11 w-full rounded-xl border border-white/60 bg-white/90 px-3.5 py-2 text-base text-foreground shadow-sm backdrop-blur-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:px-3 sm:text-sm";

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatList(items: string[]): string {
  return items.join(", ");
}

function formatMemberSince(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-PK", {
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function profileInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PatientProfileSection({ initialProfile }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const { locale, setLocale } = useLocale();
  const t = useTranslations();
  const p = t.dashboard.profile;

  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [phoneError, setPhoneError] = useState<string>();

  const initials = profileInitials(profile.user.name);

  function genderLabel(value?: string) {
    if (value === "male") return p.gender.male;
    if (value === "female") return p.gender.female;
    if (value === "other") return p.gender.other;
    return p.notSet;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    setSuccess(false);

    const form = new FormData(e.currentTarget);
    const phone = String(form.get("phone") ?? "").trim();

    if (phone) {
      const result = pakistaniPhoneSchema.safeParse(phone);
      if (!result.success) {
        setPhoneError(t.auth.validation.phone);
        setPending(false);
        return;
      }
    }
    setPhoneError(undefined);

    const body = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: phone || undefined,
      city: String(form.get("city") ?? ""),
      locale: String(form.get("locale") ?? locale) as "en" | "ur",
      dateOfBirth: String(form.get("dateOfBirth") ?? "") || null,
      gender: String(form.get("gender") ?? "") || null,
      bloodGroup: String(form.get("bloodGroup") ?? "") || null,
      allergies: parseList(String(form.get("allergies") ?? "")),
      chronicConditions: parseList(String(form.get("chronicConditions") ?? "")),
      emergencyContact: {
        name: String(form.get("emergencyName") ?? "").trim() || undefined,
        phone: String(form.get("emergencyPhone") ?? "").trim() || undefined,
        relation: String(form.get("emergencyRelation") ?? "").trim() || undefined,
      },
    };

    const res = await fetch("/api/v1/patient/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setPending(false);

    if (!res.ok) {
      const json = (await res.json()) as { error?: { message?: string } };
      setError(json.error?.message ?? p.saveError);
      return;
    }

    const json = (await res.json()) as { data?: PatientProfileDto };
    if (json.data) {
      setProfile(json.data);
      await update({ name: json.data.user.name });
      if (json.data.user.locale !== locale) {
        setLocale(json.data.user.locale);
      }
    }

    setEditing(false);
    setSuccess(true);
    router.refresh();
  }

  function cancelEdit() {
    setEditing(false);
    setError(undefined);
    setPhoneError(undefined);
  }

  return (
    <Card className={cn(surfaceCard, "overflow-hidden border-white/70 p-0 shadow-premium")}>
      <ProfileHero
        eyebrow={p.title}
        name={profile.user.name}
        email={profile.user.email}
        phone={profile.user.phone}
        subtitle={p.subtitle}
        patientAccountLabel={t.dashboard.header.patientAccount}
        memberSinceLabel={p.memberSince}
        memberSince={formatMemberSince(profile.user.memberSince, profile.user.locale)}
        city={profile.user.city}
        emailVerified={profile.user.emailVerified}
        phoneVerified={profile.user.phoneVerified}
        verifiedLabel={p.verified}
        initials={initials}
        editing={editing}
        editLabel={p.edit}
        onEdit={() => {
          setEditing(true);
          setSuccess(false);
        }}
      />

      <CardContent className="space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
        {success && !editing && (
          <div
            className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 text-sm text-emerald-800 shadow-sm"
            role="status"
          >
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
            {p.saveSuccess}
          </div>
        )}

        {editing ? (
          <form onSubmit={onSubmit} className="space-y-6 sm:space-y-8">
            <div className="grid gap-6 xl:grid-cols-2 xl:gap-8">
            <ProfileSection title={p.account} icon={UserRound} accent="brand">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={p.fields.name} name="name" defaultValue={profile.user.name} required />
                <FormField
                  label={p.fields.email}
                  name="email"
                  type="email"
                  defaultValue={profile.user.email ?? ""}
                />
                <div>
                  <Label htmlFor="phone">{p.fields.phone}</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    defaultValue={profile.user.phone ?? ""}
                    placeholder={t.auth.phonePlaceholder}
                    aria-invalid={!!phoneError}
                    onChange={() => phoneError && setPhoneError(undefined)}
                  />
                  <FieldError message={phoneError} />
                </div>
                <FormField label={p.fields.city} name="city" defaultValue={profile.user.city} required />
                <div>
                  <Label htmlFor="locale">{p.fields.language}</Label>
                  <select id="locale" name="locale" defaultValue={profile.user.locale} className={selectClassName}>
                    <option value="en">{t.auth.english}</option>
                    <option value="ur">{t.auth.urdu}</option>
                  </select>
                </div>
              </div>
            </ProfileSection>

            <ProfileSection title={p.health} icon={HeartPulse} accent="rose">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label={p.fields.dateOfBirth}
                  name="dateOfBirth"
                  type="date"
                  defaultValue={profile.profile.dateOfBirth ?? ""}
                />
                <div>
                  <Label htmlFor="gender">{p.fields.gender}</Label>
                  <select id="gender" name="gender" defaultValue={profile.profile.gender ?? ""} className={selectClassName}>
                    <option value="">—</option>
                    <option value="male">{p.gender.male}</option>
                    <option value="female">{p.gender.female}</option>
                    <option value="other">{p.gender.other}</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="bloodGroup">{p.fields.bloodGroup}</Label>
                  <select
                    id="bloodGroup"
                    name="bloodGroup"
                    defaultValue={profile.profile.bloodGroup ?? ""}
                    className={selectClassName}
                  >
                    <option value="">—</option>
                    {BLOOD_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>
                <FormField
                  label={p.fields.allergies}
                  name="allergies"
                  defaultValue={formatList(profile.profile.allergies)}
                  hint={p.hints.allergies}
                />
                <FormField
                  label={p.fields.chronicConditions}
                  name="chronicConditions"
                  defaultValue={formatList(profile.profile.chronicConditions)}
                  hint={p.hints.chronicConditions}
                  className="md:col-span-2"
                />
              </div>
            </ProfileSection>
            </div>

            <ProfileSection title={p.emergency} icon={PhoneCall} accent="accent">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                  label={p.fields.emergencyName}
                  name="emergencyName"
                  defaultValue={profile.profile.emergencyContact?.name ?? ""}
                />
                <FormField
                  label={p.fields.emergencyPhone}
                  name="emergencyPhone"
                  type="tel"
                  defaultValue={profile.profile.emergencyContact?.phone ?? ""}
                />
                <FormField
                  label={p.fields.emergencyRelation}
                  name="emergencyRelation"
                  defaultValue={profile.profile.emergencyContact?.relation ?? ""}
                />
              </div>
            </ProfileSection>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-premium backdrop-blur-md sm:bottom-4 sm:flex-row sm:flex-wrap sm:gap-3 sm:p-4">
              <Button type="submit" disabled={pending} loading={pending} className="w-full shadow-sm shadow-brand/20 sm:min-w-[9rem] sm:w-auto">
                {pending ? p.saving : p.save}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={cancelEdit} className="w-full gap-1.5 sm:w-auto">
                <X className="size-4" aria-hidden />
                {p.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <ProfileSection title={p.account} icon={UserRound} accent="brand">
              <div className="grid gap-3">
                <InfoTile icon={User} label={p.fields.name} value={profile.user.name} />
                <InfoTile
                  icon={Mail}
                  label={p.fields.email}
                  value={profile.user.email}
                  verified={profile.user.emailVerified}
                  verifiedLabel={p.verified}
                />
                <InfoTile
                  icon={Phone}
                  label={p.fields.phone}
                  value={profile.user.phone}
                  verified={profile.user.phoneVerified}
                  verifiedLabel={p.verified}
                />
                <InfoTile icon={MapPin} label={p.fields.city} value={profile.user.city} />
                <InfoTile
                  icon={Globe}
                  label={p.fields.language}
                  value={profile.user.locale === "ur" ? t.auth.urdu : t.auth.english}
                />
              </div>
            </ProfileSection>

            <ProfileSection title={p.health} icon={HeartPulse} accent="rose">
              <div className="grid gap-3">
                <InfoTile icon={Calendar} label={p.fields.dateOfBirth} value={profile.profile.dateOfBirth} />
                <InfoTile icon={UserRound} label={p.fields.gender} value={genderLabel(profile.profile.gender)} />
                <InfoTile
                  icon={Droplets}
                  label={p.fields.bloodGroup}
                  value={profile.profile.bloodGroup}
                  highlight={Boolean(profile.profile.bloodGroup)}
                />
                <InfoTile
                  icon={AlertCircle}
                  label={p.fields.allergies}
                  tags={profile.profile.allergies}
                  emptyLabel={p.notSet}
                />
                <InfoTile
                  icon={Activity}
                  label={p.fields.chronicConditions}
                  tags={profile.profile.chronicConditions}
                  emptyLabel={p.notSet}
                />
              </div>
            </ProfileSection>
            </div>

            <ProfileSection title={p.emergency} icon={PhoneCall} accent="accent">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoTile icon={User} label={p.fields.emergencyName} value={profile.profile.emergencyContact?.name} />
                <InfoTile icon={Phone} label={p.fields.emergencyPhone} value={profile.profile.emergencyContact?.phone} />
                <InfoTile
                  icon={HeartPulse}
                  label={p.fields.emergencyRelation}
                  value={profile.profile.emergencyContact?.relation}
                  className="sm:col-span-2 lg:col-span-1"
                />
              </div>
            </ProfileSection>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileHero({
  eyebrow,
  name,
  email,
  phone,
  subtitle,
  patientAccountLabel,
  memberSinceLabel,
  memberSince,
  city,
  emailVerified,
  phoneVerified,
  verifiedLabel,
  initials,
  editing,
  editLabel,
  onEdit,
}: {
  eyebrow: string;
  name: string;
  email?: string;
  phone?: string;
  subtitle: string;
  patientAccountLabel: string;
  memberSinceLabel: string;
  memberSince: string;
  city: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  verifiedLabel: string;
  initials: string;
  editing: boolean;
  editLabel: string;
  onEdit: () => void;
}) {
  return (
    <div className="border-b border-slate-200/80 bg-gradient-to-br from-brand-muted/90 via-white to-accent-muted/30 px-4 py-5 sm:px-8 sm:py-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <div className="relative shrink-0">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-xl font-bold text-white shadow-md ring-4 ring-white sm:size-20 sm:text-2xl">
              {initials || <User className="size-8 text-white" aria-hidden />}
            </div>
            {(emailVerified || phoneVerified) && (
              <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                <ShieldCheck className="size-4 text-white" aria-hidden />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-dark/70">
              {eyebrow}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <h2 className="font-display break-words text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {name}
              </h2>
              <span className="inline-flex rounded-full border border-brand-light/50 bg-brand-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
                {patientAccountLabel}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            <div className="mt-2 flex flex-col gap-0.5 text-sm text-slate-600">
              {email ? (
                <p className="flex items-center gap-1.5 truncate">
                  <Mail className="size-3.5 shrink-0 text-brand" aria-hidden />
                  {email}
                </p>
              ) : null}
              {phone ? (
                <p className="flex items-center gap-1.5 truncate">
                  <Phone className="size-3.5 shrink-0 text-brand" aria-hidden />
                  {phone}
                </p>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {memberSinceLabel} {memberSince} · {city}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {emailVerified && (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  <ShieldCheck className="mr-1 size-3" />
                  {verifiedLabel}
                </Badge>
              )}
              {phoneVerified && (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                  <Phone className="mr-1 size-3" />
                  {verifiedLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {!editing && (
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <LanguageSwitcher variant="compact" size="header" />
            <Button type="button" variant="outline" size="sm" onClick={onEdit} className="h-10 gap-1.5 px-4">
              <Pencil className="size-3.5" aria-hidden />
              {editLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileSection({
  title,
  icon: Icon,
  accent = "brand",
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "brand" | "rose" | "accent";
  className?: string;
  children: React.ReactNode;
}) {
  const iconStyles = {
    brand: "bg-brand-muted text-brand-dark ring-brand-light/30",
    rose: "bg-rose-50 text-rose-700 ring-rose-200/60",
    accent: "bg-accent-muted text-accent ring-accent-light/30",
  } as const;

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white via-white to-slate-50/80 p-4 shadow-sm sm:p-5 lg:p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl ring-1",
            iconStyles[accent],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <h3 className="font-display text-base font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  tags,
  emptyLabel,
  verified,
  verifiedLabel,
  highlight,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  tags?: string[];
  emptyLabel?: string;
  verified?: boolean;
  verifiedLabel?: string;
  highlight?: boolean;
  className?: string;
}) {
  const hasTags = tags && tags.length > 0;
  const displayValue = value || (hasTags ? undefined : emptyLabel ?? "—");
  const isEmpty = !value && !hasTags;

  return (
    <div
      className={cn(
        "group rounded-xl border p-3 transition-all sm:p-4 sm:hover:-translate-y-0.5 sm:hover:shadow-md",
        highlight
          ? "border-brand-light/40 bg-gradient-to-br from-brand-muted/80 to-white"
          : "border-slate-200/70 bg-white/90 hover:border-brand-light/30",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            highlight ? "bg-brand/10 text-brand-dark" : "bg-slate-100 text-slate-600 group-hover:bg-brand-muted group-hover:text-brand-dark",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
          <dd className="mt-1.5">
            {hasTags ? (
              <div className="flex flex-wrap gap-1.5">
                {tags!.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium leading-snug",
                    isEmpty ? "text-slate-400 italic" : "text-slate-800",
                    highlight && !isEmpty && "text-lg font-semibold text-brand-dark",
                  )}
                >
                  {displayValue}
                </span>
                {verified && value && verifiedLabel && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    {verifiedLabel}
                  </Badge>
                )}
              </div>
            )}
          </dd>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  name,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  hint?: string;
  name: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name} className="text-sm font-semibold text-slate-700">
        {label}
      </Label>
      {hint ? <p className="mb-1.5 text-xs text-slate-500">{hint}</p> : null}
      <Input id={name} name={name} className="mt-0.5" {...props} />
    </div>
  );
}
