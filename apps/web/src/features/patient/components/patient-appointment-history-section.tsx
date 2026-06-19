import Image from "next/image";
import Link from "next/link";
import { Calendar, Video, FileText } from "lucide-react";
import { AppointmentStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollChainContainer } from "@/components/layout/scroll-chain-container";
import { videoConsultPath } from "@/features/consult/paths";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { surfaceCardInteractive, surfaceInset } from "@/lib/ui/surfaces";
import { PatientAppointmentReviewAction } from "@/features/patient/components/patient-appointment-review-action";
import type { PatientAppointmentHistoryItem } from "@/server/services/patient-appointments.service";
import { cn } from "@zindagi/shared";

type Props = {
  items: PatientAppointmentHistoryItem[];
  title: string;
  empty: string;
  missedLabel: string;
  statusLabels: Record<string, string>;
  reviewCopy: {
    rateVisit: string;
    yourRating: string;
    ratingLabel: string;
    commentLabel: string;
    commentPlaceholder: string;
    submit: string;
    submitting: string;
    submitError: string;
    thankYou: string;
    optional: string;
    cancel: string;
  };
  viewPrescriptionLabel: string;
};

function statusBadgeClass(status: string, isMissed: boolean) {
  if (isMissed) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === AppointmentStatuses.COMPLETED) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  if (status === AppointmentStatuses.NO_SHOW) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-brand-light/40 bg-brand-muted text-brand-dark";
}

function DoctorAvatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return (
      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200/80">
        <Image src={src} alt={name} fill className="object-cover object-top" sizes="44px" />
      </span>
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-xs font-semibold text-brand-dark ring-1 ring-slate-200/80">
      {name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

export function PatientAppointmentHistorySection({
  items,
  title,
  empty,
  missedLabel,
  statusLabels,
  reviewCopy,
  viewPrescriptionLabel,
}: Props) {
  return (
    <Card className={cn(surfaceCardInteractive, "overflow-hidden")}>
      <CardHeader className="border-b border-slate-100/80 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <ScrollChainContainer
        aria-label={title}
        className={cn(
          "px-6 pb-6 pt-4",
          "max-h-[calc(100vh-6rem)] supports-[height:100dvh]:max-h-[calc(100dvh-6rem)]",
          "sm:max-h-[calc(100vh-6.75rem)] sm:supports-[height:100dvh]:max-h-[calc(100dvh-6.75rem)]",
        )}
      >
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{empty}</p>
        ) : (
          <ul className="space-y-3 pr-1">
            {items.map((item) => {
              const statusLabel = item.isMissed
                ? missedLabel
                : (statusLabels[item.status] ?? item.status.replaceAll("_", " "));

              return (
                <li key={item.appointmentId} className={cn(surfaceInset, "p-4")}>
                  <div className="flex flex-wrap items-start gap-3">
                    <DoctorAvatar name={item.doctor.name} src={item.doctor.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{item.doctor.name}</p>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {item.typeLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold",
                            statusBadgeClass(item.status, item.isMissed),
                            item.isMissed && "uppercase tracking-wide",
                          )}
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">{item.doctor.specialty}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-700">
                        <Calendar className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                        {formatKarachiDateTime(item.scheduledStart)}
                      </p>
                      {item.consultationFee != null && item.consultationFee > 0 ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Fee: Rs. {item.consultationFee.toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    {item.canJoin ? (
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link href={videoConsultPath(item.appointmentId)}>
                          <Video className="h-3.5 w-3.5" />
                          Join
                        </Link>
                      </Button>
                    ) : item.prescription ? (
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <a
                          href={item.prescription.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {viewPrescriptionLabel}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  {(item.canReview || item.review) && !item.isMissed ? (
                    <PatientAppointmentReviewAction
                      appointmentId={item.appointmentId}
                      doctorName={item.doctor.name}
                      copy={reviewCopy}
                      initialReview={item.review}
                      canReview={item.canReview}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </ScrollChainContainer>
    </Card>
  );
}
