import { SundayBanner } from "@/features/marketing/components/sunday-banner";
import { SundayConsultClient } from "@/features/sunday-consult/components/sunday-consult-client";

export const metadata = {
  title: "Sunday Free Consult",
  description:
    "Book a free 10-minute video consultation with PMDC-verified doctors every Sunday on ZindagiCare. No fee, online from home, one slot per doctor per week.",
};

export default function SundayConsultPage() {
  return (
    <>
      <SundayBanner />
      <SundayConsultClient />
    </>
  );
}
