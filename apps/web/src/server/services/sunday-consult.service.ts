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
  VideoSessionModel,
  ReviewModel,
  type EmbeddedSlot,
} from "@zindagi/database";
import {
  AppError,
  ErrorCodes,
  AppointmentStatuses,
  AppointmentTypes,
  IntakeSources,
  IntakeStatuses,
  PaymentProviders,
  PaymentStatuses,
  SlotStatuses,
  SundayAffordabilityChoices,
  SundayFreeRequestStatuses,
  SUNDAY_CONSULT_CONFIG,
  VerificationStatuses,
  VideoSessionStatuses,
  getPaidOnlineIntakeQuestions,
  getSundayFreeJoinWindow,
  normalizeIntakeLocale,
  type IntakeLocale,
} from "@zindagi/shared";
import { decryptField, encryptField } from "@zindagi/shared/crypto/field-encryption";
import { notifyAdmins } from "@/lib/notifications/notify-admins";
import { deliverUserNotification } from "@/lib/notifications/deliver-notification";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { MedicalIntakeService } from "@/server/services/medical-intake.service";
import { ChatService } from "@/server/services/chat.service";
import { ReviewService } from "@/server/services/review.service";
import {
  canBookNow,
  canRequestSundayNow,
  formatSundayDateKey,
  generateSlotTimes,
  getActiveOrNextSundayDate,
  getNextSundayDate,
  localTimeToUtc,
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
  SundayDoctorRequestDto,
  SundayHistoryAnswerDto,
} from "@/features/sunday-consult/types";
import type {
  SundayFreeClaimInput,
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
  /** Encrypted JSON of SundayHistoryAnswerDto[] — payment metadata is not field-encrypted. */
  historyEncrypted?: string;
  historyLocale?: IntakeLocale;
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

/**
 * Pair the patient's answers with the paid-online question text (in their
 * language), in the canonical question order.
 */
function buildHistory(
  answers: { key: string; answer: string }[],
  locale: IntakeLocale,
): SundayHistoryAnswerDto[] {
  return getPaidOnlineIntakeQuestions(locale).map((question) => ({
    key: question.key,
    text: question.text,
    answer: answers.find((a) => a.key === question.key)?.answer.trim() ?? "",
  }));
}

function readPaymentHistory(metadata: SundayPaymentMetadata): SundayHistoryAnswerDto[] {
  if (!metadata.historyEncrypted) return [];
  try {
    return JSON.parse(decryptField(metadata.historyEncrypted)) as SundayHistoryAnswerDto[];
  } catch {
    return [];
  }
}

const ADMIN_REQUEST_HISTORY_LIMIT = 500;

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

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatuses.PENDING,
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
];

