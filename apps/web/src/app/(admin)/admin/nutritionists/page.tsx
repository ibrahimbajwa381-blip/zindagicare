import { ConsultProviderKinds } from "@/features/admin/consult-providers/config";
import {
  ConsultProviderQueuePage,
  consultProviderQueueMetadata,
} from "@/features/admin/consult-providers/pages";

const KIND = ConsultProviderKinds.NUTRITIONIST;

export const metadata = consultProviderQueueMetadata(KIND);

export default function AdminNutritionistVerificationsPage() {
  return <ConsultProviderQueuePage kind={KIND} />;
}
