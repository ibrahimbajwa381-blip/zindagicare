import Link from "next/link";
import { siteConfig } from "@/config/site";
import { mockDoctors } from "../data/mock-doctors";
import { DoctorCard } from "./doctor-card";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "./section-header";
import { Button } from "@/components/ui/button";

export function TopDoctorsSection() {
  return (
    <PageSection variant="brand" spacing="lg" flipBlur>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-6">
        <SectionHeader
          eyebrow="Online consultation"
          title="Top doctors in Lahore"
          description="PMDC verified specialists available for secure video consults."
        />
        <Button
          variant="outline"
          className="w-full shrink-0 rounded-xl border-accent/30 bg-white/90 text-accent-dark backdrop-blur-sm hover:border-accent hover:bg-accent-muted sm:w-auto"
          asChild
        >
          <Link href={siteConfig.links.doctors}>Browse all doctors</Link>
        </Button>
      </div>
      <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {mockDoctors.map((doctor) => (
          <DoctorCard key={doctor.id} {...doctor} />
        ))}
      </div>
    </PageSection>
  );
}
