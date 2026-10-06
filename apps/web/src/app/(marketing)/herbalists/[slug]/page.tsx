import type { Metadata } from "next";
import {
  ConsultProviderProfilePage,
  consultProviderProfileMetadata,
} from "@/features/marketing/components/consult-provider-pages";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return consultProviderProfileMetadata("herbalist", slug);
}

export default async function HerbalistProfilePage({ params }: PageProps) {
  const { slug } = await params;
  return <ConsultProviderProfilePage role="herbalist" slug={slug} />;
}
