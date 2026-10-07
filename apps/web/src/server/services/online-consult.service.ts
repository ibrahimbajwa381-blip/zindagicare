import { Types } from "mongoose";
import {
  connectDatabase,
  DoctorProfileModel,
  AppointmentModel,
  PaymentModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  ErrorCodes,
  AppointmentStatuses,
  AppointmentTypes,
  SlotStatuses,
  VerificationStatuses,
  PaymentProviders,
  PaymentStatuses,
  ONLINE_CONSULT_CONFIG,
  getVideoJoinWindow,
  resolveDisplaySpecialty,
  withDoctorTitle,
  SPECIALTIES,
} from "@zindagi/shared";
import type { ConsultCheckoutInput } from "@zindagi/validators";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { resolveDoctorSlug } from "@/lib/doctors/profile-path";
import { mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import {
  appointmentBlocksSlot,
  generateConsultSlots,
  isValidCalendarDateKey,
  parseConsultSlotId,
  type WeeklyWindow,
} from "@/lib/consult/slot-utils";
import { generateTxnRefNo } from "@/lib/payments/jazzcash";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { CacheTags, cacheKey, cached } from "@/server/lib/cache";
import { normalizePhoneDigits, toPakistaniLocalPhone } from "@zindagi/validators";
import { phoneLookupHash } from "@zindagi/shared";
import {
  buildGatewayCheckout,
  gatewayIntegrationLabel,
  isGatewayConfigured,
  resolveCheckoutProvider,
  type GatewayRedirectForm,
  type LivePaymentProvider,
} from "@/lib/payments/payment-gateway";
import {
  buildTestPaymentCheckout,
  dummyExternalTransactionId,
  type TestPaymentCheckout,
} from "@/lib/payments/dummy-payment";
import {
  buildManualTransferCheckout,
  isManualTransferMode,
  manualExternalTransactionId,
  type ManualTransferCheckout,
} from "@/lib/payments/manual-payment";
import { sendOnlineConsultConfirmation, sendDoctorConsultBooked } from "@/lib/notifications/consult-notifications";
import { notifyAdmins } from "@/lib/notifications/notify-admins";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { mongoFilter } from "@/lib/mongo/query";
import { resolveMongoRefId } from "@/lib/mongo/resolve-id";
import { ChatService } from "@/server/services/chat.service";
import { VideoSessionService } from "@/server/services/video-session.service";
import { randomUUID } from "crypto";

const ACTIVE_STATUSES = [
  AppointmentStatuses.PENDING,
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
];

export type ConsultDoctorRow = {
  doctorId: string;
  slug?: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  ratingAvg: number;
  ratingCount: number;
  pmdcVerified: boolean;
  consultationFee: number;
  hospital?: string;
  medicalDegree?: string;
  qualifications: string[];
  availableSlots: number;
  isFull: boolean;
};

export type ConsultSlotView = {
  slotId: string;
  startAt: string;
  endAt: string;
  status: string;
};

export type OnlinePatientBookingDto = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  consultationFee: number;
  doctor: {
    doctorId: string;
    /** User account id — required for `/messages?doctor=` deep links. */
    userId: string;
    name: string;
    avatarUrl?: string;
    specialty: string;
    pmdcVerified: boolean;
    ratingAvg: number;
    ratingCount: number;
  };
};

export type ValidatedSlotBooking = {
  doctorId: string;
  slotId: string;
  slotStart: Date;
  slotEnd: Date;
  consultationFee: number;
  doctorName: string;
};

export type CheckoutResult = {
  paymentId: string;
  appointmentId: string;
  amount: number;
  /** Manual JazzCash transfer + receipt upload (default until gateways are live). */
  manualTransfer?: ManualTransferCheckout;
  /** @deprecated use manualTransfer */
  testMode?: boolean;
  /** @deprecated use manualTransfer */
  testPayment?: TestPaymentCheckout;
  gatewayRedirect?: GatewayRedirectForm;
  /** @deprecated use gatewayRedirect */
  jazzcash?: GatewayRedirectForm;
};

const EXPIRE_SWEEP_INTERVAL_MS = 60_000;
let lastExpireSweepAt = 0;

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

export class OnlineConsultService {
  private static async ensureConnected() {
    await connectDatabase();
  }

  static async getDoctorAvailabilitySummary(
    doctorId: string,
    weeklyAvailability: WeeklyWindow[],
  ) {
    await OnlineConsultService.ensureConnected();

    const rangeStart = new Date();
    const rangeEnd = new Date(
      rangeStart.getTime() +
        ONLINE_CONSULT_CONFIG.lookaheadDays * 24 * 60 * 60 * 1000,
    );
    const booked = await OnlineConsultService.getBookedRanges(
      [doctorId],
      rangeStart,
      rangeEnd,
    );
    const availableSlots = OnlineConsultService.countAvailableSlots(
      weeklyAvailability,
      booked,
    );

    return {
      availableSlots,
      isFull: availableSlots === 0,
    };
  }

