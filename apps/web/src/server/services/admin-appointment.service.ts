import {
  connectDatabase,
  AppointmentModel,
  DoctorProfileModel,
  SundaySlotInstanceModel,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  AppointmentTypes,
  SlotStatuses,
} from "@zindagi/shared";
import { safeDisplayText } from "@/server/lib/decrypt-pii";

export type AdminAppointmentRow = {
  id: string;
  type: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  isOnline: boolean;
  patient: { id: string; name: string; phone?: string; email?: string };
  doctor: { id: string; name: string; specialty?: string };
  cancellationReason?: string;
  patientNotes?: string;
  clinic?: { hospitalName?: string; address?: string; city?: string };
  amountPkr?: number;
  paymentStatus?: string;
  createdAt: string;
};

const TYPE_FILTERS = {
  online: AppointmentTypes.ONLINE,
  sunday: AppointmentTypes.SUNDAY_FREE,
  home: AppointmentTypes.HOME_VISIT,
  clinic: AppointmentTypes.CLINIC,
} as const;

export async function listAdminAppointments(filters?: {
  type?: keyof typeof TYPE_FILTERS;
  status?: string;
  limit?: number;
}): Promise<AdminAppointmentRow[]> {
  await connectDatabase();

  const query: Record<string, unknown> = { deletedAt: null };

  if (filters?.type && TYPE_FILTERS[filters.type]) {
    query.type = TYPE_FILTERS[filters.type];
  }
  if (filters?.status) {
    query.status = filters.status;
  }

  const appointments = await AppointmentModel.find(query)
    .populate("patientId", "name phone email")
    .populate({
      path: "doctorId",
      populate: { path: "userId", select: "name" },
      select: "specialties",
    })
    .populate("paymentId", "amount status")
    .sort({ scheduledStart: -1 })
    .limit(filters?.limit ?? 100)
    .lean();

  return appointments.map((a) => {
    const patient = a.patientId as {
      _id?: { toString(): string };
      name?: string;
      phone?: string;
      email?: string;
    } | null;
    const doctorProfile = a.doctorId as {
      _id?: { toString(): string };
      userId?: { name?: string };
      specialties?: string[];
    } | null;
    const payment = a.paymentId as { amount?: number; status?: string } | null;

    return {
      id: a._id.toString(),
      type: a.type,
      status: a.status,
      scheduledStart: a.scheduledStart.toISOString(),
      scheduledEnd: a.scheduledEnd.toISOString(),
      isOnline: a.isOnline ?? false,
      patient: {
        id: patient?._id?.toString() ?? "",
        name: safeDisplayText(patient?.name) ?? "Patient",
        phone: safeDisplayText(patient?.phone) ?? undefined,
        email: safeDisplayText(patient?.email) ?? undefined,
      },
      doctor: {
        id: doctorProfile?._id?.toString() ?? "",
        name: doctorProfile?.userId?.name ?? "Doctor",
        specialty: doctorProfile?.specialties?.[0] ?? undefined,
      },
      cancellationReason: a.cancellationReason ?? undefined,
      patientNotes: a.patientNotes ?? undefined,
      clinic:
        a.clinic && (a.clinic.hospitalName || a.clinic.address || a.clinic.city)
          ? {
              hospitalName: a.clinic.hospitalName ?? undefined,
              address: a.clinic.address ?? undefined,
              city: a.clinic.city ?? undefined,
            }
          : undefined,
      amountPkr: payment?.amount ?? undefined,
      paymentStatus: payment?.status ?? undefined,
      createdAt: (a.createdAt as Date | undefined)?.toISOString() ?? a.scheduledStart.toISOString(),
    };
  });
}

export async function adminCancelAppointment(
  appointmentId: string,
  adminUserId: string,
  reason?: string,
) {
  await connectDatabase();

  const appointment = await AppointmentModel.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", "NOT_FOUND", 404);

  if (
    appointment.status === AppointmentStatuses.CANCELLED ||
    appointment.status === AppointmentStatuses.COMPLETED
  ) {
    throw new AppError("Appointment cannot be cancelled", "CONFLICT", 409);
  }

  appointment.status = AppointmentStatuses.CANCELLED;
  appointment.cancellationReason = reason ?? "Cancelled by admin";
  appointment.set("cancelledBy", adminUserId);
  await appointment.save();

  if (
    appointment.type === AppointmentTypes.SUNDAY_FREE &&
    appointment.sundaySlotInstanceId &&
    appointment.sundaySlotId
  ) {
    await SundaySlotInstanceModel.updateOne(
      {
        _id: appointment.sundaySlotInstanceId,
        "slots.slotId": appointment.sundaySlotId,
      } as Record<string, unknown>,
      {
        $set: {
          "slots.$.status": SlotStatuses.CANCELLED,
          "slots.$.patientId": undefined,
          "slots.$.appointmentId": undefined,
        },
      },
    );
  }

  return { id: appointment._id.toString(), status: appointment.status };
}

export async function adminReassignAppointment(
  appointmentId: string,
  newDoctorProfileId: string,
) {
  await connectDatabase();

  const appointment = await AppointmentModel.findById(appointmentId);
  if (!appointment) throw new AppError("Appointment not found", "NOT_FOUND", 404);

  if (
    appointment.status === AppointmentStatuses.CANCELLED ||
    appointment.status === AppointmentStatuses.COMPLETED
  ) {
    throw new AppError("Appointment cannot be reassigned", "CONFLICT", 409);
  }

  const doctor = await DoctorProfileModel.findById(newDoctorProfileId).populate(
    "userId",
    "name",
  );
  if (!doctor?.isListed) {
    throw new AppError("Doctor not available", "NOT_FOUND", 404);
  }

  await AppointmentModel.findByIdAndUpdate(appointmentId, {
    $set: { doctorId: newDoctorProfileId },
  });

  const doctorUser = doctor.userId as { name?: string } | null;
  return {
    id: appointmentId,
    doctor: {
      id: doctor._id.toString(),
      name: doctorUser?.name ?? "Doctor",
    },
  };
}
