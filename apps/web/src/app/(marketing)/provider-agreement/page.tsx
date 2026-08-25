import type { Metadata } from "next";
import { LegalDocumentPage } from "@/features/legal/components/legal-document-page";
import { getLegalDocument } from "@/features/legal/content";
import { getServerTranslations } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerTranslations();
  const document = getLegalDocument(locale, "providerAgreement");
  return buildPageMetadata({
    title: document.title,
    description: document.intro.slice(0, 160),
    path: "/provider-agreement",
  });
}

export default async function ProviderAgreementPage() {
  const { locale, t } = await getServerTranslations();
  const document = getLegalDocument(locale, "providerAgreement");

  return (
    <LegalDocumentPage
      document={document}
      backLabel={t.legal.backToHome}
      relatedLabel={t.legal.related}
    />
  );
}
