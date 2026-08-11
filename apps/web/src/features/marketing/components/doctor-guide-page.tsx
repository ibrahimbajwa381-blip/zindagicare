import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileCheck,
  Home,
  Mail,
  MapPin,
  MessageCircle,
  Percent,
  ShieldAlert,
  Stethoscope,
  Sun,
  UserPlus,
  Video,
  Wallet,
  Zap,
} from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { DoctorGuideToc } from "@/features/marketing/components/doctor-guide-toc";
import { FaqAccordion } from "@/features/marketing/components/faq-accordion";
import { SectionHeader } from "@/features/marketing/components/section-header";
import {
  DOCTOR_GUIDE_FAQ,
  DOCTOR_GUIDE_SCREENSHOTS,
  DOCTOR_GUIDE_VIDEO,
} from "@/features/marketing/data/doctor-guide";
import { getWhatsAppSupportUrl } from "@/lib/support-contact";
import { surfaceCard, surfaceCardInteractive } from "@/lib/ui/surfaces";

const JOIN_WHATSAPP = getWhatsAppSupportUrl(
  "Assalamualaikum, I am a doctor interested in joining ZindagiCare.",
);

export function DoctorGuidePage() {
  return (
    <>
      <Hero />
      <DoctorGuideToc />
      <VideoSection />
      <EarningsSection />
      <JoinSection />
      <PatientDemandSection />
      <WorkspaceSection />
      <AttendanceSection />
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
          <Stethoscope className="h-4 w-4" />
          Doctor guide
        </p>
        <h1 className="mt-5 font-display text-3xl font-semibold leading-[1.12] tracking-tight text-foreground sm:mt-8 sm:text-5xl lg:text-6xl">
          Practice on ZindagiCare — earnings, tools, and how it works
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-700 sm:mt-6 sm:text-lg">
          A Pakistan-wide, English and Urdu telemedicine platform for PMDC-verified
          doctors. Set your own fee, keep 70% of paid consults, and manage patients
          from one workspace.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
          <Button size="lg" className="h-12 rounded-xl shadow-premium sm:h-14" asChild>
            <Link href={siteConfig.links.registerDoctor}>
              Register as doctor
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 rounded-xl sm:h-14" asChild>
            <a href="#demo">Watch the demo</a>
          </Button>
          <Button size="lg" variant="outline" className="h-12 rounded-xl sm:h-14" asChild>
            <Link href={siteConfig.links.login}>Log in</Link>
          </Button>
        </div>

        <dl className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Your share", value: "70%", hint: "of every paid consult" },
            { label: "Payouts", value: "Monthly", hint: "to your bank account" },
            { label: "Online care", value: "Pakistan-wide", hint: "video, urgent, Sunday" },
            { label: "Home visits", value: "Lahore", hint: "Phase 1 in-house only" },
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

function VideoSection() {
  return (
    <PageSection id="demo" variant="soft" spacing="lg" className="scroll-mt-28 sm:scroll-mt-32">
      <SectionHeader
        eyebrow="Watch first"
        title="Full platform walkthrough"
        description={DOCTOR_GUIDE_VIDEO.description}
        align="center"
        className="mx-auto"
      />
      <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-premium sm:mt-10 sm:rounded-3xl">
        <div className="relative aspect-video">
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${DOCTOR_GUIDE_VIDEO.youtubeId}`}
            title={DOCTOR_GUIDE_VIDEO.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
      <ul className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
        {[
          "Home healthcare — doctors, nurses, IV, injections, wound care at home",
          "Online consults — browse doctors, book a slot, pay, and join video",
          "Free Sunday consult — volunteer 10-minute care for patients who cannot afford it",
          "Urgent care — admin assigns a doctor within minutes for a live video call",
          "Doctor workspace — appointments, visits, prescriptions, chat, and earnings",
          "E-prescriptions — dosages, notes, and a professional PDF the patient can download",
        ].map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {item}
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

function EarningsSection() {
  return (
    <PageSection id="earnings" variant="accent" spacing="lg" flipBlur className="scroll-mt-28 sm:scroll-mt-32">
      <SectionHeader
        eyebrow="Compensation"
        title="You keep 70% of every paid consult"
        description="Transparent rates, your own fee, and monthly payouts. Sunday free consults are unpaid volunteer work."
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className={`p-6 ${surfaceCard}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Percent className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  70% doctor · 30% platform
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Same split on online, clinic, urgent, and in-house doctor visits.
                  The Earnings screen already shows your credited 70% — not the
                  patient&apos;s gross payment.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`p-5 ${surfaceCard}`}>
              <Wallet className="h-5 w-5 text-brand" />
              <p className="mt-3 font-display text-base font-semibold">You set your fee</p>
              <p className="mt-1 text-sm text-slate-600">
                Choose your consultation fee in Edit profile. Patients see that
                amount when they book you.
              </p>
            </div>
            <div className={`p-5 ${surfaceCard}`}>
              <Banknote className="h-5 w-5 text-brand" />
              <p className="mt-3 font-display text-base font-semibold">Monthly payouts</p>
              <p className="mt-1 text-sm text-slate-600">
                We pay out monthly to your registered bank account. Email or
                WhatsApp us to request a transfer.
              </p>
            </div>
            <div className={`p-5 ${surfaceCard}`}>
              <Sun className="h-5 w-5 text-brand" />
              <p className="mt-3 font-display text-base font-semibold">Sunday is volunteer</p>
              <p className="mt-1 text-sm text-slate-600">
                Free Sunday consults are unpaid. Enable or disable them whenever
                you choose. No paid chat on Sunday visits.
              </p>
            </div>
            <div className={`p-5 ${surfaceCard}`}>
              <MapPin className="h-5 w-5 text-brand" />
              <p className="mt-3 font-display text-base font-semibold">Where you can practice</p>
              <p className="mt-1 text-sm text-slate-600">
                Video, urgent, and Sunday: Pakistan-wide. In-house doctor visits:
                Lahore only in Phase 1.
              </p>
            </div>
          </div>

          <div className={`border-brand/20 bg-brand-muted/60 p-5 ${surfaceCard}`}>
            <p className="text-sm font-semibold text-brand-dark">Example</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              A patient pays PKR 2,500 for an online consult. You are credited{" "}
              <span className="font-semibold text-foreground">PKR 1,750</span> (70%).
              ZindagiCare retains PKR 750.
            </p>
          </div>
        </div>

        <Screenshot shot={DOCTOR_GUIDE_SCREENSHOTS.earnings} />
      </div>
    </PageSection>
  );
}

function JoinSection() {
  const steps = [
    {
      icon: UserPlus,
      title: "Create your doctor account",
      desc: "Register with email, phone, and professional details. Already a patient on ZindagiCare? Add a doctor profile to the same login.",
    },
    {
      icon: FileCheck,
      title: "Submit verification",
      desc: "Upload PMDC certificate, CNIC front and back, and degree certificate, plus your PMDC number and CNIC. Admin reviews every application.",
    },
    {
      icon: CalendarCheck,
      title: "Go live",
      desc: "Once approved, set your fee, weekly hours, and locations. Patients can book online consults; admin can assign urgent care and Lahore home visits.",
    },
  ] as const;

  return (
    <PageSection id="join" variant="neutral" spacing="lg" className="scroll-mt-28 sm:scroll-mt-32">
      <SectionHeader
        eyebrow="Getting started"
        title="How to join as a doctor"
        description="Three steps from signup to seeing patients. English and Urdu throughout."
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
    </PageSection>
  );
}

function PatientDemandSection() {
  const items = [
    {
      icon: Home,
      title: "Home healthcare",
      desc: "Patients request a doctor, nurse, IV drip, injection, or wound care at home. Admin assigns the most suitable professional — currently in Lahore for in-house visits.",
    },
    {
      icon: Video,
      title: "Online consultation",
      desc: "Patients browse verified doctors, view your profile and fee, pick a slot, pay, and join a secure video consult. Pakistan-wide.",
    },
    {
      icon: Sun,
      title: "Free Sunday consult",
      desc: "Every Sunday, participating doctors volunteer 10-minute video slots for patients who cannot afford care. You can opt in or out.",
    },
    {
      icon: Zap,
      title: "Urgent care",
      desc: "When a patient needs a doctor now, admin assigns an available doctor within minutes. You join a live video call and can issue an e-Rx.",
    },
  ] as const;

  return (
    <PageSection variant="accent" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow="The ecosystem"
        title="What patients use — and how you get involved"
        description="ZindagiCare is built around real healthcare needs in Pakistan, in English and Urdu."
        align="center"
        className="mx-auto"
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className={`p-6 ${surfaceCardInteractive}`}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
            </article>
          );
        })}
      </div>
    </PageSection>
  );
}

