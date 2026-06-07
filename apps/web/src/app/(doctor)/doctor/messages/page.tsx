import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { ChatApp } from "@/features/chat/components/chat-app";
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
    <PageShell variant="brand" spacing="default" flipBlur>
      <PageTitle
        eyebrow="Doctor workspace"
        title={t.chat.doctorPageTitle}
        description={t.chat.doctorPageDescription}
      />
      <div className="mt-6">
        <ChatApp
          currentUserId={session.user.id}
          isDoctorView
          initialParticipantId={patientId}
          copy={{
            title: t.chat.title,
            searchPlaceholder: t.chat.searchPlaceholder,
            emptyTitle: t.chat.emptyTitle,
            emptyDescription: t.chat.emptyDescription,
            newChatLabel: t.chat.newChatLabel,
            newChatTitle: t.chat.newChatTitle,
            newChatSearchPlaceholder: t.chat.doctorNewChatSearchPlaceholder,
            newChatEmpty: t.chat.doctorNewChatEmpty,
            selectChatTitle: t.chat.selectChatTitle,
            selectChatDescription: t.chat.doctorSelectChatDescription,
            messagePlaceholder: t.chat.messagePlaceholder,
            backLabel: t.chat.backLabel,
          }}
        />
      </div>
    </PageShell>
  );
}
