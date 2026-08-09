import { randomUUID } from "crypto";
import {
  connectDatabase,
  UserModel,
  DoctorProfileModel,
  SundaySlotTemplateModel,
  SundaySlotInstanceModel,
  SundayFreeRequestModel,
  AppointmentModel,
  PaymentModel,
  type EmbeddedSlot,
} from "@zindagi/database";
import {
  AppError,
  ErrorCodes,
  AppointmentStatuses,
  AppointmentTypes,
  IntakeSources,
  PaymentProviders,
  PaymentStatuses,
  SlotStatuses,
  SundayAffordabilityChoices,
  SundayFreeRequestStatuses,
  SUNDAY_CONSULT_CONFIG,
  VerificationStatuses,
} from "@zindagi/shared";
import { notifyAdmins } from "@/lib/notifications/notify-admins";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { MedicalIntakeService } from "@/server/services/medical-intake.service";
import {
  canBookNow,
  canRequestSundayNow,
  formatSundayDateKey,
  generateSlotTimes,
  getActiveOrNextSundayDate,
  getNextSundayDate,
  parseSundayDateKey,
} from "@/lib/sunday/date-utils";
import { publishSundayEvent } from "@/lib/realtime/sunday-emitter";
import { sendBookingConfirmation } from "@/lib/notifications/sunday-reminders";
import { sendDoctorConsultBooked } from "@/lib/notifications/consult-notifications";
import { isSundayConsultGloballyEnabled } from "./system-settings.service";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import type {
  SundayAdminRequestDto,
  SundayCheckoutResult,
  SundayConfirmBookingResult,
  SundayPatientBookingDto,
  SundayPatientRequestDto,
  SundaySubmitRequestResult,
  SundayTeamDoctorOption,
} from "@/features/sunday-consult/types";
import type {
  SundayFreeAssignInput,
  SundayFreeRequestInput,
  PaymentProviderInput,
} from "@zindagi/validators";
import { mongoFilter } from "@/lib/mongo/query";
import { resolveMongoRefId } from "@/lib/mongo/resolve-id";
import type { HydratedDocument } from "mongoose";
import type { AppointmentDocument } from "@zindagi/database";
import { generateTxnRefNo } from "@/lib/payments/jazzcash";
import {
  buildManualTransferCheckout,
  isManualTransferMode,
  manualExternalTransactionId,
} from "@/lib/payments/manual-payment";
import { buildTestPaymentCheckout } from "@/lib/payments/dummy-payment";
import {
  buildGatewayCheckout,
  gatewayIntegrationLabel,
  resolveCheckoutProvider,
  type LivePaymentProvider,
} from "@/lib/payments/payment-gateway";

const SUNDAY_PAYMENT_KIND = "sunday_consult";

type SundayPaymentMetadata = {
  kind: typeof SUNDAY_PAYMENT_KIND;
  patientPhone: string;
  patientNotes?: string;
  sundayDateKey: string;
  affordabilityChoice: typeof SundayAffordabilityChoices.PAY_FEE;
  txnRefNo?: string;
  expiresAt?: string;
  integration?: string;
  receipt?: {
    storageKey: string;
    url: string;
    originalName: string;
    mimeType: string;
    transactionId?: string;
    uploadedAt?: string;
  };
};