  private static async getBookedRanges(
    doctorIds: string[],
    rangeStart: Date,
    rangeEnd: Date,
  ) {
    return AppointmentModel.find(
      mongoFilter({
        doctorId: { $in: doctorIds },
        status: { $in: ACTIVE_STATUSES },
        scheduledStart: { $lt: rangeEnd },
        scheduledEnd: { $gt: rangeStart },
      }),
    )
      .select("doctorId scheduledStart scheduledEnd")
      .lean();
  }

  private static countAvailableSlots(
    weeklyAvailability: WeeklyWindow[],
    booked: { scheduledStart: Date; scheduledEnd: Date }[],
    from = new Date(),
  ) {
    const slots = generateConsultSlots(
      weeklyAvailability,
      from,
      ONLINE_CONSULT_CONFIG.lookaheadDays,
      ONLINE_CONSULT_CONFIG.defaultSlotDurationMins,
    );

    return slots.filter(
      (slot) =>
        !booked.some((appt) =>
          appointmentBlocksSlot(slot.startAt, slot.endAt, appt),
        ),
    ).length;
  }

  static async expireStalePendingBookings() {
    await OnlineConsultService.ensureConnected();
    const now = Date.now();
    if (now - lastExpireSweepAt < EXPIRE_SWEEP_INTERVAL_MS) return;
    lastExpireSweepAt = now;

    await AppointmentModel.updateMany(
      mongoFilter({
        type: AppointmentTypes.ONLINE,
        status: AppointmentStatuses.PENDING,
        $or: [{ paymentId: { $exists: false } }, { paymentId: null }],
      }),
      { $set: { status: AppointmentStatuses.CANCELLED } },
    );

    const cutoff = new Date(Date.now() - ONLINE_CONSULT_CONFIG.paymentHoldDurationMs);

    const stale = await AppointmentModel.find(
      mongoFilter({
        type: AppointmentTypes.ONLINE,
        status: AppointmentStatuses.PENDING,
        createdAt: { $lt: cutoff },
      }),
    ).lean();

    for (const appt of stale) {
      await OnlineConsultService.cancelPendingHold(
        appt._id.toString(),
        appt.paymentId?.toString(),
      );
    }
  }

  private static async cancelPendingHold(appointmentId: string, paymentId?: string) {
    await AppointmentModel.updateOne(
      mongoFilter({ _id: appointmentId }),
      { $set: { status: AppointmentStatuses.CANCELLED } },
    );
    if (paymentId) {
      await PaymentModel.updateOne(
        mongoFilter({ _id: paymentId, status: PaymentStatuses.PENDING }),
        { $set: { status: PaymentStatuses.CANCELLED } },
      );
    }
  }

  private static buildCheckoutResultFromPayment(
    payment: {
      _id: { toString(): string };
      amount: number;
      provider: string;
      appointmentId?: { toString(): string } | null;
      externalTransactionId?: string | null;
      metadata?: Record<string, unknown>;
    },
    doctorName: string,
  ): CheckoutResult {
    const paymentId = payment._id.toString();
    const appointmentId = payment.appointmentId!.toString();
    const metadata = payment.metadata as { txnRefNo?: string; doctorName?: string } | undefined;
    const txnRefNo =
      payment.externalTransactionId ??
      metadata?.txnRefNo?.replace(/^DUMMY-/, "") ??
      paymentId;

    if (
      payment.provider === PaymentProviders.MANUAL_JAZZCASH ||
      payment.provider === PaymentProviders.DUMMY
    ) {
      const manualTransfer = buildManualTransferCheckout({
        paymentId,
        amountPkr: payment.amount,
        description: `Online consult with ${metadata?.doctorName ?? doctorName}`,
      });
      return {
        paymentId,
        appointmentId,
        amount: payment.amount,
        manualTransfer,
        testMode: true,
        testPayment: buildTestPaymentCheckout({
          paymentId,
          appointmentId,
          amountPkr: payment.amount,
          doctorName: metadata?.doctorName ?? doctorName,
          txnRefNo: metadata?.txnRefNo,
        }),
      };
    }

    const provider = payment.provider as LivePaymentProvider;
    if (
      provider !== PaymentProviders.JAZZCASH &&
      provider !== PaymentProviders.EASYPAISA
    ) {
      throw new AppError("Unsupported payment provider", ErrorCodes.VALIDATION, 400);
    }

    if (!isGatewayConfigured(provider)) {
      throw new AppError(
        provider === PaymentProviders.JAZZCASH
          ? "JazzCash credentials missing. Set JAZZCASH_* env vars."
          : "Easypaisa credentials missing. Set EASYPAISA_* env vars.",
        ErrorCodes.VALIDATION,
        503,
      );
    }

    const gatewayRedirect = buildGatewayCheckout(provider, {
      amountPkr: payment.amount,
      txnRefNo,
      billReference: appointmentId.slice(-12),
      description: `Online consult with ${metadata?.doctorName ?? doctorName}`,
      paymentId,
    });

    return {
      paymentId,
      appointmentId,
      amount: payment.amount,
      gatewayRedirect,
      jazzcash: gatewayRedirect,
    };
  }

