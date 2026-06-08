import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

export function TopDoctorsSectionSkeleton() {
  return (
    <PageSection variant="brand" spacing="lg" flipBlur aria-busy="true" aria-label="Loading doctors">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-6">
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-brand-light/40" />
          <div className="h-8 w-64 max-w-full animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100 sm:w-36" />
      </div>
      <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`h-48 animate-pulse rounded-xl bg-white/80 ${surfaceCardInteractive}`}
          />
        ))}
      </div>
    </PageSection>
  );
}
