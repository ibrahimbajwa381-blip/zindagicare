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
    <div className="-mx-4 flex h-[calc(100svh-4rem-4.75rem)] flex-col overflow-hidden sm:-mx-6 lg:-mx-8 lg:h-[calc(100svh-4rem)]">
      <div className="shrink-0 border-b border-slate-200/80 bg-white/95 px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Communications
        </p>
        <h1 className="font-display text-lg font-semibold text-foreground sm:text-xl">
          {t.chat.doctorPageTitle}
        </h1>
      </div>
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
