import { redirect } from "next/navigation";
import type { Role } from "@zindagi/shared";
import { auth } from "@/lib/auth";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n";
import { DoctorWorkspaceMessages } from "@/features/doctor/components/doctor-workspace-messages";

type Props = {
  /** Portal role allowed on this page. */
  role: Role;
  /** This page's path, for the login redirect. */
  path: string;
  /** Patient to open straight away (`?patient=` deep link). */
  patientId?: string;
};

/** Patient chat for a provider portal (herbalist, nutritionist, nurse, physiotherapist). */
export async function ProviderMessagesPage({ role, path, patientId }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(path)}`);
  }
  if (!session.user.roles?.includes(role)) {
    redirect("/dashboard");
  }

  const t = getDictionary(await getLocale());

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
