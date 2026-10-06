import type { Metadata } from "next";
import {
  ConsultProviderDirectoryPage,
  consultProviderDirectoryMetadata,
  type DirectorySearchParams,
} from "@/features/marketing/components/consult-provider-pages";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: DirectorySearchParams };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return consultProviderDirectoryMetadata("herbalist", searchParams);
}

export default function HerbalistsPage({ searchParams }: PageProps) {
  return <ConsultProviderDirectoryPage role="herbalist" searchParams={searchParams} />;
}
