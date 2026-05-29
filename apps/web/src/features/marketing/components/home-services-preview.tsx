import Link from "next/link";
import { ArrowRight, Bandage, Home, HeartPulse, Syringe } from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Home,
    title: "Doctor home visit",
    desc: "In-person check-up at your doorstep",
    color: "from-brand-dark to-brand",
  },
  {
    icon: Syringe,
    title: "Nursing & IV therapy",
    desc: "Injections, drips, and skilled nursing",
    color: "from-brand to-brand-light",
  },
  {
    icon: Bandage,
    title: "Wound & post-op care",
    desc: "Dressings and recovery support at home",
    color: "from-brand-light to-accent-light",
  },
  {
    icon: HeartPulse,
    title: "Urgent in-house visit",
    desc: "Timely medical support when you need it",
    color: "from-accent to-accent-dark",
  },
];

export function HomeServicesPreview() {
  return (
    <PageSection variant="accent" spacing="lg">
      <SectionHeader
        eyebrow="At your home"
        title="In-house medical services"
        description="Geo-tracked scheduling, transparent pricing, and PMDC-verified staff across Lahore."
      />
      <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {services.map(({ icon: Icon, title, desc, color }) => (
          <article
            key={title}
            className={`group p-6 ${surfaceCardInteractive}`}
          >
            <span
              className={`inline-flex rounded-xl bg-gradient-to-br ${color} p-2.5 text-white shadow-sm`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold text-foreground">
              {title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>
          </article>
        ))}
      </div>
      <Button
        className="mt-8 h-12 w-full rounded-xl px-6 text-base shadow-premium sm:mt-10 sm:w-auto"
        asChild
      >
        <Link href={siteConfig.links.homeServices}>
          Explore in-house services
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </PageSection>
  );
}
