import type { NextRequest } from "next/server";
import {
  requestAppointmentCancellationSchema,
  type RequestAppointmentCancellationInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { PatientAppointmentsService } from "@/server/services/patient-appointments.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const handler = withApiHandler<RequestAppointmentCancellationInput>(
    async ({ session, body }) => {
      return PatientAppointmentsService.requestCancellation(id, session!.user!.id, body);
    },
    { auth: true, bodySchema: requestAppointmentCancellationSchema },
  );

  return handler(req as never);
}
