import { ConsultProviderKinds } from "@/features/admin/consult-providers/config";
import {
  ConsultProviderQueuePage,
  consultProviderQueueMetadata,
} from "@/features/admin/consult-providers/pages";

const KIND = ConsultProviderKinds.HERBALIST;

export const metadata = consultProviderQueueMetadata(KIND);

export default function AdminHerbalistVerificationsPage() {
  return <ConsultProviderQueuePage kind={KIND} />;
}
