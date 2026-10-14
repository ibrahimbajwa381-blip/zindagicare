import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BadgeCheck, MessageCircleQuestion, PenLine } from "lucide-react";
import { cn } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getServerTranslations } from "@/i18n/server";
import { surfaceCard } from "@/lib/ui/surfaces";
import { MedicalQaService } from "@/server/services/medical-qa.service";
import { QuestionCard } from "./question-card";

/**
 * Home-page entry point for the free public Q&A: a clear "Ask a question"
 * call to action with three plain steps, beside the most recent questions.
 * The CTA renders immediately; only the recent list waits on the database.
 */
export async function HomeQaSection() {
  const { t } = await getServerTranslations();
  const qa = t.medicalQa;

  return (
    <PageSection id="ask-a-doctor" variant="brand" spacing="default">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-10">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-muted px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-dark [:where(html[lang=ur])_&]:normal-case [:where(html[lang=ur])_&]:tracking-normal">
            <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden />
            {qa.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {qa.homeTitle}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">{qa.homeDescription}</p>

          <ol className="mt-5 space-y-2.5">
            {qa.homeSteps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-sm text-slate-700 sm:text-[15px]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/questions/ask">
                <PenLine className="h-5 w-5" aria-hidden />
                {qa.askButton}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/questions">
                {qa.browseButton}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            {qa.providerOnlyNote}
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 [:where(html[lang=ur])_&]:normal-case">
            {qa.latestTitle}
          </h3>
          <Suspense fallback={<LatestSkeleton />}>
            <LatestQuestions emptyLabel={qa.noQuestions} />
          </Suspense>
        </div>
      </div>
    </PageSection>
  );
}

async function LatestQuestions({ emptyLabel }: { emptyLabel: string }) {
  let items: Awaited<ReturnType<typeof MedicalQaService.latestPublic>> = [];
  try {
    items = await MedicalQaService.latestPublic(3);
  } catch {
    // The CTA still works without the preview list.
  }

  if (items.length === 0) {
    return <p className={cn(surfaceCard, "p-6 text-sm text-slate-600")}>{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}
    </div>
  );
}

function LatestSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}
