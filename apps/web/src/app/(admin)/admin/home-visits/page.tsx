import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminHomeVisitsBoard } from "@/features/home-care/components/admin-home-visits-board";

export const metadata = {
  title: "Home care dispatch",
  description: "Assign nurses and doctors to in-house medical visits in Lahore.",
};

export default function AdminHomeVisitsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Home treatment"
        title="Home care dispatch"
        description="Assign nurses or doctors to home treatment requests. Matching uses staff availability and nearest location to the patient."
      />
      <AdminHomeVisitsBoard />
    </>
  );
}