function WorkspaceSection() {
  return (
    <PageSection id="workspace" variant="soft" spacing="lg" flipBlur className="scroll-mt-28 sm:scroll-mt-32">
      <SectionHeader
        eyebrow="Doctor workspace"
        title="How to use the system"
        description="Every screen in your dashboard, with a short how-to. After approval, open Doctor workspace from the header. Screenshots use a dummy doctor and sample contacts — not real patients."
      />

      <div className="mt-10 space-y-16">
        <GuideBlock
          title="1. Overview"
          body="Your home screen: public profile status, PMDC badge, open requests, Sunday queue, home visits, rating, and completion rate. Switch between Patient and Doctor profiles if you use both."
          howTo={[
            "Confirm your profile is live and PMDC verified before expecting bookings.",
            "Use Edit profile from here to change your fee, photo, or bio.",
            "Watch completion rate — missed consults affect it and can trigger a warning.",
          ]}
          shot={DOCTOR_GUIDE_SCREENSHOTS.overview}
        />
        <GuideBlock
          title="2. Edit profile"
          reverse
          body="Control what patients see: display name, specialty, languages, professional bio, photo, and clinic locations. Your consultation fee is set here."
          howTo={[
            "Upload a clear professional photo — it appears on your public profile after approval.",
            "Add hospital or clinic locations so patients know where you practice.",
            "Set languages (English, Urdu, or both) and a short bio.",
          ]}
          shot={DOCTOR_GUIDE_SCREENSHOTS.editProfile}
        />
        <GuideBlock
          title="3. Weekly availability"
          body="Tick the days you accept paid online or clinic bookings and set start/end times in Pakistan Standard Time. The Sunday free consult toggle is separate from paid hours."
          howTo={[
            "Save your weekly template so patients only see real open slots.",
            "Turn on Free Sunday online consultation only if you want to volunteer that week.",
            "You can change hours anytime — new bookings follow the updated schedule.",
          ]}
          shot={DOCTOR_GUIDE_SCREENSHOTS.availability}
        />
        <GuideBlock
          title="4. Consult requests"
          reverse
          body="All online and clinic appointments: active, upcoming, completed, missed, and cancelled. Sunday free visits are tagged so you can tell them apart from paid consults."
          howTo={[
            "Join the video room on time for upcoming consults.",
            "Open Patient history, Message, or Issue Rx from a completed visit.",
            "Filter by status when you need to find a missed or cancelled booking.",
          ]}
          shot={DOCTOR_GUIDE_SCREENSHOTS.requests}
        />
        <GuideBlock
          title="5. Urgent care"
          body="High-priority video consults assigned by the ZindagiCare team. You do not pick the patient — admin matches the next available doctor."
          howTo={[
            "Enable urgent care alerts so you are notified even when the app is closed.",
            "Join the secure session within 10 minutes of assignment.",
            "Write an e-prescription from the call bar while you are speaking with the patient.",
          ]}
          shot={DOCTOR_GUIDE_SCREENSHOTS.urgent}
        />
        <GuideBlock
          title="6. Free Sunday consult"
          reverse
          body="Unpaid volunteer care every Sunday for patients who cannot afford a paid visit. You control start time, end time, slot duration, and max patients — or disable the program entirely."
          howTo={[
            "Set start/end (PK time), duration (for example 10 minutes), and max slots.",
            "Tap Save & materialize next Sunday so the queue is created.",
            "Use Disable Sunday consults whenever you cannot volunteer.",
          ]}
          shot={DOCTOR_GUIDE_SCREENSHOTS.sunday}
        />
        <GuideBlock
          title="7. Home visits (Lahore, Phase 1)"
          body="In-house doctor visits are assigned by admin. Update status as you travel so the patient and admin see live progress: requested → assigned → en route → arrived → completed."
          howTo={[
            "Accept only visits you can reach in Lahore.",
            "Move the stepper as you leave, arrive, and finish — do not skip statuses.",
            "Call or message from the visit card if you need the patient on the way.",
          ]}
          shot={DOCTOR_GUIDE_SCREENSHOTS.homeVisits}
        />
        <GuideBlock
          title="8. Patient messages"
          reverse
          body="Secure chat after paid consultations. Sunday free consults do not include chat. Use this for follow-up questions, not for new unpaid diagnoses."
          howTo={[
            "Select a patient from your paid-consult list.",
            "Search chats by name when your inbox grows.",
            "Issue a prescription from the workspace if the follow-up needs medication.",
          ]}
          shot={DOCTOR_GUIDE_SCREENSHOTS.messages}
        />
        <GuideBlock
          title="9. My patients"
          body="A directory of everyone you have seen — completed, missed, upcoming, and reviewed. Open a card for visit counts, last contact, and a message button."
          howTo={[
            "Filter by Completed, Missed, or Awaiting review.",
            "Message a patient only if they came through a paid consult.",
            "Check reviews so you know how patients rated the visit.",
          ]}
          shot={DOCTOR_GUIDE_SCREENSHOTS.patients}
        />

        <article className={`p-6 sm:p-8 ${surfaceCard}`}>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Video className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                10. Live consult & e-prescriptions
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
                During a video consult you can prescribe medications, set dosages,
                add clinical notes, and generate a professionally formatted PDF.
                Patients download it anytime from their dashboard. Open
                Prescriptions in the sidebar to review or issue an Rx after the call.
              </p>
            </div>
          </div>
        </article>
      </div>
    </PageSection>
  );
}

