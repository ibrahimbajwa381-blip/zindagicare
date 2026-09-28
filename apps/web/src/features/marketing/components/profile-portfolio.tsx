import Image from "next/image";
import type { ReactNode } from "react";
import { BadgeCheck, type LucideIcon } from "lucide-react";
import { cn } from "@zindagi/shared";
import { surfaceCard } from "@/lib/ui/surfaces";

/**
 * Building blocks for the public doctor / physiotherapist portfolio pages. Both pages share
 * one visual language so a clinician's ZindagiCare profile doubles as a personal website.
 */

export type ProfileStat = { value: string; label: string };
export type ProfileMeta = { icon: LucideIcon; label: string };

function initials(name: string) {
  return name
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, "")
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfilePortrait({ name, src }: { name: string; src?: string }) {
  return (
    <div className="relative mx-auto w-44 shrink-0 sm:w-56 lg:mx-0 lg:w-64">
      {/* Offset frame + glow give the portrait depth against the gradient. */}
      <div
        aria-hidden
        className="absolute -inset-3 rotate-3 rounded-[2rem] border border-white/20 bg-white/5"
      />
      <div aria-hidden className="absolute -inset-6 rounded-full bg-brand-lighter/20 blur-3xl" />
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand-light to-accent shadow-2xl ring-4 ring-white/25">
        {src ? (
          <Image
            src={src}
            alt={name}
            fill
            className="object-cover object-top"
            sizes="(min-width: 1024px) 256px, (min-width: 640px) 224px, 176px"
            priority
            unoptimized
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-6xl font-semibold text-white/90">
            {initials(name)}
          </span>
        )}
      </div>
    </div>
  );
}

type HeroProps = {
  name: string;
  avatarUrl?: string;
  /** Short line above the name, e.g. "Cardiologist · Lahore". */
  eyebrow?: string;
  headline?: string;
  verifiedLabel?: string;
  credentials?: string[];
  meta?: ProfileMeta[];
  stats?: ProfileStat[];
  /** Primary + secondary CTAs. */
  actions?: ReactNode;
  /** Social / website links rendered under the CTAs. */
  links?: ReactNode;
};

export function ProfileHero({
  name,
  avatarUrl,
  eyebrow,
  headline,
  verifiedLabel,
  credentials = [],
  meta = [],
  stats = [],
  actions,
  links,
}: HeroProps) {
  return (
    <header className="relative isolate overflow-hidden rounded-3xl bg-hero-brand text-white shadow-premium">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.12] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
      />
      <div
        aria-hidden
        className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-brand-lighter/30 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-16 -z-10 h-80 w-80 rounded-full bg-accent-lighter/25 blur-3xl"
      />

      <div className="flex flex-col-reverse gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:gap-14 lg:px-14 lg:py-14">
        <div className="min-w-0 flex-1 text-center lg:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {verifiedLabel && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide ring-1 ring-white/25">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-300" />
                {verifiedLabel}
              </span>
            )}
            {eyebrow && (
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                {eyebrow}
              </span>
            )}
          </div>

          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            {name}
          </h1>

          {credentials.length > 0 && (
            <p className="mt-3 text-sm font-medium text-white/80">{credentials.join(" · ")}</p>
          )}

          {headline && (
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl lg:mx-0">
              {headline}
            </p>
          )}

          {meta.length > 0 && (
            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-white/85 lg:justify-start">
              {meta.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-brand-lighter" />
                  {label}
                </li>
              ))}
            </ul>
          )}

          {actions && (
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">{actions}</div>
          )}
          {links && <div className="mt-5 flex justify-center lg:justify-start">{links}</div>}
        </div>

        <ProfilePortrait name={name} src={avatarUrl} />
      </div>

      {stats.length > 0 && (
        <dl
          className={cn(
            "grid grid-cols-2 gap-px border-t border-white/15 bg-white/10",
            stats.length === 3 && "sm:grid-cols-3",
            stats.length >= 4 && "sm:grid-cols-4",
          )}
        >
          {stats.slice(0, 4).map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col-reverse gap-1 bg-black/20 px-5 py-5 text-center last:odd:col-span-2 sm:px-8 sm:last:odd:col-span-1 lg:text-left"
            >
              <dt className="text-xs font-medium uppercase tracking-wider text-white/65">
                {stat.label}
              </dt>
              <dd className="font-display text-2xl font-semibold tabular-nums sm:text-3xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}

/** White pill CTA for use on the dark hero / CTA band. */
export const heroPrimaryAction =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-brand-dark shadow-lg transition hover:bg-brand-muted active:scale-[0.98]";
export const heroSecondaryAction =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white ring-1 ring-white/35 transition hover:bg-white/10 active:scale-[0.98]";

export function PortfolioSection({
  id,
  icon: Icon,
  eyebrow,
  title,
  aside,
  children,
  className,
}: {
  id: string;
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-36 p-6 sm:p-8", surfaceCard, className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-accent text-white shadow-sm">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
                {eyebrow}
              </p>
            )}
            <h2 className="font-display text-xl font-semibold text-slate-900 sm:text-2xl">
              {title}
            </h2>
          </div>
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function PortfolioSubHeading({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</p>
  );
}

/** Label/value tiles for the "At a glance" block inside About. */
export function PortfolioFacts({ items }: { items: { icon: LucideIcon; label: string; value: string }[] }) {
  if (!items.length) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export function PortfolioQuote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-muted to-accent-muted/70 px-6 py-5">
      <span
        aria-hidden
        className="absolute -top-4 right-4 font-display text-8xl leading-none text-brand/15"
      >
        &rdquo;
      </span>
      <figcaption className="text-xs font-semibold uppercase tracking-wider text-brand-dark">
        {label}
      </figcaption>
      <blockquote className="relative mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
        {children}
      </blockquote>
    </figure>
  );
}

/** Closing call-to-action band at the bottom of a portfolio. */
export function ProfileClosingCta({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-banner-brand px-6 py-10 text-center text-white sm:px-10">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.1] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]"
      />
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>
    </section>
  );
}
