import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
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
    <>
      <DoctorPageHeader
        eyebrow="Communications"
        title={t.chat.doctorPageTitle}
        description={t.chat.doctorPageDescription}
      />
      <DoctorWorkspaceMessages
        currentUserId={session.user.id}
        initialParticipantId={patientId}
        copy={t.chat}
      />
    </>
  );
}