function AttendanceSection() {
  return (
    <PageSection id="attendance" variant="neutral" spacing="lg" className="scroll-mt-28 sm:scroll-mt-32">
      <SectionHeader
        eyebrow="Practice standards"
        title="Join your appointments on time"
        description="Patients book a real slot with you. Repeated no-shows restrict your account."
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Clock,
            title: "15-minute grace",
            desc: "A miss is counted if you never join the video room and the scheduled window has ended, plus 15 minutes.",
          },
          {
            icon: ShieldAlert,
            title: "3 misses → warning",
            desc: "Three missed online or Sunday consults in one calendar month (Pakistan time) trigger a formal warning.",
          },
          {
            icon: ShieldAlert,
            title: "5 misses → restricted",
            desc: "Five misses in a month remove you from booking. Contact the ZindagiCare team to restore your account.",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className={`p-6 ${surfaceCard}`}>
              <Icon className="h-5 w-5 text-brand" />
              <h3 className="mt-4 font-display text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
            </article>
          );
        })}
      </div>
    </PageSection>
  );
}

function FaqSection() {
  return (
    <PageSection id="faq" variant="soft" spacing="lg" flipBlur className="scroll-mt-28 sm:scroll-mt-32">
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          eyebrow="Questions"
          title="Doctor FAQ"
          description="The details doctors ask before joining — fees, Sunday, payouts, and cities."
          align="center"
        />
        <div className="mt-8 sm:mt-10">
          <FaqAccordion items={[...DOCTOR_GUIDE_FAQ]} />
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
          Register, complete PMDC verification, and start seeing patients online
          across Pakistan — with home visits in Lahore.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button size="lg" className="h-12 rounded-xl shadow-premium" asChild>
            <Link href={siteConfig.links.registerDoctor}>
              Register as doctor
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

type Shot = (typeof DOCTOR_GUIDE_SCREENSHOTS)[keyof typeof DOCTOR_GUIDE_SCREENSHOTS];

function Screenshot({ shot }: { shot: Shot }) {
  return (
    <figure>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-premium">
        <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="ms-2 truncate text-[11px] font-medium text-slate-400">
            zindagicare.com/doctor
          </span>
        </div>
        <Image
          src={shot.src}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          className="h-auto w-full"
          sizes="(max-width: 1024px) 100vw, 40rem"
        />
      </div>
      <figcaption className="mt-2 text-center text-xs leading-relaxed text-slate-500">
        Dummy doctor and sample contacts for demonstration — not real patients.
      </figcaption>
    </figure>
  );
}

function GuideBlock({
  title,
  body,
  howTo,
  shot,
  reverse = false,
}: {
  title: string;
  body: string;
  howTo: readonly string[];
  shot: Shot;
  reverse?: boolean;
}) {
  return (
    <article className="grid items-start gap-6 lg:grid-cols-2 lg:gap-10">
      <div className={reverse ? "lg:order-2" : undefined}>
        <h3 className="font-display text-xl font-semibold text-foreground sm:text-2xl">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{body}</p>
        <ol className="mt-4 space-y-2">
          {howTo.map((step, index) => (
            <li key={step} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <div className={reverse ? "lg:order-1" : undefined}>
        <Screenshot shot={shot} />
      </div>
    </article>
  );
}
