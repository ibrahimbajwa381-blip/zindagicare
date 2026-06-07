import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { ChatApp } from "@/features/chat/components/chat-app";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n";

export const metadata = { title: "Messages" };

type PageProps = {
  searchParams: Promise<{ doctor?: string }>;
};

export default async function PatientMessagesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/messages");
  }

  const { doctor: doctorId } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <PageShell variant="brand" spacing="default" flipBlur>
      <PageTitle
        eyebrow={t.dashboard.nav.messages}
        title={t.chat.pageTitle}
        description={t.chat.pageDescription}
      />
      <div className="mt-6">
        <ChatApp
          currentUserId={session.user.id}
          initialParticipantId={doctorId}
          copy={{
            title: t.chat.title,
            searchPlaceholder: t.chat.searchPlaceholder,
            emptyTitle: t.chat.emptyTitle,
            emptyDescription: t.chat.emptyDescription,
            newChatLabel: t.chat.newChatLabel,
            newChatTitle: t.chat.newChatTitle,
            newChatSearchPlaceholder: t.chat.newChatSearchPlaceholder,
            newChatEmpty: t.chat.newChatEmpty,
            selectChatTitle: t.chat.selectChatTitle,
            selectChatDescription: t.chat.selectChatDescription,
            messagePlaceholder: t.chat.messagePlaceholder,
            backLabel: t.chat.backLabel,
          }}
        />
      </div>
    </PageShell>
  );
}
