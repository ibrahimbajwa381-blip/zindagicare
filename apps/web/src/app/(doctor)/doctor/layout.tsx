import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorProfileModel, UserModel, connectDatabase } from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";
import { DoctorShell } from "@/features/doctor/components/doctor-shell";
import { mongoFilter } from "@/lib/mongo/query";

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
  const [user, doctorProfile] = await Promise.all([
    UserModel.findById(session.user.id).select("name email avatarUrl").lean(),
    DoctorProfileModel.findOne(mongoFilter({ userId: session.user.id }))
      .select("slug verificationStatus")
      .lean(),
  ]);

  const verificationStatus =
    doctorProfile?.verificationStatus ?? session.user.doctorVerificationStatus;

  const showFullNav = verificationStatus === VerificationStatuses.APPROVED;

  return (
    <DoctorShell
      showFullNav={showFullNav}
      verificationStatus={verificationStatus}
      doctorSlug={doctorProfile?.slug}
      user={{
        name: user?.name ?? session.user.name,
        email: user?.email ?? session.user.email,
        avatarUrl: user?.avatarUrl,
      }}
    >
      {children}
    </DoctorShell>
  );
}
