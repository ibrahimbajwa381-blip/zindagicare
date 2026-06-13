"use client";

import { MessageCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { HeaderIconButton } from "@/components/layout/header-icon-button";
import { messagesHref } from "@/lib/nav/header-actions";

type HeaderChatButtonProps = {
  count: number;
  label: string;
};

export function HeaderChatButton({ count, label }: HeaderChatButtonProps) {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <HeaderIconButton
      href={messagesHref(session.user.roles)}
      icon={MessageCircle}
      label={label}
      count={count}
    />
  );
}
