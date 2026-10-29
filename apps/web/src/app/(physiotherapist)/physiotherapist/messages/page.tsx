import { Roles } from "@zindagi/shared";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { ProviderMessagesPage } from "@/features/chat/components/provider-messages-page";

export const metadata = { title: "Messages | Physiotherapist" };

type PageProps = {
  searchParams: Promise<{ patient?: string }>;
};

export default async function PhysiotherapistMessagesPage({ searchParams }: PageProps) {
  const { patient } = await searchParams;
  return (
    <ProviderMessagesPage
      role={Roles.PHYSIOTHERAPIST}
      path={AUTH_ROUTES.physiotherapistMessages}
      patientId={patient}
    />
  );
}
