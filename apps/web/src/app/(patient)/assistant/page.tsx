import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canAccessHealthAssistant } from "@zindagi/shared";
import { resolvePostAuthPath } from "@/lib/auth/routes";
import { CopilotApp } from "@/features/copilot/components/copilot-app";
import { CopilotPageHeader } from "@/features/copilot/components/copilot-page-header";
import { getLocale } from "@/i18n/server";
import { getDictionary } from "@/i18n";

export const metadata = { title: "Health Assistant" };

export default async function PatientAssistantPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/assistant");
  }

  if (!canAccessHealthAssistant(session.user.roles)) {
    redirect(resolvePostAuthPath(session.user));
  }

  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-br from-brand-muted/40 via-white to-accent-muted/30">
      <CopilotPageHeader
        navLabel={t.dashboard.nav.assistant}
        title={t.copilot.pageTitle}
        description={t.copilot.pageDescription}
        dismissLabel={t.copilot.dismissIntro}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              {t.copilot.loading}
            </div>
          }
        >
          <CopilotApp
            fillViewport
            copy={{
            newChat: t.copilot.newChat,
            emptyTitle: t.copilot.emptyTitle,
            emptyDescription: t.copilot.emptyDescription,
            selectChatTitle: t.copilot.selectChatTitle,
            selectChatDescription: t.copilot.selectChatDescription,
            messagePlaceholder: t.copilot.messagePlaceholder,
            disclaimer: t.copilot.disclaimer,
            bookConsultation: t.copilot.bookConsultation,
            consultationFee: t.copilot.consultationFee,
            pmdcVerified: t.copilot.pmdcVerified,
            urgentTitle: t.copilot.urgentTitle,
            urgentDescription: t.copilot.urgentDescription,
            urgentCta: t.copilot.urgentCta,
            emergencyTitle: t.copilot.emergencyTitle,
            emergencyBody: t.copilot.emergencyBody,
            urgentBannerTitle: t.copilot.urgentBannerTitle,
            urgentBannerBody: t.copilot.urgentBannerBody,
            callEmergency: t.copilot.callEmergency,
            thinking: t.copilot.thinking,
            checkingTools: t.copilot.checkingTools,
            retry: t.copilot.retry,
            loading: t.copilot.loading,
            micLabel: t.copilot.micLabel,
            stopMicLabel: t.copilot.stopMicLabel,
            doctorReferralTitle: t.copilot.doctorReferralTitle,
            slotsAvailable: t.copilot.slotsAvailable,
            bookedConfirmedTitle: t.copilot.bookedConfirmedTitle,
            bookedPendingTitle: t.copilot.bookedPendingTitle,
            bookedPendingDescription: t.copilot.bookedPendingDescription,
            payNow: t.copilot.payNow,
            viewDashboard: t.copilot.viewDashboard,
            viewProfile: t.copilot.viewProfile,
          }}
          />
        </Suspense>
      </div>
    </div>
  );
}
