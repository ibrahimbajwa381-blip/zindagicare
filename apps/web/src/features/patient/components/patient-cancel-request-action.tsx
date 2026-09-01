import Link from "next/link";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

type Props = {
  appointmentId: string;
  canRequestCancellation: boolean;
  cancellationRequestStatus: string;
};

export function PatientCancelRequestAction({
  appointmentId,
  canRequestCancellation,
  cancellationRequestStatus,
}: Props) {
  if (cancellationRequestStatus === "pending") {
    return (
      <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-800">
        Refund request sent — our team will review it and send your money back shortly.
      </p>
    );
  }

  if (!canRequestCancellation) return null;

  return (
    <div className="mt-3">
      <Button
        asChild
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5 border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100"
      >
        <Link href={`${siteConfig.links.refundRequest}?appointmentId=${appointmentId}`}>
          <Undo2 className="h-3.5 w-3.5" />
          Cancel & apply for refund
        </Link>
      </Button>
    </div>
  );
}
