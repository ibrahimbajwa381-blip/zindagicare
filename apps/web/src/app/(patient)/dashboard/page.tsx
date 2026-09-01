import Link from "next/link";
import { auth } from "@/lib/auth";
import { resolvePostAuthPath } from "@/lib/auth/routes";
import { redirect } from "next/navigation";
import { canUsePatientWorkspace } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { Undo2 } from "lucide-react";
import { PatientDashboardMessagesSection } from "@/features/patient/components/patient-dashboard-messages-section";
import { PatientSundayBookingSection } from "@/features/sunday-consult/components/patient-sunday-booking-section";
import { PatientVisitsSection } from "@/features/home-care/components/patient-visits-section";
import { PatientAppointmentHistorySection } from "@/features/patient/components/patient-appointment-history-section";
import { PatientProfileSection } from "@/features/patient/components/patient-profile-section";
import { PatientPrescriptionsSection } from "@/features/prescriptions/components/patient-prescriptions-section";
import { WelcomeTour } from "@/features/patient/components/welcome-tour";
import { PatientAppointmentsService } from "@/server/services/patient-appointments.service";
import { getDictionary } from "@/i18n";
import { formatMessage } from "@/i18n/messages";
import { getLocale } from "@/i18n/server";
import { getPatientProfile } from "@/server/services/patient-profile.service";
import { PatientUrgentBookingSection } from "@/features/urgent-consult/components/patient-urgent-booking-section";
import { PatientDashboardCopilotSection } from "@/features/patient/components/patient-dashboard-copilot-section";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";
import { PrescriptionService } from "@/server/services/prescription.service";
import { SundayConsultService } from "@/server/services/sunday-consult.service";
import { ChatService } from "@/server/services/chat.service";
import { loadPatientOnlineBooking } from "@/features/consult/components/patient-online-booking-section";
import { PatientOnlineBookingSection } from "@/features/consult/components/patient-online-booking-section";
import { PatientUpcomingAppointmentsEmpty } from "@/features/patient/components/patient-upcoming-appointments-empty";
import { PatientTestimonialSection } from "@/features/patient/components/patient-testimonial-section";

export const metadata = { title: "Dashboard" };

export default async function PatientDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (!canUsePatientWorkspace(session.user.roles)) {
    redirect(resolvePostAuthPath(session.user));
  }

  const locale = await getLocale();
  const t = getDictionary(locale);
  const [profile, sundayBooking, urgentBooking, onlineBooking, appointmentHistory, prescriptions, messageContacts, messageThreads] =
    await Promise.all([
      getPatientProfile(session.user.id),
      SundayConsultService.getPatientBooking(session.user.id),
      UrgentConsultService.getPatientRequest(session.user.id),
      loadPatientOnlineBooking(session.user.id),
      PatientAppointmentsService.listHistory(session.user.id),
      PrescriptionService.listForPatient(session.user.id),
      ChatService.listPatientContacts(session.user.id),
      ChatService.listThreads(session.user.id),
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

      <Link
        href={siteConfig.links.refundRequest}
        className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-red-100 bg-red-50/60 px-5 py-4 transition-colors hover:bg-red-50"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <Undo2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Need a refund?</p>
            <p className="text-xs text-slate-600">
              Cancel an appointment and get your money back — full refund, sent manually to your account.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 border-red-200 bg-white text-red-700 hover:bg-red-100">
          Request refund
        </Button>
      </Link>

      <section className="mt-8 min-w-0 space-y-8">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t.dashboard.activitiesTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t.dashboard.activitiesDescription}</p>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <PatientDashboardCopilotSection />
            <PatientDashboardMessagesSection
              initialContacts={messageContacts}
              initialThreads={messageThreads}
            />
          </div>
          <div className="min-w-0">
          {onlineBooking ? (
            <PatientOnlineBookingSection initialBooking={onlineBooking} />
          ) : (
            <PatientUpcomingAppointmentsEmpty
              title={t.dashboard.upcomingAppointments}
              emptyTitle={t.dashboard.upcomingAppointmentsEmpty.title}
              emptyDescription={t.dashboard.upcomingAppointmentsEmpty.description}
              bookConsultLabel={t.dashboard.upcomingAppointmentsEmpty.bookConsult}
              bookConsultHref={siteConfig.links.doctors}
              freeSundayLabel={t.dashboard.upcomingAppointmentsEmpty.freeSunday}
              freeSundayHref={siteConfig.links.sundayConsult}
            />
          )}
          </div>
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

        <PatientTestimonialSection />

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
