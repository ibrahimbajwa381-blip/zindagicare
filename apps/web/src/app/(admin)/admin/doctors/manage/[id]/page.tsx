import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminDoctorManageDetail } from "@/features/admin/components/admin-doctor-manage-detail";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { getDoctorDetailForAdmin } from "@/server/services/admin-doctor.service";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  try {
    const { id } = await params;
    const doctor = await getDoctorDetailForAdmin(id);
    return { title: `${doctor.name} — Doctor management` };
  } catch {
    return { title: "Doctor management" };
  }
}

export default async function AdminDoctorManageDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/doctors/manage");

  const { id } = await params;
  let doctor;
  try {
    doctor = await getDoctorDetailForAdmin(id);
  } catch {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/admin/doctors/manage">
            <ArrowLeft className="h-4 w-4" />
            Back to doctors
          </Link>
        </Button>
        <p className="text-sm text-red-600">Doctor not found.</p>
      </div>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Provider network"
        title={doctor.name}
        description="Review performance, earnings, and account controls for this doctor."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/doctors/manage">
              <ArrowLeft className="h-4 w-4" />
              All doctors
            </Link>
          </Button>
        }
      />
      <AdminDoctorManageDetail initialDoctor={doctor} />
    </>
  );
}
