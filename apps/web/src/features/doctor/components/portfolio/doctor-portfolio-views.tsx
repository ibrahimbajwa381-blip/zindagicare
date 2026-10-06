import { BookOpen, ChevronDown, ExternalLink, Globe, Link2 } from "lucide-react";
import { DOCTOR_PORTFOLIO_LINK_KEYS, DOCTOR_PORTFOLIO_LINKS } from "@zindagi/shared";
import type {
  DoctorPortfolioFaq,
  DoctorPortfolioLinks,
  DoctorPortfolioPublication,
  DoctorPortfolioService,
} from "@/lib/doctors/portfolio";

/**
 * Read-only renderers for doctor-only portfolio sections — shared by the workspace editor
 * (view mode) and the public /doctors/[slug] page so doctors see exactly what patients see.
 * Experience, education, certifications, awards and tags reuse the physiotherapist views.
 */

export function formatRupees(amount: number) {
  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

export function DoctorServiceList({ items }: { items: DoctorPortfolioService[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item, index) => (
        <li
          key={`${item.name}-${index}`}
          className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
            {item.fee !== undefined && (
              <span className="shrink-0 rounded-full bg-brand-muted px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
                {item.fee === 0 ? "Free" : formatRupees(item.fee)}
              </span>
            )}
          </div>
          {item.description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.description}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DoctorPublicationList({ items }: { items: DoctorPortfolioPublication[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
            <BookOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-start gap-1 text-sm font-semibold text-slate-900 hover:text-brand"
              >
                <span className="break-words">{item.title}</span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <p className="break-words text-sm font-semibold text-slate-900">{item.title}</p>
            )}
            {item.publisher && <p className="text-sm text-slate-600">{item.publisher}</p>}
          </div>
          {item.year && <span className="shrink-0 text-xs font-medium text-slate-500">{item.year}</span>}
        </li>
      ))}
    </ul>
  );
}

export function DoctorFaqList({ items }: { items: DoctorPortfolioFaq[] }) {
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
      {items.map((item, index) => (
        <details key={`${item.question}-${index}`} className="group px-4 py-3" open={index === 0}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
            {item.question}
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

export function hasDoctorLinks(links: DoctorPortfolioLinks) {
  return DOCTOR_PORTFOLIO_LINK_KEYS.some((key) => Boolean(links[key]));
}

export function DoctorLinkList({ links }: { links: DoctorPortfolioLinks }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {DOCTOR_PORTFOLIO_LINK_KEYS.filter((key) => links[key]).map((key) => {
        const Icon = key === "website" ? Globe : Link2;
        return (
          <li key={key}>
            <a
              href={links[key]}
              target="_blank"
              rel="noopener noreferrer nofollow me"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand-light hover:text-brand"
            >
              <Icon className="h-3.5 w-3.5" />
              {DOCTOR_PORTFOLIO_LINKS[key].label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
