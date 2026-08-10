import Link from "next/link";
import { ArrowRight, Home, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/layout/site-logo";
import { siteConfig } from "@/config/site";
import { getServerTranslations } from "@/i18n/server";

export default async function NotFound() {
  const { t, locale } = await getServerTranslations();
  const isRtl = locale === "ur";

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-muted via-white to-accent-muted px-6 py-12 text-center sm:py-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="not-found-glow absolute left-1/2 top-[40%] size-[min(90vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/12 blur-3xl" />
        <div className="absolute left-[8%] top-[18%] size-48 rounded-full bg-accent/8 blur-3xl" />
        <div className="absolute bottom-[12%] right-[10%] size-40 rounded-full bg-brand/8 blur-2xl" />
        <p className="not-found-watermark absolute left-1/2 top-[36%] -translate-x-1/2 -translate-y-1/2 select-none font-display text-[clamp(7rem,24vw,14rem)] font-bold leading-none tracking-tighter text-accent/[0.07]">
          404
        </p>
      </div>

      <div className="relative flex w-full max-w-lg flex-col items-center gap-6 sm:gap-8">
        <div className="not-found-rise">
          <SiteLogo size="xl" priority />
        </div>

        <div
          className="not-found-rise flex flex-col items-center gap-3 sm:gap-4"
          style={{ animationDelay: "80ms" }}
        >
          <span className={`inline-flex items-center rounded-full border border-brand/20 bg-brand-muted px-3 py-1 text-xs font-semibold text-brand-dark ${isRtl ? "tracking-normal" : "uppercase tracking-[0.14em]"}`}>
            {t.notFoundPage.eyebrow}
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl md:leading-[1.15]">
            {t.notFoundPage.title}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
            {t.notFoundPage.description}
          </p>
        </div>

        <div
          className="not-found-rise flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:w-auto sm:flex-row sm:justify-center"
          style={{ animationDelay: "160ms" }}
        >
          <Button asChild size="lg" className="shadow-premium">
            <Link href="/">
              <Home className="size-4" aria-hidden />
              {t.notFoundPage.goHome}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={siteConfig.links.doctors}>
              <Stethoscope className="size-4" aria-hidden />
              {t.notFoundPage.browseDoctors}
              <ArrowRight
                className={`size-4 opacity-70 ${isRtl ? "rotate-180" : ""}`}
                aria-hidden
              />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
