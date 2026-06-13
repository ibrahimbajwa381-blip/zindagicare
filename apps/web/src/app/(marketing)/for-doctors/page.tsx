import { ProviderOnboardingIntro } from "@/features/marketing/components/provider-onboarding-intro";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerTranslations();
  const content = t.providerOnboarding.doctor;

  return {
    title: content.eyebrow,
    description: content.body,
  };
}

export default function ForDoctorsPage() {
  return <ProviderOnboardingIntro role="doctor" />;
}