  private static async reconcilePatientPendingCheckout(
    patientId: string,
    requestedSlotId: string,
    doctorName: string,
  ): Promise<CheckoutResult | null> {
    const pendingAppointments = await AppointmentModel.find(
      mongoFilter({
        patientId,
        type: AppointmentTypes.ONLINE,
        status: AppointmentStatuses.PENDING,
      }),
    ).lean();

    let resumable: CheckoutResult | null = null;

    for (const appt of pendingAppointments) {
      if (!appt.paymentId) {
        await OnlineConsultService.cancelPendingHold(appt._id.toString());
        continue;
      }

      const payment = await PaymentModel.findById(appt.paymentId).lean();
      if (!payment || payment.status !== PaymentStatuses.PENDING) {
        await OnlineConsultService.cancelPendingHold(
          appt._id.toString(),
          appt.paymentId.toString(),
        );
        continue;
      }

      const metadata = payment.metadata as { expiresAt?: string; slotId?: string } | undefined;
      const expiresAtMs = metadata?.expiresAt
        ? new Date(metadata.expiresAt).getTime()
        : appt.createdAt.getTime() + ONLINE_CONSULT_CONFIG.paymentHoldDurationMs;

      if (expiresAtMs <= Date.now()) {
        await OnlineConsultService.cancelPendingHold(
          appt._id.toString(),
          payment._id.toString(),
        );
        continue;
      }

      if (metadata?.slotId === requestedSlotId) {
        resumable = OnlineConsultService.buildCheckoutResultFromPayment(payment, doctorName);
        continue;
      }

      await OnlineConsultService.cancelPendingHold(
        appt._id.toString(),
        payment._id.toString(),
      );
    }

    return resumable;
  }

  static async listConsultDoctors(city?: string, specialty?: string) {
    // Throttled sweep; runs outside the cache so expired holds still free up
    // slots on cache hits (its writes invalidate the cached counts).
    await OnlineConsultService.expireStalePendingBookings();

    // Slot counts here are display-only — booking re-validates the slot live
    // (validateSlotForBooking), so a briefly stale count can't double-book.
    return cached(
      cacheKey("consult-doctors", city, specialty),
      { ttl: 120, tags: [CacheTags.DOCTORS, CacheTags.DOCTOR_AVAILABILITY] },
      () => OnlineConsultService.loadConsultDoctors(city, specialty),
    );
  }

  private static async loadConsultDoctors(city?: string, specialty?: string) {
    await OnlineConsultService.ensureConnected();

    const filter: Record<string, unknown> = {
      isListed: true,
      verificationStatus: VerificationStatuses.APPROVED,
      ...(city ? { coverageCities: city } : {}),
      consultationFee: { $gte: ONLINE_CONSULT_CONFIG.minConsultationFee },
    };

    if (specialty?.trim()) {
      // Case-insensitive regex can't use the specialties index (COLLSCAN) and
      // is slow on a remote cluster. Specialties are a small fixed vocabulary,
      // so resolve the typed text to canonical values in memory and query
      // those with an indexed exact match instead.
      const needle = specialty.trim().toLowerCase();
      const matches = SPECIALTIES.filter((s) => s.toLowerCase().includes(needle));
      filter.specialties = { $in: matches.length ? matches : [specialty.trim()] };
    }

    const allDoctors = await DoctorProfileModel.find(filter)
      .populate("userId", "name avatarUrl isActive deletedAt")
      .sort({ ratingAvg: -1, ratingCount: -1 })
      .lean();

    // DoctorProfile.isListed isn't touched when a doctor deactivates/deletes
    // their account (deleteOwnAccount only flips User.isActive/deletedAt) —
    // exclude those here too, matching the same check validateSlotForBooking
    // already applies before checkout.
    const doctors = allDoctors.filter((doc) => {
      const doctorUser = doc.userId as { isActive?: boolean; deletedAt?: Date | null } | null;
      return doctorUser && doctorUser.isActive !== false && !doctorUser.deletedAt;
    });

    if (!doctors.length) return [];

    const rangeStart = new Date();
    const rangeEnd = new Date(
      rangeStart.getTime() +
        ONLINE_CONSULT_CONFIG.lookaheadDays * 24 * 60 * 60 * 1000,
    );

    const booked = await OnlineConsultService.getBookedRanges(
      doctors.map((d) => d._id.toString()),
      rangeStart,
      rangeEnd,
    );

    const bookedByDoctor = new Map<string, { scheduledStart: Date; scheduledEnd: Date }[]>();
    for (const appt of booked) {
      const key = appt.doctorId.toString();
      const list = bookedByDoctor.get(key) ?? [];
      list.push({
        scheduledStart: appt.scheduledStart,
        scheduledEnd: appt.scheduledEnd,
      });
      bookedByDoctor.set(key, list);
    }

    return doctors.map((doc) => {
    const user = doc.userId as { name?: string; avatarUrl?: string } | null;
    const name = mapUserPii(user ?? {}).name;
    const weeklyAvailability = (doc.weeklyAvailability ?? []) as WeeklyWindow[];
    const doctorBooked = bookedByDoctor.get(doc._id.toString()) ?? [];
    const availableSlots = OnlineConsultService.countAvailableSlots(
      weeklyAvailability,
      doctorBooked,
    );
    const verified = doc.specialties ?? [];
    const primary = resolveDisplaySpecialty({
      primarySpecialty: doc.primarySpecialty,
      specialties: verified,
    });

    return {
      doctorId: doc._id.toString(),
      slug: resolveDoctorSlug(doc.slug, name),
      name,
      avatarUrl: resolveDoctorPortrait(name, user?.avatarUrl),
      specialties: verified.includes(primary)
        ? [primary, ...verified.filter((s) => s !== primary)]
        : verified,
      ratingAvg: doc.ratingAvg ?? 0,
      ratingCount: doc.ratingCount ?? 0,
      pmdcVerified: doc.pmdcVerified ?? false,
      consultationFee: doc.consultationFee ?? 0,
      hospital: doc.hospitals?.[0]?.name,
      medicalDegree: doc.medicalDegree ?? undefined,
      qualifications: doc.qualifications ?? [],
      availableSlots,
      isFull: availableSlots === 0,
    } satisfies ConsultDoctorRow;
    });
  }

