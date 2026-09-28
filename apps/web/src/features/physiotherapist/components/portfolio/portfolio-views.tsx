import { Award, BadgeCheck, Briefcase, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatExperienceYears,
  type PortfolioAward,
  type PortfolioCertification,
  type PortfolioEducation,
  type PortfolioExperience,
} from "@/lib/physiotherapists/portfolio";

/**
 * Read-only portfolio renderers — shared by the workspace editor (view mode) and the
 * public /physiotherapists/[slug] page so physios see exactly what patients see.
 */

export function PortfolioTagList({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="border-slate-200 bg-white/80 text-slate-700">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

export function PortfolioExperienceTimeline({ items }: { items: PortfolioExperience[] }) {
  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-6">
      {items.map((item, index) => {
        const years = formatExperienceYears(item);
        return (
          <li key={`${item.role}-${item.organization}-${index}`} className="relative">
            <span className="absolute -left-[33px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-muted text-brand shadow-sm">
              <Briefcase className="h-2.5 w-2.5" />
            </span>
            <p className="text-sm font-semibold text-slate-900">{item.role}</p>
            <p className="text-sm text-slate-700">
              {[item.organization, item.city].filter(Boolean).join(", ")}
            </p>
            {(years || item.current) && (
              <p className="mt-0.5 text-xs text-slate-500">
                {years}
                {item.current && (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                    Current
                  </span>
                )}
              </p>
            )}
            {item.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {item.description}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function IconRow({
  icon: Icon,
  title,
  subtitle,
  year,
}: {
  icon: typeof GraduationCap;
  title: string;
  subtitle?: string;
  year?: number;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
      {year && <span className="shrink-0 text-xs font-medium text-slate-500">{year}</span>}
    </li>
  );
}

export function PortfolioEducationList({ items }: { items: PortfolioEducation[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <IconRow
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
    <ul className="space-y-3">
      {items.map((item, index) => (
        <IconRow
          key={`${item.title}-${index}`}
          icon={BadgeCheck}
          title={item.title}
          subtitle={item.issuer}
          year={item.year}
        />
      ))}
    </ul>
  );
}

export function PortfolioAwardList({ items }: { items: PortfolioAward[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <IconRow key={`${item.title}-${index}`} icon={Award} title={item.title} year={item.year} />
      ))}
    </ul>
  );
}
