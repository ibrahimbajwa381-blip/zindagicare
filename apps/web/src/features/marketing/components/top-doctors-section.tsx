import Link from "next/link";
import { siteConfig } from "@/config/site";
import { mockDoctors } from "../data/mock-doctors";
import { DoctorCard } from "./doctor-card";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "./section-header";
import { Button } from "@/components/ui/button";
import { getServerTranslations } from "@/i18n/server";

export async function TopDoctorsSection() {
  const { t } = await getServerTranslations();

  return (
    <PageSection variant="brand" spacing="lg" flipBlur>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end sm:gap-6">
        <SectionHeader
          eyebrow={t.doctors.eyebrow}
          title={t.doctors.title}
          description={t.doctors.description}
        />
        <Button
          variant="outline"
          className="w-full shrink-0 rounded-xl border-accent/30 bg-white/90 text-accent-dark backdrop-blur-sm hover:border-accent hover:bg-accent-muted sm:w-auto"
          asChild
        >
          <Link href={siteConfig.links.doctors}>{t.common.browseAll}</Link>
        </Button>
      </div>
      <div className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {mockDoctors.map((doctor) => (
          <DoctorCard key={doctor.id} {...doctor} pmdcLabel={t.common.pmdc} />
        ))}
      </div>
    </PageSection>
  );
}
