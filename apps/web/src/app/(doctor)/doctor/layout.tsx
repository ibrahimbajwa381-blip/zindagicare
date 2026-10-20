import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorProfileModel, connectDatabase } from "@zindagi/database";
import { DOCTOR_ACCOUNTABILITY_CONFIG, VerificationStatuses } from "@zindagi/shared";
import { buildPrivateMetadata } from "@/lib/seo/metadata";
import {
  DoctorShell,
  type DoctorAccountabilityBanner,
} from "@/features/doctor/components/doctor-shell";
import { mongoFilter } from "@/lib/mongo/query";
import { AppointmentReminderService } from "@/server/services/appointment-reminder.service";

/** YYYY-MM bucket in Asia/Karachi — must match DoctorAccountabilityService. */
function currentMonthKeyKarachi(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DOCTOR_ACCOUNTABILITY_CONFIG.timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${year}-${month}`;
}

type AccountabilityCache = {
  currentMonthKey?: string;
  currentMonthMisses?: number;
  autoRestrictedAt?: Date | string;
  autoRestrictedMonthKey?: string;
};

function buildAccountabilityBanner(
  accountability: AccountabilityCache | undefined,
  verificationStatus?: string | null,
): DoctorAccountabilityBanner | null {
  const { warningThreshold, removalThreshold } = DOCTOR_ACCOUNTABILITY_CONFIG;
  const thisMonth = currentMonthKeyKarachi();

  // Doctor was auto-removed this month for missed consults.
  if (
    verificationStatus === VerificationStatuses.RESTRICTED &&
    accountability?.autoRestrictedAt &&
    accountability.autoRestrictedMonthKey === thisMonth
  ) {
    return {
      level: "danger",
      monthMisses: accountability.currentMonthMisses ?? removalThreshold,
      warningThreshold,
      removalThreshold,
    };
  }

  // Misses only count toward the banner if they happened in the current month.
  const monthMisses =
    accountability?.currentMonthKey === thisMonth
      ? (accountability.currentMonthMisses ?? 0)
      : 0;

  if (monthMisses <= 0) return null;

  return {
    level: monthMisses >= warningThreshold ? "warning" : "info",
    monthMisses,
    warningThreshold,
    removalThreshold,
  };
}

export const metadata = buildPrivateMetadata();

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
    .select("slug verificationStatus accountability communityJoinedAt")
    .populate("userId", "name avatarUrl")
    .lean();

  const doctorUser = doctorProfile?.userId as
    | { name?: string; avatarUrl?: string }
    | null
    | undefined;

  const verificationStatus =
    doctorProfile?.verificationStatus ?? session.user.doctorVerificationStatus;

  const showFullNav = verificationStatus === VerificationStatuses.APPROVED;

  if (showFullNav) {
    void AppointmentReminderService.processDueReminders().catch(() => null);
  }

  const accountabilityBanner = buildAccountabilityBanner(
    doctorProfile?.accountability as AccountabilityCache | undefined,
    verificationStatus,
  );

  return (
    <DoctorShell
      showFullNav={showFullNav}
      verificationStatus={verificationStatus}
      doctorSlug={doctorProfile?.slug}
      doctorName={doctorUser?.name ?? session.user.name ?? "Doctor"}
      doctorAvatarUrl={doctorUser?.avatarUrl}
      accountabilityBanner={accountabilityBanner}
      showCommunityInvite={Boolean(doctorProfile) && !doctorProfile?.communityJoinedAt}
    >
      {children}
    </DoctorShell>
  );
}
