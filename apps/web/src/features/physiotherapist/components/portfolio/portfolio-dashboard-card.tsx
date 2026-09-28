import Link from "next/link";
import { ExternalLink, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhysiotherapistAvatar } from "@/features/physiotherapist/components/physiotherapist-avatar";
import {
  portfolioChecklist,
  portfolioCompleteness,
  type PhysiotherapistPortfolio,
} from "@/lib/physiotherapists/portfolio";
import { PORTFOLIO_PATH, PortfolioChecklist, PortfolioProgressBar } from "./portfolio-progress";

type Props = {
  name: string;
  avatarUrl?: string;
  specialties: string[];
  portfolio: PhysiotherapistPortfolio;
  publicPath: string | null;
};

/** Overview-page summary: a mini preview of the public profile plus the next steps to finish it. */
export function PortfolioDashboardCard({ name, avatarUrl, specialties, portfolio, publicPath }: Props) {
  const checklist = portfolioChecklist(portfolio, avatarUrl);
  const percent = portfolioCompleteness(checklist);
  const complete = percent === 100;

  const highlights = [
    { value: portfolio.experience.length, label: "positions" },
    { value: portfolio.certifications.length, label: "certifications" },
    { value: portfolio.conditionsTreated.length, label: "conditions" },
    { value: portfolio.education.length, label: "degrees" },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-6 p-0 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="bg-gradient-to-br from-brand-muted/70 via-white to-accent-muted/30 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            Your public portfolio
          </p>
          <div className="mt-4 flex items-start gap-4">
            <PhysiotherapistAvatar name={name} avatarUrl={avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-slate-900">{name}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                {portfolio.headline ??
                  (specialties.length ? specialties.join(" · ") : "Add a headline that sums up your practice.")}
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
            {highlights.map((h) => (
              <div key={h.label} className="rounded-xl bg-white/80 px-1 py-2 shadow-sm">
                <dt className="sr-only">{h.label}</dt>
                <dd className="text-base font-semibold text-slate-900">{h.value}</dd>
                <dd className="text-[11px] leading-tight text-slate-500">{h.label}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={PORTFOLIO_PATH}>
                <Pencil className="h-4 w-4" />
                Edit portfolio
              </Link>
            </Button>
            {publicPath && (
              <Button asChild size="sm" variant="outline">
                <Link href={publicPath} target="_blank">
                  <ExternalLink className="h-4 w-4" />
                  View live
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5 pt-0 sm:p-6 md:pl-0">
          <PortfolioProgressBar percent={percent} />
          {complete ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Your portfolio is complete. Keep it fresh — add new courses and photos as your
                practice grows.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Next steps
              </p>
              <PortfolioChecklist items={checklist} showDone={false} limit={3} />
            </div>
          )}
          {!publicPath && (
            <p className="text-xs text-slate-500">
              Goes live on your public profile after your application is approved.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
