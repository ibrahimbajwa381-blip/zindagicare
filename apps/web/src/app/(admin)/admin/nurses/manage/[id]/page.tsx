import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppError, isAdmin } from "@zindagi/shared";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { AdminNurseFinance } from "@/features/admin/components/admin-nurse-finance";
import { AdminNurseManageDetail } from "@/features/admin/components/admin-nurse-manage-detail";
import { getNurseProfileForAdmin } from "@/server/services/nurse.service";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params) {
  try {
    const { id } = await params;
    const profile = await getNurseProfileForAdmin(id);
    return { title: `${profile.user.name} — Nurse management` };
  } catch {
    return { title: "Nurse management" };
  }
}

export default async function AdminNurseManageDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/nurses/manage");
  if (!isAdmin(session.user.roles)) redirect("/dashboard");

  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();

  let profile;
  try {
    profile = await getNurseProfileForAdmin(id);
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 404) notFound();
    throw e;
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Provider network"
        title={profile.user.name}
        description="Review visits and earnings, update account controls, and correct profile details."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/nurses/manage">
              <ArrowLeft className="h-4 w-4" />
              All nurses
            </Link>
          </Button>
        }
      />
      <AdminNurseManageDetail initialProfile={profile} />
      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Earnings &amp; Sunday payouts</h2>
        <AdminNurseFinance staffProfileId={id} />
      </section>
    </>
  );
}
