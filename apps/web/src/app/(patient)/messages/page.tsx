import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-br from-brand-muted/40 via-white to-accent-muted/30">
      <h1 className="sr-only">{t.chat.pageTitle}</h1>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatApp
          fillViewport
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
            openChatFailedTitle: t.chat.openChatFailedTitle,
            openingChatTitle: t.chat.openingChatTitle,
            openingChatDescription: t.chat.openingChatDescription,
          }}
        />
      </div>
    </div>
  );
}
