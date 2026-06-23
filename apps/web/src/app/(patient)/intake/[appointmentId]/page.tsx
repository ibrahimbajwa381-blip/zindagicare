import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { IntakeForm } from "@/features/intake/components/intake-form";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n";

export const metadata = { title: "Medical history" };

type PageProps = {
  params: Promise<{ appointmentId: string }>;
};

export default async function IntakePage({ params }: PageProps) {
  const { appointmentId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/intake/${appointmentId}`);
  }

  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <PageShell
      variant="brand"
      spacing="default"
      flipBlur
      innerClassName="!max-w-3xl"
    >
      <PageTitle
        eyebrow={t.intake.pageTitle}
        title={t.intake.formTitle}
        description={t.intake.pageDescription}
        align="center"
        className="mx-auto"
      />
      <div className="mt-8 sm:mt-10">
        <IntakeForm appointmentId={appointmentId} />
      </div>
    </PageShell>
  );
}