/** A doctor picking "now" may land a minute or two after the chosen HH:mm. */
const CLAIM_PAST_GRACE_MS = 5 * 60_000;
/** Unpicked requests older than this stay on the doctor board as overdue. */
const OVERDUE_REQUEST_AGE_MS = 7 * 24 * 60 * 60_000;

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

  static async listSundayDoctors(city?: string, dateKey?: string) {
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
      ...(city ? { coverageCities: city } : {}),
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
      { upsert: true, returnDocument: "after" },
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
      { returnDocument: "after" },
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

    let appointment: CreatedAppointmentRow;
    try {
      appointment = (await AppointmentModel.create({
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
    } catch (error) {
      // The patient can hold two different slots at once (e.g. two browser
      // tabs) and confirm both within milliseconds of each other — each
      // hold check above passes independently, but the unique partial index
      // on Appointment{patientId, type, sundayDateKey} (active statuses
      // only) rejects the loser's insert. Without this catch the loser got
      // a raw, unhandled MongoServerError (500) instead of a clean 409, and
      // this slot would stay HELD (never released) until the expiry sweep.
      if (isDuplicateKeyError(error)) {
        await SundayConsultService.releaseHold(patientId, instanceId, slotId, holdToken);
        throw new AppError(
          "You already have your free consultation for this week. One request per patient — first come, first served.",
          ErrorCodes.CONFLICT,
          409,
        );
      }
      throw error;
    }

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

    await MedicalIntakeService.createForAppointment(
      result.appointmentId,
      IntakeSources.FORM,
      locale,
    );
    await ChatService.ensureAppointmentThread(result.appointmentId);

    const patient = await UserModel.findById(patientId).lean();
    await sendBookingConfirmation({
      userId: patientId,
      phone: safeDisplayText(patient?.phone) ?? undefined,
      doctorName: safeDisplayText(doctorUser?.name) ?? "Doctor",
      slotStart: slot.startAt,
      appointmentId: result.appointmentId,
    });

    if (doctor?.userId) {
      await sendDoctorConsultBooked({
        userId: resolveMongoRefId(doctor.userId),
        phone: safeDisplayText(doctorUser?.phone) ?? undefined,
        patientName: safeDisplayText(patient?.name) ?? "Patient",
        slotStart: slot.startAt,
        appointmentId: result.appointmentId,
        type: "sunday_free",
        patientId,
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
      { returnDocument: "after" },
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
      { upsert: true, returnDocument: "after" },
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
      { returnDocument: "after" },
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

    if (
      appointment.status !== AppointmentStatuses.CONFIRMED &&
      appointment.status !== AppointmentStatuses.IN_PROGRESS
    ) {
      throw new AppError(
        "This consultation is already closed.",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    if (
      status === "completed" &&
      !getSundayFreeJoinWindow(appointment.scheduledStart).canJoin
    ) {
      throw new AppError(
        "You can finish this consultation once it has started.",
        ErrorCodes.VALIDATION,
        400,
      );
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

    // The room and chat stay open until now; closing the consult closes both.
    await SundayConsultService.closeConsultRoom(appointment._id.toString());
    await ChatService.closeSundayConsultThread(appointment._id.toString()).catch((err) => {
      console.error("[sunday-consult] chat close failed", err);
    });

    if (status === "completed") {
      await deliverUserNotification({
        userId: appointment.patientId.toString(),
        title: "Your free consultation is complete",
        body: "Your doctor has finished your Sunday free consultation. Please take a moment to rate your doctor.",
        payload: { type: "sunday_free_completed", appointmentId: appointment._id.toString() },
      }).catch((err) => {
        console.error("[sunday-consult] completion notification failed", err);
      });
    }

    return appointment;
  }

  /** Ends the video session (if any) of a Sunday consult the doctor just closed. */
  private static async closeConsultRoom(appointmentId: string) {
    const session = await VideoSessionModel.findOne(
      mongoFilter({
        appointmentId,
        status: { $nin: [VideoSessionStatuses.COMPLETED, VideoSessionStatuses.CANCELLED] },
      }),
    )
      .select("startedAt createdAt")
      .lean();
    if (!session) return;

    const endedAt = new Date();
    const startedAt = session.startedAt ?? session.createdAt;
    await VideoSessionModel.updateOne(mongoFilter({ _id: session._id }), {
      $set: {
        status: VideoSessionStatuses.COMPLETED,
        endedAt,
        durationSeconds: startedAt
          ? Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000))
          : 0,
      },
    });
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

    const historyLocale = normalizeIntakeLocale(input.locale ?? user.metadata?.locale);
    const history = buildHistory(input.history, historyLocale);

    if (input.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE) {
      return SundayConsultService.initiateContributionCheckout(patientId, {
        patientPhone: input.patientPhone,
        history,
        historyLocale,
        sundayDateKey,
      });
    }

    const mapped = await SundayConsultService.createFreeRequestInternal(patientId, {
      patientPhone: input.patientPhone,
      history,
      historyLocale,
      sundayDateKey,
      affordabilityChoice: SundayAffordabilityChoices.CANNOT_AFFORD,
    });

    return { kind: "request", ...mapped };
  }

  private static async createFreeRequestInternal(
    patientId: string,
    input: {
      patientPhone: string;
      history: SundayHistoryAnswerDto[];
      historyLocale: IntakeLocale;
      sundayDateKey: string;
      affordabilityChoice: SundayPatientRequestDto["affordabilityChoice"];
      paymentId?: string;
    },
  ): Promise<SundayPatientRequestDto> {
    const user = await UserModel.findById(patientId).lean();

    let doc;
    try {
      doc = await SundayFreeRequestModel.create({
        patientId,
        patientPhone: input.patientPhone,
        history: input.history,
        historyLocale: input.historyLocale,
        sundayDateKey: input.sundayDateKey,
        affordabilityChoice: input.affordabilityChoice,
        paymentId: input.paymentId,
        status: SundayFreeRequestStatuses.REQUESTED,
      });
    } catch (error) {
      // Two concurrent requests from the same patient can both pass the
      // earlier findOne() conflict check in submitRequest() before either
      // has written (TOCTOU race) — the unique partial index on
      // SundayFreeRequest{patientId, sundayDateKey} (REQUESTED/ASSIGNED
      // only) is the actual guard; a duplicate key here means the other
      // request already won. Recover by returning that existing request
      // instead of surfacing a raw 500 to the loser.
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const existing = await SundayFreeRequestModel.findOne(
        mongoFilter({
          patientId,
          sundayDateKey: input.sundayDateKey,
          status: { $in: [...ACTIVE_REQUEST_STATUSES] },
        }),
      ).lean();
      if (!existing) {
        throw error;
      }
      return SundayConsultService.mapPatientRequest(
        existing as Parameters<typeof SundayConsultService.mapPatientRequest>[0],
      );
    }

    const requestId = doc._id.toString();
    const isPaid = input.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE;
    const patientName = safeDisplayText(user?.name) ?? "A patient";
    await notifyAdmins({
      title: isPaid
        ? "New Sunday consult request (paid contribution)"
        : "New Sunday free consult request",
      body: isPaid
        ? `${patientName} paid Rs. ${SUNDAY_CONSULT_CONFIG.contributionFeePkr} and requested a Sunday consult. It is now on the doctors' open-requests board.`
        : `${patientName} requested a free Sunday consult. It is now on the doctors' open-requests board.`,
      payload: { type: "sunday_free_requested", requestId, sundayDateKey: input.sundayDateKey },
    }).catch((err) => {
      console.error("[sunday-consult] admin notification failed", err);
    });

    await SundayConsultService.notifyDoctorsOfOpenRequest(requestId, input.sundayDateKey).catch(
      (err) => {
        console.error("[sunday-consult] doctor notification failed", err);
      },
    );

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
      history: SundayHistoryAnswerDto[];
      historyLocale: IntakeLocale;
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

    const historyEncrypted = encryptField(JSON.stringify(input.history));

    if (pendingPayment) {
      const paymentId = pendingPayment._id.toString();
      // Keep the latest answers if the patient re-submits while a checkout is pending.
      await PaymentModel.updateOne(mongoFilter({ _id: paymentId }), {
        $set: {
          "metadata.historyEncrypted": historyEncrypted,
          "metadata.historyLocale": input.historyLocale,
        },
      });
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
        historyEncrypted,
        historyLocale: input.historyLocale,
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
      history: readPaymentHistory(metadata),
      historyLocale: normalizeIntakeLocale(metadata.historyLocale),
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

  /** Sunday date keys that have at least one request, newest first. */
  static async listAdminRequestDates(): Promise<string[]> {
    await connectDatabase();
    const keys = await SundayFreeRequestModel.distinct(
      "sundayDateKey",
      mongoFilter({ deletedAt: null }),
    );
    return (keys as string[]).filter(Boolean).sort().reverse();
  }

  /**
   * Admin progress feed. `dateKey` = one Sunday (YYYY-MM-DD); `"all"` = full history,
   * newest first (capped at ADMIN_REQUEST_HISTORY_LIMIT).
   */
  static async listAdminRequests(dateKey?: string): Promise<SundayAdminRequestDto[]> {
    await connectDatabase();
    const allSundays = dateKey === "all";
    const sundayDateKey = dateKey ?? formatSundayDateKey(getActiveOrNextSundayDate());

    // All statuses — admins follow a request through to completion, no-show or cancellation.
    const docs = await SundayFreeRequestModel.find(
      mongoFilter(allSundays ? { deletedAt: null } : { sundayDateKey, deletedAt: null }),
    )
      .sort(allSundays ? { sundayDateKey: -1, createdAt: 1 } : { createdAt: 1 })
      .limit(allSundays ? ADMIN_REQUEST_HISTORY_LIMIT : 0)
      .populate("patientId", "name phone")
      .populate(
        "appointmentId",
        "scheduledStart scheduledEnd status completedAt missedBy noShowMarkedAt cancellationReason",
      )
      .populate({
        path: "assignedDoctorId",
        select: "specialties pmdcVerified ratingAvg ratingCount",
        populate: { path: "userId", select: "name phone" },
      })
      .lean();

    const appointmentIds = docs
      .map((doc) => {
        const appointment = doc.appointmentId as { _id?: { toString(): string } } | { toString(): string } | null;
        if (!appointment) return undefined;
        return typeof appointment === "object" && "_id" in appointment
          ? appointment._id?.toString()
          : appointment.toString();
      })
      .filter((id): id is string => Boolean(id));

    const [videoSessions, reviews, platformReviews] = appointmentIds.length
      ? await Promise.all([
          VideoSessionModel.find(mongoFilter({ appointmentId: { $in: appointmentIds } }))
            .select(
              "appointmentId status patientJoinedAt doctorJoinedAt startedAt endedAt durationSeconds",
            )
            .lean(),
          ReviewModel.find(mongoFilter({ appointmentId: { $in: appointmentIds } }))
            .select("appointmentId rating comment createdAt isVisible")
            .lean(),
          ReviewService.getPlatformReviewsForAppointments(appointmentIds),
        ])
      : [[], [], new Map()];

    const videoSessionByAppointment = new Map(
      videoSessions.map((session) => [session.appointmentId?.toString(), session]),
    );
    const reviewByAppointment = new Map(
      reviews.map((review) => [review.appointmentId?.toString(), review]),
    );

    return docs.map((doc) => {
      const patient = doc.patientId as { name?: string; phone?: string } | null;
      const appointment = doc.appointmentId as {
        completedAt?: Date;
        missedBy?: "patient" | "doctor";
        noShowMarkedAt?: Date;
        cancellationReason?: string;
      } | null;
      const doctorUser = (doc.assignedDoctorId as { userId?: { phone?: string } | null } | null)
        ?.userId;
      const mapped = SundayConsultService.mapPatientRequest(
        doc as Parameters<typeof SundayConsultService.mapPatientRequest>[0],
      );
      const videoSession = mapped.appointmentId
        ? videoSessionByAppointment.get(mapped.appointmentId)
        : undefined;
      const review = mapped.appointmentId
        ? reviewByAppointment.get(mapped.appointmentId)
        : undefined;
      return {
        requestId: mapped.requestId,
        status: mapped.status,
        sundayDateKey: mapped.sundayDateKey,
        patientName: safeDisplayText(patient?.name) ?? "Patient",
        patientPhone: mapped.patientPhone,
        patientNotes: mapped.patientNotes,
        history: (doc.history ?? []).map((h) => ({
          key: h.key,
          text: h.text,
          answer: h.answer,
        })),
        affordabilityChoice: mapped.affordabilityChoice,
        paymentId: mapped.paymentId,
        contributionFeePkr: mapped.contributionFeePkr,
        createdAt: mapped.createdAt,
        assignedAt: mapped.assignedAt,
        completedAt: (doc.completedAt ?? appointment?.completedAt)?.toISOString(),
        cancelledAt: doc.cancelledAt?.toISOString(),
        rejectedByAdmin: Boolean(doc.rejectedBy),
        cancellationReason:
          safeDisplayText(doc.cancellationReason) ?? appointment?.cancellationReason ?? undefined,
        appointmentId: mapped.appointmentId,
        appointmentStatus: mapped.appointmentStatus,
        missedBy: appointment?.missedBy ?? undefined,
        scheduledStart: mapped.scheduledStart,
        scheduledEnd: mapped.scheduledEnd,
        doctor: mapped.doctor
          ? {
              doctorId: mapped.doctor.doctorId,
              name: mapped.doctor.name,
              phone: safeDisplayText(doctorUser?.phone) ?? undefined,
              specialty: mapped.doctor.specialty,
              pmdcVerified: mapped.doctor.pmdcVerified,
              ratingAvg: mapped.doctor.ratingAvg,
              ratingCount: mapped.doctor.ratingCount,
            }
          : undefined,
        patientJoinedAt: videoSession?.patientJoinedAt?.toISOString(),
        doctorJoinedAt: videoSession?.doctorJoinedAt?.toISOString(),
        session: videoSession
          ? {
              status: videoSession.status,
              startedAt: videoSession.startedAt?.toISOString(),
              endedAt: videoSession.endedAt?.toISOString(),
              durationSeconds: videoSession.durationSeconds ?? undefined,
            }
          : undefined,
        review: review
          ? {
              rating: review.rating,
              comment: review.comment ?? undefined,
              createdAt: review.createdAt?.toISOString(),
              isVisible: review.isVisible !== false,
            }
          : undefined,
        platformReview: mapped.appointmentId
          ? platformReviews.get(mapped.appointmentId)
          : undefined,
      };
    });
  }

  /**
   * Admin rejects a request outright — waiting or already picked, as long as the
   * consult has not started. Cancels the linked appointment and tells patient + doctor.
   */
  static async rejectRequestByAdmin(
    adminUserId: string,
    requestId: string,
    reason: string,
  ): Promise<{ rejected: true }> {
    await connectDatabase();

    const request = await SundayFreeRequestModel.findOne(
      mongoFilter({
        _id: requestId,
        deletedAt: null,
        status: { $in: [...ACTIVE_REQUEST_STATUSES] },
      }),
    ).lean();
    if (!request) {
      throw new AppError(
        "Request not found or already closed",
        ErrorCodes.NOT_FOUND,
        404,
      );
    }

    if (request.appointmentId) {
      const cancelled = await AppointmentModel.findOneAndUpdate(
        mongoFilter({
          _id: request.appointmentId,
          status: { $in: [AppointmentStatuses.PENDING, AppointmentStatuses.CONFIRMED] },
        }),
        {
          $set: {
            status: AppointmentStatuses.CANCELLED,
            cancellationReason: `Rejected by admin: ${reason}`,
            cancelledBy: adminUserId,
          },
        },
      );
      if (!cancelled) {
        throw new AppError(
          "This consultation has already started or finished",
          ErrorCodes.CONFLICT,
          409,
        );
      }
    }

    const updated = await SundayFreeRequestModel.findOneAndUpdate(
      mongoFilter({ _id: requestId, status: request.status }),
      {
        $set: {
          status: SundayFreeRequestStatuses.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason,
          rejectedBy: adminUserId,
        },
      },
    );
    if (!updated) {
      throw new AppError("Request changed — refresh and try again", ErrorCodes.CONFLICT, 409);
    }

    await deliverUserNotification({
      userId: request.patientId.toString(),
      title: "Sunday free consult request declined",
      body: `Your Sunday free consultation request was declined by ZindagiCare. Note: ${reason}`,
      payload: { type: "sunday_free_rejected", requestId },
    }).catch((err) => {
      console.error("[sunday-consult] patient rejection notification failed", err);
    });

    if (request.assignedDoctorId) {
      const doctor = await DoctorProfileModel.findById(request.assignedDoctorId)
        .select("userId")
        .lean();
      if (doctor?.userId) {
        await deliverUserNotification({
          userId: doctor.userId.toString(),
          title: "Sunday consult cancelled by admin",
          body: "An admin cancelled a Sunday free consult you had picked. It has been removed from your schedule.",
          payload: { type: "sunday_free_rejected", requestId },
          skipWhatsApp: true,
        }).catch((err) => {
          console.error("[sunday-consult] doctor rejection notification failed", err);
        });
      }
    }

    publishSundayEvent({
      type: "instance_updated",
      doctorId: request.assignedDoctorId?.toString() ?? "queue",
      sundayDateKey: request.sundayDateKey,
      instanceId: requestId,
    });

    return { rejected: true };
  }

  /** In-app + push heads-up to doctors who opted into Sunday consults. */
  private static async notifyDoctorsOfOpenRequest(requestId: string, sundayDateKey: string) {
    const doctors = await DoctorProfileModel.find(
      mongoFilter({
        sundayConsultEnabled: true,
        verificationStatus: VerificationStatuses.APPROVED,
      }),
    )
      .select("userId")
      .lean();

    await Promise.all(
      doctors.map((doc) =>
        deliverUserNotification({
          userId: doc.userId.toString(),
          title: "New Sunday free consult request",
          body: "A patient is waiting for a free Sunday consultation. Pick them and choose a time to earn a review.",
          payload: { type: "sunday_free_open_request", requestId, sundayDateKey },
          skipWhatsApp: true,
          skipEmail: true,
        }),
      ),
    );
  }

  private static async requireApprovedDoctor(userId: string) {
    const doctor = await DoctorProfileModel.findOne(mongoFilter({ userId }))
      .populate("userId", "name phone")
      .lean();
    if (!doctor) {
      throw new AppError("Doctor profile not found", ErrorCodes.NOT_FOUND, 404);
    }
    if (doctor.verificationStatus !== VerificationStatuses.APPROVED) {
      throw new AppError(
        "Only verified doctors can pick Sunday free consult requests",
        ErrorCodes.FORBIDDEN,
        403,
      );
    }
    return doctor;
  }

  /**
   * Open-requests board for doctors: every unpicked request for the Sunday,
   * plus the requests this doctor has already picked. Any verified doctor can
   * see the board — opting into Sunday consults is not required. Requests
   * older than a week that no doctor ever picked stay on the board (flagged
   * `overdue`) so those patients are not silently dropped.
   */
  static async listDoctorRequests(
    userId: string,
    dateKey?: string,
  ): Promise<SundayDoctorRequestDto[]> {
    await connectDatabase();
    const doctor = await SundayConsultService.requireApprovedDoctor(userId);
    const sundayDateKey = dateKey ?? formatSundayDateKey(getActiveOrNextSundayDate());

    const docs = await SundayFreeRequestModel.find(
      mongoFilter({
        $or: [
          { sundayDateKey, status: SundayFreeRequestStatuses.REQUESTED },
          {
            sundayDateKey,
            status: {
              $in: [SundayFreeRequestStatuses.ASSIGNED, SundayFreeRequestStatuses.COMPLETED],
            },
            assignedDoctorId: doctor._id,
          },
          {
            status: SundayFreeRequestStatuses.REQUESTED,
            createdAt: { $lte: new Date(Date.now() - OVERDUE_REQUEST_AGE_MS) },
          },
        ],
        deletedAt: null,
      }),
    )
      .sort({ createdAt: 1 })
      .populate("patientId", "name")
      .populate("appointmentId", "scheduledStart scheduledEnd status")
      .lean();

    return docs.map((doc) => {
      const patient = doc.patientId as { name?: string } | null;
      const mapped = SundayConsultService.mapPatientRequest(
        doc as Parameters<typeof SundayConsultService.mapPatientRequest>[0],
      );
      const pickedByMe = doc.assignedDoctorId?.toString() === doctor._id.toString();
      const overdue =
        mapped.status === SundayFreeRequestStatuses.REQUESTED &&
        mapped.sundayDateKey < sundayDateKey;
      return {
        requestId: mapped.requestId,
        status: mapped.status,
        sundayDateKey: mapped.sundayDateKey,
        patientName: safeDisplayText(patient?.name) ?? "Patient",
        patientPhone: pickedByMe ? mapped.patientPhone : undefined,
        patientNotes: mapped.patientNotes,
        history: (doc.history ?? []).map((h) => ({
          key: h.key,
          text: h.text,
          answer: h.answer,
        })),
        affordabilityChoice: mapped.affordabilityChoice,
        createdAt: mapped.createdAt,
        overdue,
        consultDateKey: overdue ? sundayDateKey : mapped.sundayDateKey,
        pickedByMe,
        appointmentId: pickedByMe ? mapped.appointmentId : undefined,
        scheduledStart: pickedByMe ? mapped.scheduledStart : undefined,
        scheduledEnd: pickedByMe ? mapped.scheduledEnd : undefined,
      };
    });
  }

  /**
   * Doctor picks an open request and schedules the consult on that Sunday.
   * The REQUESTED → ASSIGNED flip is a single atomic update, so when two
   * doctors pick the same patient at once exactly one wins; the other gets a
   * clean 409.
   */
  static async claimRequest(
    userId: string,
    requestId: string,
    input: SundayFreeClaimInput,
    locale?: "en" | "ur",
  ): Promise<SundayDoctorRequestDto> {
    await connectDatabase();
    const doctor = await SundayConsultService.requireApprovedDoctor(userId);

    const request = await SundayFreeRequestModel.findById(requestId);
    if (!request || request.deletedAt) {
      throw new AppError("Request not found", ErrorCodes.NOT_FOUND, 404);
    }
    if (request.status !== SundayFreeRequestStatuses.REQUESTED) {
      throw new AppError(
        "Another doctor already picked this patient",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    // An overdue request (its Sunday passed with no doctor picking it) is
    // scheduled on the current board Sunday instead of its original date.
    const boardDateKey = formatSundayDateKey(getActiveOrNextSundayDate());
    const consultDateKey =
      request.sundayDateKey < boardDateKey ? boardDateKey : request.sundayDateKey;
    const scheduledStart = localTimeToUtc(consultDateKey, input.startTimeLocal);
    const scheduledEnd = new Date(
      scheduledStart.getTime() + SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins * 60_000,
    );
    if (scheduledStart.getTime() < Date.now() - CLAIM_PAST_GRACE_MS) {
      throw new AppError(
        "That time has already passed — pick a later time",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    const clash = await AppointmentModel.exists(
      mongoFilter({
        doctorId: doctor._id,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        scheduledStart: { $lt: scheduledEnd },
        scheduledEnd: { $gt: scheduledStart },
      }),
    );
    if (clash) {
      throw new AppError(
        "You already have a consultation at that time — pick another time",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    let claimed;
    try {
      claimed = await SundayFreeRequestModel.findOneAndUpdate(
        mongoFilter({ _id: requestId, status: SundayFreeRequestStatuses.REQUESTED }),
        {
          $set: {
            status: SundayFreeRequestStatuses.ASSIGNED,
            assignedDoctorId: doctor._id,
            assignedAt: new Date(),
            sundayDateKey: consultDateKey,
          },
        },
        { returnDocument: "after" },
      );
    } catch (error) {
      // Moving an overdue request onto this Sunday collides with the unique
      // index when the patient already has an active request for it.
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          "This patient already has a free consult request this Sunday",
          ErrorCodes.CONFLICT,
          409,
        );
      }
      throw error;
    }
    if (!claimed) {
      throw new AppError(
        "Another doctor already picked this patient",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    let appointmentId: string;
    try {
      const appointment = await AppointmentModel.create({
        type: AppointmentTypes.SUNDAY_FREE,
        status: AppointmentStatuses.CONFIRMED,
        patientId: request.patientId,
        doctorId: doctor._id,
        paymentId: request.paymentId,
        scheduledStart,
        scheduledEnd,
        timezone: SUNDAY_CONSULT_CONFIG.timezone,
        sundayDateKey: consultDateKey,
        isOnline: true,
        patientNotes: request.patientNotes,
      } as Record<string, unknown>);
      appointmentId = appointment._id.toString();
    } catch (error) {
      // Put the request back on the board so another doctor (or this one,
      // at a different time) can pick it.
      await SundayFreeRequestModel.updateOne(
        mongoFilter({
          _id: requestId,
          status: SundayFreeRequestStatuses.ASSIGNED,
          assignedDoctorId: doctor._id,
        }),
        {
          $set: {
            status: SundayFreeRequestStatuses.REQUESTED,
            sundayDateKey: request.sundayDateKey,
          },
          $unset: { assignedDoctorId: "", assignedAt: "" },
        },
      );
      if (isDuplicateKeyError(error) && consultDateKey !== request.sundayDateKey) {
        throw new AppError(
          "This patient already has a free consult booked this Sunday",
          ErrorCodes.CONFLICT,
          409,
        );
      }
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          "That time was just taken — pick another time",
          ErrorCodes.CONFLICT,
          409,
        );
      }
      throw error;
    }

    await SundayFreeRequestModel.updateOne(
      mongoFilter({ _id: requestId }),
      { $set: { appointmentId } },
    );

    if (request.history?.length) {
      // History was taken up-front on the request — carry it into the
      // appointment's intake as already completed so the patient is not asked again.
      const historyLocale = normalizeIntakeLocale(request.historyLocale);
      await MedicalIntakeService.createCompletedFromPrior(
        appointmentId,
        {
          id: requestId,
          appointmentId,
          source: IntakeSources.FORM,
          status: IntakeStatuses.COMPLETED,
          locale: historyLocale,
          currentQuestionIndex: request.history.length,
          questions: request.history.map((h) => ({
            key: h.key,
            text: h.text,
            answer: h.answer,
            answeredAt: (request.createdAt ?? new Date()).toISOString(),
          })),
          completedAt: (request.createdAt ?? new Date()).toISOString(),
        },
        IntakeSources.FORM,
        historyLocale,
      );
    } else {
      await MedicalIntakeService.createForAppointment(appointmentId, IntakeSources.FORM, locale);
    }

    const patient = await UserModel.findById(request.patientId).lean();
    const doctorUser = doctor.userId as {
      _id?: { toString(): string };
      name?: string;
      phone?: string;
    } | null;

    await sendBookingConfirmation({
      userId: request.patientId.toString(),
      phone: safeDisplayText(patient?.phone) ?? request.patientPhone,
      doctorName: safeDisplayText(doctorUser?.name) ?? "Doctor",
      slotStart: scheduledStart,
      appointmentId,
    }).catch((err) => {
      console.error("[sunday-consult] patient notification failed", err);
    });

    await ChatService.ensureAppointmentThread(appointmentId).catch((err) => {
      console.error("[sunday-consult] chat thread setup failed", err);
    });

    if (doctorUser?._id) {
      await sendDoctorConsultBooked({
        userId: doctorUser._id.toString(),
        phone: safeDisplayText(doctorUser.phone) ?? undefined,
        patientName: safeDisplayText(patient?.name) ?? "Patient",
        slotStart: scheduledStart,
        appointmentId,
        type: "sunday_free",
        patientId: request.patientId.toString(),
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

    const rows = await SundayConsultService.listDoctorRequests(userId, consultDateKey);
    const row = rows.find((r) => r.requestId === requestId);
    if (!row) {
      throw new AppError("Picked request not found", ErrorCodes.NOT_FOUND, 404);
    }
    return row;
  }

  /**
   * Doctor hands a picked request back to the open board (e.g. can no longer
   * make the time). Only allowed before the consult has started.
   */
  static async releaseRequest(userId: string, requestId: string): Promise<{ released: true }> {
    await connectDatabase();
    const doctor = await SundayConsultService.requireApprovedDoctor(userId);

    const request = await SundayFreeRequestModel.findOne(
      mongoFilter({
        _id: requestId,
        status: SundayFreeRequestStatuses.ASSIGNED,
        assignedDoctorId: doctor._id,
      }),
    ).lean();
    if (!request) {
      throw new AppError("Request not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (request.appointmentId) {
      const cancelled = await AppointmentModel.findOneAndUpdate(
        mongoFilter({
          _id: request.appointmentId,
          doctorId: doctor._id,
          status: { $in: [AppointmentStatuses.PENDING, AppointmentStatuses.CONFIRMED] },
        }),
        {
          $set: {
            status: AppointmentStatuses.CANCELLED,
            cancellationReason: "Doctor released Sunday free consult request",
            cancelledBy: userId,
          },
        },
      );
      if (!cancelled) {
        throw new AppError(
          "This consultation has already started or finished",
          ErrorCodes.CONFLICT,
          409,
        );
      }
    }

    await SundayFreeRequestModel.updateOne(
      mongoFilter({
        _id: requestId,
        status: SundayFreeRequestStatuses.ASSIGNED,
        assignedDoctorId: doctor._id,
      }),
      {
        $set: { status: SundayFreeRequestStatuses.REQUESTED },
        $unset: { assignedDoctorId: "", assignedAt: "", appointmentId: "" },
      },
    );

    await deliverUserNotification({
      userId: request.patientId.toString(),
      title: "Sunday consult rescheduling",
      body: "Your doctor is no longer available at the chosen time. Your request is back in the queue and another doctor will pick it shortly.",
      payload: { type: "sunday_free_released", requestId },
    }).catch((err) => {
      console.error("[sunday-consult] patient release notification failed", err);
    });

    publishSundayEvent({
      type: "instance_updated",
      doctorId: doctor._id.toString(),
      sundayDateKey: request.sundayDateKey,
      instanceId: requestId,
    });

    return { released: true };
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
