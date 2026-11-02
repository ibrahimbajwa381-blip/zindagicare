import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-json-ld";
import { FaqJsonLd } from "@/components/seo/faq-json-ld";
import { JsonLd } from "@/components/seo/json-ld";
import { HomeServicesHowItWorks } from "@/features/marketing/components/home-services-how-it-works";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { siteConfig } from "@/config/site";
import { buildPageMetadata } from "@/lib/seo/metadata";
import {
  buildCityFaq,
  cityFacts,
  getHomeVisitCity,
  homeVisitCityPath,
  rs,
} from "@/lib/seo/home-visit-cities";
import { buildMedicalServiceSchema } from "@/lib/seo/schema";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const city = await getHomeVisitCity((await params).city);
  if (!city) return { title: "Not found", robots: { index: false } };
  const { serviceList, prices } = cityFacts(city);
  return buildPageMetadata({
    title: `Doctor Home Visit in ${city.name} — Book a Doctor, Nurse or Physio at Home | ZindagiCare`,
    description: `Book a verified doctor, nurse or physiotherapist to visit your home in ${city.name}. Verified ${serviceList}${prices.length ? `, ${prices[0]}` : ""} — transparent fees, geo-tracked visits on ZindagiCare.`,
    path: homeVisitCityPath(city.slug),
  });
}

export default async function HomeVisitCityPage({ params }: PageProps) {
  const city = await getHomeVisitCity((await params).city);
  if (!city) notFound();

  const path = homeVisitCityPath(city.slug);
  const { serviceList, prices, coverage } = cityFacts(city);
  const faq = buildCityFaq(city);
  const groups = [
    {
      title: "Doctors",
      items: city.doctors.map((d) => ({
        key: d.slug,
        href: `/doctors/${d.slug}`,
        name: d.name,
        detail: d.specialty,
        fee: d.homeVisitFee,
      })),
    },
    {
      title: "Nurses",
      items: city.nurses.map((n) => ({
        key: n.slug,
        href: `/nurses/${n.slug}`,
        name: n.name,
        detail: n.specialties.slice(0, 2).join(" · ") || n.qualification,
        fee: n.homeVisitFee,
      })),
    },
    {
      title: "Physiotherapists",
      items: city.physiotherapists.map((p) => ({
        key: p.slug,
        href: `/physiotherapists/${p.slug}`,
        name: p.name,
        detail: p.specialties.slice(0, 2).join(" · ") || p.qualification,
        fee: p.homeVisitFee,
      })),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "In-house medical services", path: "/home-services" },
          { name: city.name, path },
        ]}
      />
      <JsonLd
        data={buildMedicalServiceSchema({
          name: `Doctor, nurse and physiotherapist home visits in ${city.name}`,
          description: `Verified ${serviceList} visiting patients at home in ${city.name}, booked through ZindagiCare.`,
          path,
          city: city.name,
        })}
      />
      <FaqJsonLd items={faq} />

      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title={`Doctor Home Visits in ${city.name}`}
          description={`ZindagiCare sends verified ${serviceList} to your home in ${city.name}. ${coverage}.${prices.length ? ` Prices: ${prices.join(", ")}.` : ""} Every visit is geo-tracked and ends with a written report.`}
        />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="h-12 rounded-xl" asChild>
            <Link href={siteConfig.links.homeCareRequest}>Book a home visit</Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 rounded-xl" asChild>
            <a
              href={`https://wa.me/${siteConfig.supportWhatsApp}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp {siteConfig.supportWhatsAppDisplay}
            </a>
          </Button>
        </div>
      </PageSection>

      {groups.length > 0 && (
        <PageSection variant="neutral" spacing="default">
          <SectionHeader
            eyebrow={city.name}
            title={`Verified home-visit providers in ${city.name}`}
            className="mb-8"
          />
          <div className="space-y-10">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {group.title} ({group.items.length})
                </h3>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <li key={item.key}>
                      <Link href={item.href} className={`block p-4 ${surfaceCardInteractive}`}>
                        <span className="font-semibold text-foreground">{item.name}</span>
                        {item.detail && (
                          <span className="mt-1 block text-sm text-slate-600">{item.detail}</span>
                        )}
                        {item.fee > 0 && (
                          <span className="mt-2 block text-sm font-medium text-brand-dark">
                            Home visit {rs(item.fee)}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </PageSection>
      )}

      <HomeServicesHowItWorks />

      <PageSection variant="soft" spacing="default">
        <SectionHeader title={`Home visits in ${city.name}: common questions`} className="mb-6" />
        <dl className="space-y-6">
          {faq.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold text-foreground">{item.q}</dt>
              <dd className="mt-1.5 leading-relaxed text-slate-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </PageSection>
    </>
  );
}
