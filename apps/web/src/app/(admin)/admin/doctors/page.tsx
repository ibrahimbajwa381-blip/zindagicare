import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminDoctorQueue } from "@/features/auth/components/admin-doctor-queue";

export const metadata = { title: "Doctor verifications" };

export default function AdminDoctorsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Provider onboarding"
        title="Doctor verifications"
        description="Review submitted applications, open each doctor's full profile and documents, conduct interviews offline, then approve or reject."
      />
      <AdminDoctorQueue />
    </>
  );
}
