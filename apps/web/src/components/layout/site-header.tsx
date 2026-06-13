"use client";

import { UnifiedHeader } from "@/components/layout/unified-header";

type SiteHeaderProps = {
  /** Load patient city/phone in the account menu (patient dashboard). */
  enrichUserFromProfile?: boolean;
};

export function SiteHeader({ enrichUserFromProfile = false }: SiteHeaderProps) {
  return <UnifiedHeader enrichUserFromProfile={enrichUserFromProfile} />;
}
