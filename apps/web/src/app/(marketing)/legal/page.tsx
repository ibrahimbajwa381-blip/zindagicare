import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, ExternalLink, FileText, Mail } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { siteConfig } from "@/config/site";
import { legalRoutes } from "@/features/legal/routes";
import type { LegalDocumentSlug } from "@/features/legal/types";
import { getServerTranslations } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { surfacePanel } from "@/lib/ui/surfaces";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return buildPageMetadata({
    title: t.legal.company.title,
    description: t.legal.company.intro.slice(0, 160),
    path: siteConfig.links.legal,
  });
}

const POLICY_ORDER: LegalDocumentSlug[] = [
  "terms",
  "privacy",
  "telemedicineConsent",
  "refundPolicy",
  "providerAgreement",
];

export default async function LegalPage() {
  const { locale, t } = await getServerTranslations();
  const copy = t.legal.company;
  const company = siteConfig.company;

  const incorporatedOn = new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-PK", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Karachi",
  }).format(new Date(`${company.incorporatedOn}T00:00:00+05:00`));

  const details: { label: string; value: string; mono?: boolean }[] = [
    { label: copy.legalName, value: company.legalName },
    { label: copy.registrar, value: company.registrar },
    { label: copy.cuin, value: company.cuin, mono: true },
    { label: copy.incorporatedOn, value: incorporatedOn },
    { label: copy.registrationOffice, value: company.registrationOffice },
    { label: copy.law, value: company.companiesAct },
    { label: copy.companyType, value: company.companyType },
  ];

  return (
    <PageSection variant="neutral" spacing="default" bordered={false}>
      <article className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-sm font-medium text-brand hover:text-brand-dark hover:underline"
        >
          ← {t.legal.backToHome}
        </Link>

        <header className="mt-6 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            {copy.verifiedBadge}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-700">{copy.intro}</p>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-5">
          <section className={`lg:col-span-3 ${surfacePanel}`} aria-labelledby="registration-details">
            <h2
              id="registration-details"
              className="font-display text-xl font-semibold text-foreground sm:text-2xl"
            >
              {copy.detailsTitle}
            </h2>
            <dl className="mt-5 divide-y divide-slate-200">
              {details.map((row) => (
                <div key={row.label} className="grid gap-1 py-3 sm:grid-cols-5 sm:gap-4">
                  <dt className="text-sm text-slate-500 sm:col-span-2">{row.label}</dt>
                  <dd
                    className={`text-sm font-medium text-foreground sm:col-span-3 ${row.mono ? "font-mono tracking-wide" : ""}`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 rounded-xl border border-brand-light/30 bg-brand-muted/50 p-4">
              <a
                href={company.verifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-light"
              >
                {copy.verifyCta}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              <p className="mt-3 text-xs leading-relaxed text-slate-600 sm:text-sm">
                {copy.verifyHint}
              </p>
            </div>
          </section>

          <section className="lg:col-span-2" aria-labelledby="certificate">
            <h2
              id="certificate"
              className="font-display text-xl font-semibold text-foreground sm:text-2xl"
            >
              {copy.certificateTitle}
            </h2>
            <a
              href={company.certificateImage}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-brand/40"
            >
              <Image
                src={company.certificateImage}
                alt={copy.certificateAlt}
                width={1254}
                height={1254}
                sizes="(min-width: 1024px) 400px, 100vw"
                className="h-auto w-full"
              />
            </a>
            <p className="mt-2 text-xs text-slate-500">
              <a
                href={company.certificateImage}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand hover:underline"
              >
                {copy.openFull}
              </a>
            </p>
          </section>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <nav
            aria-labelledby="policies"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4"
          >
            <h2 id="policies" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {copy.policiesTitle}
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {POLICY_ORDER.map((slug) => (
                <li key={slug}>
                  <Link
                    href={legalRoutes[slug]}
                    className="inline-flex items-center gap-2 font-medium text-brand hover:text-brand-dark hover:underline"
                  >
                    <FileText className="h-4 w-4 shrink-0" aria-hidden />
                    {t.legal.pages[slug]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {copy.contactTitle}
            </h2>
            <a
              href={`mailto:${siteConfig.supportEmail}`}
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-dark hover:underline"
            >
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              {siteConfig.supportEmail}
            </a>
          </div>
        </div>
      </article>
    </PageSection>
  );
}
