import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { AdminDoctorQueue } from "@/features/auth/components/admin-doctor-queue";

export const metadata = { title: "Doctor verifications" };

export default function AdminDoctorsPage() {
  return (
    <PageShell variant="accent" spacing="default" narrow flipBlur>
      <PageTitle
        title="Pending doctor verifications"
        description="Approve doctors to publish their profile and enable consultations."
      />
      <div className="mt-8">
        <AdminDoctorQueue />
      </div>
    </PageShell>
  );
}
