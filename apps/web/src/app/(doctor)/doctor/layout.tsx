import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorProfileModel, connectDatabase } from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";
import { DoctorShell } from "@/features/doctor/components/doctor-shell";
import { mongoFilter } from "@/lib/mongo/query";
import { AppointmentReminderService } from "@/server/services/appointment-reminder.service";

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/profile");
  if (!session.user.roles?.includes("doctor")) {
    redirect("/dashboard");
  }

  await connectDatabase();
  const doctorProfile = await DoctorProfileModel.findOne(
    mongoFilter({ userId: session.user.id }),
  )
    .select("slug verificationStatus")
    .lean();

  const verificationStatus =
    doctorProfile?.verificationStatus ?? session.user.doctorVerificationStatus;

  const showFullNav = verificationStatus === VerificationStatuses.APPROVED;

  if (showFullNav) {
    void AppointmentReminderService.processDueReminders().catch(() => null);
  }

  return (
    <DoctorShell
      showFullNav={showFullNav}
      verificationStatus={verificationStatus}
      doctorSlug={doctorProfile?.slug}
    >
      {children}
    </DoctorShell>
  );
}
