import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppError } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/admin-page-header";
import { getHerbalistDetailForAdmin } from "@/server/services/admin-herbalist.service";
import { getNutritionistDetailForAdmin } from "@/server/services/admin-nutritionist.service";
import {
  ConsultProviderKinds,
  getConsultProviderAdminConfig,
  type ConsultProviderKind,
} from "@/features/admin/consult-providers/config";
import type { AdminConsultProviderDetail } from "@/features/admin/consult-providers/types";
import { ConsultProviderApplicationReview } from "@/features/admin/consult-providers/components/consult-provider-application-review";
import { ConsultProviderFinance } from "@/features/admin/consult-providers/components/consult-provider-finance";
import { ConsultProviderManageDetail } from "@/features/admin/consult-providers/components/consult-provider-manage-detail";
import { ConsultProviderQueue } from "@/features/admin/consult-providers/components/consult-provider-queue";
import { ConsultProvidersManagement } from "@/features/admin/consult-providers/components/consult-providers-management";

/**
 * Server page builders shared by the herbalist and nutritionist admin routes.
 * Route files only pick a kind; data loading and layout live here.
 */

const DETAIL_LOADERS: Record<
  ConsultProviderKind,
  (id: string) => Promise<AdminConsultProviderDetail>
> = {
  [ConsultProviderKinds.HERBALIST]: getHerbalistDetailForAdmin,
  [ConsultProviderKinds.NUTRITIONIST]: getNutritionistDetailForAdmin,
};

/** Deduped per request so metadata and page share one load. */
const loadDetail = cache((kind: ConsultProviderKind, id: string) => DETAIL_LOADERS[kind](id));

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Loads a provider for a detail page; unknown or malformed ids render the 404 page. */
async function loadProviderOr404(
  kind: ConsultProviderKind,
  id: string,
): Promise<AdminConsultProviderDetail> {
  if (!OBJECT_ID.test(id)) notFound();
  try {
    return await loadDetail(kind, id);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    throw error;
  }
}

async function providerName(kind: ConsultProviderKind, id: string): Promise<string | null> {
  if (!OBJECT_ID.test(id)) return null;
  try {
    return (await loadDetail(kind, id)).name;
  } catch {
    return null;
  }
}

export function consultProviderQueueMetadata(kind: ConsultProviderKind): Metadata {
  return { title: `${getConsultProviderAdminConfig(kind).labels.singular} verifications` };
}

export function consultProviderManageMetadata(kind: ConsultProviderKind): Metadata {
  return { title: `${getConsultProviderAdminConfig(kind).labels.singular} management` };
}

export async function consultProviderReviewMetadata(
  kind: ConsultProviderKind,
  id: string,
): Promise<Metadata> {
  const name = await providerName(kind, id);
  const { singular } = getConsultProviderAdminConfig(kind).labels;
  return { title: name ? `Review · ${name}` : `${singular} application review` };
}

export async function consultProviderManageDetailMetadata(
  kind: ConsultProviderKind,
  id: string,
): Promise<Metadata> {
  const name = await providerName(kind, id);
  const { singular } = getConsultProviderAdminConfig(kind).labels;
  return { title: name ? `${name} — ${singular} management` : `${singular} management` };
}

export function ConsultProviderQueuePage({ kind }: { kind: ConsultProviderKind }) {
  const { singular, pluralLower } = getConsultProviderAdminConfig(kind).labels;
  return (
    <>
      <AdminPageHeader
        eyebrow="Provider onboarding"
        title={`${singular} verifications`}
        description={`Review registration documents and credentials, verify specialties, then approve or reject. Only approved ${pluralLower} can be listed for video consultations.`}
      />
      <ConsultProviderQueue kind={kind} />
    </>
  );
}

export function ConsultProviderManagePage({ kind }: { kind: ConsultProviderKind }) {
  const { singular, singularLower } = getConsultProviderAdminConfig(kind).labels;
  return (
    <>
      <AdminPageHeader
        eyebrow="Provider network"
        title={`${singular} management`}
        description={`Manage your ${singularLower} directory — verification, listing, video consults, commission and accounts.`}
      />
      <ConsultProvidersManagement kind={kind} />
    </>
  );
}

export async function ConsultProviderReviewPage({
  kind,
  id,
}: {
  kind: ConsultProviderKind;
  id: string;
}) {
  const config = getConsultProviderAdminConfig(kind);
  const provider = await loadProviderOr404(kind, id);
  return (
    <>
      <AdminPageHeader
        eyebrow="Application review"
        title={provider.name}
        description="Review credentials and documents, verify specialties, then approve or reject."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={config.routes.queue}>Back to queue</Link>
          </Button>
        }
      />
      <ConsultProviderApplicationReview kind={kind} provider={provider} />
    </>
  );
}

export async function ConsultProviderManageDetailPage({
  kind,
  id,
}: {
  kind: ConsultProviderKind;
  id: string;
}) {
  const config = getConsultProviderAdminConfig(kind);
  const provider = await loadProviderOr404(kind, id);
  return (
    <>
      <AdminPageHeader
        eyebrow="Provider network"
        title={provider.name}
        description="Update account controls, commission and profile details, and settle earnings."
        actions={
          <Button variant="outline" asChild>
            <Link href={config.routes.manage}>
              <ArrowLeft className="h-4 w-4" />
              All {config.labels.pluralLower}
            </Link>
          </Button>
        }
      />
      <ConsultProviderManageDetail kind={kind} initialProvider={provider} />
      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Earnings &amp; payouts</h2>
        <ConsultProviderFinance kind={kind} providerId={provider.id} />
      </section>
    </>
  );
}
