import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { EmergencyNotice } from "@/features/medical-qa/components/emergency-notice";
import { QuestionList } from "@/features/medical-qa/components/question-list";
import { getServerTranslations } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { MedicalQaService } from "@/server/services/medical-qa.service";

export const metadata: Metadata = buildPageMetadata({
  title: "Ask a Doctor Free — Medical Questions & Answers",
  description:
    "Ask a health question for free and get answers from verified doctors, nurses and physiotherapists on ZindagiCare.",
  path: "/questions",
});

export default async function QuestionsPage() {
  const { t } = await getServerTranslations();
  const qa = t.medicalQa;
  const first = await MedicalQaService.listQuestions(null, { filter: "all", limit: 20 }).catch(() => ({
    items: [],
    nextCursor: null,
    total: null,
  }));

  return (
    <PageSection variant="soft" spacing="default">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center gap-3">
          <Link
            href="/"
            aria-label={qa.back}
            className="-ms-2 rounded-full p-2 text-slate-900 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft className="h-6 w-6 rtl:rotate-180" aria-hidden />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-2xl font-bold text-slate-900 sm:text-3xl">{qa.forumTitle}</h1>
          <Link
            href="/questions/ask"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-dark to-brand px-5 py-2.5 text-base font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-5 w-5" aria-hidden />
            {qa.askShort}
          </Link>
        </header>
        <QuestionList initialItems={first.items} initialCursor={first.nextCursor} initialTotal={first.total} />
        <EmergencyNotice />
      </div>
    </PageSection>
  );
}
