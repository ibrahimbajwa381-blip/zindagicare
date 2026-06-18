import { siteConfig } from "@/config/site";

export function getWhatsAppSupportUrl(prefill?: string) {
  const base = `https://wa.me/${siteConfig.supportWhatsApp}`;
  if (!prefill?.trim()) return base;
  return `${base}?text=${encodeURIComponent(prefill.trim())}`;
}
