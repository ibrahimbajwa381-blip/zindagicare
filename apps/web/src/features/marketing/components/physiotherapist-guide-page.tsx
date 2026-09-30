import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Award,
  Banknote,
  BadgeCheck,
  BriefcaseMedical,
  CalendarCheck,
  Car,
  CheckCircle2,
  FileCheck,
  FileUp,
  Globe,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  Mail,
  MapPin,
  MessageCircle,
  Percent,
  Search,
  Share2,
  ShieldCheck,
  Sun,
  ToggleRight,
  UserCog,
  UserPlus,
  Wallet,
} from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { PhysiotherapistGuideToc } from "@/features/marketing/components/doctor-guide-toc";
import { FaqAccordion } from "@/features/marketing/components/faq-accordion";
import { SectionHeader } from "@/features/marketing/components/section-header";
import {
  PHYSIO_GUIDE_EXAMPLES,
  PHYSIO_GUIDE_FACTS as F,
  PHYSIO_GUIDE_FAQ,
  formatRs,
} from "@/features/marketing/data/physiotherapist-guide";
import { getWhatsAppSupportUrl } from "@/lib/support-contact";
import { surfaceCard, surfaceCardInteractive } from "@/lib/ui/surfaces";

const JOIN_WHATSAPP = getWhatsAppSupportUrl(
  "Assalamualaikum, I am a physiotherapist interested in joining ZindagiCare.",
);

export function PhysiotherapistGuidePage() {
  return (
    <>
      <Hero />
      <PhysiotherapistGuideToc />
      <EarningsSection />
      <PortfolioSection />
      <JoinSection />
      <VisitFlowSection />
      <WorkspaceSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}

function Hero() {
  return (
    <PageSection spacing="lg" variant="brand">
      <div className="mx-auto max-w-4xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white sm:text-sm">
          <Activity className="h-4 w-4" />
          Physiotherapist guide
        </p>
        <h1 className="mt-5 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-foreground sm:mt-8 sm:text-5xl lg:text-6xl">
          Grow your physiotherapy practice with ZindagiCare
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-700 sm:mt-6 sm:text-lg">
          Everything a verified physiotherapist needs to know: keep {F.physioPercent}% of every home
          visit, set your own fee, get paid every Sunday, and get your own portfolio website that
          patients book you from.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Button size="lg" className="h-12 rounded-xl shadow-premium sm:h-14" asChild>
            <Link href={siteConfig.links.registerPhysiotherapist}>
              Register as physiotherapist
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 rounded-xl sm:h-14" asChild>
            <a href="#portfolio">See your portfolio website</a>
          </Button>
          <Button size="lg" variant="outline" className="h-12 rounded-xl sm:h-14" asChild>
            <Link href={siteConfig.links.login}>Log in</Link>
          </Button>
        </div>

        <dl className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Your share", value: `${F.physioPercent}%`, hint: "of every home visit" },
            { label: "Payouts", value: "Every Sunday", hint: "to your bank or wallet" },
            {
              label: "Your fee",
              value: "You decide",
              hint: `${formatRs(F.feeMin)} – ${formatRs(F.feeMax)}`,
            },
            { label: "Your website", value: "Free", hint: "portfolio profile page" },
          ].map((item) => (
            <div key={item.label} className={`px-4 py-4 text-start ${surfaceCard}`}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {item.label}
              </dt>
              <dd className="mt-1 font-display text-xl font-semibold text-foreground">
                {item.value}
              </dd>
              <p className="mt-0.5 text-sm text-slate-600">{item.hint}</p>
            </div>
          ))}
        </dl>
      </div>
    </PageSection>
  );
}

