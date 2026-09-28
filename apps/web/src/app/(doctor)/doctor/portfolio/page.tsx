import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorPortfolioEditor } from "@/features/doctor/components/portfolio/doctor-portfolio-editor";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";

export const metadata = { title: "My portfolio | Doctor" };

export default async function DoctorPortfolioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/portfolio");
  if (!session.user.roles?.includes(Roles.DOCTOR)) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  const isApproved = profile.verificationStatus === VerificationStatuses.APPROVED;
  if (!profile.verificationSubmittedAt && !isApproved) {
    redirect("/doctor/verification");
  }

  const publicPath =
    isApproved && profile.isListed ? doctorProfilePath(profile.slug, profile.id) : null;
  const specialties = [
    ...new Set(
      [profile.primarySpecialty, ...profile.specialties, ...profile.additionalSpecialties].filter(
        (s): s is string => Boolean(s),
      ),
    ),
  ];

  return (
    <>
      <DoctorPageHeader
        eyebrow="Portfolio"
        title="My portfolio"
        description="Your public profile is your personal website on ZindagiCare. Add your services, experience, training and an intro video so patients can choose you with confidence."
      />
      <DoctorPortfolioEditor
        initialPortfolio={profile.portfolio}
        context={{
          avatarUrl: profile.user.avatarUrl,
          hospitalCount: profile.hospitals.length,
          weeklySlotCount: profile.weeklyAvailability.length,
        }}
        doctorName={profile.user.name}
        specialties={specialties}
        hospitals={profile.hospitals}
        publicPath={publicPath}
      />
    </>
  );
}
