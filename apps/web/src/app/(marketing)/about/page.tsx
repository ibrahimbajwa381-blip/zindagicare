import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  CalendarHeart,
  Code2,
  ExternalLink,
  Eye,
  Globe2,
  HandHeart,
  HeartHandshake,
  HeartPulse,
  Home,
  Network,
  Quote,
  Receipt,
  ShieldCheck,
  Star,
  Stethoscope,
  Target,
  UserCheck,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { siteConfig } from "@/config/site";
import { getAboutContent } from "@/features/about/content";
import { getServerTranslations } from "@/i18n/server";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { surfaceCard, surfacePanel } from "@/lib/ui/surfaces";

const ABOUT_PATH = "/about";
const TECHCOGNIFY_URL = "https://www.techcognify.com";
const WORK_WITH_IBRAHIM_URL = "https://www.techcognify.com/work-with-ibrahim";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerTranslations();
  const { meta } = getAboutContent(locale);
  return buildPageMetadata({
    title: meta.title,
    description: meta.description,
    path: ABOUT_PATH,
  });
}

const VALUE_ICONS: LucideIcon[] = [ShieldCheck, Receipt, HeartPulse, HeartHandshake];

const SERVICE_LINKS: { icon: LucideIcon; href: string }[] = [
  { icon: Video, href: siteConfig.links.doctors },
  { icon: Zap, href: siteConfig.links.urgentCare },
  { icon: Home, href: siteConfig.links.homeServices },
  { icon: HeartPulse, href: siteConfig.links.physiotherapists },
  { icon: CalendarHeart, href: siteConfig.links.sundayConsult },
  { icon: Network, href: siteConfig.links.nurses },
];

const PROVIDER_ICONS: LucideIcon[] = [BadgeCheck, Star, CalendarClock, BarChart3, Globe2, HandHeart];

function SectionHeading({
  eyebrow,
  title,
  intro,
  id,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  id: string;
}) {
  return (
    <header className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">{eyebrow}</p>
      <h2
        id={id}
        className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
      >
        {title}
      </h2>
      {intro ? (
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{intro}</p>
      ) : null}
    </header>
  );
}

const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-light";
const secondaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-foreground hover:border-brand-light hover:text-brand";

