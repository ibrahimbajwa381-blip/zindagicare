import { cn } from "@zindagi/shared";
import { OnlineConsultService } from "@/server/services/online-consult.service";
import { PatientOnlineBookingCard } from "@/features/consult/components/patient-online-booking-card";
import type { OnlinePatientBookingDto } from "@/features/consult/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

type Props = {
  initialBooking: OnlinePatientBookingDto | null;
};

export function PatientOnlineBookingSection({ initialBooking }: Props) {
  if (!initialBooking) return null;

  return (
    <Card className={cn(surfaceCardInteractive, "flex h-full flex-col")}>
      <CardHeader>
        <CardTitle className="text-base">Online consultation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <PatientOnlineBookingCard booking={initialBooking} variant="dashboard" />
      </CardContent>
    </Card>
  );
}

export async function loadPatientOnlineBooking(userId: string) {
  return OnlineConsultService.getPatientBooking(userId);
}
