import { ConsultProviderKinds } from "@/features/admin/consult-providers/config";
import {
  ConsultProviderManagePage,
  consultProviderManageMetadata,
} from "@/features/admin/consult-providers/pages";

const KIND = ConsultProviderKinds.HERBALIST;

export const metadata = consultProviderManageMetadata(KIND);

export default function AdminHerbalistsManagePage() {
  return <ConsultProviderManagePage kind={KIND} />;
}
