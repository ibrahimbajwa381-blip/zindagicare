import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { siteConfig } from "@/config/site";
import type { LegalDocument } from "@/features/legal/types";
import { surfacePanel } from "@/lib/ui/surfaces";

type LegalDocumentPageProps = {
  document: LegalDocument;
  relatedLinks?: { href: string; label: string }[];
  backLabel: string;
  relatedLabel?: string;
};

export function LegalDocumentPage({
  document,
  relatedLinks,
  backLabel,
  relatedLabel = "Related",
}: LegalDocumentPageProps) {
  return (
    <PageSection variant="neutral" spacing="default" bordered={false}>
      <article className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-medium text-brand hover:text-brand-dark hover:underline"
        >
          ← {backLabel}
        </Link>

        <header className="mt-6">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {document.title}
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            {document.lastUpdated} · {siteConfig.name}
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-700">{document.intro}</p>
        </header>

        <div className={`mt-10 space-y-8 ${surfacePanel}`}>
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 sm:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
                {section.bullets?.length ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.bullets.map((item) => (
                      <li key={item.slice(0, 48)}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        {relatedLinks?.length ? (
          <nav
            aria-label="Related policies"
            className="mt-10 rounded-2xl border border-brand-light/30 bg-brand-muted/50 px-5 py-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {relatedLabel}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {relatedLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-medium text-brand hover:text-brand-dark hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </article>
    </PageSection>
  );
}
