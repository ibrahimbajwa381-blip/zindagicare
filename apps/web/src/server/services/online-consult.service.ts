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
} from "@zindagi/shared";
import type { ConsultCheckoutInput } from "@zindagi/validators";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { nameToDoctorSlug } from "@/lib/doctors/profile-path";
import {
  appointmentBlocksSlot,
  generateConsultSlots,
  parseConsultSlotId,
  type WeeklyWindow,
} from "@/lib/consult/slot-utils";
import {
  buildCheckoutForm,
  generateTxnRefNo,
  isJazzCashConfigured,
} from "@/lib/payments/jazzcash";
import {
  buildDummyPaymentPreview,
  buildTestPaymentCheckout,
  dummyExternalTransactionId,
  isDummyPaymentMode,
  type TestPaymentCheckout,
} from "@/lib/payments/dummy-payment";
import { sendOnlineConsultConfirmation } from "@/lib/notifications/consult-notifications";
import { mongoFilter } from "@/lib/mongo/query";
import { ChatService } from "@/server/services/chat.service";
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
  /** MVP simulated checkout — real JazzCash when JAZZCASH_LIVE=true */
  testMode?: boolean;
  testPayment?: TestPaymentCheckout;
  jazzcash?: {
    actionUrl: string;
    fields: Record<string, string>;
  };
};

export class OnlineConsultService {
  private static async ensureConnected() {
    await connectDatabase();
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
    const cutoff = new Date(Date.now() - ONLINE_CONSULT_CONFIG.paymentHoldDurationMs);

    const stale = await AppointmentModel.find(
      mongoFilter({
        type: AppointmentTypes.ONLINE,
        status: AppointmentStatuses.PENDING,
        createdAt: { $lt: cutoff },
      }),
    ).lean();

    for (const appt of stale) {
      await AppointmentModel.updateOne(
        mongoFilter({ _id: appt._id }),
        { $set: { status: AppointmentStatuses.CANCELLED } },
      );
      if (appt.paymentId) {
        await PaymentModel.updateOne(
          mongoFilter({ _id: appt.paymentId }),
          { $set: { status: PaymentStatuses.CANCELLED } },
        );
      }
    }
  }

