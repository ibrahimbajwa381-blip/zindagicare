import { CalendarCheck, MessageCircle, Search, Stethoscope } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Search",
    desc: "Find doctors by specialty, hospital, or rating in Lahore.",
  },
  {
    icon: CalendarCheck,
    step: "02",
    title: "Book",
    desc: "Clinic visit, paid online consult, or our free 10-minute Sunday video call.",
  },
  {
    icon: Stethoscope,
    step: "03",
    title: "Consult",
    desc: "Visit in person, at home, or join when video launches.",
  },
  {
    icon: MessageCircle,
    step: "04",
    title: "Follow up",
    desc: "Prescriptions, reminders, and family health in one place.",
  },
];

export function HowItWorksSection() {
  return (
    <PageSection variant="soft" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow="Simple process"
        title="How it works"
        description="From search to follow-up in four clear steps."
        align="center"
        className="mx-auto"
      />
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
