import { randomUUID } from "crypto";
import {
  connectDatabase,
  UserModel,
  DoctorProfileModel,
  SundaySlotTemplateModel,
  SundaySlotInstanceModel,
  AppointmentModel,
  type EmbeddedSlot,
} from "@zindagi/database";
import {
  AppError,
  ErrorCodes,
  AppointmentStatuses,
  AppointmentTypes,
  IntakeSources,
  SlotStatuses,
  SUNDAY_CONSULT_CONFIG,
} from "@zindagi/shared";
import { MedicalIntakeService } from "@/server/services/medical-intake.service";
import {
  canBookNow,
  formatSundayDateKey,
  generateSlotTimes,
  getNextSundayDate,
  parseSundayDateKey,
} from "@/lib/sunday/date-utils";
import { publishSundayEvent } from "@/lib/realtime/sunday-emitter";
import { sendBookingConfirmation } from "@/lib/notifications/sunday-reminders";
import { sendDoctorConsultBooked } from "@/lib/notifications/consult-notifications";
import { isSundayConsultGloballyEnabled } from "./system-settings.service";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import type {
  SundayConfirmBookingResult,
  SundayPatientBookingDto,
} from "@/features/sunday-consult/types";
import { mongoFilter } from "@/lib/mongo/query";
import { resolveMongoRefId } from "@/lib/mongo/resolve-id";
import type { HydratedDocument } from "mongoose";
import type { AppointmentDocument } from "@zindagi/database";

type CreatedAppointmentRow = {
  _id: { toString(): string };
  scheduledStart: Date;
  scheduledEnd: Date;
  status: SundayConfirmBookingResult["status"];
};

function toConfirmBookingResult(doc: CreatedAppointmentRow): SundayConfirmBookingResult {
  return {
    appointmentId: doc._id.toString(),
    scheduledStart: doc.scheduledStart.toISOString(),
    scheduledEnd: doc.scheduledEnd.toISOString(),
    status: doc.status,
  };
}

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatuses.PENDING,
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
];

const HOLD_SWEEP_INTERVAL_MS = 60_000;
let lastHoldSweepAt = 0;

export class SundayConsultService {
  static async ensureConnected() {
    await connectDatabase();
    const now = Date.now();
    if (now - lastHoldSweepAt < HOLD_SWEEP_INTERVAL_MS) return;
    lastHoldSweepAt = now;
    await SundayConsultService.releaseExpiredHolds();
  }

  /** Remove holds past heldUntil */
  static async releaseExpiredHolds() {
    const now = new Date();
    const instances = await SundaySlotInstanceModel.find({
      "slots.status": SlotStatuses.HELD,
      "slots.heldUntil": { $lt: now },
    });

    for (const instance of instances) {
      let changed = false;
      for (const slot of instance.slots) {
        if (
          slot.status === SlotStatuses.HELD &&
          slot.heldUntil &&
          slot.heldUntil < now
        ) {
          slot.status = SlotStatuses.AVAILABLE;
          slot.heldUntil = undefined;
          slot.holdToken = undefined;
          slot.patientId = undefined;
          changed = true;
        }
      }
      if (changed) {
        await instance.save();
        publishSundayEvent({
          type: "instance_updated",
          doctorId: instance.doctorId.toString(),
          sundayDateKey: formatSundayDateKey(instance.sundayDate),
          instanceId: instance._id.toString(),
        });
      }
    }
  }

  static async listSundayDoctors(city = "Lahore", dateKey?: string) {
    await SundayConsultService.ensureConnected();
    const globallyEnabled = await isSundayConsultGloballyEnabled();
    if (!globallyEnabled) return [];

    const sundayDate = dateKey
      ? parseSundayDateKey(dateKey)
      : getNextSundayDate();
    const key = formatSundayDateKey(sundayDate);

    const doctors = await DoctorProfileModel.find({
      sundayConsultEnabled: true,
      isListed: true,
      verificationStatus: "approved",
      coverageCities: city,
    })
      .populate("userId", "name avatarUrl")
      .lean();

    const instances = await SundaySlotInstanceModel.find(
      mongoFilter({
        sundayDate,
        doctorId: { $in: doctors.map((d) => d._id.toString()) },
      }),
    ).lean();

    const instanceMap = new Map(
      instances.map((i) => [i.doctorId.toString(), i]),
    );

    return doctors.map((doc) => {
      const inst = instanceMap.get(doc._id.toString());
      const slots = inst?.slots ?? [];
      const available = slots.filter((s) => s.status === SlotStatuses.AVAILABLE).length;
      const user = doc.userId as { name?: string; avatarUrl?: string } | null;

      const name = user?.name ?? "Doctor";
      return {
        doctorId: doc._id.toString(),
        name,
        avatarUrl: resolveDoctorPortrait(name, user?.avatarUrl),
        specialties: doc.specialties,
        ratingAvg: doc.ratingAvg,
        ratingCount: doc.ratingCount,
        pmdcVerified: doc.pmdcVerified,
        sundayDateKey: key,
        instanceId: inst?._id?.toString(),
        availableSlots: available,
        totalSlots: slots.length,
        isFull: slots.length > 0 && available === 0,
      };
    });
  }

