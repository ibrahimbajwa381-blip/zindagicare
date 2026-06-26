import type { Metadata } from "next";
import { LegalDocumentPage } from "@/features/legal/components/legal-document-page";
import { getLegalDocument } from "@/features/legal/content";
import { getLegalRelatedLinks } from "@/features/legal/routes";
import { getServerTranslations } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerTranslations();
  const document = getLegalDocument(locale, "privacy");
  return buildPageMetadata({
    title: document.title,
    description: document.intro.slice(0, 160),
    path: "/privacy",
  });
}

export default async function PrivacyPage() {
  const { locale, t } = await getServerTranslations();
  const document = getLegalDocument(locale, "privacy");

  return (
    <LegalDocumentPage
      document={document}
      backLabel={t.legal.backToHome}
      relatedLabel={t.legal.related}
      relatedLinks={getLegalRelatedLinks("privacy", t.legal.pages)}
    />
  );
}
