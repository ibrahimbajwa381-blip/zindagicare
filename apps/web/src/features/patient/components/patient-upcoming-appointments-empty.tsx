import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

type Props = {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  bookConsultLabel: string;
  bookConsultHref: string;
  freeSundayLabel: string;
  freeSundayHref: string;
};

export function PatientUpcomingAppointmentsEmpty({
  title,
  emptyTitle,
  emptyDescription,
  bookConsultLabel,
  bookConsultHref,
  freeSundayLabel,
  freeSundayHref,
}: Props) {
  return (
    <Card className={cn(surfaceCardInteractive, "flex h-full min-w-0 flex-col")}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-gradient-to-b from-brand-muted/40 to-white px-4 py-8 text-center sm:px-6 sm:py-10">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand shadow-sm ring-1 ring-slate-200/80">
            <CalendarDays className="size-7" aria-hidden />
          </span>
          <p className="mt-4 font-display text-base font-semibold text-slate-900">{emptyTitle}</p>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 sm:max-w-sm">
            {emptyDescription}
          </p>
          <div className="mt-5 flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="w-full sm:w-auto">
              <Link href={bookConsultHref}>{bookConsultLabel}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href={freeSundayHref}>{freeSundayLabel}</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
