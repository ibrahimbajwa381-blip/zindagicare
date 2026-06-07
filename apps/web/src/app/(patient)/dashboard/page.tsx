import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientSundayBookingSection } from "@/features/sunday-consult/components/patient-sunday-booking-section";
import { SundayExplainer } from "@/features/sunday-consult/components/sunday-explainer";
import { PatientVisitsSection } from "@/features/home-care/components/patient-visits-section";
import {
  PatientProfileSection,
} from "@/features/patient/components/patient-profile-section";
import { getDictionary } from "@/i18n";
import { formatMessage } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
import { getPatientProfile } from "@/server/services/patient-profile.service";
import { SundayConsultService } from "@/server/services/sunday-consult.service";
import { loadPatientOnlineBooking } from "@/features/consult/components/patient-online-booking-section";
import { PatientOnlineBookingSection } from "@/features/consult/components/patient-online-booking-section";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

export const metadata = { title: "Dashboard" };

export default async function PatientDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const locale = await getLocale();
  const t = getDictionary(locale);
  const [profile, sundayBooking, onlineBooking] = await Promise.all([
    getPatientProfile(session.user.id),
    SundayConsultService.getPatientBooking(session.user.id),
    loadPatientOnlineBooking(session.user.id),
  ]);
  const displayName = profile.user.name ?? session.user.name ?? "Patient";

  return (
    <PageShell variant="brand" spacing="default" flipBlur>
      <PageTitle
        eyebrow={t.dashboard.eyebrow}
        title={t.dashboard.pageTitle}
        description={formatMessage(t.dashboard.welcomeMessage, { name: displayName })}
      />

      <div className="mt-8">
        <PatientProfileSection initialProfile={profile} initialSundayBooking={sundayBooking} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className={surfaceCardInteractive}>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.nav.messages}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500">
            <p>{t.chat.pageDescription}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={siteConfig.links.messages}>{t.dashboard.nav.messages}</Link>
            </Button>
          </CardContent>
        </Card>
        {onlineBooking ? (
          <PatientOnlineBookingSection initialBooking={onlineBooking} />
        ) : (
          <Card className={surfaceCardInteractive}>
            <CardHeader>
              <CardTitle className="text-base">{t.dashboard.upcomingAppointments}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">
              {t.dashboard.noAppointments}
            </CardContent>
          </Card>
        )}
        <PatientSundayBookingSection
          variant="dashboard"
          initialBooking={sundayBooking}
        />
      </div>

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{t.homeCare.visitsTitle}</h2>
            <p className="text-sm text-slate-500">{t.homeCare.visitsDesc}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={siteConfig.links.homeCareRequest}>{t.homeCare.bookVisit}</Link>
          </Button>
        </div>
        <PatientVisitsSection />
      </div>

      <div className="mt-8">
        <SundayExplainer variant="compact" />
      </div>
    </PageShell>
  );
}
