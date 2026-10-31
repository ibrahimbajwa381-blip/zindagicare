import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { forPanelViewer } from "@/server/lib/manager-access";
import { isAdminPanelUser, AppError } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminPhysiotherapistApplicationReview } from "@/features/admin/components/admin-physiotherapist-application-review";
import { getPhysiotherapistProfileForAdmin } from "@/server/services/physiotherapist.service";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  try {
    const profile = await getPhysiotherapistProfileForAdmin(id);
    return {
      title: `Review · ${profile.user.name}`,
      description: "Review physiotherapist application, credentials, and visit history.",
    };
  } catch {
    return { title: "Physiotherapist application review" };
  }
}

export default async function AdminPhysiotherapistReviewPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/physiotherapists");
  if (!isAdminPanelUser(session.user.roles)) redirect("/dashboard");

  const { id } = await params;

  let profile;
  try {
    profile = forPanelViewer(session.user.roles, await getPhysiotherapistProfileForAdmin(id));
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Application review"
        title={profile.user.name}
        description="Review credentials and documents, record interview notes, then approve or reject."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/physiotherapists">Back to queue</Link>
          </Button>
        }
      />
      <AdminPhysiotherapistApplicationReview profile={profile} />
    </>
  );
}
