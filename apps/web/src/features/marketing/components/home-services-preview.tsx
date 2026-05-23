import Link from "next/link";
import { ArrowRight, Droplets, Home, Syringe, TestTube } from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { SectionHeader } from "./section-header";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: Home,
    title: "Doctor home visit",
    desc: "Consult at your doorstep",
    color: "from-brand-dark to-brand",
  },
  {
    icon: Syringe,
    title: "Nurse & IV drip",
    desc: "Professional care at home",
    color: "from-brand to-brand-light",
  },
  {
    icon: TestTube,
    title: "Sample collection",
    desc: "Lab tests without the wait",
    color: "from-brand-light to-accent-light",
  },
  {
    icon: Droplets,
    title: "Emergency visit",
    desc: "Urgent home support",
    color: "from-accent to-accent-dark",
  },
];

export function HomeServicesPreview() {
  return (
    <PageSection variant="accent" spacing="lg">
      <SectionHeader
        eyebrow="At your door"
        title="Home visit & IV services"
        description="Geo-tracked scheduling, transparent pricing, and verified staff across Lahore."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
        className="mt-10 h-12 rounded-xl px-6 text-base shadow-premium"
        asChild
      >
        <Link href={siteConfig.links.homeServices}>
          Explore home services
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </PageSection>
  );
}
