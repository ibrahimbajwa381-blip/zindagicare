"use client";

import { usePathname } from "next/navigation";
import { useMounted } from "@/hooks/use-mounted";
import { useTranslations } from "@/i18n/locale-provider";
import { getWhatsAppSupportUrl } from "@/lib/support-contact";
import { WhatsAppIcon } from "@/components/shared/whatsapp-cta-button";
import { cn } from "@zindagi/shared";

export function WhatsAppFloatButton() {
  const mounted = useMounted();
  const pathname = usePathname();
  const t = useTranslations();
  const href = getWhatsAppSupportUrl(t.common.whatsappPrefill);

  if (!mounted) return null;
  if (pathname?.startsWith("/doctor")) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={t.common.whatsappChat}
      aria-label={t.common.whatsappChat}
      className={cn(
        "group fixed z-40 flex h-14 w-14 items-center justify-center rounded-full",
        "bg-[#25D366] text-white shadow-lg ring-2 ring-white",
        "md:transition-transform md:duration-200 md:hover:scale-105 md:active:scale-95",
        "bottom-[max(1.25rem,env(safe-area-inset-bottom))] start-[max(1rem,env(safe-area-inset-left))]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2",
      )}
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
