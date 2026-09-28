import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { PortfolioProgressBar } from "@/features/physiotherapist/components/portfolio/portfolio-progress";
import {
  PortfolioAwardList,
  PortfolioCertificationList,
  PortfolioEducationList,
  PortfolioExperienceTimeline,
  PortfolioTagList,
} from "@/features/physiotherapist/components/portfolio/portfolio-views";
import {
  portfolioChecklist,
  portfolioCompleteness,
  type PhysiotherapistPortfolio,
} from "@/lib/physiotherapists/portfolio";

type Props = {
  portfolio: PhysiotherapistPortfolio;
  avatarUrl?: string;
  /** Public profile URL, when the physio is approved and listed. */
  publicPath?: string | null;
};

function Block({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {empty ? <p className="text-sm text-slate-400">Not added yet</p> : children}
    </div>
  );
}

/**
 * Read-only view of a physiotherapist's public portfolio for admin review — rendered with
 * the same components as /physiotherapists/[slug], so admins see exactly what patients see.
 */
export function AdminPhysiotherapistPortfolioPanel({ portfolio, avatarUrl, publicPath }: Props) {
  const checklist = portfolioChecklist(portfolio, avatarUrl);
  const percent = portfolioCompleteness(checklist);
  const missing = checklist.filter((item) => !item.done);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="sm:w-64">
          <PortfolioProgressBar percent={percent} />
        </div>
        <div className="min-w-0 flex-1 text-sm text-slate-600">
          {missing.length ? (
            <p>
              <span className="font-medium text-slate-800">Missing:</span>{" "}
              {missing.map((item) => item.label).join(", ")}
            </p>
          ) : (
            <p className="font-medium text-emerald-700">Portfolio complete</p>
          )}
          {portfolio.updatedAt && (
            <p className="mt-0.5 text-xs text-slate-400">
              Last updated by physiotherapist{" "}
              {new Date(portfolio.updatedAt).toLocaleString("en-PK", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
        {publicPath && (
          <a
            href={publicPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            View public profile
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <Block title="About" empty={!portfolio.headline && !portfolio.bio}>
        {portfolio.headline && (
          <p className="text-sm font-semibold text-slate-900">{portfolio.headline}</p>
        )}
        {portfolio.bio && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
            {portfolio.bio}
          </p>
        )}
        {portfolio.languages.length > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Languages:</span>{" "}
            {portfolio.languages.join(", ")}
          </p>
        )}
      </Block>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Conditions treated" empty={!portfolio.conditionsTreated.length}>
          <PortfolioTagList tags={portfolio.conditionsTreated} />
        </Block>
        <Block title="Techniques" empty={!portfolio.techniques.length}>
          <PortfolioTagList tags={portfolio.techniques} />
        </Block>
        <Block title="Work experience" empty={!portfolio.experience.length}>
          <PortfolioExperienceTimeline items={portfolio.experience} />
        </Block>
        <Block title="Education" empty={!portfolio.education.length}>
          <PortfolioEducationList items={portfolio.education} />
        </Block>
        <Block title="Certifications & training" empty={!portfolio.certifications.length}>
          <PortfolioCertificationList items={portfolio.certifications} />
        </Block>
        <Block
          title="Awards & memberships"
          empty={!portfolio.awards.length && !portfolio.memberships.length}
        >
          <div className="space-y-3">
            {portfolio.awards.length > 0 && <PortfolioAwardList items={portfolio.awards} />}
            {portfolio.memberships.length > 0 && <PortfolioTagList tags={portfolio.memberships} />}
          </div>
        </Block>
      </div>

    </div>
  );
}
