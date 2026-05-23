import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SundayExplainer } from "@/features/sunday-consult/components/sunday-explainer";
import { formatNextSundayLong } from "@/lib/sunday/display";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

export const metadata = { title: "Dashboard" };

export default async function PatientDashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <PageShell variant="brand" spacing="default" narrow flipBlur>
      <PageTitle
        title={`Hello, ${session.user.name ?? "Patient"}`}
        description="Your appointments and family health hub."
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className={surfaceCardInteractive}>
          <CardHeader>
            <CardTitle className="text-base">Upcoming appointments</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">None scheduled yet.</CardContent>
        </Card>
        <Card className="border-brand-light/40 bg-brand-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Sunday Free Consult</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Free 10-minute video call with a verified doctor on{" "}
              <strong className="text-slate-800">{formatNextSundayLong()}</strong> — Rs. 0,
              from home.
            </p>
            <Button asChild>
              <Link href={siteConfig.links.sundayConsult}>Book free Sunday slot</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="mt-8">
        <SundayExplainer variant="compact" />
      </div>
    </PageShell>
  );
}