const ACTIVE_REQUEST_STATUSES = [
  SundayFreeRequestStatuses.REQUESTED,
  SundayFreeRequestStatuses.ASSIGNED,
] as const;

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
      phone: safeDisplayText(patient?.phone) ?? undefined,
      doctorName: safeDisplayText(doctorUser?.name) ?? "Doctor",
      slotStart: slot.startAt,
    });

    if (doctor?.userId) {
      await sendDoctorConsultBooked({
        userId: resolveMongoRefId(doctor.userId),
        phone: safeDisplayText(doctorUser?.phone) ?? undefined,
        patientName: safeDisplayText(patient?.name) ?? "Patient",
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
      : getActiveOrNextSundayDate();
    const sundayKey = dateKey ?? formatSundayDateKey(sundayDate);
    const sundayEnd = new Date(sundayDate.getTime() + 24 * 60 * 60 * 1000);

    const [instance, appointments] = await Promise.all([
      SundaySlotInstanceModel.findOne(
        mongoFilter({ doctorId: profile._id, sundayDate }),
      ).lean(),
      AppointmentModel.find(
        mongoFilter({
          doctorId: profile._id,
          type: AppointmentTypes.SUNDAY_FREE,
          $or: [
            { sundayDateKey: sundayKey },
            { scheduledStart: { $gte: sundayDate, $lt: sundayEnd } },
          ],
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
      await SundayFreeRequestModel.updateOne(
        mongoFilter({ appointmentId: appointment._id }),
        {
          $set: {
            status: SundayFreeRequestStatuses.COMPLETED,
            completedAt: new Date(),
          },
        },
      );
    } else if (status === "cancelled") {
      appointment.status = AppointmentStatuses.CANCELLED;
      await SundayFreeRequestModel.updateOne(
        mongoFilter({ appointmentId: appointment._id }),
        {
          $set: {
            status: SundayFreeRequestStatuses.CANCELLED,
            cancelledAt: new Date(),
          },
        },
      );
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

    const request = await SundayConsultService.getPatientRequest(patientId, dateKey);
    if (request) {
      return SundayConsultService.requestToBookingDto(request);
    }

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

  /** Lightweight patient request path — no slot materialization / doctor list. */
  static async submitRequest(
    patientId: string,
    input: SundayFreeRequestInput,
  ): Promise<SundaySubmitRequestResult> {
    await connectDatabase();
    await SundayConsultService.expireStalePendingPayments();

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

    const sundayDate = getActiveOrNextSundayDate();
    const sundayDateKey = formatSundayDateKey(sundayDate);

    if (!canRequestSundayNow(sundayDate, user.earlyAccessSunday ?? false)) {
      throw new AppError(
        "Sunday free consult requests are not open yet",
        ErrorCodes.FORBIDDEN,
        403,
      );
    }

    const existingRequest = await SundayFreeRequestModel.findOne(
      mongoFilter({
        patientId,
        sundayDateKey,
        status: { $in: [...ACTIVE_REQUEST_STATUSES] },
      }),
    ).lean();

    if (existingRequest) {
      const mapped = SundayConsultService.mapPatientRequest(
        existingRequest as Parameters<typeof SundayConsultService.mapPatientRequest>[0],
      );
      return { kind: "request", ...mapped };
    }

    const existingAppointment = await AppointmentModel.findOne(
      mongoFilter({
        patientId,
        type: AppointmentTypes.SUNDAY_FREE,
        sundayDateKey,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      }),
    ).lean();

    if (existingAppointment) {
      throw new AppError(
        "You already have your free consultation for this week. One request per patient — first come, first served.",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    if (input.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE) {
      return SundayConsultService.initiateContributionCheckout(patientId, {
        patientPhone: input.patientPhone,
        patientNotes: input.patientNotes,
        sundayDateKey,
      });
    }

    const mapped = await SundayConsultService.createFreeRequestInternal(patientId, {
      patientPhone: input.patientPhone,
      patientNotes: input.patientNotes,
      sundayDateKey,
      affordabilityChoice: SundayAffordabilityChoices.CANNOT_AFFORD,
    });

    return { kind: "request", ...mapped };
  }

  private static async createFreeRequestInternal(
    patientId: string,
    input: {
      patientPhone: string;
      patientNotes?: string;
      sundayDateKey: string;
      affordabilityChoice: SundayPatientRequestDto["affordabilityChoice"];
      paymentId?: string;
    },
  ): Promise<SundayPatientRequestDto> {
    const user = await UserModel.findById(patientId).lean();

    const doc = await SundayFreeRequestModel.create({
      patientId,
      patientPhone: input.patientPhone,
      patientNotes: input.patientNotes,
      sundayDateKey: input.sundayDateKey,
      affordabilityChoice: input.affordabilityChoice,
      paymentId: input.paymentId,
      status: SundayFreeRequestStatuses.REQUESTED,
    });

    const requestId = doc._id.toString();
    const isPaid = input.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE;
    await notifyAdmins({
      title: isPaid
        ? "New Sunday consult request (paid contribution)"
        : "New Sunday free consult request",
      body: isPaid
        ? `${safeDisplayText(user?.name) ?? "A patient"} paid Rs. ${SUNDAY_CONSULT_CONFIG.contributionFeePkr} and requested a Sunday consult — assign a doctor within ${SUNDAY_CONSULT_CONFIG.matchWithinMinutes} minutes.`
        : `${safeDisplayText(user?.name) ?? "A patient"} requested a free Sunday consult (cannot afford paid care) — assign a doctor within ${SUNDAY_CONSULT_CONFIG.matchWithinMinutes} minutes.`,
      payload: { type: "sunday_free_requested", requestId, sundayDateKey: input.sundayDateKey },
    }).catch((err) => {
      console.error("[sunday-consult] admin notification failed", err);
    });

    publishSundayEvent({
      type: "instance_updated",
      doctorId: "queue",
      sundayDateKey: input.sundayDateKey,
      instanceId: requestId,
    });

    return SundayConsultService.mapPatientRequest(doc.toObject());
  }

  private static async expireStalePendingPayments() {
    const cutoff = new Date(Date.now() - SUNDAY_CONSULT_CONFIG.paymentHoldDurationMs);
    await PaymentModel.updateMany(
      mongoFilter({
        status: PaymentStatuses.PENDING,
        "metadata.kind": SUNDAY_PAYMENT_KIND,
        createdAt: { $lt: cutoff },
      }),
      { $set: { status: PaymentStatuses.CANCELLED } },
    );
  }

  private static async initiateContributionCheckout(
    patientId: string,
    input: {
      patientPhone: string;
      patientNotes?: string;
      sundayDateKey: string;
      paymentProvider?: PaymentProviderInput;
    },
  ): Promise<SundayCheckoutResult> {
    const pendingPayment = await PaymentModel.findOne(
      mongoFilter({
        userId: patientId,
        status: PaymentStatuses.PENDING,
        "metadata.kind": SUNDAY_PAYMENT_KIND,
      }),
    ).lean();

    if (pendingPayment) {
      const paymentId = pendingPayment._id.toString();
      const amount = pendingPayment.amount;
      const useManual =
        pendingPayment.provider === PaymentProviders.MANUAL_JAZZCASH ||
        pendingPayment.provider === PaymentProviders.DUMMY;

      if (useManual) {
        const manualTransfer = buildManualTransferCheckout({
          paymentId,
          amountPkr: amount,
          description: `Sunday consult contribution — Rs. ${amount}`,
          payPath: `/sunday-consult/pay?paymentId=${paymentId}`,
        });
        return {
          kind: "payment",
          paymentId,
          amount,
          manualTransfer,
          testMode: true,
          testPayment: buildTestPaymentCheckout({
            paymentId,
            appointmentId: paymentId,
            amountPkr: amount,
            description: `Sunday consult contribution — Rs. ${amount}`,
            payPath: `/sunday-consult/pay?paymentId=${paymentId}`,
          }),
        };
      }
    }

    const amount = SUNDAY_CONSULT_CONFIG.contributionFeePkr;
    const txnRefNo = generateTxnRefNo();
    const idempotencyKey = randomUUID();
    const expiresAt = new Date(Date.now() + SUNDAY_CONSULT_CONFIG.paymentHoldDurationMs);
    const useManual = isManualTransferMode();
    let liveProvider: LivePaymentProvider | null = null;

    if (!useManual) {
      try {
        liveProvider = resolveCheckoutProvider(input.paymentProvider);
      } catch (error) {
        throw new AppError(
          error instanceof Error ? error.message : "Payment gateway unavailable",
          ErrorCodes.VALIDATION,
          503,
        );
      }
    }

    const payment = (await PaymentModel.create({
      userId: patientId,
      provider: useManual ? PaymentProviders.MANUAL_JAZZCASH : liveProvider!,
      status: PaymentStatuses.PENDING,
      amount,
      currency: "PKR",
      idempotencyKey,
      externalTransactionId: txnRefNo,
      metadata: {
        kind: SUNDAY_PAYMENT_KIND,
        patientPhone: input.patientPhone,
        patientNotes: input.patientNotes,
        sundayDateKey: input.sundayDateKey,
        affordabilityChoice: SundayAffordabilityChoices.PAY_FEE,
        txnRefNo,
        expiresAt: expiresAt.toISOString(),
        integration: useManual
          ? "manual_jazzcash"
          : gatewayIntegrationLabel(liveProvider!),
      } satisfies SundayPaymentMetadata,
    } as Record<string, unknown>)) as { _id: { toString(): string } };

    const paymentId = payment._id.toString();

    if (useManual) {
      const manualTransfer = buildManualTransferCheckout({
        paymentId,
        amountPkr: amount,
        description: `Sunday consult contribution — Rs. ${amount}`,
        payPath: `/sunday-consult/pay?paymentId=${paymentId}`,
      });
      return {
        kind: "payment",
        paymentId,
        amount,
        manualTransfer,
        testMode: true,
        testPayment: buildTestPaymentCheckout({
          paymentId,
          appointmentId: paymentId,
          amountPkr: amount,
          description: `Sunday consult contribution — Rs. ${amount}`,
          payPath: `/sunday-consult/pay?paymentId=${paymentId}`,
        }),
      };
    }

    const gatewayRedirect = buildGatewayCheckout(liveProvider!, {
      amountPkr: amount,
      txnRefNo,
      billReference: paymentId.slice(-12),
      description: "ZindagiCare Sunday consult",
      paymentId,
      customerMobile: input.patientPhone,
    });

    return { kind: "payment", paymentId, amount, gatewayRedirect };
  }

  static async submitManualReceipt(
    paymentId: string,
    userId: string,
    receipt: {
      storageKey: string;
      url: string;
      originalName: string;
      mimeType: string;
      transactionId?: string;
    },
  ) {
    await connectDatabase();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment || payment.userId.toString() !== userId) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if ((payment.metadata as SundayPaymentMetadata | undefined)?.kind !== SUNDAY_PAYMENT_KIND) {
      throw new AppError("Not a Sunday consult payment", ErrorCodes.VALIDATION, 400);
    }

    if (
      payment.provider !== PaymentProviders.MANUAL_JAZZCASH &&
      payment.provider !== PaymentProviders.DUMMY
    ) {
      throw new AppError("Not a manual JazzCash payment", ErrorCodes.VALIDATION, 400);
    }

    if (payment.status !== PaymentStatuses.PENDING) {
      throw new AppError("Payment is not pending", ErrorCodes.VALIDATION, 400);
    }

    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      {
        $set: {
          "metadata.receipt": {
            storageKey: receipt.storageKey,
            url: receipt.url,
            originalName: receipt.originalName,
            mimeType: receipt.mimeType,
            ...(receipt.transactionId ? { transactionId: receipt.transactionId } : {}),
            uploadedAt: new Date().toISOString(),
          },
        },
      },
    );

    const externalId =
      receipt.transactionId?.trim() || manualExternalTransactionId(paymentId);

    return SundayConsultService.confirmAfterPayment(paymentId, externalId);
  }

  static async completeTestPayment(paymentId: string, userId: string) {
    await connectDatabase();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment || payment.userId.toString() !== userId) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if ((payment.metadata as SundayPaymentMetadata | undefined)?.kind !== SUNDAY_PAYMENT_KIND) {
      throw new AppError("Not a Sunday consult payment", ErrorCodes.VALIDATION, 400);
    }

    if (payment.provider !== PaymentProviders.DUMMY) {
      throw new AppError("Not a test payment", ErrorCodes.VALIDATION, 400);
    }

    return SundayConsultService.confirmAfterPayment(
      paymentId,
      `DUMMY-${paymentId}`,
    );
  }

  static async confirmAfterPayment(paymentId: string, externalTransactionId?: string) {
    await connectDatabase();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const metadata = payment.metadata as SundayPaymentMetadata | undefined;
    if (metadata?.kind !== SUNDAY_PAYMENT_KIND) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (payment.status === PaymentStatuses.PAID && payment.sundayFreeRequestId) {
      const existing = await SundayFreeRequestModel.findById(
        payment.sundayFreeRequestId,
      ).lean();
      if (existing) {
        return SundayConsultService.mapPatientRequest(
          existing as Parameters<typeof SundayConsultService.mapPatientRequest>[0],
        );
      }
    }

    if (payment.status === PaymentStatuses.PAID) {
      const linked = await SundayFreeRequestModel.findOne(
        mongoFilter({ paymentId }),
      ).lean();
      if (linked) {
        return SundayConsultService.mapPatientRequest(
          linked as Parameters<typeof SundayConsultService.mapPatientRequest>[0],
        );
      }
    }

    if (payment.status !== PaymentStatuses.PENDING && payment.status !== PaymentStatuses.PAID) {
      throw new AppError("Payment is not pending", ErrorCodes.VALIDATION, 400);
    }

    const patientId = payment.userId.toString();
    const request = await SundayConsultService.createFreeRequestInternal(patientId, {
      patientPhone: metadata.patientPhone,
      patientNotes: metadata.patientNotes,
      sundayDateKey: metadata.sundayDateKey,
      affordabilityChoice: SundayAffordabilityChoices.PAY_FEE,
      paymentId,
    });

    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      {
        $set: {
          status: PaymentStatuses.PAID,
          paidAt: new Date(),
          sundayFreeRequestId: request.requestId,
          ...(externalTransactionId ? { externalTransactionId } : {}),
        },
      },
    );

    return request;
  }

  static async failPayment(paymentId: string, reason?: string) {
    await connectDatabase();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (
      !payment ||
      payment.status !== PaymentStatuses.PENDING ||
      (payment.metadata as SundayPaymentMetadata | undefined)?.kind !== SUNDAY_PAYMENT_KIND
    ) {
      return;
    }

    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      {
        $set: {
          status: PaymentStatuses.FAILED,
          failureReason: reason,
        },
      },
    );
  }

  static async getPaymentStatus(paymentId: string, userId: string) {
    await connectDatabase();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment || payment.userId.toString() !== userId) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const metadata = payment.metadata as SundayPaymentMetadata | undefined;
    if (metadata?.kind !== SUNDAY_PAYMENT_KIND) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const isManual =
      payment.provider === PaymentProviders.MANUAL_JAZZCASH ||
      payment.provider === PaymentProviders.DUMMY;

    let manualTransfer = null;
    if (isManual && payment.status === PaymentStatuses.PENDING) {
      manualTransfer = buildManualTransferCheckout({
        paymentId,
        amountPkr: payment.amount,
        description: `Sunday consult contribution — Rs. ${payment.amount}`,
        payPath: `/sunday-consult/pay?paymentId=${paymentId}`,
      });
    }

    return {
      paymentId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency ?? "PKR",
      sundayFreeRequestId: payment.sundayFreeRequestId?.toString(),
      manualTransfer,
    };
  }

  static async getPatientRequest(
    patientId: string,
    dateKey?: string,
  ): Promise<SundayPatientRequestDto | null> {
    await connectDatabase();

    const sundayDateKey = dateKey ?? formatSundayDateKey(getActiveOrNextSundayDate());

    const doc = await SundayFreeRequestModel.findOne(
      mongoFilter({
        patientId,
        sundayDateKey,
        status: {
          $in: [
            ...ACTIVE_REQUEST_STATUSES,
            SundayFreeRequestStatuses.COMPLETED,
          ],
        },
      }),
    )
      .sort({ createdAt: -1 })
      .populate("appointmentId", "scheduledStart scheduledEnd status")
      .populate({
        path: "assignedDoctorId",
        select: "specialties pmdcVerified ratingAvg ratingCount",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .lean();

    if (!doc) return null;
    return SundayConsultService.mapPatientRequest(
      doc as Parameters<typeof SundayConsultService.mapPatientRequest>[0],
    );
  }

  static async listAdminRequests(dateKey?: string): Promise<SundayAdminRequestDto[]> {
    await connectDatabase();
    const sundayDateKey = dateKey ?? formatSundayDateKey(getActiveOrNextSundayDate());

    const docs = await SundayFreeRequestModel.find(
      mongoFilter({
        sundayDateKey,
        status: { $in: [...ACTIVE_REQUEST_STATUSES] },
      }),
    )
      .sort({ createdAt: 1 })
      .populate("patientId", "name phone")
      .populate("appointmentId", "scheduledStart scheduledEnd")
      .populate({
        path: "assignedDoctorId",
        select: "specialties pmdcVerified",
        populate: { path: "userId", select: "name" },
      })
      .lean();

    return docs.map((doc) => {
      const patient = doc.patientId as { name?: string; phone?: string } | null;
      const mapped = SundayConsultService.mapPatientRequest(
        doc as Parameters<typeof SundayConsultService.mapPatientRequest>[0],
      );
      return {
        requestId: mapped.requestId,
        status: mapped.status,
        sundayDateKey: mapped.sundayDateKey,
        patientName: patient?.name ?? "Patient",
        patientPhone: mapped.patientPhone,
        patientNotes: mapped.patientNotes,
        affordabilityChoice: mapped.affordabilityChoice,
        paymentId: mapped.paymentId,
        contributionFeePkr: mapped.contributionFeePkr,
        createdAt: mapped.createdAt,
        assignedAt: mapped.assignedAt,
        appointmentId: mapped.appointmentId,
        scheduledStart: mapped.scheduledStart,
        scheduledEnd: mapped.scheduledEnd,
        doctor: mapped.doctor
          ? {
              doctorId: mapped.doctor.doctorId,
              name: mapped.doctor.name,
              specialty: mapped.doctor.specialty,
              pmdcVerified: mapped.doctor.pmdcVerified,
            }
          : undefined,
      };
    });
  }

  static async listSundayTeamDoctors(): Promise<SundayTeamDoctorOption[]> {
    await connectDatabase();

    const doctors = await DoctorProfileModel.find({
      sundayConsultEnabled: true,
      isListed: true,
      verificationStatus: VerificationStatuses.APPROVED,
    })
      .populate("userId", "name")
      .sort({ ratingAvg: -1, ratingCount: -1 })
      .lean();

    return doctors.map((doc) => {
      const user = doc.userId as { name?: string } | null;
      return {
        doctorId: doc._id.toString(),
        name: user?.name ?? "Doctor",
        specialties: doc.specialties ?? [],
        pmdcVerified: doc.pmdcVerified ?? false,
      };
    });
  }

  static async assignDoctor(
    requestId: string,
    adminUserId: string,
    input: SundayFreeAssignInput,
    locale?: "en" | "ur",
  ): Promise<SundayAdminRequestDto> {
    await connectDatabase();

    const request = await SundayFreeRequestModel.findById(requestId);
    if (
      !request ||
      !ACTIVE_REQUEST_STATUSES.includes(
        request.status as (typeof ACTIVE_REQUEST_STATUSES)[number],
      )
    ) {
      throw new AppError("Request not found", ErrorCodes.NOT_FOUND, 404);
    }

    const doctor = await DoctorProfileModel.findById(input.doctorId)
      .populate("userId", "name phone")
      .lean();
    if (
      !doctor?.isListed ||
      doctor.verificationStatus !== VerificationStatuses.APPROVED ||
      !doctor.sundayConsultEnabled
    ) {
      throw new AppError(
        "Doctor is not available for Sunday free consult",
        ErrorCodes.NOT_FOUND,
        404,
      );
    }

    const assignedAt = new Date();
    const scheduledStart = assignedAt;
    // Admin match: keep the join window open for the SLA, not just one 10-min slot.
    const scheduledEnd = new Date(
      assignedAt.getTime() + SUNDAY_CONSULT_CONFIG.matchWithinMinutes * 60_000,
    );

    let appointmentId = request.appointmentId?.toString();

    if (!appointmentId) {
      const appointment = (await AppointmentModel.create({
        type: AppointmentTypes.SUNDAY_FREE,
        status: AppointmentStatuses.CONFIRMED,
        patientId: request.patientId,
        doctorId: doctor._id,
        scheduledStart,
        scheduledEnd,
        timezone: SUNDAY_CONSULT_CONFIG.timezone,
        sundayDateKey: request.sundayDateKey,
        isOnline: true,
        patientNotes: request.patientNotes,
      } as Record<string, unknown>)) as { _id: { toString(): string } };

      appointmentId = appointment._id.toString();
      request.appointmentId = appointment._id as unknown as typeof request.appointmentId;

      await MedicalIntakeService.createForAppointment(
        appointmentId,
        IntakeSources.FORM,
        locale,
      );
    } else {
      await AppointmentModel.updateOne(
        mongoFilter({ _id: appointmentId }),
        {
          $set: {
            doctorId: doctor._id,
            scheduledStart,
            scheduledEnd,
            status: AppointmentStatuses.CONFIRMED,
          },
        },
      );
    }

    request.status = SundayFreeRequestStatuses.ASSIGNED;
    request.assignedDoctorId = doctor._id as unknown as typeof request.assignedDoctorId;
    request.assignedBy = adminUserId as unknown as typeof request.assignedBy;
    request.assignedAt = assignedAt;
    if (input.adminNotes) {
      request.adminNotes = input.adminNotes;
    }
    await request.save();

    const patient = await UserModel.findById(request.patientId).lean();
    const doctorUser = doctor.userId as {
      _id?: { toString(): string };
      name?: string;
      phone?: string;
    } | null;
    const doctorName = safeDisplayText(doctorUser?.name) ?? "Doctor";

    await sendBookingConfirmation({
      userId: request.patientId.toString(),
      phone: safeDisplayText(patient?.phone) ?? request.patientPhone,
      doctorName,
      slotStart: scheduledStart,
    }).catch((err) => {
      console.error("[sunday-consult] patient notification failed", err);
    });

    if (doctorUser?._id) {
      await sendDoctorConsultBooked({
        userId: doctorUser._id.toString(),
        phone: safeDisplayText(doctorUser.phone) ?? undefined,
        patientName: safeDisplayText(patient?.name) ?? "Patient",
        slotStart: scheduledStart,
        appointmentId,
        type: "sunday_free",
      }).catch((err) => {
        console.error("[sunday-consult] doctor notification failed", err);
      });
    }

    publishSundayEvent({
      type: "instance_updated",
      doctorId: doctor._id.toString(),
      sundayDateKey: request.sundayDateKey,
      instanceId: requestId,
    });

    const rows = await SundayConsultService.listAdminRequests(request.sundayDateKey);
    const row = rows.find((r) => r.requestId === requestId);
    if (!row) {
      throw new AppError("Assigned request not found", ErrorCodes.NOT_FOUND, 404);
    }
    return row;
  }

  private static mapPatientRequest(doc: {
    _id: { toString(): string };
    patientPhone: string;
    patientNotes?: string | null;
    status: string;
    sundayDateKey: string;
    affordabilityChoice?: string | null;
    paymentId?: { toString(): string } | null;
    createdAt?: Date;
    assignedAt?: Date | null;
    appointmentId?:
      | { toString(): string }
      | null
      | {
          _id?: { toString(): string };
          scheduledStart?: Date;
          scheduledEnd?: Date;
          status?: string;
        };
    assignedDoctorId?:
      | { toString(): string }
      | null
      | {
          _id?: { toString(): string };
          specialties?: string[];
          pmdcVerified?: boolean;
          ratingAvg?: number;
          ratingCount?: number;
          userId?: { name?: string; avatarUrl?: string } | null;
        };
  }): SundayPatientRequestDto {
    let doctor: SundayPatientRequestDto["doctor"];
    const assigned = doc.assignedDoctorId;
    if (assigned && typeof assigned === "object" && "userId" in assigned) {
      const user = assigned.userId;
      const name = user?.name ?? "Doctor";
      doctor = {
        doctorId: assigned._id?.toString() ?? "",
        name,
        avatarUrl: resolveDoctorPortrait(name, user?.avatarUrl),
        specialty: assigned.specialties?.[0] ?? "General Physician",
        pmdcVerified: Boolean(assigned.pmdcVerified),
        ratingAvg: assigned.ratingAvg ?? 0,
        ratingCount: assigned.ratingCount ?? 0,
      };
    }

    let appointmentId: string | undefined;
    let scheduledStart: string | undefined;
    let scheduledEnd: string | undefined;
    let appointmentStatus: SundayPatientRequestDto["appointmentStatus"];
    const appointment = doc.appointmentId;
    if (appointment && typeof appointment === "object") {
      if ("scheduledStart" in appointment) {
        appointmentId = appointment._id?.toString();
        scheduledStart = appointment.scheduledStart?.toISOString();
        scheduledEnd = appointment.scheduledEnd?.toISOString();
        if (typeof appointment.status === "string") {
          appointmentStatus =
            appointment.status as SundayPatientRequestDto["appointmentStatus"];
        }
      } else if ("toString" in appointment) {
        appointmentId = appointment.toString();
      }
    }

    const affordabilityChoice =
      doc.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE
        ? SundayAffordabilityChoices.PAY_FEE
        : SundayAffordabilityChoices.CANNOT_AFFORD;

    return {
      requestId: doc._id.toString(),
      status: doc.status as SundayPatientRequestDto["status"],
      sundayDateKey: doc.sundayDateKey,
      patientPhone: doc.patientPhone,
      patientNotes: doc.patientNotes ?? undefined,
      affordabilityChoice,
      paymentId: doc.paymentId?.toString(),
      contributionFeePkr:
        affordabilityChoice === SundayAffordabilityChoices.PAY_FEE
          ? SUNDAY_CONSULT_CONFIG.contributionFeePkr
          : undefined,
      createdAt: (doc.createdAt ?? new Date()).toISOString(),
      assignedAt: doc.assignedAt?.toISOString(),
      appointmentId,
      appointmentStatus,
      scheduledStart,
      scheduledEnd,
      doctor,
    };
  }

  private static resolveBookingAppointmentStatus(
    request: SundayPatientRequestDto,
  ): SundayPatientBookingDto["status"] {
    if (request.appointmentStatus) return request.appointmentStatus;
    if (request.status === SundayFreeRequestStatuses.COMPLETED) {
      return AppointmentStatuses.COMPLETED;
    }
    if (request.status === SundayFreeRequestStatuses.CANCELLED) {
      return AppointmentStatuses.CANCELLED;
    }
    if (request.status === SundayFreeRequestStatuses.REQUESTED) {
      return AppointmentStatuses.PENDING;
    }
    return AppointmentStatuses.CONFIRMED;
  }

  private static requestToBookingDto(
    request: SundayPatientRequestDto,
  ): SundayPatientBookingDto | null {
    if (request.status === SundayFreeRequestStatuses.REQUESTED) {
      return {
        appointmentId: request.requestId,
        scheduledStart: request.createdAt,
        scheduledEnd: new Date(
          new Date(request.createdAt).getTime() +
            SUNDAY_CONSULT_CONFIG.matchWithinMinutes * 60_000,
        ).toISOString(),
        status: AppointmentStatuses.PENDING,
        sundayDateKey: request.sundayDateKey,
        doctor: {
          doctorId: "",
          name: "Matching doctor…",
          specialty: "Sunday Free Consult",
          pmdcVerified: true,
          ratingAvg: 0,
          ratingCount: 0,
        },
        requestId: request.requestId,
        requestStatus: request.status,
      };
    }

    const status = SundayConsultService.resolveBookingAppointmentStatus(request);

    if (!request.appointmentId || !request.scheduledStart || !request.scheduledEnd || !request.doctor) {
      return {
        appointmentId: request.requestId,
        scheduledStart: request.assignedAt ?? request.createdAt,
        scheduledEnd: new Date(
          new Date(request.assignedAt ?? request.createdAt).getTime() +
            SUNDAY_CONSULT_CONFIG.matchWithinMinutes * 60_000,
        ).toISOString(),
        status,
        sundayDateKey: request.sundayDateKey,
        doctor: request.doctor ?? {
          doctorId: "",
          name: "Doctor",
          specialty: "General Physician",
          pmdcVerified: true,
          ratingAvg: 0,
          ratingCount: 0,
        },
        requestId: request.requestId,
        requestStatus: request.status,
      };
    }

    return {
      appointmentId: request.appointmentId,
      scheduledStart: request.scheduledStart,
      scheduledEnd: request.scheduledEnd,
      status,
      sundayDateKey: request.sundayDateKey,
      doctor: request.doctor,
      requestId: request.requestId,
      requestStatus: request.status,
    };
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
      sundayDateKey:
        (appointment.sundayDateKey as string | undefined) ??
        formatSundayDateKey(scheduledStart),
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
