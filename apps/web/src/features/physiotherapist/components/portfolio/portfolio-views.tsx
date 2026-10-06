import type { ReactNode } from "react";
import { Award, BadgeCheck, Check, ExternalLink, GraduationCap } from "lucide-react";
import { cn } from "@zindagi/shared";
import {
  formatExperienceYears,
  type PortfolioAward,
  type PortfolioCertification,
  type PortfolioEducation,
  type PortfolioExperience,
} from "@/lib/physiotherapists/portfolio";

/**
 * Read-only portfolio renderers — shared by the workspace editor (view mode) and the
 * public /physiotherapists/[slug] and /doctors/[slug] pages so clinicians see exactly what
 * patients see.
 */

export function PortfolioTagList({
  tags,
  variant = "default",
}: {
  tags: string[];
  /** `check` renders emphasised chips with a tick — for conditions treated. */
  variant?: "default" | "check";
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li
          key={tag}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium",
            variant === "check"
              ? "bg-brand-muted text-brand-dark ring-1 ring-brand-light/40"
              : "border border-slate-200 bg-white text-slate-700",
          )}
        >
          {variant === "check" && <Check className="h-3.5 w-3.5 text-brand" strokeWidth={3} />}
          {tag}
        </li>
      ))}
    </ul>
  );
}

export function PortfolioExperienceTimeline({ items }: { items: PortfolioExperience[] }) {
  return (
    <ol className="relative space-y-6">
      <span
        aria-hidden
        className="absolute bottom-2 left-[7px] top-2 w-0.5 rounded-full bg-gradient-to-b from-brand via-brand-light/50 to-slate-200"
      />
      {items.map((item, index) => {
        const years = formatExperienceYears(item);
        return (
          <li key={`${item.role}-${item.organization}-${index}`} className="relative pl-9">
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1 h-4 w-4 rounded-full border-[3px] border-white shadow ring-1",
                item.current ? "bg-emerald-500 ring-emerald-200" : "bg-brand ring-brand-light/50",
              )}
            />
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-5 py-4 transition-colors hover:border-brand-light/50 hover:bg-white">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.role}</p>
                  <p className="text-sm text-slate-600">
                    {[item.organization, item.city].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {(years || item.current) && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                      item.current ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-600 ring-1 ring-slate-200",
                    )}
                  >
                    {years || "Current"}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                  {item.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CredentialCard({
  icon: Icon,
  title,
  subtitle,
  year,
  tone = "brand",
  children,
}: {
  icon: typeof GraduationCap;
  title: string;
  subtitle?: string;
  year?: number;
  tone?: "brand" | "gold";
  children?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          tone === "gold"
            ? "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 ring-1 ring-amber-200"
            : "bg-gradient-to-br from-brand-muted to-accent-muted text-brand ring-1 ring-brand-light/30",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug text-slate-900">{title}</p>
        {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
        {children}
      </div>
      {year && (
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
          {year}
        </span>
      )}
    </li>
  );
}

export function PortfolioEducationList({ items }: { items: PortfolioEducation[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => (
        <CredentialCard
          key={`${item.degree}-${index}`}
          icon={GraduationCap}
          title={item.degree}
          subtitle={item.institute}
          year={item.year}
        />
      ))}
    </ul>
  );
}

export function PortfolioCertificationList({ items }: { items: PortfolioCertification[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => (
        <CredentialCard
          key={`${item.title}-${index}`}
          icon={BadgeCheck}
          title={item.title}
          subtitle={item.issuer}
          year={item.year}
        >
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              Verify certificate
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </CredentialCard>
      ))}
    </ul>
  );
}

export function PortfolioAwardList({ items }: { items: PortfolioAward[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => (
        <CredentialCard
          key={`${item.title}-${index}`}
          icon={Award}
          tone="gold"
          title={item.title}
          year={item.year}
        />
      ))}
    </ul>
  );
}
