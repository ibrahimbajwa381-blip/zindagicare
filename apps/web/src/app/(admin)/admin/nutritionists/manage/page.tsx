import { ConsultProviderKinds } from "@/features/admin/consult-providers/config";
import {
  ConsultProviderManagePage,
  consultProviderManageMetadata,
} from "@/features/admin/consult-providers/pages";

const KIND = ConsultProviderKinds.NUTRITIONIST;

export const metadata = consultProviderManageMetadata(KIND);

export default function AdminNutritionistsManagePage() {
  return <ConsultProviderManagePage kind={KIND} />;
}
