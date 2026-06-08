import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin, AppError } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminDoctorApplicationReview } from "@/features/admin/components/admin-doctor-application-review";
import { getDoctorProfileForAdmin } from "@/server/services/doctor-profile.service";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  try {
    const profile = await getDoctorProfileForAdmin(id);
    return {
      title: `Review · ${profile.user.name}`,
      description: "Review doctor application, credentials, and documents before approval.",
    };
  } catch {
    return { title: "Doctor application review" };
  }
}

export default async function AdminDoctorReviewPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/doctors");
  if (!isAdmin(session.user.roles)) redirect("/dashboard");

  const { id } = await params;

  let profile;
  try {
    profile = await getDoctorProfileForAdmin(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Application review"
        title={profile.user.name}
        description="Review credentials and documents, complete your offline interview, then approve or reject."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/doctors">Back to queue</Link>
          </Button>
        }
      />
      <AdminDoctorApplicationReview profile={profile} />
    </>
  );
}
