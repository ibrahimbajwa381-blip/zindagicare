import { ProviderOnboardingIntro } from "@/features/marketing/components/provider-onboarding-intro";
import { getServerTranslations } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerTranslations();
  const content = t.providerOnboarding.physiotherapist;

  return {
    title: content.eyebrow,
    description: content.body,
  };
}

export default function ForPhysiotherapistsPage() {
  return <ProviderOnboardingIntro role="physiotherapist" />;
}
