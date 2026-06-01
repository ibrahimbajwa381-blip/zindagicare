import {
  connectDatabase,
  DoctorProfileModel,
  SundaySlotInstanceModel,
  SundaySlotTemplateModel,
  AppointmentModel,
  UserModel,
} from "@zindagi/database";
import {
  AppointmentStatuses,
  AppointmentTypes,
  SlotStatuses,
  SUNDAY_CONSULT_CONFIG,
  VerificationStatuses,
} from "@zindagi/shared";
import {
  formatSundayDateKey,
  generateSlotTimes,
  getNextSundayDate,
  parseSundayDateKey,
} from "@/lib/sunday/date-utils";
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettingsDto,
} from "./system-settings.service";
import { SundayConsultService } from "./sunday-consult.service";

export type AdminSundayOverview = SystemSettingsDto & {
  nextSundayKey: string;
  doctors: {
    doctorId: string;
    name: string;
    specialties: string[];
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
  }[];
  queue: {
    appointmentId: string;
    patientName: string;
    patientPhone?: string;
    doctorName: string;
    scheduledStart: string;
    status: string;
  }[];
};

export async function getAdminSundayOverview(
  dateKey?: string,
): Promise<AdminSundayOverview> {
  await connectDatabase();

  const sundayDate = dateKey ? parseSundayDateKey(dateKey) : getNextSundayDate();
  const key = formatSundayDateKey(sundayDate);
  const settings = await getSystemSettings();

  const doctors = await DoctorProfileModel.find({
    sundayConsultEnabled: true,
    verificationStatus: VerificationStatuses.APPROVED,
    isListed: true,
  })
    .populate("userId", "name")
    .lean();

  const instances = await SundaySlotInstanceModel.find({
    sundayDate,
<<<<<<< HEAD
    doctorId: { $in: doctors.map((d) => d._id.toString()) },
  } as Record<string, unknown>).lean();
=======
    doctorId: { $in: doctors.map((d) => d._id) },
  }).lean();
>>>>>>> de54e62 (google verification)

  const instanceMap = new Map(
    instances.map((i) => [i.doctorId.toString(), i]),
  );

  const doctorStats = doctors.map((doc) => {
    const inst = instanceMap.get(doc._id.toString());
    const slots = inst?.slots ?? [];
    const booked = slots.filter(
      (s) =>
        s.status === SlotStatuses.BOOKED ||
        s.status === SlotStatuses.COMPLETED ||
        s.status === SlotStatuses.HELD,
    ).length;
    const available = slots.filter((s) => s.status === SlotStatuses.AVAILABLE).length;
    const user = doc.userId as { name?: string } | null;

    return {
      doctorId: doc._id.toString(),
      name: user?.name ?? "Doctor",
      specialties: doc.specialties ?? [],
      totalSlots: slots.length,
      bookedSlots: booked,
      availableSlots: available,
    };
  });

  const appointments = await AppointmentModel.find({
    type: AppointmentTypes.SUNDAY_FREE,
    scheduledStart: {
      $gte: sundayDate,
      $lt: new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000),
    },
    status: {
      $in: [
        AppointmentStatuses.PENDING,
        AppointmentStatuses.CONFIRMED,
        AppointmentStatuses.IN_PROGRESS,
      ],
    },
  })
    .populate("patientId", "name phone")
    .populate({ path: "doctorId", populate: { path: "userId", select: "name" } })
    .sort({ scheduledStart: 1 })
    .lean();

  const queue = appointments.map((a) => {
    const patient = a.patientId as { name?: string; phone?: string } | null;
    const doctor = a.doctorId as { userId?: { name?: string } } | null;
    return {
      appointmentId: a._id.toString(),
      patientName: patient?.name ?? "Patient",
      patientPhone: patient?.phone ?? undefined,
      doctorName: doctor?.userId?.name ?? "Doctor",
      scheduledStart: a.scheduledStart.toISOString(),
      status: a.status,
    };
  });

  return {
    ...settings,
    nextSundayKey: key,
    doctors: doctorStats,
    queue,
  };
}

export async function updateAdminSundaySettings(
  patch: Partial<SystemSettingsDto>,
): Promise<SystemSettingsDto> {
  return updateSystemSettings(patch);
}

/** Reset all Sunday slot instances for the upcoming Sunday (clears bookings). */
export async function resetWeeklySundaySlots(dateKey?: string) {
  await connectDatabase();

  const sundayDate = dateKey ? parseSundayDateKey(dateKey) : getNextSundayDate();
  const settings = await getSystemSettings();

  const templates = await SundaySlotTemplateModel.find({ isActive: true }).lean();
  let resetCount = 0;

  for (const template of templates) {
    const key = formatSundayDateKey(sundayDate);
    const slotDefs = generateSlotTimes(
      key,
      template.startTimeLocal,
      template.endTimeLocal,
      settings.sundaySlotDurationMins ?? template.slotDurationMins,
      settings.sundayDefaultMaxSlots ?? template.maxSlots,
    );

    const slots = slotDefs.map((s) => ({
      slotId: s.slotId,
      startAt: s.startAt,
      endAt: s.endAt,
      status: SlotStatuses.AVAILABLE,
    }));

    await SundaySlotInstanceModel.findOneAndUpdate(
<<<<<<< HEAD
      { doctorId: template.doctorId, sundayDate } as Record<string, unknown>,
=======
      { doctorId: template.doctorId, sundayDate },
>>>>>>> de54e62 (google verification)
      {
        $set: {
          slots,
          timezone: template.timezone,
          materializedFromTemplateId: template._id,
        },
      },
      { upsert: true },
    );
    resetCount += 1;
  }

  return { resetCount, sundayDateKey: formatSundayDateKey(sundayDate) };
}

export async function applyDefaultSlotsToAllDoctors() {
  await connectDatabase();
  const settings = await getSystemSettings();

  const doctors = await DoctorProfileModel.find({
    sundayConsultEnabled: true,
    verificationStatus: VerificationStatuses.APPROVED,
  });

  let updated = 0;
  for (const doctor of doctors) {
    await SundaySlotTemplateModel.findOneAndUpdate(
<<<<<<< HEAD
      { doctorId: doctor._id } as Record<string, unknown>,
=======
      { doctorId: doctor._id },
>>>>>>> de54e62 (google verification)
      {
        $set: {
          slotDurationMins: settings.sundaySlotDurationMins,
          maxSlots: settings.sundayDefaultMaxSlots,
          isActive: true,
          dayOfWeek: SUNDAY_CONSULT_CONFIG.dayOfWeek,
          timezone: SUNDAY_CONSULT_CONFIG.timezone,
        },
        $setOnInsert: {
          startTimeLocal: "09:00",
          endTimeLocal: "12:00",
        },
      },
      { upsert: true },
    );

    await SundayConsultService.materializeInstance(
      doctor._id.toString(),
      getNextSundayDate(),
    );
    updated += 1;
  }

  return { updated };
}