export default async function AboutPage() {
  const { locale } = await getServerTranslations();
  const c = getAboutContent(locale);
  const arrow = <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />;

  return (
    <>
      {/* Hero */}
      <PageSection variant="brand" spacing="default" bordered={false}>
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">{c.hero.eyebrow}</p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            {c.hero.title} <span className="text-brand">{c.hero.titleHighlight}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-700 sm:text-lg">
            {c.hero.intro}
          </p>

          <figure className="mx-auto mt-8 max-w-2xl rounded-2xl border border-brand-light/40 bg-white/80 px-6 py-5 shadow-sm">
            <figcaption className="text-xs font-bold uppercase tracking-widest text-brand">
              {c.hero.mottoLabel}
            </figcaption>
            <blockquote className="mt-2 font-display text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {c.hero.motto}
            </blockquote>
          </figure>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={siteConfig.links.doctors} className={primaryButton}>
              {c.hero.primaryCta}
              {arrow}
            </Link>
            <Link href={siteConfig.links.sundayConsult} className={secondaryButton}>
              <CalendarHeart className="h-4 w-4" aria-hidden />
              {c.hero.secondaryCta}
            </Link>
          </div>
        </div>
      </PageSection>

      {/* Mission & vision */}
      <PageSection variant="neutral" spacing="default" bordered={false}>
        <section aria-labelledby="about-mission">
          <SectionHeading id="about-mission" eyebrow={c.mission.eyebrow} title={c.mission.title} />

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className={surfacePanel}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-muted text-brand">
                <Target className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-foreground">
                {c.mission.missionTitle}
              </h3>
              <p className="mt-3 leading-relaxed text-slate-700">{c.mission.missionBody}</p>
            </article>
            <article className={surfacePanel}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-muted text-accent">
                <Eye className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-foreground">
                {c.mission.visionTitle}
              </h3>
              <p className="mt-3 leading-relaxed text-slate-700">{c.mission.visionBody}</p>
            </article>
          </div>

          <h3 className="mt-12 font-display text-xl font-semibold text-foreground">
            {c.mission.valuesTitle}
          </h3>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {c.mission.values.map((value, index) => {
              const Icon = VALUE_ICONS[index] ?? ShieldCheck;
              return (
                <li key={value.title} className={`${surfaceCard} p-5`}>
                  <Icon className="h-6 w-6 text-brand" aria-hidden />
                  <p className="mt-3 font-semibold text-foreground">{value.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{value.body}</p>
                </li>
              );
            })}
          </ul>
        </section>
      </PageSection>

      {/* Services */}
      <PageSection variant="soft" spacing="default" bordered={false}>
        <section aria-labelledby="about-services">
          <SectionHeading
            id="about-services"
            eyebrow={c.services.eyebrow}
            title={c.services.title}
            intro={c.services.intro}
          />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.services.items.map((item, index) => {
              const { icon: Icon, href } = SERVICE_LINKS[index] ?? SERVICE_LINKS[0];
              return (
                <li key={item.title}>
                  <Link
                    href={href}
                    className={`${surfaceCard} group flex h-full gap-4 p-5 hover:border-brand-light/60`}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground group-hover:text-brand">
                        {item.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-slate-600">
                        {item.body}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </PageSection>

      {/* Free Sunday consultation */}
      <PageSection variant="accent" spacing="default" bordered={false}>
        <section aria-labelledby="about-sunday" className="grid gap-10 lg:grid-cols-5 lg:items-start">
          <div className="lg:col-span-3">
            <SectionHeading id="about-sunday" eyebrow={c.sunday.eyebrow} title={c.sunday.title} />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700">
              {c.sunday.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={siteConfig.links.sundayConsult} className={primaryButton}>
                {c.sunday.patientCta}
                {arrow}
              </Link>
              <Link href={siteConfig.links.registerDoctor} className={secondaryButton}>
                <HandHeart className="h-4 w-4" aria-hidden />
                {c.sunday.volunteerCta}
              </Link>
            </div>
          </div>

          <aside className="space-y-5 lg:col-span-2">
            <ul className={`${surfacePanel} space-y-3`}>
              {c.sunday.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm leading-relaxed text-slate-700 sm:text-base">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <figure className="rounded-2xl bg-[#062a5c] p-6 text-white shadow-premium">
              <Quote className="h-6 w-6 text-brand-lighter" aria-hidden />
              <blockquote className="mt-3 font-display text-lg leading-snug">
                {c.sunday.quote}
              </blockquote>
            </figure>
          </aside>
        </section>
      </PageSection>

      {/* Provider career growth */}
      <PageSection variant="neutral" spacing="default" bordered={false}>
        <section aria-labelledby="about-providers">
          <SectionHeading
            id="about-providers"
            eyebrow={c.providers.eyebrow}
            title={c.providers.title}
            intro={c.providers.intro}
          />
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.providers.items.map((item, index) => {
              const Icon = PROVIDER_ICONS[index] ?? BadgeCheck;
              return (
                <li key={item.title} className={`${surfaceCard} p-5`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-brand">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-xs font-bold tabular-nums text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-4 font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={siteConfig.links.forDoctors} className={primaryButton}>
              <Stethoscope className="h-4 w-4" aria-hidden />
              {c.providers.doctorCta}
            </Link>
            <Link href={siteConfig.links.forNurses} className={secondaryButton}>
              {c.providers.nurseCta}
            </Link>
            <Link href={siteConfig.links.forPhysiotherapists} className={secondaryButton}>
              {c.providers.physioCta}
            </Link>
          </div>
        </section>
      </PageSection>

      {/* Team */}
      <PageSection variant="brand" spacing="default" bordered={false}>
        <section aria-labelledby="about-team">
          <SectionHeading
            id="about-team"
            eyebrow={c.team.eyebrow}
            title={c.team.title}
            intro={c.team.intro}
          />

          {/* Dr. Osama — Co-Founder & CEO */}
          <article className={`${surfaceCard} mt-10 overflow-hidden`}>
            <div className="grid lg:grid-cols-5">
              <div className="relative aspect-[4/5] bg-slate-100 lg:col-span-2 lg:aspect-auto lg:min-h-full">
                <Image
                  src="/about/dr-osama-riaz.webp"
                  alt={c.osama.photoAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover object-top"
                />
              </div>

              <div className="p-6 sm:p-8 lg:col-span-3 lg:p-10">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-muted px-3 py-1 text-xs font-semibold text-brand-dark">
                  <UserCheck className="h-3.5 w-3.5" aria-hidden />
                  {c.osama.role}
                </span>
                <h3 className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl">
                  {c.osama.name}
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500">{c.osama.subtitle}</p>

                <blockquote className="mt-6 border-s-4 border-brand ps-4 font-display text-lg font-semibold italic text-foreground">
                  {c.osama.quote}
                </blockquote>

                <div className="mt-6 space-y-4 leading-relaxed text-slate-700">
                  {c.osama.bio.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>

                <dl className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {c.osama.facts.map((fact) => (
                    <div key={fact.label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                      <dt className="text-sm text-slate-500">{fact.label}</dt>
                      <dd className="text-sm font-medium text-foreground sm:col-span-2">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="grid gap-6 border-t border-slate-200 bg-slate-50/70 p-6 sm:p-8 lg:grid-cols-5 lg:p-10">
              <div className="lg:col-span-3">
                <h4 className="font-display text-lg font-semibold text-foreground">
                  {c.osama.principlesTitle}
                </h4>
                <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                  {c.osama.principles.map((principle, index) => (
                    <li key={principle.title} className="rounded-xl border border-slate-200 bg-white p-4">
                      <span className="text-xs font-bold tabular-nums text-brand">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="mt-1 font-display text-lg font-bold text-foreground">
                        {principle.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{principle.body}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <figure className="lg:col-span-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-200">
                  <Image
                    src="/about/dr-osama-riaz-theatre.webp"
                    alt={c.osama.theatreAlt}
                    fill
                    sizes="(min-width: 1024px) 35vw, 100vw"
                    className="object-cover object-top"
                  />
                </div>
                <figcaption className="mt-2 text-xs text-slate-500">{c.osama.theatreCaption}</figcaption>
              </figure>
            </div>
          </article>

          {/* Ibrahim Bajwa — Founder & AI Product Engineer */}
          <article className={`${surfaceCard} mt-8 overflow-hidden`}>
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-5 lg:p-10">
              <div className="lg:col-span-2">
                <div className="relative mx-auto aspect-[3/4] w-full max-w-[16rem] overflow-hidden rounded-2xl border border-slate-200 bg-white lg:mx-0">
                  <Image
                    src="/about/ibrahim-bajwa.webp"
                    alt={c.ibrahim.photoAlt}
                    fill
                    sizes="256px"
                    className="object-cover object-top"
                  />
                </div>
                <figure className="mx-auto mt-6 max-w-[16rem] rounded-2xl bg-[#062a5c] p-5 text-white lg:mx-0">
                  <Quote className="h-5 w-5 text-brand-lighter" aria-hidden />
                  <blockquote className="mt-2 font-display font-semibold leading-snug">
                    {c.ibrahim.principle}
                  </blockquote>
                </figure>
              </div>

              <div className="min-w-0 lg:col-span-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-muted px-3 py-1 text-xs font-semibold text-brand-dark">
                  <Code2 className="h-3.5 w-3.5" aria-hidden />
                  {c.ibrahim.role}
                </span>
                <h3 className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl">
                  {c.ibrahim.name}
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500">{c.ibrahim.subtitle}</p>

                <div className="mt-6 space-y-4 leading-relaxed text-slate-700">
                  {c.ibrahim.bio.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>

                <dl className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200">
                  {c.ibrahim.facts.map((fact) => (
                    <div key={fact.label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                      <dt className="text-sm text-slate-500">{fact.label}</dt>
                      <dd className="text-sm font-medium text-foreground sm:col-span-2">{fact.value}</dd>
                    </div>
                  ))}
                </dl>

                <h4 className="mt-8 font-display text-lg font-semibold text-foreground">
                  {c.ibrahim.expertiseTitle}
                </h4>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {c.ibrahim.expertise.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50/70 p-6 sm:p-8 lg:px-10">
              <h4 className="font-display text-lg font-semibold text-foreground">
                {c.ibrahim.workTitle}
              </h4>
              <p className="mt-2 max-w-3xl leading-relaxed text-slate-700">{c.ibrahim.workBody}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <a
                  href={WORK_WITH_IBRAHIM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={primaryButton}
                >
                  {c.ibrahim.workCta}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
                <a
                  href={TECHCOGNIFY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={secondaryButton}
                >
                  {c.ibrahim.companyCta}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>
          </article>
        </section>
      </PageSection>

      {/* Closing */}
      <PageSection variant="soft" spacing="default" bordered={false}>
        <div className="mx-auto max-w-3xl rounded-3xl bg-[#062a5c] px-6 py-10 text-center text-white shadow-premium sm:px-12 sm:py-14">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">{c.closing.title}</h2>
          <p className="mt-4 leading-relaxed text-slate-200">{c.closing.body}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={siteConfig.links.doctors} className={primaryButton}>
              {c.closing.primaryCta}
              {arrow}
            </Link>
            <Link
              href={siteConfig.links.forDoctors}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 px-6 text-sm font-semibold text-white hover:border-brand-lighter"
            >
              {c.closing.secondaryCta}
            </Link>
          </div>
        </div>
      </PageSection>
    </>
  );
}