function EarningsSection() {
  return (
    <PageSection id="earnings" variant="accent" spacing="lg" flipBlur className="scroll-mt-28 sm:scroll-mt-32">
      <SectionHeader
        eyebrow="Compensation"
        title={`You keep ${F.physioPercent}% of every home visit`}
        description="A simple, transparent split. You set the fee, you do the visit, and your share is paid to you every Sunday."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className={`p-6 ${surfaceCard}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Percent className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {F.physioPercent}% physiotherapist · {F.platformPercent}% platform
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  The {F.platformPercent}% platform fee covers patient bookings, payments, geo-matching,
                  your portfolio website and support. Your Earnings page always shows your
                  credited {F.physioPercent}% — not the patient&apos;s full payment.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard icon={Wallet} title="You set your fee">
              Choose any fee from {formatRs(F.feeMin)} to {formatRs(F.feeMax)} per visit in
              Profile. Leave it empty to use the platform rate of {formatRs(F.defaultFee)}.
            </InfoCard>
            <InfoCard icon={Sun} title="Paid every Sunday">
              Your full available balance is sent to your registered bank or wallet account
              every Sunday.
            </InfoCard>
            <InfoCard icon={Banknote} title="Receipts for every payout">
              Each payout appears in Earnings with its amount, method, date and transfer
              receipt.
            </InfoCard>
            <InfoCard icon={ShieldCheck} title="Bank details kept safe">
              Your account number is stored encrypted. Update it anytime from Earnings.
            </InfoCard>
          </div>
        </div>

        <div className={`p-6 sm:p-8 ${surfaceCard}`}>
          <h3 className="font-display text-lg font-semibold text-foreground">Worked examples</h3>
          <p className="mt-1 text-sm text-slate-600">What you earn on a single completed visit.</p>
          <div className="mt-6 space-y-5">
            {PHYSIO_GUIDE_EXAMPLES.map((ex, index) => (
              <div key={ex.fee}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {index === 0 ? "Platform rate" : "Your own fee"} · {formatRs(ex.fee)}
                  </p>
                  <p className="font-display text-lg font-semibold text-brand-dark">
                    {formatRs(ex.earns)}
                  </p>
                </div>
                <div
                  className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-200"
                  role="img"
                  aria-label={`${F.physioPercent}% to you, ${F.platformPercent}% to ZindagiCare`}
                >
                  <span className="bg-brand" style={{ width: `${F.physioPercent}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  You {formatRs(ex.earns)} · ZindagiCare {formatRs(ex.platform)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-brand/20 bg-brand-muted/60 p-4">
            <p className="text-sm font-semibold text-brand-dark">Example week</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              Ten visits at {formatRs(PHYSIO_GUIDE_EXAMPLES[1].fee)} ={" "}
              <span className="font-semibold text-foreground">
                {formatRs(PHYSIO_GUIDE_EXAMPLES[1].earns * 10)}
              </span>{" "}
              in your bank account on Sunday.
            </p>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Patients always pay your own fee — whether they book you from your profile or
            choose &ldquo;nearest available&rdquo; and are matched with you. Earnings are credited when a visit is marked completed.
          </p>
        </div>
      </div>
    </PageSection>
  );
}

function PortfolioSection() {
  return (
    <PageSection id="portfolio" variant="soft" spacing="lg" className="scroll-mt-28 sm:scroll-mt-32">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <SectionHeader
            eyebrow="Your own website"
            title="Get a free portfolio website"
            description="Every approved physiotherapist gets a personal profile page on ZindagiCare. It is your professional website — the page patients read before they hire you."
          />
          <ul className="mt-8 space-y-4">
            {[
              {
                icon: Globe,
                title: "Your own link",
                desc: "zindagicare.com/physiotherapists/your-name — put it on your WhatsApp, Instagram, visiting card or clinic board.",
              },
              {
                icon: CalendarCheck,
                title: "Patients hire you directly",
                desc: "A Book home visit button on your page sends the request straight to you, at your own fee.",
              },
              {
                icon: Search,
                title: "Found by new patients",
                desc: "Your page is listed in the physiotherapist directory and is built to show up on Google.",
              },
              {
                icon: Share2,
                title: "Share card included",
                desc: "Share profile and a ready-made share card with your photo, fee and verified badge.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <PortfolioPreview />
      </div>

      <div className={`mt-12 p-6 sm:p-8 ${surfaceCard}`}>
        <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">
          What you can add to your portfolio
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Open Portfolio in your workspace. A progress bar shows how complete your page is — a
          complete page earns more trust and more bookings.
        </p>
        <div className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Profile photo and headline",
            "About you — your approach to treatment",
            "Languages you speak",
            "Conditions you treat (e.g. lower back pain)",
            "Techniques (e.g. dry needling, manual therapy)",
            "Work experience at hospitals and clinics",
            "Degrees and education",
            "Certifications with verification links",
            "Awards and professional memberships",
          ].map((item) => (
            <p key={item} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              {item}
            </p>
          ))}
        </div>
      </div>
    </PageSection>
  );
}

/** Illustrative mock of a public physiotherapist profile — sample data, not a real person. */
function PortfolioPreview() {
  return (
    <figure>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-premium">
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="ms-2 truncate rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
            zindagicare.com/physiotherapists/your-name
          </span>
        </div>
        <div className="bg-gradient-to-br from-brand-muted to-white p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand font-display text-xl font-semibold text-white">
              YN
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-foreground">Your Name, DPT</p>
              <p className="text-sm text-slate-600">Sports & orthopaedic physiotherapist</p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-dark">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified physiotherapist
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { v: "8+", l: "Years" },
              { v: "12", l: "Conditions" },
              { v: formatRs(PHYSIO_GUIDE_EXAMPLES[1].fee), l: "Home visit" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white px-2 py-2.5 ring-1 ring-slate-200">
                <p className="font-display text-sm font-semibold text-foreground sm:text-base">{s.v}</p>
                <p className="text-[11px] text-slate-500">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Treats</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Lower back pain", "Knee rehab", "Frozen shoulder", "Stroke recovery"].map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-brand-muted px-2.5 py-1 text-xs font-medium text-brand-dark"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <p className="flex items-center gap-2">
              <BriefcaseMedical className="h-4 w-4 text-brand" /> Senior Physiotherapist · City Hospital
            </p>
            <p className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-brand" /> Doctor of Physical Therapy
            </p>
            <p className="flex items-center gap-2">
              <Award className="h-4 w-4 text-brand" /> Certified Dry Needling Practitioner
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand" /> Your area, your city
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white">
            Book home visit
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs leading-relaxed text-slate-500">
        Illustration with sample details — your page shows your own photo and portfolio.
      </figcaption>
    </figure>
  );
}

function JoinSection() {
  const steps = [
    {
      icon: UserPlus,
      title: "Create your account",
      desc: "Register as a physiotherapist with your email and phone.",
    },
    {
      icon: FileCheck,
      title: "Submit verification",
      desc: "Enter your license / PPTA number, CNIC, qualification, experience, specialties, service area and payout account, and upload your documents.",
    },
    {
      icon: CalendarCheck,
      title: "Get approved & go live",
      desc: "Admin reviews your application. Once approved, your portfolio website goes live and you start receiving home visits.",
    },
  ] as const;

  return (
    <PageSection id="join" variant="neutral" spacing="lg" className="scroll-mt-28 sm:scroll-mt-32">
      <SectionHeader
        eyebrow="Getting started"
        title="How to join as a physiotherapist"
        description="Three steps from signup to your first home visit."
        align="center"
        className="mx-auto"
      />
      <ol className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className={`flex h-full flex-col p-6 ${surfaceCardInteractive}`}>
              <span className="font-display text-4xl font-semibold text-brand/25">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 font-display text-lg font-semibold text-foreground">{step.title}</p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{step.desc}</p>
            </li>
          );
        })}
      </ol>

      <div className={`mt-8 p-6 sm:p-8 ${surfaceCard}`}>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Keep these ready before you apply
        </h3>
        <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Registration",
              items: ["Physiotherapy license / PPTA number", "License or PPTA certificate (photo or PDF)"],
            },
            {
              title: "Identity",
              items: ["CNIC number", "CNIC front photo", "CNIC back photo"],
            },
            {
              title: "Practice",
              items: [
                "Qualification (DPT, BS Physical Therapy…)",
                "Years of experience",
                "Your specialties",
                `City, area and home location (${F.radiusKm} km matching)`,
              ],
            },
            {
              title: "Payouts",
              items: ["Account title", "Bank or wallet name", "Account number", "IBAN (optional)"],
            },
          ].map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.title}
              </p>
              <ul className="mt-2 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-slate-500">
          You also accept the{" "}
          <Link href="/provider-agreement" className="font-medium text-brand hover:underline">
            provider agreement
          </Link>{" "}
          when you submit.
        </p>
      </div>
    </PageSection>
  );
}

