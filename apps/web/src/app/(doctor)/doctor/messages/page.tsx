import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorWorkspaceMessages } from "@/features/doctor/components/doctor-workspace-messages";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n";

export const metadata = { title: "Messages | Doctor" };

type PageProps = {
  searchParams: Promise<{ patient?: string }>;
};

export default async function DoctorMessagesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/doctor/messages");
  }
  if (!session.user.roles?.includes("doctor")) {
    redirect("/dashboard");
  }

  const { patient: patientId } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    // The chat is pinned between the sticky header (h-16 / sm:h-[4.75rem]) and the
    // fixed practice nav (below lg) or the viewport bottom, beside the lg sidebar,
    // so the composer is always on screen whatever breadcrumbs/banners sit above it.
    <div className="fixed inset-x-0 top-[calc(4rem+1px+env(safe-area-inset-top))] bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex flex-col overflow-hidden bg-white sm:top-[calc(4.75rem+1px+env(safe-area-inset-top))] lg:bottom-0 lg:left-[17.5rem]">
      <h1 className="sr-only">{t.chat.doctorPageTitle}</h1>
      <div className="min-h-0 flex-1">
        <DoctorWorkspaceMessages
          fillViewport
          currentUserId={session.user.id}
          initialParticipantId={patientId}
          copy={t.chat}
        />
      </div>
    </div>
  );
}
