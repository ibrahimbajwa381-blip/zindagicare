import { ChevronDown } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "./section-header";
import { getServerTranslations } from "@/i18n/server";

export async function HomePhysioFaq() {
  const { t } = await getServerTranslations();
  const f = t.homePhysio.page.faq;

  return (
    <PageSection variant="brand" spacing="lg" innerClassName="mx-auto max-w-3xl">
      <SectionHeader eyebrow={f.eyebrow} title={f.title} align="center" />

      <div className="mt-8 space-y-3 sm:mt-12 sm:space-y-4">
        {f.items.map((faq, index) => (
          <details
            key={faq.q}
            className="group overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition open:border-brand/25 open:shadow-premium"
            {...(index === 0 ? { open: true } : {})}
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
              <span className="font-display text-base font-semibold leading-snug text-foreground sm:text-lg">
                {faq.q}
              </span>
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brand/15 bg-brand-muted/40 text-brand-dark transition group-open:rotate-180 group-open:bg-brand group-open:text-white">
                <ChevronDown className="h-4 w-4" />
              </span>
            </summary>
            <div className="border-t border-slate-100 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{faq.a}</p>
            </div>
          </details>
        ))}
      </div>
    </PageSection>
  );
}
