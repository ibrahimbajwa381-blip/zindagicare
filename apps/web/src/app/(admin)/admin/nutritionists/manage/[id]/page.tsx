import { ConsultProviderKinds } from "@/features/admin/consult-providers/config";
import {
  ConsultProviderManageDetailPage,
  consultProviderManageDetailMetadata,
} from "@/features/admin/consult-providers/pages";

const KIND = ConsultProviderKinds.NUTRITIONIST;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  return consultProviderManageDetailMetadata(KIND, id);
}

export default async function AdminNutritionistManageDetailPage({ params }: Params) {
  const { id } = await params;
  return <ConsultProviderManageDetailPage kind={KIND} id={id} />;
}
