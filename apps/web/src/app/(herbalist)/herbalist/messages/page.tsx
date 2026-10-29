import { Roles } from "@zindagi/shared";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { ProviderMessagesPage } from "@/features/chat/components/provider-messages-page";

export const metadata = { title: "Messages | Herbalist" };

type PageProps = {
  searchParams: Promise<{ patient?: string }>;
};

export default async function HerbalistMessagesPage({ searchParams }: PageProps) {
  const { patient } = await searchParams;
  return (
    <ProviderMessagesPage
      role={Roles.HERBALIST}
      path={AUTH_ROUTES.herbalistMessages}
      patientId={patient}
    />
  );
}
