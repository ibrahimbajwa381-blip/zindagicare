import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { forPanelViewer } from "@/server/lib/manager-access";
import { AdminPatientManageDetail } from "@/features/admin/components/admin-patient-manage-detail";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { getPatientDetail } from "@/server/services/admin-patient.service";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  try {
    const { id } = await params;
    const patient = await getPatientDetail(id);
    return { title: `${patient.name} — Patient management` };
  } catch {
    return { title: "Patient management" };
  }
}

export default async function AdminPatientDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/patients");

  const { id } = await params;
  let patient;
  try {
    patient = forPanelViewer(session.user.roles, await getPatientDetail(id));
  } catch {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/admin/patients">
            <ArrowLeft className="h-4 w-4" />
            Back to patients
          </Link>
        </Button>
        <p className="text-sm text-red-600">Patient not found.</p>
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Patient records"
        title={patient.name}
        description="Review clinical profile, care history, spending, and account controls."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/patients">
              <ArrowLeft className="h-4 w-4" />
              All patients
            </Link>
          </Button>
        }
      />
      <AdminPatientManageDetail initialPatient={patient} />
    </>
  );
}
