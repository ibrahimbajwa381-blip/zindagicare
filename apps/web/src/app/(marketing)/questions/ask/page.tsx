import type { Metadata } from "next";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { AskQuestionForm } from "@/features/medical-qa/components/ask-question-form";
import { getServerTranslations } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Ask a Health Question",
  description: "Ask verified doctors, nurses and physiotherapists a health question for free.",
  path: "/questions/ask",
  noIndex: true,
});

export default async function AskQuestionPage() {
  const { t } = await getServerTranslations();
  const f = t.medicalQa.form;

  return (
    <PageSection variant="soft" spacing="default">
      <div className="mx-auto max-w-2xl space-y-6">
        <SectionHeader eyebrow={t.medicalQa.eyebrow} title={f.title} description={f.description} />
        <AskQuestionForm />
      </div>
    </PageSection>
  );
}
