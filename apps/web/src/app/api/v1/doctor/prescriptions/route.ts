import { createPrescriptionSchema, type CreatePrescriptionInput } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { PrescriptionService } from "@/server/services/prescription.service";

export const POST = withApiHandler<CreatePrescriptionInput>(
  async ({ session, body }) => {
    return PrescriptionService.createForAppointment(session!.user!.id, body);
  },
  { auth: true, roles: ["doctor"], bodySchema: createPrescriptionSchema },
);

export const GET = withApiHandler(
  async ({ session, searchParams }) => {
    const patientId = searchParams.get("patientId") ?? undefined;
    const appointmentId = searchParams.get("appointmentId") ?? undefined;
    return PrescriptionService.listForDoctor(session!.user!.id, {
      patientId,
      appointmentId,
    });
  },
  { auth: true, roles: ["doctor"] },
);
