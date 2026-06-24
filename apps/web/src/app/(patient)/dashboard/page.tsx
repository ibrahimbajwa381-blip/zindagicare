import Link from "next/link";
import { auth } from "@/lib/auth";
import { resolvePostAuthPath } from "@/lib/auth/routes";
import { redirect } from "next/navigation";
import { isStaff } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientDashboardMessagesSection } from "@/features/patient/components/patient-dashboard-messages-section";
import { PatientSundayBookingSection } from "@/features/sunday-consult/components/patient-sunday-booking-section";
import { PatientVisitsSection } from "@/features/home-care/components/patient-visits-section";
import { PatientAppointmentHistorySection } from "@/features/patient/components/patient-appointment-history-section";
import { PatientProfileSection } from "@/features/patient/components/patient-profile-section";
import { PatientPrescriptionsSection } from "@/features/prescriptions/components/patient-prescriptions-section";
import { WelcomeTour } from "@/features/patient/components/welcome-tour";
import { AppointmentReminderService } from "@/server/services/appointment-reminder.service";
import { PatientAppointmentsService } from "@/server/services/patient-appointments.service";
import { getDictionary } from "@/i18n";
import { formatMessage } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
import { getPatientProfile } from "@/server/services/patient-profile.service";
import { PatientUrgentBookingSection } from "@/features/urgent-consult/components/patient-urgent-booking-section";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";
import { PrescriptionService } from "@/server/services/prescription.service";
import { SundayConsultService } from "@/server/services/sunday-consult.service";
import { loadPatientOnlineBooking } from "@/features/consult/components/patient-online-booking-section";
import { PatientOnlineBookingSection } from "@/features/consult/components/patient-online-booking-section";
import { cn } from "@zindagi/shared";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

export const metadata = { title: "Dashboard" };

export default async function PatientDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (isStaff(session.user.roles)) {
    redirect(resolvePostAuthPath(session.user));
  }

  const locale = await getLocale();
  const t = getDictionary(locale);
  const [profile, sundayBooking, urgentBooking, onlineBooking, appointmentHistory, prescriptions, _reminders] =
    await Promise.all([
      getPatientProfile(session.user.id),
      SundayConsultService.getPatientBooking(session.user.id),
      UrgentConsultService.getPatientRequest(session.user.id),
      loadPatientOnlineBooking(session.user.id),
      PatientAppointmentsService.listHistory(session.user.id),
      PrescriptionService.listForPatient(session.user.id),
      AppointmentReminderService.processDueReminders().catch(() => null),
    ]);
  const displayName = profile.user.name ?? session.user.name ?? "Patient";

  return (
    <PageShell variant="brand" spacing="default">
      <WelcomeTour userId={session.user.id} />
      <PageTitle
        eyebrow={t.dashboard.eyebrow}
        title={t.dashboard.pageTitle}
        description={formatMessage(t.dashboard.welcomeMessage, { name: displayName })}
      />

      <section className="mt-8 space-y-8">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t.dashboard.activitiesTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t.dashboard.activitiesDescription}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          <PatientDashboardMessagesSection />
          {onlineBooking ? (
            <PatientOnlineBookingSection initialBooking={onlineBooking} />
          ) : (
            <Card className={cn(surfaceCardInteractive, "flex h-full flex-col")}>
              <CardHeader>
                <CardTitle className="text-base">{t.dashboard.upcomingAppointments}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-center text-sm text-slate-500">
                {t.dashboard.noAppointments}
              </CardContent>
            </Card>
          )}
        </div>

        {urgentBooking ? (
          <PatientUrgentBookingSection variant="dashboard" initialRequest={urgentBooking} />
        ) : null}

        {sundayBooking ? (
          <PatientSundayBookingSection
            variant="dashboard"
            initialBooking={sundayBooking}
          />
        ) : null}

        <PatientAppointmentHistorySection
          items={appointmentHistory}
          title={t.dashboard.appointmentHistory.title}
          empty={t.dashboard.appointmentHistory.empty}
          missedLabel={t.dashboard.appointmentHistory.missed}
          statusLabels={t.dashboard.appointmentHistory.status}
          reviewCopy={t.dashboard.appointmentHistory.review}
          viewPrescriptionLabel={t.prescriptions.viewPrescription}
        />

        <PatientPrescriptionsSection initialItems={prescriptions} />

        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">{t.homeCare.visitsTitle}</h3>
              <p className="text-sm text-slate-500">{t.homeCare.visitsDesc}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={siteConfig.links.homeCareRequest}>{t.homeCare.bookVisit}</Link>
            </Button>
          </div>
          <PatientVisitsSection />
        </div>

      </section>

      <section className="mt-10">
        <div className="mb-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t.dashboard.profile.title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t.dashboard.profile.subtitle}</p>
        </div>
        <PatientProfileSection initialProfile={profile} />
      </section>
    </PageShell>
  );
}
