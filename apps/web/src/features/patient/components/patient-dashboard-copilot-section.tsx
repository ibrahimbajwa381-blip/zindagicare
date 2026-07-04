"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { useTranslations } from "@/i18n/locale-provider";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

export function PatientDashboardCopilotSection() {
  const t = useTranslations();

  return (
    <Card className={cn(surfaceCardInteractive, "shrink-0")}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-brand">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base">{t.dashboard.copilot.title}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{t.dashboard.copilot.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full sm:w-auto">
          <Link href={siteConfig.links.assistant}>{t.dashboard.copilot.cta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
