import { HomeVisitStatuses } from "@zindagi/shared";
import { cn } from "@zindagi/shared";
import { Check } from "lucide-react";

const STEPS = [
  HomeVisitStatuses.REQUESTED,
  HomeVisitStatuses.ASSIGNED,
  HomeVisitStatuses.EN_ROUTE,
  HomeVisitStatuses.ARRIVED,
  HomeVisitStatuses.COMPLETED,
] as const;

const LABELS: Record<string, string> = {
  requested: "Requested",
  assigned: "Assigned",
  en_route: "En route",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

type Props = {
  status: string;
  compact?: boolean;
};

export function VisitStatusStepper({ status, compact }: Props) {
  if (status === HomeVisitStatuses.CANCELLED) {
    return (
      <p className="text-sm font-medium text-red-600">
        {LABELS.cancelled}
      </p>
    );
  }

  const currentIdx = STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <ol
      className={cn(
        "flex flex-wrap gap-2",
        compact ? "gap-1.5" : "gap-3 sm:gap-4",
      )}
    >
      {STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
              done
                ? "border-brand/30 bg-brand-muted/60 text-brand-dark"
                : "border-slate-200 bg-white/80 text-slate-400",
              active && "ring-2 ring-brand/20",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                done ? "bg-brand text-white" : "bg-slate-200 text-slate-500",
              )}
            >
              {done ? <Check className="h-2.5 w-2.5" /> : idx + 1}
            </span>
            {LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}
