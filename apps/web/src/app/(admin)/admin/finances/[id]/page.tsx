import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminDoctorFinanceDetail } from "@/features/admin/components/admin-doctor-finance-detail";
import { Button } from "@/components/ui/button";

type Params = { params: Promise<{ id: string }> };

export const metadata = { title: "Doctor finance details" };

export default async function AdminDoctorFinancePage({ params }: Params) {
  const { id } = await params;

  return (
    <>
      <AdminPageHeader
        eyebrow="Finances"
        title="Doctor finance details"
        description="Earnings breakdown, appointment-by-appointment payout eligibility, bank account, and payout history."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/finances">
              <ArrowLeft className="h-4 w-4" />
              All doctors
            </Link>
          </Button>
        }
      />
      <AdminDoctorFinanceDetail doctorProfileId={id} />
    </>
  );
}