  static async getSlotsForDoctor(doctorId: string, dateKey?: string) {
    await SundayConsultService.ensureConnected();
    const sundayDate = dateKey
      ? parseSundayDateKey(dateKey)
      : getNextSundayDate();
    const key = formatSundayDateKey(sundayDate);

    const doctor = await DoctorProfileModel.findById(doctorId).lean();
    if (!doctor?.sundayConsultEnabled) {
      throw new AppError("Sunday consult not available", ErrorCodes.NOT_FOUND, 404);
    }

    let instance = await SundaySlotInstanceModel.findOne(
      mongoFilter({ doctorId, sundayDate }),
    );

    if (!instance) {
      instance = await SundayConsultService.materializeInstance(
        doctorId,
        sundayDate,
      );
    }

    return {
      doctorId,
      instanceId: instance._id.toString(),
      sundayDateKey: key,
      sundayDate: instance.sundayDate,
      slots: instance.slots.map((s) => ({
        slotId: s.slotId,
        startAt: s.startAt,
        endAt: s.endAt,
        status: s.status,
        heldUntil: s.heldUntil,
      })),
      bookingOpensAt: canBookNow(sundayDate, false)
        ? null
        : SUNDAY_CONSULT_CONFIG.bookingOpensDaysBefore,
    };
  }

  static async materializeInstance(doctorId: string, sundayDate: Date) {
    const template = await SundaySlotTemplateModel.findOne(
      mongoFilter({ doctorId, isActive: true }),
    );

    if (!template) {
      throw new AppError(
        "Doctor has no Sunday slot template",
        ErrorCodes.NOT_FOUND,
        404,
      );
    }

    const key = formatSundayDateKey(sundayDate);
    const slotDefs = generateSlotTimes(
      key,
      template.startTimeLocal,
      template.endTimeLocal,
      template.slotDurationMins,
      template.maxSlots,
    );

    const slots: EmbeddedSlot[] = slotDefs.map((s) => ({
      slotId: s.slotId,
      startAt: s.startAt,
      endAt: s.endAt,
      status: SlotStatuses.AVAILABLE,
    }));

    const instance = await SundaySlotInstanceModel.findOneAndUpdate(
      mongoFilter({ doctorId, sundayDate }),
      {
        $setOnInsert: {
          doctorId,
          sundayDate,
          timezone: template.timezone,
          materializedFromTemplateId: template._id,
          slots,
        },
      },
      { upsert: true, new: true },
    );

    if (!instance) {
      throw new AppError("Could not materialize Sunday slots", "INTERNAL_ERROR", 500);
    }
    return instance;
  }

