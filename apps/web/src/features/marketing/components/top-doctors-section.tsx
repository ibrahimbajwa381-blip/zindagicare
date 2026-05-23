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
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <SectionHeader
          eyebrow="Top rated"
          title="Doctors in Lahore"
          description="PMDC verified. Rated by real patients."
        />
        <Button
          variant="outline"
          className="shrink-0 rounded-xl border-accent/30 bg-white/90 text-accent-dark backdrop-blur-sm hover:border-accent hover:bg-accent-muted"
          asChild
        >
          <Link href={siteConfig.links.doctors}>View all doctors</Link>
        </Button>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {mockDoctors.map((doctor) => (
          <DoctorCard key={doctor.id} {...doctor} />
        ))}
      </div>
    </PageSection>
  );
}