function VisitFlowSection() {
  const steps = [
    {
      icon: Search,
      title: "Patient finds you",
      desc: "Through your portfolio link, the physiotherapist directory, or a nearest-available request near your area.",
    },
    {
      icon: CalendarCheck,
      title: "Visit is assigned",
      desc: "The home visit appears in My visits with the patient's details, address and notes.",
    },
    {
      icon: Car,
      title: "En route → arrived",
      desc: "Tap Mark en route when you leave and Mark arrived at the door, so the patient sees live progress.",
    },
    {
      icon: FileUp,
      title: "Treat & complete",
      desc: "Deliver the session, upload a visit report if needed, and tap Mark completed.",
    },
    {
      icon: Wallet,
      title: "Get paid Sunday",
      desc: `Your ${F.physioPercent}% is credited instantly and sent to your account on the coming Sunday.`,
    },
  ] as const;

  return (
    <PageSection id="visits" variant="accent" spacing="lg" flipBlur className="scroll-mt-28 sm:scroll-mt-32">
      <SectionHeader
        eyebrow="How home visits work"
        title="From booking to payout"
        description="Every visit follows the same five steps, so patients, admin and you always know where things stand."
        align="center"
        className="mx-auto"
      />
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className={`relative p-5 ${surfaceCard}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {index + 1}
                </span>
                <Icon className="h-5 w-5 text-brand" />
              </div>
              <p className="mt-4 font-display text-base font-semibold text-foreground">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.desc}</p>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: ToggleRight,
            title: "Stay available",
            desc: "Keep the availability toggle on when you can take visits, and off when you can't — you won't be matched while it's off.",
          },
          {
            icon: MapPin,
            title: "Keep location accurate",
            desc: `Nearest-available requests are matched within ${F.radiusKm} km of your saved location. Update it if you move.`,
          },
          {
            icon: Car,
            title: "Don't skip statuses",
            desc: "Move through en route, arrived and completed in order. Only completed visits count towards your earnings.",
          },
        ].map((item) => (
          <InfoCard key={item.title} icon={item.icon} title={item.title}>
            {item.desc}
          </InfoCard>
        ))}
      </div>
    </PageSection>
  );
}

function WorkspaceSection() {
  const screens = [
    {
      icon: LayoutDashboard,
      title: "Overview",
      desc: "Your application status, the availability toggle, active visits, earnings summary and portfolio completeness — all at a glance.",
      tips: ["Turn availability on to start receiving visits.", "Check your portfolio score and finish missing sections."],
    },
    {
      icon: CalendarCheck,
      title: "My visits",
      desc: "Every home visit assigned to you, with patient details, address and notes, plus the status buttons for each step.",
      tips: ["Mark en route, arrived and completed as you go.", "Upload a visit report from the visit card."],
    },
    {
      icon: Wallet,
      title: "Earnings",
      desc: `Your ${F.physioPercent}% share, this month's total, available balance, a per-visit breakdown and Sunday payout history with receipts.`,
      tips: ["See exactly what each visit earned you.", "Add or update your bank account here."],
    },
    {
      icon: UserCog,
      title: "Profile",
      desc: "Name, phone, service city and area, coverage radius, specialties, home-visit toggle and your fee per visit.",
      tips: [`Set your fee (${formatRs(F.feeMin)} – ${formatRs(F.feeMax)}).`, "Keep your service area up to date."],
    },
    {
      icon: IdCard,
      title: "Portfolio",
      desc: "Edit your public website — headline, about, conditions, techniques, experience, education, certifications and awards.",
      tips: ["Edit in place — it shows exactly what patients see.", "Open View public profile and share that link."],
    },
  ] as const;

  return (
    <PageSection id="workspace" variant="soft" spacing="lg" className="scroll-mt-28 sm:scroll-mt-32">
      <SectionHeader
        eyebrow="Physiotherapist workspace"
        title="How to use the system"
        description="After approval, open Physiotherapist workspace from the header. These are the five screens in your sidebar."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {screens.map((screen, index) => {
          const Icon = screen.icon;
          return (
            <article key={screen.title} className={`flex flex-col p-6 ${surfaceCardInteractive}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {index + 1}. {screen.title}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{screen.desc}</p>
              <ul className="mt-4 space-y-1.5">
                {screen.tips.map((tip) => (
                  <li key={tip} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {tip}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </PageSection>
  );
}

function FaqSection() {
  return (
    <PageSection id="faq" variant="neutral" spacing="lg" className="scroll-mt-28 sm:scroll-mt-32">
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          eyebrow="Questions"
          title="Physiotherapist FAQ"
          description="What physiotherapists ask before joining — earnings, fees, payouts and the portfolio website."
          align="center"
        />
        <div className="mt-8 sm:mt-10">
          <FaqAccordion items={[...PHYSIO_GUIDE_FAQ]} />
        </div>
      </div>
    </PageSection>
  );
}

function CtaSection() {
  return (
    <PageSection spacing="default">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Ready to join ZindagiCare?
        </h2>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">
          Register, get verified, and get your own portfolio website — then start treating
          patients at home and getting paid every Sunday.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" className="h-12 rounded-xl shadow-premium" asChild>
            <Link href={siteConfig.links.registerPhysiotherapist}>
              Register as physiotherapist
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 rounded-xl" asChild>
            <a href={JOIN_WHATSAPP} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp {siteConfig.supportWhatsAppDisplay}
            </a>
          </Button>
        </div>
        <p className="mt-6 text-sm text-slate-600">
          <Mail className="mr-1 inline h-4 w-4 align-text-bottom text-brand" />
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="font-medium text-brand hover:underline"
          >
            {siteConfig.supportEmail}
          </a>
        </p>
      </div>
    </PageSection>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Wallet;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={`p-5 ${surfaceCard}`}>
      <Icon className="h-5 w-5 text-brand" />
      <p className="mt-3 font-display text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}
