import type { Metadata } from "next";
import {
  ConsultProviderProfilePage,
  consultProviderProfileMetadata,
} from "@/features/marketing/components/consult-provider-pages";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return consultProviderProfileMetadata("nutritionist", slug);
}

export default async function NutritionistProfilePage({ params }: PageProps) {
  const { slug } = await params;
  return <ConsultProviderProfilePage role="nutritionist" slug={slug} />;
}
