import { ConsultProviderKinds } from "@/features/admin/consult-providers/config";
import {
  ConsultProviderReviewPage,
  consultProviderReviewMetadata,
} from "@/features/admin/consult-providers/pages";

const KIND = ConsultProviderKinds.HERBALIST;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  return consultProviderReviewMetadata(KIND, id);
}

export default async function AdminHerbalistReviewPage({ params }: Params) {
  const { id } = await params;
  return <ConsultProviderReviewPage kind={KIND} id={id} />;
}
