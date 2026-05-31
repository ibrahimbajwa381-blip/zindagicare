import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { DoctorSundayDashboard } from "@/features/sunday-consult/components/doctor-sunday-dashboard";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { VerificationStatuses } from "@zindagi/shared";

export const metadata = { title: "Sunday Consult | Doctor" };

export default async function DoctorSundayPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/sunday-consult");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  return (
    <PageShell variant="brand" spacing="default" narrow flipBlur>
      <div className="mb-6">
        <Link
          href="/doctor/profile"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to workspace
        </Link>
      </div>
      <DoctorSundayDashboard />
    </PageShell>
  );
}
