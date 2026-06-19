"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useTranslations } from "@/i18n/locale-provider";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { formatMessage } from "@/i18n/messages";
import type { PrescriptionSummary } from "@/features/prescriptions/types";

type Props = {
  initialItems?: PrescriptionSummary[];
};

export function PatientPrescriptionsSection({ initialItems }: Props) {
  const t = useTranslations();
  const copy = t.prescriptions;
  const [items, setItems] = useState<PrescriptionSummary[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!initialItems);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/patient/prescriptions");
    const json = await res.json();
    if (json.success) setItems(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialItems) {
      void load();
    }
  }, [initialItems, load]);

  if (loading) {
    return <LoadingScreen message={copy.loading} />;
  }

  return (
    <Card className={surfaceCard}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">{copy.title}</CardTitle>
        {items.length > 0 && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/prescriptions">{copy.viewAll}</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{copy.empty}</p>
        ) : (
          <ul className="space-y-3">
            {items.slice(0, 5).map((rx) => (
              <li
                key={rx.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {formatMessage(copy.fromDoctor, { name: rx.doctorName.replace(/^Dr\.?\s*/i, "") })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {formatKarachiDateTime(rx.issuedAt)} ·{" "}
                    {rx.medicationCount === 1
                      ? copy.medicationCountOne
                      : formatMessage(copy.medicationCountMany, {
                          count: rx.medicationCount,
                        })}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={rx.downloadUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-3.5 w-3.5" />
                    {copy.download}
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
