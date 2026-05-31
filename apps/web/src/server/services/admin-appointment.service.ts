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

export type AdminAppointmentRow = {
  id: string;
  type: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  isOnline: boolean;
  patient: { id: string; name: string; phone?: string };
  doctor: { id: string; name: string };
  cancellationReason?: string;
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
    .populate("patientId", "name phone")
    .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
    .sort({ scheduledStart: -1 })
    .limit(filters?.limit ?? 100)
    .lean();

  return appointments.map((a) => {
    const patient = a.patientId as { _id?: { toString(): string }; name?: string; phone?: string } | null;
    const doctorProfile = a.doctorId as {
      _id?: { toString(): string };
      userId?: { name?: string };
    } | null;

    return {
      id: a._id.toString(),
      type: a.type,
      status: a.status,
      scheduledStart: a.scheduledStart.toISOString(),
      scheduledEnd: a.scheduledEnd.toISOString(),
      isOnline: a.isOnline ?? false,
      patient: {
        id: patient?._id?.toString() ?? "",
        name: patient?.name ?? "Patient",
        phone: patient?.phone ?? undefined,
      },
      doctor: {
        id: doctorProfile?._id?.toString() ?? "",
        name: doctorProfile?.userId?.name ?? "Doctor",
      },
      cancellationReason: a.cancellationReason ?? undefined,
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
      },
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
