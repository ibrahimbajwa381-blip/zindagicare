import Link from "next/link";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

type Props = {
  searchParams: Promise<{ paymentId?: string; reason?: string }>;
};

export default async function ConsultBookingFailedPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <>
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title="Payment not completed"
          description="Your consultation was not booked because payment did not go through."
        />
      </PageSection>
      <PageSection variant="brand" spacing="lg">
        <div className={`mx-auto max-w-xl space-y-4 p-6 ${surfaceCardInteractive}`}>
          {params.reason && (
            <p className="text-sm text-slate-500">Reason: {params.reason.replace(/_/g, " ")}</p>
          )}
          <p className="text-sm text-slate-600">
            No charges were applied for an incomplete payment. You can choose another slot and try
            again. Remember: only{" "}
            <Link href={siteConfig.links.sundayConsult} className="text-brand hover:underline">
              Sunday consults
            </Link>{" "}
            are free.
          </p>
          <Button asChild className="bg-brand text-white hover:bg-brand-dark">
            <Link href={siteConfig.links.doctors}>Try again</Link>
          </Button>
        </div>
      </PageSection>
    </>
  );
}
