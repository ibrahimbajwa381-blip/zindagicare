import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { DoctorVerificationForm } from "@/features/auth/components/doctor-verification-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Doctor verification" };

type Props = { searchParams: Promise<{ submitted?: string }> };

export default async function DoctorVerificationPage({ searchParams }: Props) {
  const session = await auth();
  const { submitted } = await searchParams;

  if (!session?.user) redirect("/login?callbackUrl=/doctor/verification");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const status = session.user.doctorVerificationStatus;
  const isApproved = status === VerificationStatuses.APPROVED;

  if (isApproved) {
    redirect("/doctor/sunday-consult");
  }

  return (
    <PageShell variant="soft" spacing="default" narrow>
      <Card className="shadow-premium">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Doctor verification</CardTitle>
              <CardDescription>
                Submit PMDC, CNIC, and credentials. Your public profile goes live after admin
                approval.
              </CardDescription>
            </div>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent>
          {submitted === "1" || status === VerificationStatuses.PENDING ? (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Your application is under review. You will be notified once an admin approves your
              profile.
            </div>
          ) : status === VerificationStatuses.REJECTED ? (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Your previous application was rejected. Update your details and resubmit.
            </div>
          ) : null}
          <DoctorVerificationForm />
        </CardContent>
      </Card>
    </PageShell>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (status === VerificationStatuses.APPROVED) {
    return <Badge variant="default">Approved</Badge>;
  }
  if (status === VerificationStatuses.REJECTED) {
    return <Badge variant="outline">Rejected</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}
