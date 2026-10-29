import { Roles } from "@zindagi/shared";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { ProviderMessagesPage } from "@/features/chat/components/provider-messages-page";

export const metadata = { title: "Messages | Nurse" };

type PageProps = {
  searchParams: Promise<{ patient?: string }>;
};

export default async function NurseMessagesPage({ searchParams }: PageProps) {
  const { patient } = await searchParams;
  return (
    <ProviderMessagesPage
      role={Roles.NURSE}
      path={AUTH_ROUTES.nurseMessages}
      patientId={patient}
    />
  );
}
