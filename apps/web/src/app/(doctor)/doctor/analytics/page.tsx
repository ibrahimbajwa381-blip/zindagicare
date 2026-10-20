import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses } from "@zindagi/shared";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorProfileAnalyticsPanel } from "@/features/doctor/components/doctor-profile-analytics-panel";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import {
  getDoctorProfileAnalytics,
  parseAnalyticsRange,
} from "@/server/services/doctor-profile-analytics.service";

export const metadata = { title: "Profile analytics | Doctor" };

type PageProps = {
  searchParams: Promise<{ range?: string }>;
};

export default async function DoctorAnalyticsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/analytics");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const { range } = await searchParams;
  const analytics = await getDoctorProfileAnalytics(session.user.id, parseAnalyticsRange(range));

  return (
    <>
      <DoctorPageHeader
        eyebrow="Analytics"
        title="Profile analytics"
        description="See how many people visit your public profile, where they come from, and how many go on to book a consultation."
      />
      <DoctorProfileAnalyticsPanel data={analytics} />
    </>
  );
}
