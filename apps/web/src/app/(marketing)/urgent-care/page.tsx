import { UrgentConsultClient } from "@/features/urgent-consult/components/urgent-consult-client";

export const metadata = {
  title: "Urgent Care — Call in 10 Minutes",
  description:
    "Need a doctor now? Share your WhatsApp number on ZindagiCare and a PMDC-verified doctor will call you within 5–10 minutes.",
};

export default function UrgentCarePage() {
  return <UrgentConsultClient />;
}
