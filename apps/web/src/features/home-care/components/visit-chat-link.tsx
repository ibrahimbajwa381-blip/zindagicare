"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/locale-provider";

/** Opens the patient ↔ provider chat for a home visit. */
export function VisitChatLink({ href, audience }: { href: string; audience: "patient" | "provider" }) {
  const copy = useTranslations().homeCare.visitChat;
  return (
    <Button size="sm" variant="outline" asChild className="gap-1">
      <Link href={href}>
        <MessageCircle className="h-3.5 w-3.5" />
        {audience === "patient" ? copy.messagePatient : copy.messageProvider}
      </Link>
    </Button>
  );
}
