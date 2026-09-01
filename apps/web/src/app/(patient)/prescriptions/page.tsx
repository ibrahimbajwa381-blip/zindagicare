import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canUsePatientWorkspace } from "@zindagi/shared";
import { resolvePostAuthPath } from "@/lib/auth/routes";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { PrescriptionService } from "@/server/services/prescription.service";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { formatMessage } from "@/i18n/messages";
import { surfaceCard } from "@/lib/ui/surfaces";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "My prescriptions" };

export default async function PatientPrescriptionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/prescriptions");

  if (!canUsePatientWorkspace(session.user.roles)) {
    redirect(resolvePostAuthPath(session.user));
  }

  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.prescriptions;
  const items = await PrescriptionService.listForPatient(session.user.id);

  return (
    <PageShell narrow>
      <PageTitle
        eyebrow={copy.eyebrow}
        title={copy.pageTitle}
        description={copy.pageDescription}
      />

      {items.length === 0 ? (
        <Card className={surfaceCard}>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-slate-500">{copy.empty}</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard">{copy.backToDashboard}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((rx) => (
            <li key={rx.id}>
              <Card className={surfaceCard}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatMessage(copy.fromDoctor, {
                        name: rx.doctorName.replace(/^Dr\.?\s*/i, ""),
                      })}
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
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
