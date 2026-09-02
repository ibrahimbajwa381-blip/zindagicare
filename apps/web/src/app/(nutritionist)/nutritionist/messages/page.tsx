import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatApp } from "@/features/chat/components/chat-app";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n";

export const metadata = { title: "Messages | Nutritionist" };

type PageProps = {
  searchParams: Promise<{ patient?: string }>;
};

export default async function NutritionistMessagesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/nutritionist/messages");
  }
  if (!session.user.roles?.includes("nutritionist")) {
    redirect("/dashboard");
  }

  const { patient: patientId } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100svh-4rem-4.75rem+3rem)] flex-col overflow-hidden sm:-mx-6 sm:-my-8 sm:h-[calc(100svh-4rem-4.75rem+4rem)] lg:-mx-8 lg:-my-10 lg:h-[calc(100svh-4rem+5rem)]">
      <div className="shrink-0 border-b border-slate-200/80 bg-white/95 px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Communications
        </p>
        <h1 className="font-display text-lg font-semibold text-foreground sm:text-xl">
          {t.chat.doctorPageTitle}
        </h1>
      </div>
      <div className="min-h-0 flex-1">
        <ChatApp
          fillViewport
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
            openChatFailedTitle: t.chat.openChatFailedTitle,
            openingChatTitle: t.chat.openingChatTitle,
            openingChatDescription: t.chat.openingChatDescription,
          }}
        />
      </div>
    </div>
  );
}