  static async assertPatientCanBook(patientId: string, doctorId: string, sundayDate: Date) {
    const globallyEnabled = await isSundayConsultGloballyEnabled();
    if (!globallyEnabled) {
      throw new AppError(
        "Sunday free consult is currently disabled",
        ErrorCodes.FORBIDDEN,
        403,
      );
    }

    const user = await UserModel.findById(patientId);
    if (!user) {
      throw new AppError("User not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (user.sundayBannedUntil && user.sundayBannedUntil > new Date()) {
      throw new AppError(
        "You are temporarily banned from Sunday free consults",
        ErrorCodes.USER_BANNED,
        403,
      );
    }

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new AppError("Account suspended", ErrorCodes.USER_BANNED, 403);
    }

    const sundayDateKey = formatSundayDateKey(sundayDate);

    const existing = await AppointmentModel.findOne(
      mongoFilter({
        patientId,
        type: AppointmentTypes.SUNDAY_FREE,
        $or: [
          { sundayDateKey },
          {
            sundayDateKey: { $exists: false },
            scheduledStart: {
              $gte: sundayDate,
              $lt: new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        ],
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      }),
    );

    if (existing) {
      throw new AppError(
        "You already have your free consultation for this week. One appointment per patient — first come, first served.",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    if (!canBookNow(sundayDate, user.earlyAccessSunday ?? false)) {
      throw new AppError("Booking is not open yet for this Sunday", ErrorCodes.FORBIDDEN, 403);
    }
  }

  static async reserveSlot(
    patientId: string,
    doctorId: string,
    instanceId: string,
    slotId: string,
  ) {
    await SundayConsultService.ensureConnected();

    const instance = await SundaySlotInstanceModel.findById(instanceId);
    if (!instance || instance.doctorId.toString() !== doctorId) {
      throw new AppError("Slot instance not found", ErrorCodes.NOT_FOUND, 404);
    }

    await SundayConsultService.assertPatientCanBook(
      patientId,
      doctorId,
      instance.sundayDate,
    );

    const holdToken = randomUUID();
    const heldUntil = new Date(Date.now() + SUNDAY_CONSULT_CONFIG.holdDurationMs);

    const updated = await SundaySlotInstanceModel.findOneAndUpdate(
      mongoFilter({
        _id: instanceId,
        slots: {
          $elemMatch: {
            slotId,
            status: SlotStatuses.AVAILABLE,
          },
        },
      }),
      {
        $set: {
          "slots.$.status": SlotStatuses.HELD,
          "slots.$.heldUntil": heldUntil,
          "slots.$.holdToken": holdToken,
          "slots.$.patientId": patientId,
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new AppError("Slot is no longer available", ErrorCodes.SLOT_UNAVAILABLE, 409);
    }

    const key = formatSundayDateKey(instance.sundayDate);
    publishSundayEvent({
      type: "slot_updated",
      doctorId,
      sundayDateKey: key,
      instanceId,
      slotId,
      status: SlotStatuses.HELD,
    });

    return { holdToken, heldUntil, instanceId, slotId };
  }

  static async confirmBooking(
    patientId: string,
    doctorId: string,
    instanceId: string,
    slotId: string,
    holdToken: string,
    patientNotes?: string,
    locale?: "en" | "ur",
  ): Promise<SundayConfirmBookingResult> {
    await SundayConsultService.ensureConnected();

    const instance = await SundaySlotInstanceModel.findById(instanceId);
    if (!instance || instance.doctorId.toString() !== doctorId) {
      throw new AppError("Invalid booking", ErrorCodes.NOT_FOUND, 404);
    }

    const slot = instance.slots.find((s) => s.slotId === slotId);
    if (
      !slot ||
      slot.status !== SlotStatuses.HELD ||
      slot.holdToken !== holdToken ||
      slot.patientId?.toString() !== patientId
    ) {
      throw new AppError("Hold expired or invalid", ErrorCodes.SLOT_UNAVAILABLE, 409);
    }

    if (slot.heldUntil && slot.heldUntil < new Date()) {
      throw new AppError("Hold expired", ErrorCodes.SLOT_UNAVAILABLE, 409);
    }

    await SundayConsultService.assertPatientCanBook(
      patientId,
      doctorId,
      instance.sundayDate,
    );

    const doctor = await DoctorProfileModel.findById(doctorId).populate(
      "userId",
      "name phone",
    );
    const doctorUser = doctor?.userId as { name?: string; phone?: string } | null;

    const sundayDateKey = formatSundayDateKey(instance.sundayDate);

    const appointment = (await AppointmentModel.create({
      type: AppointmentTypes.SUNDAY_FREE,
      status: AppointmentStatuses.CONFIRMED,
      patientId,
      doctorId,
      scheduledStart: slot.startAt,
      scheduledEnd: slot.endAt,
      sundayDateKey,
      sundaySlotInstanceId: instance._id.toString(),
      sundaySlotId: slotId,
      patientNotes,
      isOnline: true,
    } as Record<string, unknown>)) as CreatedAppointmentRow;

    const result = toConfirmBookingResult(appointment);

    await SundaySlotInstanceModel.updateOne(
      mongoFilter({
        _id: instanceId,
        "slots.slotId": slotId,
      }),
      {
        $set: {
          "slots.$.status": SlotStatuses.BOOKED,
          "slots.$.appointmentId": result.appointmentId,
          "slots.$.heldUntil": undefined,
          "slots.$.holdToken": undefined,
        },
      },
    );

    // Sunday consults have no chat, so the medical history is collected
    // through the intake form instead.
    await MedicalIntakeService.createForAppointment(
      result.appointmentId,
      IntakeSources.FORM,
      locale,
    );

    const patient = await UserModel.findById(patientId).lean();
    await sendBookingConfirmation({
      userId: patientId,
      phone: patient?.phone ?? undefined,
      doctorName: doctorUser?.name ?? "Doctor",
      slotStart: slot.startAt,
    });

    if (doctor?.userId) {
      await sendDoctorConsultBooked({
        userId: resolveMongoRefId(doctor.userId),
        phone: doctorUser?.phone ?? undefined,
        patientName: patient?.name ?? "Patient",
        slotStart: slot.startAt,
        appointmentId: result.appointmentId,
        type: "sunday_free",
      });
    }

    const key = formatSundayDateKey(instance.sundayDate);
    publishSundayEvent({
      type: "slot_updated",
      doctorId,
      sundayDateKey: key,
      instanceId,
      slotId,
      status: SlotStatuses.BOOKED,
    });

    return result;
  }

  static async releaseHold(
    patientId: string,
    instanceId: string,
    slotId: string,
    holdToken: string,
  ) {
    await SundayConsultService.ensureConnected();

    const updated = (await SundaySlotInstanceModel.findOneAndUpdate(
      mongoFilter({
        _id: instanceId,
        slots: {
          $elemMatch: {
            slotId,
            status: SlotStatuses.HELD,
            holdToken,
            patientId,
          },
        },
      }),
      {
        $set: {
          "slots.$.status": SlotStatuses.AVAILABLE,
          "slots.$.heldUntil": undefined,
          "slots.$.holdToken": undefined,
          "slots.$.patientId": undefined,
        },
      },
      { new: true },
    )) as { doctorId: { toString(): string }; sundayDate: Date } | null;

    if (updated) {
      publishSundayEvent({
        type: "slot_updated",
        doctorId: updated.doctorId.toString(),
        sundayDateKey: formatSundayDateKey(updated.sundayDate),
        instanceId,
        slotId,
        status: SlotStatuses.AVAILABLE,
      });
    }

    return { released: !!updated };
  }

  static async upsertTemplate(
    userId: string,
    input: {
      startTimeLocal: string;
      endTimeLocal: string;
      slotDurationMins: number;
      maxSlots: number;
      isActive: boolean;
    },
  ) {
    await SundayConsultService.ensureConnected();

    const profile = await DoctorProfileModel.findOne(mongoFilter({ userId }));
    if (!profile) {
      throw new AppError("Doctor profile required", ErrorCodes.FORBIDDEN, 403);
    }

    const template = await SundaySlotTemplateModel.findOneAndUpdate(
      mongoFilter({ doctorId: profile._id }),
      {
        $set: {
          ...input,
          dayOfWeek: SUNDAY_CONSULT_CONFIG.dayOfWeek,
          timezone: SUNDAY_CONSULT_CONFIG.timezone,
        },
      },
      { upsert: true, new: true },
    );

    await SundayConsultService.materializeInstance(
      profile._id.toString(),
      getNextSundayDate(),
    );

    return template;
  }

  static async toggleSundayConsult(userId: string, enabled: boolean) {
    await SundayConsultService.ensureConnected();
    const profile = await DoctorProfileModel.findOneAndUpdate(
      mongoFilter({ userId }),
      { $set: { sundayConsultEnabled: enabled } },
      { new: true },
    );
    if (!profile) {
      throw new AppError("Doctor profile not found", ErrorCodes.NOT_FOUND, 404);
    }
    return profile;
  }

  static async getDoctorQueue(userId: string, dateKey?: string) {
    await SundayConsultService.ensureConnected();
    const profile = await DoctorProfileModel.findOne(mongoFilter({ userId }));
    if (!profile) {
      throw new AppError("Doctor profile not found", ErrorCodes.NOT_FOUND, 404);
    }

    const sundayDate = dateKey
      ? parseSundayDateKey(dateKey)
      : getNextSundayDate();

    const [instance, appointments] = await Promise.all([
      SundaySlotInstanceModel.findOne(
        mongoFilter({ doctorId: profile._id, sundayDate }),
      ).lean(),
      AppointmentModel.find(
        mongoFilter({
        doctorId: profile._id,
        type: AppointmentTypes.SUNDAY_FREE,
        scheduledStart: {
          $gte: sundayDate,
          $lt: new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000),
        },
        }),
      )
        .populate("patientId", "name phone")
        .sort({ scheduledStart: 1 })
        .lean(),
    ]);

    return {
      instance,
      appointments,
      slots: instance?.slots ?? [],
    };
  }

  static async updateAppointmentStatus(
    userId: string,
    appointmentId: string,
    status: "completed" | "no_show" | "cancelled",
    doctorNotes?: string,
  ) {
    await SundayConsultService.ensureConnected();
    const profile = await DoctorProfileModel.findOne(mongoFilter({ userId }));
    if (!profile) {
      throw new AppError("Forbidden", ErrorCodes.FORBIDDEN, 403);
    }

    const appointment = (await AppointmentModel.findOne(
      mongoFilter({
        _id: appointmentId,
        doctorId: profile._id,
        type: AppointmentTypes.SUNDAY_FREE,
      }),
    )) as HydratedDocument<AppointmentDocument> | null;

    if (!appointment) {
      throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (status === "completed") {
      appointment.status = AppointmentStatuses.COMPLETED;
      appointment.completedAt = new Date();
    } else if (status === "cancelled") {
      appointment.status = AppointmentStatuses.CANCELLED;
    } else if (status === "no_show") {
      appointment.status = AppointmentStatuses.NO_SHOW;
      appointment.noShowMarkedAt = new Date();
      appointment.set("missedBy", "patient");

      const patient = await UserModel.findById(appointment.patientId);
      if (patient) {
        patient.noShowCount = (patient.noShowCount ?? 0) + 1;
        if (patient.noShowCount >= SUNDAY_CONSULT_CONFIG.noShowBanThreshold) {
          patient.sundayBannedUntil = new Date(
            Date.now() +
              SUNDAY_CONSULT_CONFIG.noShowBanWeeks * 7 * 24 * 60 * 60 * 1000,
          );
        }
        await patient.save();
      }

      if (appointment.sundaySlotInstanceId && appointment.sundaySlotId) {
        await SundaySlotInstanceModel.updateOne(
          mongoFilter({
            _id: appointment.sundaySlotInstanceId,
            "slots.slotId": appointment.sundaySlotId,
          }),
          { $set: { "slots.$.status": SlotStatuses.NO_SHOW } },
        );
      }
    }

    if (doctorNotes) appointment.doctorNotes = doctorNotes;
    await appointment.save();

    if (status === "completed" && appointment.sundaySlotInstanceId && appointment.sundaySlotId) {
      await SundaySlotInstanceModel.updateOne(
        mongoFilter({
          _id: appointment.sundaySlotInstanceId,
          "slots.slotId": appointment.sundaySlotId,
        }),
        { $set: { "slots.$.status": SlotStatuses.COMPLETED } },
      );
    }

    return appointment;
  }

  static async getPatientBooking(
    patientId: string,
    dateKey?: string,
  ): Promise<SundayPatientBookingDto | null> {
    await SundayConsultService.ensureConnected();
    const now = new Date();
    const graceAfterEndMs = 2 * 60 * 60 * 1000;

    const appointment = await AppointmentModel.findOne(
      mongoFilter({
        patientId,
        type: AppointmentTypes.SUNDAY_FREE,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        scheduledEnd: { $gte: new Date(now.getTime() - graceAfterEndMs) },
        ...(dateKey
          ? {
              scheduledStart: {
                $gte: parseSundayDateKey(dateKey),
                $lt: new Date(parseSundayDateKey(dateKey).getTime() + 24 * 60 * 60 * 1000),
              },
            }
          : {}),
      }),
    )
      .sort({ scheduledStart: -1 })
      .populate({
        path: "doctorId",
        select: "specialties pmdcVerified ratingAvg ratingCount",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .lean();

    return SundayConsultService.toPatientBookingDto(appointment);
  }

  private static toPatientBookingDto(
    appointment: Record<string, unknown> | null,
  ): SundayPatientBookingDto | null {
    if (!appointment) return null;

    const doctor = appointment.doctorId as {
      _id?: { toString(): string };
      specialties?: string[];
      pmdcVerified?: boolean;
      ratingAvg?: number;
      ratingCount?: number;
      userId?: { name?: string; avatarUrl?: string };
    } | null;

    if (!doctor?._id) return null;

    const user = doctor.userId;
    const name = user?.name ?? "Doctor";
    const scheduledStart = appointment.scheduledStart as Date;
    const scheduledEnd = appointment.scheduledEnd as Date;

    return {
      appointmentId: String(appointment._id),
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      status: appointment.status as SundayPatientBookingDto["status"],
      sundayDateKey: formatSundayDateKey(scheduledStart),
      doctor: {
        doctorId: doctor._id.toString(),
        name,
        avatarUrl: resolveDoctorPortrait(name, user?.avatarUrl),
        specialty: doctor.specialties?.[0] ?? "General Physician",
        pmdcVerified: Boolean(doctor.pmdcVerified),
        ratingAvg: doctor.ratingAvg ?? 0,
        ratingCount: doctor.ratingCount ?? 0,
      },
    };
  }
}
