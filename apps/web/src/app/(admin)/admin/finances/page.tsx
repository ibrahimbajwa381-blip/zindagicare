import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminFinancesPanel } from "@/features/admin/components/admin-finances-panel";

export const metadata = { title: "Finances | Admin" };

export default function AdminFinancesPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Revenue"
        title="Finances"
        description="Manage platform commission rates for online consultations, in-house visits, and nurse home care. Override rates per doctor when needed."
      />
      <AdminFinancesPanel />
    </>
  );
}
