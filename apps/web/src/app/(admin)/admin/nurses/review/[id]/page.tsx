import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { forPanelViewer } from "@/server/lib/manager-access";
import { isAdminPanelUser, AppError } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminNurseApplicationReview } from "@/features/admin/components/admin-nurse-application-review";
import { getNurseProfileForAdmin } from "@/server/services/nurse.service";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  try {
    const profile = await getNurseProfileForAdmin(id);
    return {
      title: `Review · ${profile.user.name}`,
      description: "Review nurse application, credentials, and visit history.",
    };
  } catch {
    return { title: "Nurse application review" };
  }
}

export default async function AdminNurseReviewPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/nurses");
  if (!isAdminPanelUser(session.user.roles)) redirect("/dashboard");

  const { id } = await params;

  let profile;
  try {
    profile = forPanelViewer(session.user.roles, await getNurseProfileForAdmin(id));
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
            <Link href="/admin/nurses">Back to queue</Link>
          </Button>
        }
      />
      <AdminNurseApplicationReview profile={profile} />
    </>
  );
}
