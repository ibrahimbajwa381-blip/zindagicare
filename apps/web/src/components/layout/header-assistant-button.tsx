"use client";

import { Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import { Roles } from "@zindagi/shared";
import { HeaderIconButton } from "@/components/layout/header-icon-button";
import { siteConfig } from "@/config/site";

type HeaderAssistantButtonProps = {
  label: string;
};

export function HeaderAssistantButton({ label }: HeaderAssistantButtonProps) {
  const { data: session } = useSession();
  if (!session?.user) return null;

  const isPatient = session.user.roles?.includes(Roles.PATIENT);
  if (!isPatient) return null;

  return (
    <HeaderIconButton
      href={siteConfig.links.assistant}
      icon={Sparkles}
      label={label}
    />
  );
}
