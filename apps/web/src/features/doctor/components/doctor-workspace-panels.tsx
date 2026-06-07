import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { surfaceCard } from "@/lib/ui/surfaces";

type Props = {
  title: string;
  description: string;
  count?: number;
};

export function DoctorWorkspaceHeader({ title, description, count }: Props) {
  return (
    <div className="mb-6 space-y-4">
      <Link
        href="/doctor/profile"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to workspace
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {typeof count === "number" && (
          <Badge variant="secondary">{count} active</Badge>
        )}
      </div>
    </div>
  );
}

export function DoctorEmptyState({ message }: { message: string }) {
  return (
    <div className={`p-8 text-center text-sm text-slate-500 ${surfaceCard}`}>
      {message}
    </div>
  );
}

export function DoctorListCard({
  title,
  subtitle,
  meta,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 p-4 ${surfaceCard}`}
    >
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{title}</p>
        {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
        {meta && <p className="mt-1 text-xs text-slate-500">{meta}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </div>
    </div>
  );
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(new Date(iso));
}

export { formatDateTime };
