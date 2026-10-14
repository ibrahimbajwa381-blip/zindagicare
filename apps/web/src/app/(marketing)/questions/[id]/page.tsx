import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppError } from "@zindagi/shared";
import { PageSection } from "@/components/layout/page-section";
import { QuestionThread } from "@/features/medical-qa/components/question-thread";
import { auth } from "@/lib/auth";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { MedicalQaService } from "@/server/services/medical-qa.service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** One lookup per request, shared by generateMetadata and the page. */
const loadQuestion = cache(async (id: string) => {
  const session = await auth();
  const viewer = session?.user?.id ? { id: session.user.id, roles: session.user.roles ?? [] } : null;
  try {
    return await MedicalQaService.getQuestion(viewer, id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) return null;
    throw e;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const detail = await loadQuestion(id);
  if (!detail) return { title: "Question not found", robots: { index: false } };
  return buildPageMetadata({
    title: detail.question.title,
    description: detail.question.body.slice(0, 155),
    path: `/questions/${detail.question.id}`,
  });
}

export default async function QuestionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const detail = await loadQuestion(id);
  if (!detail) notFound();
  const { photos } = await searchParams;

  return (
    <PageSection variant="soft" spacing="default">
      <div className="mx-auto max-w-3xl">
        <QuestionThread key={detail.question.id} initial={detail} photosFailed={photos === "failed"} />
      </div>
    </PageSection>
  );
}