  static async getSlotsForDoctor(doctorId: string, dateKey?: string) {
    await OnlineConsultService.ensureConnected();
    await OnlineConsultService.expireStalePendingBookings();

    // Same guard as validateSlotForBooking (APT-013) — an invalid ObjectId
    // would otherwise reach Mongoose and throw a raw CastError -> 500.
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
    }

    const doctor = await DoctorProfileModel.findById(doctorId)
      .populate("userId", "isActive deletedAt")
      .lean();
    if (
      !doctor?.isListed ||
      doctor.verificationStatus !== VerificationStatuses.APPROVED ||
      (doctor.consultationFee ?? 0) < ONLINE_CONSULT_CONFIG.minConsultationFee
    ) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
    }

    const doctorUser = doctor.userId as { isActive?: boolean; deletedAt?: Date | null } | null;
    if (!doctorUser || doctorUser.isActive === false || doctorUser.deletedAt) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
    }

    const weeklyAvailability = (doctor.weeklyAvailability ?? []) as WeeklyWindow[];
    if (!weeklyAvailability.length) {
      return { doctorId, slots: [] as ConsultSlotView[] };
    }

    // The route's schema only regex-checks the shape (\d{4}-\d{2}-\d{2}).
    // Two failure modes slip past that: a genuinely unparseable value like
    // "9999-99-99" (Invalid Date, month out of range) and a silently
    // rolled-over one like "2024-02-30" (JS parses that as March 1st rather
    // than rejecting it). Either would otherwise reach date-fns' format()
    // several calls later inside generateConsultSlots — the first as an
    // uncaught RangeError, the second as a request silently served for the
    // wrong day — instead of a clean 400 here.
    if (dateKey && !isValidCalendarDateKey(dateKey)) {
      throw new AppError("Invalid date", ErrorCodes.VALIDATION, 400);
    }
    const from = dateKey ? new Date(`${dateKey}T00:00:00`) : new Date();
    const days = dateKey ? 1 : ONLINE_CONSULT_CONFIG.lookaheadDays;

    const rangeStart = from;
    const rangeEnd = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);

    const booked = await OnlineConsultService.getBookedRanges(
      [doctorId],
      rangeStart,
      rangeEnd,
    );

    const generated = generateConsultSlots(
      weeklyAvailability,
      from,
      days,
      ONLINE_CONSULT_CONFIG.defaultSlotDurationMins,
    );

    const slots: ConsultSlotView[] = generated.map((slot) => {
      const isBooked = booked.some((appt) =>
        appointmentBlocksSlot(slot.startAt, slot.endAt, appt),
      );
      return {
        slotId: slot.slotId,
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString(),
        status: isBooked ? SlotStatuses.BOOKED : SlotStatuses.AVAILABLE,
      };
    });

    return { doctorId, slots };
  }

  static async validateSlotForBooking(
    doctorId: string,
    slotId: string,
    patientId: string,
  ): Promise<ValidatedSlotBooking> {
    await OnlineConsultService.ensureConnected();

    // A malformed id (not a valid ObjectId) would otherwise reach Mongoose
    // and throw a raw CastError, surfacing as an uncaught 500 instead of the
    // same clean "Doctor not found" used for every other invalid-doctor case.
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
    }

    const doctor = await DoctorProfileModel.findById(doctorId)
      .populate("userId", "name isActive deletedAt")
      .lean();
    if (
      !doctor?.isListed ||
      doctor.verificationStatus !== VerificationStatuses.APPROVED
    ) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
    }

    const doctorUser = doctor.userId as {
      _id?: { toString(): string };
      isActive?: boolean;
      deletedAt?: Date | null;
    } | null;
    if (!doctorUser || doctorUser.isActive === false || doctorUser.deletedAt) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
    }

    // A doctor's own account (linked User) can't book a consult against their
    // own DoctorProfile — the checkout route now restricts booking to
    // Roles.PATIENT anyway, but this closes the gap for a user who happens
    // to hold both a doctor and patient role on the same account.
    if (doctorUser._id?.toString() === patientId) {
      throw new AppError("You cannot book your own consultation slot", ErrorCodes.VALIDATION, 400);
    }

    const consultationFee = doctor.consultationFee ?? 0;
    if (consultationFee < ONLINE_CONSULT_CONFIG.minConsultationFee) {
      throw new AppError(
        "Online consultation requires payment",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    let slotStart: Date;
    let slotEnd: Date;
    try {
      const parsed = parseConsultSlotId(slotId);
      slotStart = parsed.startAt;
      slotEnd = new Date(
        slotStart.getTime() +
          ONLINE_CONSULT_CONFIG.defaultSlotDurationMins * 60 * 1000,
      );
    } catch {
      throw new AppError("Invalid slot", ErrorCodes.VALIDATION, 400);
    }

    if (slotStart <= new Date()) {
      throw new AppError("Slot is in the past", ErrorCodes.SLOT_UNAVAILABLE, 409);
    }

    const weeklyAvailability = (doctor.weeklyAvailability ?? []) as WeeklyWindow[];
    const validSlot = generateConsultSlots(
      weeklyAvailability,
      slotStart,
      1,
      ONLINE_CONSULT_CONFIG.defaultSlotDurationMins,
    ).find((slot) => slot.slotId === slotId);

    if (!validSlot) {
      throw new AppError("Slot is not available", ErrorCodes.SLOT_UNAVAILABLE, 409);
    }

    const conflict = await AppointmentModel.findOne(
      mongoFilter({
        doctorId,
        status: { $in: ACTIVE_STATUSES },
        scheduledStart: { $lt: slotEnd },
        scheduledEnd: { $gt: slotStart },
      }),
    ).lean();

    if (conflict) {
      throw new AppError("Slot is no longer available", ErrorCodes.SLOT_UNAVAILABLE, 409);
    }

    const user = doctor.userId as { name?: string } | null;
    return {
      doctorId,
      slotId,
      slotStart,
      slotEnd,
      consultationFee,
      doctorName: mapUserPii(user ?? {}).name,
    };
  }

  /**
   * Patients who signed up via Google can have no phone on file. Booking requires one —
   * either already stored, or supplied on checkout (and saved to the account).
   */
  static async ensurePatientPhone(patientId: string, phone?: string): Promise<void> {
    const user = await UserModel.findById(patientId).select("phone");
    if (!user) throw new AppError("User not found", ErrorCodes.NOT_FOUND, 404);
    if (user.phone) return;

    if (!phone) {
      throw new AppError(
        "A mobile number is required to book an appointment",
        ErrorCodes.VALIDATION,
        400,
        "phone",
      );
    }

    const normalized = normalizePakistaniPhone(phone);
    const normalizedLocal = toPakistaniLocalPhone(normalizePhoneDigits(phone));
    const existing = await UserModel.findOne({
      _id: { $ne: user._id },
      $or: [
        { phoneLookup: phoneLookupHash(normalized) },
        { phoneLookup: phoneLookupHash(normalizedLocal) },
      ],
    });
    if (existing) {
      throw new AppError(
        "This mobile number is already registered",
        ErrorCodes.CONFLICT,
        409,
        "phone",
      );
    }

    user.phone = normalized;
    await user.save();
  }

  static async initiateCheckout(
    patientId: string,
    input: ConsultCheckoutInput,
  ): Promise<CheckoutResult> {
    await OnlineConsultService.ensureConnected();
    await OnlineConsultService.expireStalePendingBookings();

    await OnlineConsultService.ensurePatientPhone(patientId, input.phone);

    const validated = await OnlineConsultService.validateSlotForBooking(
      input.doctorId,
      input.slotId,
      patientId,
    );

    const resumed = await OnlineConsultService.reconcilePatientPendingCheckout(
      patientId,
      input.slotId,
      validated.doctorName,
    );
    if (resumed) return resumed;

    const txnRefNo = generateTxnRefNo();
    const idempotencyKey = randomUUID();
    const expiresAt = new Date(Date.now() + ONLINE_CONSULT_CONFIG.paymentHoldDurationMs);

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

    let appointment: { _id: { toString(): string } };
    try {
      appointment = (await AppointmentModel.create({
        type: AppointmentTypes.ONLINE,
        status: AppointmentStatuses.PENDING,
        patientId,
        doctorId: validated.doctorId,
        scheduledStart: validated.slotStart,
        scheduledEnd: validated.slotEnd,
        timezone: ONLINE_CONSULT_CONFIG.timezone,
        isOnline: true,
        patientNotes: input.patientNotes,
      } as Record<string, unknown>)) as { _id: { toString(): string } };
    } catch (error) {
      // Two requests can both pass the earlier findOne() conflict check
      // before either has written (classic TOCTOU race) — the unique
      // partial index on Appointment{doctorId, scheduledStart} (active
      // statuses only) is the actual guard; a duplicate key here means the
      // other request won the race between our check and our write.
      if (isDuplicateKeyError(error)) {
        throw new AppError("Slot is no longer available", ErrorCodes.SLOT_UNAVAILABLE, 409);
      }
      throw error;
    }

    const appointmentId = appointment._id.toString();

    try {
      const payment = (await PaymentModel.create({
        userId: patientId,
        provider: useManual ? PaymentProviders.MANUAL_JAZZCASH : liveProvider!,
        status: PaymentStatuses.PENDING,
        amount: validated.consultationFee,
        currency: "PKR",
        idempotencyKey,
        externalTransactionId: txnRefNo,
        appointmentId,
        metadata: {
          slotId: input.slotId,
          txnRefNo,
          expiresAt: expiresAt.toISOString(),
          doctorName: validated.doctorName,
          integration: useManual
            ? "manual_jazzcash"
            : gatewayIntegrationLabel(liveProvider!),
          ...(input.locale ? { locale: input.locale } : {}),
        },
      } as Record<string, unknown>)) as { _id: { toString(): string } };

      await AppointmentModel.updateOne(
        mongoFilter({ _id: appointment._id }),
        { $set: { paymentId: payment._id } },
      );

      const paymentId = payment._id.toString();

      const patient = await UserModel.findById(patientId).select("name").lean();
      await notifyAdmins({
        title: "New online consult booking",
        body: `${safeDisplayText(patient?.name) ?? "A patient"} started checkout with ${withDoctorTitle(validated.doctorName)} for ${formatKarachiDateTime(validated.slotStart)} (Rs. ${validated.consultationFee.toLocaleString()}). Awaiting payment confirmation.`,
        payload: {
          type: "online_consult_requested",
          appointmentId,
          paymentId,
          patientId,
        },
      }).catch((err) => {
        console.error("[online-consult] admin notification failed", err);
      });

      if (useManual) {
        const manualTransfer = buildManualTransferCheckout({
          paymentId,
          amountPkr: validated.consultationFee,
          description: `Online consult with ${validated.doctorName}`,
        });
        return {
          paymentId,
          appointmentId,
          amount: validated.consultationFee,
          manualTransfer,
          testMode: true,
          testPayment: buildTestPaymentCheckout({
            paymentId,
            appointmentId,
            amountPkr: validated.consultationFee,
            doctorName: validated.doctorName,
            txnRefNo,
          }),
        };
      }

      const gatewayRedirect = buildGatewayCheckout(liveProvider!, {
        amountPkr: validated.consultationFee,
        txnRefNo,
        billReference: appointmentId.slice(-12),
        description: `Online consult with ${validated.doctorName}`,
        paymentId,
      });

      return {
        paymentId,
        appointmentId,
        amount: validated.consultationFee,
        gatewayRedirect,
        jazzcash: gatewayRedirect,
      };
    } catch (error) {
      await OnlineConsultService.cancelPendingHold(appointmentId);
      throw error;
    }
  }

  static async completeTestPayment(paymentId: string, userId: string) {
    await OnlineConsultService.ensureConnected();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment || payment.userId.toString() !== userId) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (payment.provider !== PaymentProviders.DUMMY) {
      throw new AppError("Not a test payment", ErrorCodes.VALIDATION, 400);
    }

    const metadata = payment.metadata as { txnRefNo?: string } | undefined;
    const txnRefNo = metadata?.txnRefNo ?? paymentId;

    return OnlineConsultService.confirmAfterPayment(
      paymentId,
      dummyExternalTransactionId(txnRefNo),
    );
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
    await OnlineConsultService.ensureConnected();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment || payment.userId.toString() !== userId) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
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
            ...receipt,
            uploadedAt: new Date().toISOString(),
          },
        },
      },
    );

    const externalId =
      receipt.transactionId?.trim() || manualExternalTransactionId(paymentId);

    return OnlineConsultService.confirmAfterPayment(paymentId, externalId);
  }

  static async confirmAfterPayment(paymentId: string, externalTransactionId?: string) {
    await OnlineConsultService.ensureConnected();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (payment.status === PaymentStatuses.PAID) {
      return OnlineConsultService.getBookingByAppointmentId(
        payment.appointmentId!.toString(),
      );
    }

    const appointment = await AppointmentModel.findById(payment.appointmentId).lean();
    if (!appointment || appointment.type !== AppointmentTypes.ONLINE) {
      throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (appointment.status === AppointmentStatuses.CONFIRMED) {
      return OnlineConsultService.getBookingByAppointmentId(appointment._id.toString());
    }

    // A payment can be confirmed late — after the 15-minute hold expired and
    // the stale-pending sweep already cancelled this appointment, or (in
    // principle) after it was otherwise completed/marked no-show. Without
    // this guard, a late gateway webhook or manual-receipt submission would
    // silently resurrect a non-PENDING appointment back to CONFIRMED.
    if (appointment.status !== AppointmentStatuses.PENDING) {
      throw new AppError(
        "This booking is no longer available to confirm",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    // Both writes are conditioned on the status this function itself just
    // read (PENDING), closing the gap the read-then-write above can't: a
    // concurrent failPayment (real gateways can deliver a decline and a
    // success callback for the same transaction close together) racing in
    // between this read and these writes. If either write matches nothing,
    // someone else already resolved it — surface a clean conflict instead of
    // silently overwriting whatever they set.
    const paymentResult = await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId, status: PaymentStatuses.PENDING }),
      {
        $set: {
          status: PaymentStatuses.PAID,
          paidAt: new Date(),
          ...(externalTransactionId ? { externalTransactionId } : {}),
        },
      },
    );
    if (paymentResult.matchedCount === 0) {
      throw new AppError(
        "This payment has already been processed",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    const appointmentResult = await AppointmentModel.updateOne(
      mongoFilter({ _id: appointment._id, status: AppointmentStatuses.PENDING }),
      { $set: { status: AppointmentStatuses.CONFIRMED } },
    );
    if (appointmentResult.matchedCount === 0) {
      throw new AppError(
        "This booking is no longer available to confirm",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    await ChatService.ensureAppointmentThread(appointment._id.toString());
    await ChatService.startIntakeConversation(appointment._id.toString());

    const doctor = await DoctorProfileModel.findById(appointment.doctorId)
      .populate("userId", "name phone")
      .lean();
    const doctorUser = doctor?.userId as { name?: string; phone?: string } | null;
    const patient = await UserModel.findById(appointment.patientId).lean();

    await sendOnlineConsultConfirmation({
      userId: appointment.patientId.toString(),
      phone: safeDisplayText(patient?.phone) ?? undefined,
      doctorName: mapUserPii(doctorUser ?? {}).name,
      slotStart: appointment.scheduledStart,
      amount: payment.amount,
    });

    if (doctor?.userId) {
      await sendDoctorConsultBooked({
        userId: resolveMongoRefId(doctor.userId),
        phone: safeDisplayText(doctorUser?.phone) ?? undefined,
        patientName: safeDisplayText(patient?.name) ?? "Patient",
        slotStart: appointment.scheduledStart,
        appointmentId: appointment._id.toString(),
        type: "online",
        patientId: appointment.patientId.toString(),
      });
    }

    await notifyAdmins({
      title: "Online consult paid",
      body: `${safeDisplayText(patient?.name) ?? "A patient"} paid Rs. ${payment.amount.toLocaleString()} for a consult with ${withDoctorTitle(mapUserPii(doctorUser ?? {}).name)} at ${formatKarachiDateTime(appointment.scheduledStart)}.`,
      payload: {
        type: "online_consult_paid",
        appointmentId: appointment._id.toString(),
        paymentId,
        patientId: appointment.patientId.toString(),
      },
    }).catch((err) => {
      console.error("[online-consult] admin paid notification failed", err);
    });

    return OnlineConsultService.getBookingByAppointmentId(appointment._id.toString());
  }

  static async failPayment(paymentId: string, reason?: string) {
    await OnlineConsultService.ensureConnected();

    // Atomic: the write itself requires status===PENDING, so a payment that
    // a concurrent confirmAfterPayment (or another failPayment/webhook
    // replay) has already resolved cannot be silently flipped to FAILED out
    // from under it. Real gateways (JazzCash return-URL + IPN webhook) can
    // and do deliver a decline and a success callback for the same
    // transaction close together — without this guard, whichever call's
    // writes landed last would win, while the loser's caller (e.g. a webhook
    // handler) would still see a successful `failPayment` return and believe
    // it had cancelled a booking that's actually confirmed and paid.
    const result = await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId, status: PaymentStatuses.PENDING }),
      {
        $set: {
          status: PaymentStatuses.FAILED,
          failureReason: reason,
        },
      },
    );
    if (result.matchedCount === 0) return;

    const payment = await PaymentModel.findById(paymentId).select("appointmentId").lean();
    if (payment?.appointmentId) {
      // Also conditioned on PENDING: our own payment write above just won,
      // but a concurrent confirmAfterPayment may have already moved the
      // appointment to CONFIRMED between that write and this one — in which
      // case leave it alone rather than blindly cancelling a now-confirmed
      // booking.
      await AppointmentModel.updateOne(
        mongoFilter({ _id: payment.appointmentId, status: AppointmentStatuses.PENDING }),
        { $set: { status: AppointmentStatuses.CANCELLED } },
      );
    }
  }

  static async getPaymentStatus(paymentId: string, userId: string) {
    await OnlineConsultService.ensureConnected();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment || payment.userId.toString() !== userId) {
      throw new AppError("Payment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const appointment = payment.appointmentId
      ? await AppointmentModel.findById(payment.appointmentId).lean()
      : null;

    const metadata = payment.metadata as {
      integration?: string;
      gatewayPreview?: TestPaymentCheckout;
      doctorName?: string;
      txnRefNo?: string;
      receipt?: {
        storageKey: string;
        url: string;
        originalName: string;
        mimeType: string;
        uploadedAt?: string;
      };
    } | undefined;

    const isManual =
      payment.provider === PaymentProviders.MANUAL_JAZZCASH ||
      payment.provider === PaymentProviders.DUMMY;

    let manualTransfer: ManualTransferCheckout | null = null;
    let testPayment: TestPaymentCheckout | null = null;
    if (isManual && payment.status === PaymentStatuses.PENDING && payment.appointmentId) {
      manualTransfer = buildManualTransferCheckout({
        paymentId,
        amountPkr: payment.amount,
        description: `Online consult with ${metadata?.doctorName ?? "Doctor"}`,
      });
      testPayment = buildTestPaymentCheckout({
        paymentId,
        appointmentId: payment.appointmentId.toString(),
        amountPkr: payment.amount,
        doctorName: metadata?.doctorName ?? "Doctor",
        txnRefNo: metadata?.txnRefNo,
      });
    }

    return {
      paymentId,
      status: payment.status,
      provider: payment.provider,
      amount: payment.amount,
      appointmentId: payment.appointmentId?.toString(),
      appointmentStatus: appointment?.status,
      manualTransfer,
      testMode: isManual,
      testPayment,
      receiptUploaded: Boolean(metadata?.receipt),
      booking:
        payment.status === PaymentStatuses.PAID && appointment
          ? await OnlineConsultService.getBookingByAppointmentId(appointment._id.toString())
          : null,
    };
  }

  static async getPatientBooking(patientId: string): Promise<OnlinePatientBookingDto | null> {
    await OnlineConsultService.ensureConnected();

    const now = new Date();
    const graceAfterEndMs = 2 * 60 * 60 * 1000;

    const appointments = await AppointmentModel.find(
      mongoFilter({
        patientId,
        type: AppointmentTypes.ONLINE,
        status: {
          $in: [
            AppointmentStatuses.CONFIRMED,
            AppointmentStatuses.IN_PROGRESS,
            AppointmentStatuses.COMPLETED,
          ],
        },
        scheduledEnd: { $gte: new Date(now.getTime() - graceAfterEndMs) },
      }),
    )
      .sort({ scheduledStart: -1 })
      .populate({
        path: "doctorId",
        select: "specialties pmdcVerified ratingAvg ratingCount consultationFee",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .populate("paymentId", "amount status")
      .lean();

    for (const appointment of appointments) {
      const finalized = await VideoSessionService.finalizeAppointmentIfAttended(
        appointment._id.toString(),
      );
      if (finalized) {
        appointment.status = AppointmentStatuses.COMPLETED;
      }
    }

    const appointment = OnlineConsultService.pickPrimaryPatientBooking(appointments, now);
    return OnlineConsultService.toPatientBookingDto(appointment);
  }

  /** Surface the patient's latest online consult on the dashboard. */
  private static pickPrimaryPatientBooking(
    appointments: Record<string, unknown>[],
    now = new Date(),
  ): Record<string, unknown> | null {
    if (!appointments.length) return null;

    type Scored = {
      appointment: Record<string, unknown>;
      canJoin: boolean;
      missed: boolean;
      scheduledStart: number;
    };

    const scored: Scored[] = appointments
      .map((appointment) => {
        const scheduledStart = appointment.scheduledStart as Date;
        const scheduledEnd = appointment.scheduledEnd as Date;
        const status = appointment.status as string;
        const { canJoin, joinClosesAt } = getVideoJoinWindow(scheduledStart, scheduledEnd, now);
        const joinWindowClosed = now > joinClosesAt;
        const attended =
          status === AppointmentStatuses.IN_PROGRESS ||
          status === AppointmentStatuses.COMPLETED;

        return {
          appointment,
          canJoin,
          missed: joinWindowClosed && !attended && status === AppointmentStatuses.CONFIRMED,
          scheduledStart: scheduledStart.getTime(),
        };
      })
      .sort((a, b) => b.scheduledStart - a.scheduledStart);

    const joinable = scored.filter((item) => item.canJoin);
    if (joinable.length) return joinable[0].appointment;

    return scored[0]?.appointment ?? null;
  }

  private static async getBookingByAppointmentId(
    appointmentId: string,
  ): Promise<OnlinePatientBookingDto | null> {
    const appointment = await AppointmentModel.findById(appointmentId)
      .populate({
        path: "doctorId",
        select: "specialties pmdcVerified ratingAvg ratingCount consultationFee",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .populate("paymentId", "amount status")
      .lean();

    return OnlineConsultService.toPatientBookingDto(appointment);
  }

  private static toPatientBookingDto(
    appointment: Record<string, unknown> | null,
  ): OnlinePatientBookingDto | null {
    if (!appointment) return null;

    const doctor = appointment.doctorId as {
      _id?: { toString(): string };
      specialties?: string[];
      pmdcVerified?: boolean;
      ratingAvg?: number;
      ratingCount?: number;
      consultationFee?: number;
      userId?: { _id?: { toString(): string }; name?: string; avatarUrl?: string } | string;
    } | null;

    if (!doctor?._id) return null;

    const doctorUserId = resolveMongoRefId(doctor.userId);
    if (!doctorUserId || doctorUserId === "undefined" || doctorUserId === "null") {
      return null;
    }

    const user =
      doctor.userId && typeof doctor.userId === "object" ? doctor.userId : undefined;
    const name = mapUserPii(user ?? {}).name;
    const scheduledStart = appointment.scheduledStart as Date;
    const scheduledEnd = appointment.scheduledEnd as Date;
    const payment = appointment.paymentId as { amount?: number } | null;

    return {
      appointmentId: String(appointment._id),
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      status: appointment.status as string,
      consultationFee: payment?.amount ?? doctor.consultationFee ?? 0,
      doctor: {
        doctorId: doctor._id.toString(),
        userId: doctorUserId,
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
