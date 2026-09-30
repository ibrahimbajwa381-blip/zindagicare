import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@zindagi/shared";
import { auth } from "@/lib/auth";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminHomeVisitsBoard } from "@/features/home-care/components/admin-home-visits-board";
import { adminHomeVisitProviderBySlug } from "@/features/home-care/lib/admin-home-visit-providers";

type Props = {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ visitId?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { provider: slug } = await params;
  const provider = adminHomeVisitProviderBySlug(slug);
  if (!provider) return { title: "Home visits" };
  return { title: provider.pageTitle, description: provider.pageDescription };
}

export default async function AdminProviderHomeVisitsPage({ params, searchParams }: Props) {
  const { provider: slug } = await params;
  const provider = adminHomeVisitProviderBySlug(slug);
  if (!provider) notFound();

  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(provider.href)}`);
  if (!isAdmin(session.user.roles)) redirect("/dashboard");

  const { visitId } = await searchParams;

  return (
    <>
      <AdminPageHeader
        eyebrow="Home visits"
        title={provider.pageTitle}
        description={provider.pageDescription}
      />
      <AdminHomeVisitsBoard
        key={provider.kind}
        provider={provider.kind}
        focusVisitId={typeof visitId === "string" ? visitId : undefined}
      />
    </>
  );
}
