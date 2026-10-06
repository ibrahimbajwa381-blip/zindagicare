import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@zindagi/shared";
import type { PortfolioChecklistItem } from "@/lib/physiotherapists/portfolio";
import { STAFF_PORTFOLIO_ROLES, type StaffPortfolioRole } from "./portfolio-roles";

export const PORTFOLIO_PATH = STAFF_PORTFOLIO_ROLES.physiotherapist.portfolioPath;

/** Where each checklist item is edited — the photo lives on the profile page. */
export function portfolioItemHref(
  id: PortfolioChecklistItem["id"],
  role: StaffPortfolioRole = "physiotherapist",
): string {
  const config = STAFF_PORTFOLIO_ROLES[role];
  return id === "photo" ? config.profilePath : `${config.portfolioPath}#portfolio-${id}`;
}

export function PortfolioProgressBar({ percent }: { percent: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">Portfolio strength</span>
        <span
          className={cn(
            "text-lg font-semibold",
            percent === 100 ? "text-emerald-700" : "text-brand-dark",
          )}
        >
          {percent}%
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Portfolio completeness"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            percent === 100 ? "bg-emerald-500" : "bg-brand",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

type ChecklistRow = { id: string; label: string; hint: string; done: boolean };

export function PortfolioChecklist<T extends ChecklistRow = PortfolioChecklistItem>({
  items,
  limit,
  showDone = true,
  itemHref,
}: {
  items: T[];
  /** Cap on rows shown (dashboard shows only the next few steps). */
  limit?: number;
  showDone?: boolean;
  /** Where each item is edited; defaults to the physiotherapist portfolio. */
  itemHref?: (id: T["id"]) => string;
}) {
  const visible = (showDone ? items : items.filter((i) => !i.done)).slice(0, limit);

  return (
    <ul className="space-y-1">
      {visible.map((item) => (
        <li key={item.id}>
          <Link
            href={itemHref ? itemHref(item.id) : portfolioItemHref(item.id as PortfolioChecklistItem["id"])}
            className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-slate-50"
          >
            {item.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand" />
            )}
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-sm",
                  item.done ? "text-slate-500 line-through decoration-slate-300" : "font-medium text-slate-800",
                )}
              >
                {item.label}
              </span>
              {!item.done && <span className="block text-xs text-slate-500">{item.hint}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
