import { CalendarCheck, Home, Search, Video } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Choose a service",
    desc: "Online video consultation, free Sunday consult, or in-house medical care at home.",
  },
  {
    icon: CalendarCheck,
    step: "02",
    title: "Book",
    desc: "Pick a doctor and time slot, or schedule a verified visit to your address in Lahore.",
  },
  {
    icon: Video,
    step: "03",
    title: "Get care",
    desc: "Join your secure video call or receive licensed medical staff at your doorstep.",
  },
  {
    icon: Home,
    step: "04",
    title: "Follow up",
    desc: "E-prescriptions, visit notes, and your health history in one account.",
  },
];

export function HowItWorksSection() {
  return (
    <PageSection variant="soft" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow="Simple process"
        title="How it works"
        description="From booking to follow-up across our three launch services."
        align="center"
        className="mx-auto"
      />
      <div className="mt-8 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {steps.map((item) => (
          <article
            key={item.step}
            className={`relative p-6 ${surfaceCardInteractive}`}
          >
            <span className="font-display text-4xl font-semibold text-brand/25">
              {item.step}
            </span>
            <span className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <item.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
          </article>
        ))}
      </div>
    </PageSection>
  );
}
