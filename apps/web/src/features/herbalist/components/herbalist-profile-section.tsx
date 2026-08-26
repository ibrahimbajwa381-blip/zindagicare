import Link from "next/link";
import { AlertCircle, Clock3, ShieldCheck } from "lucide-react";
import { VerificationStatuses } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { HerbalistProfileOverview } from "@/features/herbalist/components/herbalist-profile-overview";
import type { HerbalistProfileDto } from "@/server/services/herbalist-profile.service";

function StatusBanner({ profile }: { profile: HerbalistProfileDto }) {
  const status = profile.verification.status;

  if (status === VerificationStatuses.APPROVED) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">
            Your herbalist profile is verified
          </p>
          <p className="mt-0.5 text-sm text-emerald-800">
            Patients can book video consultations with you.
          </p>
        </div>
      </div>
    );
  }

  if (status === VerificationStatuses.REJECTED) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-900">
            Application rejected
          </p>
          <p className="mt-0.5 text-sm text-red-800">
            {profile.verification.rejectionReason ??
              "Please review your details and resubmit."}
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/herbalist/verification">Resubmit application</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === VerificationStatuses.RESTRICTED) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
        <div>
          <p className="text-sm font-semibold text-orange-900">
            Account restricted
          </p>
          <p className="mt-0.5 text-sm text-orange-800">
            {profile.verification.rejectionReason ??
              "Contact the ZindagiCare admin team to restore your account."}
          </p>
        </div>
      </div>
    );
  }

  if (!profile.verification.submittedAt) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Finish your verification
          </p>
          <p className="mt-0.5 text-sm text-amber-800">
            Submit your credentials and documents to go live on ZindagiCare.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/herbalist/verification">Start verification</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
      <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="text-sm font-semibold text-amber-900">
          Application under review
        </p>
        <p className="mt-0.5 text-sm text-amber-800">
          We are reviewing your credentials. You will be notified once an admin
          approves your profile.
        </p>
      </div>
    </div>
  );
}

export function HerbalistProfileSection({
  profile,
}: {
  profile: HerbalistProfileDto;
}) {
  return (
    <div className="space-y-6">
      <StatusBanner profile={profile} />
      <HerbalistProfileOverview profile={profile} />
    </div>
  );
}
