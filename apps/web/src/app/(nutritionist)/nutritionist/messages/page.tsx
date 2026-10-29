import { Roles } from "@zindagi/shared";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { ProviderMessagesPage } from "@/features/chat/components/provider-messages-page";

export const metadata = { title: "Messages | Nutritionist" };

type PageProps = {
  searchParams: Promise<{ patient?: string }>;
};

export default async function NutritionistMessagesPage({ searchParams }: PageProps) {
  const { patient } = await searchParams;
  return (
    <ProviderMessagesPage
      role={Roles.NUTRITIONIST}
      path={AUTH_ROUTES.nutritionistMessages}
      patientId={patient}
    />
  );
}