  static async listConsultDoctors(city = "Lahore", specialty?: string) {
    await OnlineConsultService.ensureConnected();
    await OnlineConsultService.expireStalePendingBookings();

    const filter: Record<string, unknown> = {
      isListed: true,
      verificationStatus: VerificationStatuses.APPROVED,
      coverageCities: city,
      videoConsultEnabled: true,
      consultationFee: { $gte: ONLINE_CONSULT_CONFIG.minConsultationFee },
      "weeklyAvailability.0": { $exists: true },
    };

    if (specialty?.trim()) {
      filter.specialties = specialty.trim();
    }

    const doctors = await DoctorProfileModel.find(filter)
      .populate("userId", "name avatarUrl")
      .sort({ ratingAvg: -1, ratingCount: -1 })
      .lean();

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
      const name = user?.name ?? "Doctor";
      const weeklyAvailability = (doc.weeklyAvailability ?? []) as WeeklyWindow[];
      const doctorBooked = bookedByDoctor.get(doc._id.toString()) ?? [];
      const availableSlots = OnlineConsultService.countAvailableSlots(
        weeklyAvailability,
        doctorBooked,
      );

      return {
        doctorId: doc._id.toString(),
        slug: doc.slug ?? nameToDoctorSlug(name),
        name,
        avatarUrl: resolveDoctorPortrait(name, user?.avatarUrl),
        specialties: doc.specialties ?? [],
        ratingAvg: doc.ratingAvg ?? 0,
        ratingCount: doc.ratingCount ?? 0,
        pmdcVerified: doc.pmdcVerified ?? false,
        consultationFee: doc.consultationFee ?? 0,
        hospital: doc.hospitals?.[0]?.name,
        availableSlots,
        isFull: availableSlots === 0,
      } satisfies ConsultDoctorRow;
    });
  }

  static async getSlotsForDoctor(doctorId: string, dateKey?: string) {
    await OnlineConsultService.ensureConnected();
    await OnlineConsultService.expireStalePendingBookings();

    const doctor = await DoctorProfileModel.findById(doctorId).lean();
    if (
      !doctor?.isListed ||
      doctor.verificationStatus !== VerificationStatuses.APPROVED ||
      !doctor.videoConsultEnabled ||
      (doctor.consultationFee ?? 0) < ONLINE_CONSULT_CONFIG.minConsultationFee
    ) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
    }

    const weeklyAvailability = (doctor.weeklyAvailability ?? []) as WeeklyWindow[];
    if (!weeklyAvailability.length) {
      return { doctorId, slots: [] as ConsultSlotView[] };
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
  ): Promise<ValidatedSlotBooking> {
    await OnlineConsultService.ensureConnected();

    const doctor = await DoctorProfileModel.findById(doctorId)
      .populate("userId", "name")
      .lean();
    if (
      !doctor?.isListed ||
      doctor.verificationStatus !== VerificationStatuses.APPROVED ||
      !doctor.videoConsultEnabled
    ) {
      throw new AppError("Doctor not found", ErrorCodes.NOT_FOUND, 404);
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
      doctorName: user?.name ?? "Doctor",
    };
  }

  static async initiateCheckout(
    patientId: string,
    input: ConsultCheckoutInput,
  ): Promise<CheckoutResult> {
    await OnlineConsultService.ensureConnected();
    await OnlineConsultService.expireStalePendingBookings();

    const validated = await OnlineConsultService.validateSlotForBooking(
      input.doctorId,
      input.slotId,
    );

    const existingPending = await AppointmentModel.findOne(
      mongoFilter({
        patientId,
        type: AppointmentTypes.ONLINE,
        status: AppointmentStatuses.PENDING,
      }),
    ).lean();

    if (existingPending) {
      throw new AppError(
        "You already have a pending payment. Complete or wait for it to expire.",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    const txnRefNo = generateTxnRefNo();
    const idempotencyKey = randomUUID();
    const expiresAt = new Date(Date.now() + ONLINE_CONSULT_CONFIG.paymentHoldDurationMs);

    const dummyPreview = buildDummyPaymentPreview({
      paymentId: "pending",
      appointmentId: "pending",
      amountPkr: validated.consultationFee,
      doctorName: validated.doctorName,
      txnRefNo: `DUMMY-${txnRefNo}`,
    });

    const useDummy = isDummyPaymentMode();

    const appointment = (await AppointmentModel.create({
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

    const appointmentId = appointment._id.toString();

    const payment = (await PaymentModel.create({
      userId: patientId,
      provider: useDummy ? PaymentProviders.DUMMY : PaymentProviders.JAZZCASH,
      status: PaymentStatuses.PENDING,
      amount: validated.consultationFee,
      currency: "PKR",
      idempotencyKey,
      appointmentId,
      metadata: {
        slotId: input.slotId,
        txnRefNo: dummyPreview.txnRefNo,
        expiresAt: expiresAt.toISOString(),
        doctorName: validated.doctorName,
        integration: useDummy ? "dummy_mvp" : "jazzcash_live",
        gatewayPreview: useDummy ? dummyPreview : undefined,
      },
    } as Record<string, unknown>)) as { _id: { toString(): string } };

    await AppointmentModel.updateOne(
      mongoFilter({ _id: appointment._id }),
      { $set: { paymentId: payment._id } },
    );

    const paymentId = payment._id.toString();

    if (useDummy) {
      return {
        paymentId,
        appointmentId,
        amount: validated.consultationFee,
        testMode: true,
        testPayment: buildTestPaymentCheckout({
          paymentId,
          appointmentId,
          amountPkr: validated.consultationFee,
          doctorName: validated.doctorName,
          txnRefNo: dummyPreview.txnRefNo,
        }),
      };
    }

    if (!isJazzCashConfigured()) {
      throw new AppError(
        "JazzCash credentials missing. Set JAZZCASH_* env vars or keep JAZZCASH_LIVE unset for MVP test payments.",
        ErrorCodes.VALIDATION,
        503,
      );
    }

    const jazzcash = buildCheckoutForm({
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
      jazzcash,
    };
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

    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      {
        $set: {
          status: PaymentStatuses.PAID,
          paidAt: new Date(),
          ...(externalTransactionId ? { externalTransactionId } : {}),
        },
      },
    );

    await AppointmentModel.updateOne(
      mongoFilter({ _id: appointment._id }),
      { $set: { status: AppointmentStatuses.CONFIRMED } },
    );

    await ChatService.ensureAppointmentThread(appointment._id.toString());

    const doctor = await DoctorProfileModel.findById(appointment.doctorId)
      .populate("userId", "name phone")
      .lean();
    const doctorUser = doctor?.userId as { name?: string; phone?: string } | null;
    const patient = await UserModel.findById(appointment.patientId).lean();

    await sendOnlineConsultConfirmation({
      userId: appointment.patientId.toString(),
      phone: patient?.phone ?? undefined,
      doctorName: doctorUser?.name ?? "Doctor",
      slotStart: appointment.scheduledStart,
      amount: payment.amount,
    });

    return OnlineConsultService.getBookingByAppointmentId(appointment._id.toString());
  }

  static async failPayment(paymentId: string, reason?: string) {
    await OnlineConsultService.ensureConnected();

    const payment = await PaymentModel.findById(paymentId).lean();
    if (!payment || payment.status !== PaymentStatuses.PENDING) return;

    await PaymentModel.updateOne(
      mongoFilter({ _id: paymentId }),
      {
        $set: {
          status: PaymentStatuses.FAILED,
          failureReason: reason,
        },
      },
    );

    if (payment.appointmentId) {
      await AppointmentModel.updateOne(
        mongoFilter({ _id: payment.appointmentId }),
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
    } | undefined;

    let testPayment: TestPaymentCheckout | null = null;
    if (
      payment.provider === PaymentProviders.DUMMY &&
      payment.status === PaymentStatuses.PENDING &&
      payment.appointmentId
    ) {
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
      testMode: payment.provider === PaymentProviders.DUMMY,
      testPayment,
      booking:
        payment.status === PaymentStatuses.PAID && appointment
          ? await OnlineConsultService.getBookingByAppointmentId(appointment._id.toString())
          : null,
    };
  }

  static async getPatientBooking(patientId: string): Promise<OnlinePatientBookingDto | null> {
    await OnlineConsultService.ensureConnected();

    const appointment = await AppointmentModel.findOne(
      mongoFilter({
        patientId,
        type: AppointmentTypes.ONLINE,
        status: { $in: [AppointmentStatuses.CONFIRMED, AppointmentStatuses.IN_PROGRESS] },
        scheduledEnd: { $gte: new Date() },
      }),
    )
      .sort({ scheduledStart: 1 })
      .populate({
        path: "doctorId",
        select: "specialties pmdcVerified ratingAvg ratingCount consultationFee",
        populate: { path: "userId", select: "name avatarUrl" },
      })
      .populate("paymentId", "amount status")
      .lean();

    return OnlineConsultService.toPatientBookingDto(appointment);
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
      userId?: { name?: string; avatarUrl?: string };
    } | null;

    if (!doctor?._id) return null;

    const user = doctor.userId;
    const name = user?.name ?? "Doctor";
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
