import type { Metadata } from "next";
import {
  ConsultProviderDirectoryPage,
  consultProviderDirectoryMetadata,
  type DirectorySearchParams,
} from "@/features/marketing/components/consult-provider-pages";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: DirectorySearchParams };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return consultProviderDirectoryMetadata("nutritionist", searchParams);
}

export default function NutritionistsPage({ searchParams }: PageProps) {
  return <ConsultProviderDirectoryPage role="nutritionist" searchParams={searchParams} />;
}
