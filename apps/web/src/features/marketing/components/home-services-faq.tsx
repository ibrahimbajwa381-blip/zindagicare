import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

export async function HomeServicesFaq() {
  const { t } = await getServerTranslations();
  const f = t.homeServices.faq;

  return (
    <PageSection variant="brand" spacing="lg" innerClassName="mx-auto max-w-3xl">
      <SectionHeader eyebrow={f.eyebrow} title={f.title} align="center" />
      <dl className="mt-8 space-y-3 sm:mt-12 sm:space-y-4">
        {f.items.map((faq) => (
          <div key={faq.q} className={`p-6 ${surfaceCardInteractive}`}>
            <dt className="font-display text-base font-semibold text-foreground">
              {faq.q}
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-slate-600">{faq.a}</dd>
          </div>
        ))}
      </dl>
    </PageSection>
  );
}
