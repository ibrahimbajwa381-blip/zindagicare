import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { DoctorProfileEditForm } from "@/features/doctor/components/doctor-profile-edit-form";
import { getDoctorProfileForAdmin } from "@/server/services/doctor-profile.service";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  try {
    const { id } = await params;
    const profile = await getDoctorProfileForAdmin(id);
    return { title: `Edit ${profile.user.name} — Doctor profile` };
  } catch {
    return { title: "Edit doctor profile" };
  }
}

export default async function AdminDoctorProfileEditPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/doctors/manage");

  const { id } = await params;
  let profile;
  try {
    profile = await getDoctorProfileForAdmin(id);
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
        title={`Edit ${profile.user.name}`}
        description="Correct mistakes on this doctor’s public profile, credentials, fees, and availability."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/admin/doctors/manage/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to doctor
            </Link>
          </Button>
        }
      />
      <DoctorProfileEditForm
        profile={profile}
        apiEndpoint={`/api/v1/admin/doctors/${id}/manage`}
        successRedirect={`/admin/doctors/manage/${id}`}
        syncSession={false}
        allowCredentialEdit
        avatarUploadEndpoint={`/api/v1/admin/doctors/${id}/avatar`}
      />
    </>
  );
}
