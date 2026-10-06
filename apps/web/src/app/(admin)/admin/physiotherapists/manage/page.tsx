import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminPhysiotherapistsManagement } from "@/features/admin/components/admin-physiotherapists-management";

export const metadata = { title: "Physiotherapist management" };

export default function AdminPhysiotherapistsManagePage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Provider network"
        title="Physiotherapist management"
        description="Manage your physiotherapist directory — profiles, availability, home visits, commission, and accounts."
      />
      <AdminPhysiotherapistsManagement />
    </>
  );
}
