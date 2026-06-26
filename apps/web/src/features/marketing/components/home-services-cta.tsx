import Link from "next/link";
import { ArrowRight, Home } from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { getServerTranslations } from "@/i18n/server";

export async function HomeServicesCta() {
  const { t } = await getServerTranslations();
  const c = t.homeServices.cta;

  return (
    <PageSection variant="neutral" spacing="default" bordered={false}>
      <div className="overflow-hidden rounded-2xl bg-hero-brand shadow-premium-lg sm:rounded-3xl">
        <div className="relative px-6 py-10 text-center sm:px-10 sm:py-14 lg:px-16 lg:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-white/5 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-accent-light/10 blur-3xl"
          />

          <span className="relative inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm sm:text-sm">
            <Home className="h-4 w-4 text-brand-lighter" />
            {t.homeServices.eyebrow}
          </span>

          <h2 className="relative mt-5 font-display text-2xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            {c.title}
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            {c.description}
          </p>

          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              className="group h-12 rounded-xl bg-white px-6 text-brand-dark shadow-premium hover:bg-white/95"
              asChild
            >
              <Link href="#choose-service">
                {c.primary}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-white/30 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href={`${siteConfig.links.login}?callbackUrl=${encodeURIComponent(siteConfig.links.homeCareVisits)}`}>
                {c.secondary}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </PageSection>
  );
}
