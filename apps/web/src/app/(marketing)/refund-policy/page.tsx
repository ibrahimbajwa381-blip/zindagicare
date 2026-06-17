import { LegalDocumentPage } from "@/features/legal/components/legal-document-page";
import { getLegalDocument } from "@/features/legal/content";
import { getLegalRelatedLinks } from "@/features/legal/routes";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { locale } = await getServerTranslations();
  const document = getLegalDocument(locale, "refundPolicy");
  return {
    title: document.title,
    description: document.intro.slice(0, 160),
  };
}

export default async function RefundPolicyPage() {
  const { locale, t } = await getServerTranslations();
  const document = getLegalDocument(locale, "refundPolicy");

  return (
    <LegalDocumentPage
      document={document}
      backLabel={t.legal.backToHome}
      relatedLabel={t.legal.related}
      relatedLinks={getLegalRelatedLinks("refundPolicy", t.legal.pages)}
    />
  );
}
