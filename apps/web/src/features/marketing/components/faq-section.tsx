"use client";

import Link from "next/link";
import { HelpCircle, MessageCircle } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "./section-header";
import { siteConfig } from "@/config/site";
import { FaqAccordion } from "./faq-accordion";
import { useTranslations } from "@/i18n/locale-provider";

export function FaqSection() {
  const t = useTranslations();

  return (
    <PageSection variant="soft" spacing="lg" flipBlur>
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          eyebrow={t.faq.eyebrow}
          title={t.faq.title}
          description={t.faq.description}
          align="center"
        />

        <div className="mt-8 sm:mt-10">
          <FaqAccordion items={t.faq.items} />
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-brand-light/25 bg-white/80 px-5 py-4 text-center backdrop-blur-sm sm:mt-8 sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-start gap-3 sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <HelpCircle className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-foreground sm:text-base">
                {t.faq.stillHaveQuestions}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">{t.faq.stillHaveQuestionsHint}</p>
            </div>
          </div>
          <Link
            href={siteConfig.links.register}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
          >
            <MessageCircle className="h-4 w-4" />
            {t.faq.getStarted}
          </Link>
        </div>
      </div>
    </PageSection>
  );
}
