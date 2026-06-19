import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import {
  DoctorEmptyState,
  DoctorListCard,
  formatDateTime,
} from "@/features/doctor/components/doctor-workspace-panels";
import { PrescriptionService } from "@/server/services/prescription.service";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { VerificationStatuses } from "@zindagi/shared";

export const metadata = { title: "Prescriptions | Doctor" };

export default async function DoctorPrescriptionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/prescriptions");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const prescriptions = await PrescriptionService.listForDoctor(session.user.id);

  return (
    <>
      <DoctorPageHeader
        eyebrow="Clinical"
        title="Prescriptions"
        description="Digital prescriptions you have issued to patients."
        actions={
          <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand-dark">
            {prescriptions.length} total
          </span>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {prescriptions.length === 0 ? (
          <DoctorEmptyState message="No prescriptions issued yet. Issue one from a consult request or after a video call." />
        ) : (
          <div className="divide-y divide-slate-100">
            {prescriptions.map((rx) => (
              <div key={rx.id} className="p-4 sm:p-5">
                <DoctorListCard
                  title={rx.patientName}
                  subtitle={`${rx.medicationCount} medication${rx.medicationCount === 1 ? "" : "s"}`}
                  meta={`Issued ${formatDateTime(rx.issuedAt)}`}
                  action={
                    <Button asChild variant="outline" size="sm" className="gap-1">
                      <a href={rx.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-3.5 w-3.5" />
                        View PDF
                      </a>
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        To issue a new prescription, open a consult from{" "}
        <Link href="/doctor/requests" className="font-medium text-brand-dark underline">
          Consult requests
        </Link>{" "}
        or{" "}
        <Link href="/doctor/sunday-consult" className="font-medium text-brand-dark underline">
          Sunday consult
        </Link>
        .
      </p>
    </>
  );
}
