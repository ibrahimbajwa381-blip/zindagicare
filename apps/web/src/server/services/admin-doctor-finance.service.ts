import {
  connectDatabase,
  AppointmentModel,
  DoctorPayoutModel,
  DoctorProfileModel,
  PaymentModel,
  PrescriptionModel,
  SundayFreeRequestModel,
  UserModel,
  VideoSessionModel,
  type DoctorProfileDocument,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  PaymentStatuses,
  VerificationStatuses,
  calculateStaffNetEarnings,
} from "@zindagi/shared";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import {
  getDoctorCommissionRatesByProfileId,
  getReferredPatientIdSet,
  resolveEffectiveCommissionPercent,
} from "./commission.service";

export type DoctorBankAccount = {
  accountTitle?: string;
  accountNumber?: string;
  bankName?: string;
  iban?: string;
};

export type DoctorPayoutReceipt = {
  url: string;
  originalName?: string;
  mimeType?: string;
};

export type DoctorPayoutRow = {
  id: string;
  amount: number;
  method: string;
  note?: string;
  paidByName: string;
  paidAt: string;
  receipt: DoctorPayoutReceipt | null;
};

export type DoctorFinanceAppointmentRow = {
  id: string;
  scheduledStart: string;
  type: string;
  status: string;
  patientName: string;
  amountPkr?: number;
  paymentStatus?: string;
  patientJoinedAt?: string;
  doctorJoinedAt?: string;
  videoSessionStatus?: string;
  hasPrescription: boolean;
  earningCounted: boolean;
  earningAmount: number;
  reason: string;
};

export type AdminDoctorFinanceDetail = {
  doctor: {
    id: string;
    name: string;
    avatarUrl?: string;
    specialties: string[];
    email?: string;
    phone?: string;
    verificationStatus: string;
  };
  earnings: {
    totalEarnings: number;
    earningsThisMonth: number;
    onlineCommissionPercent: number | null;
    homeVisitCommissionPercent: number | null;
    effectiveOnlineCommissionPercent: number;
    effectiveHomeVisitCommissionPercent: number;
  };
  bankAccount: DoctorBankAccount | null;
  payouts: DoctorPayoutRow[];
  totalPaidOut: number;
  balanceDue: number;
  appointments: DoctorFinanceAppointmentRow[];
};

function reasonForAppointment(row: {
  status: string;
  paymentStatus?: string;
  patientJoinedAt?: string;
  doctorJoinedAt?: string;
  hasPrescription: boolean;
  earningCounted: boolean;
  earningAmount: number;
}): string {
  if (row.earningCounted) {
    return `Counted — consult completed and payment confirmed (PKR ${row.earningAmount.toLocaleString()} credited)`;
  }
  if (row.status === AppointmentStatuses.CANCELLED) {
    return "Not counted — appointment was cancelled";
  }
  if (row.status === AppointmentStatuses.NO_SHOW) {
    return "Not counted — marked as a no-show";
  }
  if (row.status !== AppointmentStatuses.COMPLETED) {
    if (!row.patientJoinedAt && !row.doctorJoinedAt && !row.hasPrescription) {
      return "Not counted — consult not yet completed; no video session activity or prescription recorded";
    }
    if (!row.patientJoinedAt) {
      return "Not counted — consult not yet completed; patient never joined the video call";
    }
    return "Not counted — consult not yet marked completed";
  }
  if (row.paymentStatus !== PaymentStatuses.PAID) {
    return `Not counted — consult completed but payment is ${row.paymentStatus ?? "unpaid"}`;
  }
  return "Not counted — no payment on record for this appointment";
}

async function buildDoctorFinanceAppointments(
  profileId: string,
  rates: { online: number; homeVisit: number },
): Promise<{
  appointments: DoctorFinanceAppointmentRow[];
  totalEarnings: number;
  earningsThisMonth: number;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const appointments = await AppointmentModel.find(
    mongoFilter({
      doctorId: profileId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }),
  )
    .populate("patientId", "name")
    .populate("paymentId", "amount status")
    .sort({ scheduledStart: -1 })
    .limit(100)
    .lean();

  // Sunday-free-consult appointments created before assignment linked the contribution
  // payment onto the appointment itself only via SundayFreeRequest.paymentId — backfill
  // that link here so historical rows still show payment/earnings correctly.
  const unlinkedAppointmentIds = appointments
    .filter((a) => !a.paymentId)
    .map((a) => a._id.toString());
  if (unlinkedAppointmentIds.length) {
    const linkedRequests = await SundayFreeRequestModel.find(
      mongoFilter({
        appointmentId: { $in: mongoObjectIds(unlinkedAppointmentIds) },
        paymentId: { $exists: true, $ne: null },
      }),
    )
      .select("appointmentId paymentId")
      .lean();
    const paymentIdByAppointmentId = new Map(
      linkedRequests.map((r) => [r.appointmentId?.toString(), r.paymentId?.toString()]),
    );
    if (paymentIdByAppointmentId.size) {
      const payments = await PaymentModel.find(
        mongoFilter({
          _id: { $in: mongoObjectIds([...paymentIdByAppointmentId.values()].filter(Boolean) as string[]) },
        }),
      )
        .select("amount status")
        .lean();
      const paymentById = new Map(payments.map((p) => [p._id.toString(), p]));
      for (const a of appointments as Array<{ _id: { toString(): string }; paymentId?: unknown }>) {
        const paymentId = paymentIdByAppointmentId.get(a._id.toString());
        if (paymentId && paymentById.has(paymentId)) {
          a.paymentId = paymentById.get(paymentId);
        }
      }
    }
  }

  const appointmentIds = appointments.map((a) => a._id.toString());
  const [videoSessions, prescriptions] = await Promise.all([
    appointmentIds.length
      ? VideoSessionModel.find(
          mongoFilter({ appointmentId: { $in: appointmentIds } }),
        )
          .select("appointmentId patientJoinedAt doctorJoinedAt status")
          .lean()
      : [],
    appointmentIds.length
      ? PrescriptionModel.find(
          mongoFilter({
            appointmentId: { $in: mongoObjectIds(appointmentIds) },
            deletedAt: null,
          }),
        )
          .select("appointmentId")
          .lean()
      : [],
  ]);

  const videoSessionByAppointment = new Map(
    videoSessions.map((v) => [v.appointmentId?.toString() ?? "", v]),
  );
  const prescribedAppointmentIds = new Set(
    prescriptions.map((p) => p.appointmentId?.toString()).filter(Boolean),
  );

  const patientIds = appointments
    .map((a) => (a.patientId as { _id?: { toString(): string } } | null)?._id?.toString())
    .filter((id): id is string => Boolean(id));
  const referredPatientIdSet = await getReferredPatientIdSet(profileId, patientIds);

  let totalEarnings = 0;
  let earningsThisMonth = 0;

  const appointmentRows: DoctorFinanceAppointmentRow[] = appointments.map((a) => {
    const patient = a.patientId as { _id?: { toString(): string }; name?: string } | null;
    const payment = a.paymentId as { amount?: number; status?: string } | null;
    const videoSession = videoSessionByAppointment.get(a._id.toString());
    const hasPrescription = prescribedAppointmentIds.has(a._id.toString());

    const isCompleted = a.status === AppointmentStatuses.COMPLETED;
    const isPaid = payment?.status === PaymentStatuses.PAID;
    const earningCounted = isCompleted && isPaid && Boolean(payment?.amount);
    const baseCommissionPercent =
      a.type === "home_visit" ? rates.homeVisit : rates.online;
    const isReferred = referredPatientIdSet.has(patient?._id?.toString() ?? "");
    const commissionPercent = resolveEffectiveCommissionPercent(
      baseCommissionPercent,
      isReferred,
    );
    const earningAmount = earningCounted
      ? calculateStaffNetEarnings(payment?.amount ?? 0, commissionPercent)
      : 0;

    if (earningCounted) {
      totalEarnings += earningAmount;
      if (a.completedAt && a.completedAt >= startOfMonth) {
        earningsThisMonth += earningAmount;
      }
    }

    const base = {
      status: a.status,
      paymentStatus: payment?.status,
      patientJoinedAt: videoSession?.patientJoinedAt
        ? new Date(videoSession.patientJoinedAt).toISOString()
        : undefined,
      doctorJoinedAt: videoSession?.doctorJoinedAt
        ? new Date(videoSession.doctorJoinedAt).toISOString()
        : undefined,
      hasPrescription,
      earningCounted,
      earningAmount,
    };

    return {
      id: a._id.toString(),
      scheduledStart: a.scheduledStart.toISOString(),
      type: a.type,
      patientName: safeDisplayText(patient?.name) ?? "Patient",
      amountPkr: payment?.amount ?? undefined,
      videoSessionStatus: videoSession?.status ?? undefined,
      reason: reasonForAppointment(base),
      ...base,
    };
  });

  return { appointments: appointmentRows, totalEarnings, earningsThisMonth };
}

export async function getAdminDoctorFinanceDetail(
  doctorProfileId: string,
): Promise<AdminDoctorFinanceDetail> {
  await connectDatabase();

  const profile = (await DoctorProfileModel.findById(
    doctorProfileId,
  ).lean()) as (DoctorProfileDocument & { _id: { toString(): string } }) | null;
  if (!profile) throw new AppError("Doctor not found", "NOT_FOUND", 404);

  const user = profile.userId
    ? await UserModel.findById(profile.userId).select("name email phone avatarUrl").lean()
    : null;
  const pii = mapUserPii(user ?? {});

  const rates = await getDoctorCommissionRatesByProfileId(doctorProfileId);

  const [
    { appointments: appointmentRows, totalEarnings, earningsThisMonth },
    payoutDocs,
  ] = await Promise.all([
    buildDoctorFinanceAppointments(doctorProfileId, rates),
    DoctorPayoutModel.find(mongoFilter({ doctorProfileId: profile._id }))
      .populate("paidBy", "name")
      .sort({ paidAt: -1 })
      .lean(),
  ]);

  const payouts: DoctorPayoutRow[] = payoutDocs.map((p) => {
    const paidByUser = p.paidBy as { name?: string } | null;
    return {
      id: p._id.toString(),
      amount: p.amount,
      method: p.method,
      note: p.note ?? undefined,
      paidByName: paidByUser?.name ?? "Admin",
      paidAt: new Date(p.paidAt).toISOString(),
      receipt: p.receipt?.storageKey
        ? {
            url: `/api/v1/admin/doctors/${profile._id.toString()}/finance/payouts/${p._id.toString()}/receipt`,
            originalName: p.receipt.originalName ?? undefined,
            mimeType: p.receipt.mimeType ?? undefined,
          }
        : null,
    };
  });

  const totalPaidOut = payouts.reduce((sum, p) => sum + p.amount, 0);

  return {
    doctor: {
      id: profile._id.toString(),
      name: pii.name,
      avatarUrl: resolveDoctorPortrait(pii.name, user?.avatarUrl),
      specialties: profile.specialties ?? [],
      email: pii.email,
      phone: pii.phone,
      verificationStatus: profile.verificationStatus ?? VerificationStatuses.PENDING,
    },
    earnings: {
      totalEarnings,
      earningsThisMonth,
      onlineCommissionPercent: profile.onlineCommissionPercent ?? null,
      homeVisitCommissionPercent: profile.homeVisitCommissionPercent ?? null,
      effectiveOnlineCommissionPercent: rates.online,
      effectiveHomeVisitCommissionPercent: rates.homeVisit,
    },
    bankAccount: profile.bankAccount
      ? {
          accountTitle: profile.bankAccount.accountTitle ?? undefined,
          accountNumber: profile.bankAccount.accountNumber ?? undefined,
          bankName: profile.bankAccount.bankName ?? undefined,
          iban: profile.bankAccount.iban ?? undefined,
        }
      : null,
    payouts,
    totalPaidOut,
    balanceDue: Math.max(totalEarnings - totalPaidOut, 0),
    appointments: appointmentRows,
  };
}

export async function updateDoctorBankAccount(
  doctorProfileId: string,
  input: DoctorBankAccount,
): Promise<DoctorBankAccount> {
  await connectDatabase();
  const profile = await DoctorProfileModel.findById(doctorProfileId);
  if (!profile) throw new AppError("Doctor not found", "NOT_FOUND", 404);

  profile.set("bankAccount", {
    accountTitle: input.accountTitle?.trim() || undefined,
    accountNumber: input.accountNumber?.trim() || undefined,
    bankName: input.bankName?.trim() || undefined,
    iban: input.iban?.trim() || undefined,
  });
  await profile.save();

  return {
    accountTitle: profile.bankAccount?.accountTitle ?? undefined,
    accountNumber: profile.bankAccount?.accountNumber ?? undefined,
    bankName: profile.bankAccount?.bankName ?? undefined,
    iban: profile.bankAccount?.iban ?? undefined,
  };
}

export async function updateOwnDoctorBankAccount(
  userId: string,
  input: DoctorBankAccount,
): Promise<DoctorBankAccount> {
  await connectDatabase();
  const profile = await DoctorProfileModel.findOne(mongoFilter({ userId }));
  if (!profile) throw new AppError("Doctor profile not found", "NOT_FOUND", 404);

  profile.set("bankAccount", {
    accountTitle: input.accountTitle?.trim() || undefined,
    accountNumber: input.accountNumber?.trim() || undefined,
    bankName: input.bankName?.trim() || undefined,
    iban: input.iban?.trim() || undefined,
  });
  await profile.save();

  return {
    accountTitle: profile.bankAccount?.accountTitle ?? undefined,
    accountNumber: profile.bankAccount?.accountNumber ?? undefined,
    bankName: profile.bankAccount?.bankName ?? undefined,
    iban: profile.bankAccount?.iban ?? undefined,
  };
}

export async function getOwnDoctorBankAccount(
  userId: string,
): Promise<DoctorBankAccount | null> {
  await connectDatabase();
  const profile = await DoctorProfileModel.findOne(mongoFilter({ userId }))
    .select("bankAccount")
    .lean();
  if (!profile) throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  if (!profile.bankAccount) return null;
  return {
    accountTitle: profile.bankAccount.accountTitle ?? undefined,
    accountNumber: profile.bankAccount.accountNumber ?? undefined,
    bankName: profile.bankAccount.bankName ?? undefined,
    iban: profile.bankAccount.iban ?? undefined,
  };
}

export async function recordDoctorPayout(
  adminUserId: string,
  doctorProfileId: string,
  input: {
    amount: number;
    method: string;
    note?: string;
    receipt?: { storageKey: string; url: string; originalName: string; mimeType: string };
    _id?: unknown;
  },
): Promise<DoctorPayoutRow> {
  await connectDatabase();
  const profile = await DoctorProfileModel.findById(doctorProfileId).select("_id bankAccount").lean();
  if (!profile) throw new AppError("Doctor not found", "NOT_FOUND", 404);

  if (!input.amount || input.amount <= 0) {
    throw new AppError("Payout amount must be greater than zero", "VALIDATION_ERROR", 400);
  }

  const hasBankAccount = Boolean(
    profile.bankAccount?.accountNumber || profile.bankAccount?.iban,
  );
  if (!hasBankAccount) {
    throw new AppError(
      "This doctor has no bank account on file yet",
      "VALIDATION_ERROR",
      400,
    );
  }

  const detail = await getAdminDoctorFinanceDetail(doctorProfileId);
  if (Math.round(input.amount) !== Math.round(detail.balanceDue)) {
    throw new AppError(
      `Payout must equal the full outstanding balance (PKR ${detail.balanceDue.toLocaleString()})`,
      "VALIDATION_ERROR",
      400,
    );
  }

  const payoutDoc: Record<string, unknown> = {
    doctorProfileId: profile._id,
    amount: input.amount,
    method: input.method,
    note: input.note?.trim() || undefined,
    receipt: input.receipt,
    paidBy: adminUserId,
    paidAt: new Date(),
  };
  if (input._id) payoutDoc._id = input._id;

  const [payout] = await DoctorPayoutModel.create([payoutDoc]);

  const paidByUser = await UserModel.findById(adminUserId).select("name").lean();

  return {
    id: payout._id.toString(),
    amount: payout.amount,
    method: payout.method,
    note: payout.note ?? undefined,
    paidByName: paidByUser?.name ?? "Admin",
    paidAt: payout.paidAt.toISOString(),
    receipt: payout.receipt?.storageKey
      ? {
          url: `/api/v1/admin/doctors/${doctorProfileId}/finance/payouts/${payout._id.toString()}/receipt`,
          originalName: payout.receipt.originalName ?? undefined,
          mimeType: payout.receipt.mimeType ?? undefined,
        }
      : null,
  };
}

/** Storage key for a payout's receipt, scoped to the owning doctor for access checks. */
export async function getDoctorPayoutReceiptStorageKey(
  doctorProfileId: string,
  payoutId: string,
): Promise<{ storageKey: string; mimeType?: string; originalName?: string }> {
  await connectDatabase();
  const payout = await DoctorPayoutModel.findOne(
    mongoFilter({ _id: payoutId, doctorProfileId }),
  ).lean();
  if (!payout?.receipt?.storageKey) {
    throw new AppError("Receipt not found", "NOT_FOUND", 404);
  }
  return {
    storageKey: payout.receipt.storageKey,
    mimeType: payout.receipt.mimeType ?? undefined,
    originalName: payout.receipt.originalName ?? undefined,
  };
}

/**
 * Doctor-facing view of their own appointment-by-appointment earning eligibility —
 * same logic admins see, so doctors understand why a consult did or didn't get paid.
 */
export async function getOwnDoctorEarningEligibility(
  userId: string,
): Promise<{ appointments: DoctorFinanceAppointmentRow[] }> {
  await connectDatabase();
  const profile = await DoctorProfileModel.findOne(mongoFilter({ userId }))
    .select("_id")
    .lean();
  if (!profile) throw new AppError("Doctor profile not found", "NOT_FOUND", 404);

  const profileId = profile._id.toString();
  const rates = await getDoctorCommissionRatesByProfileId(profileId);
  const { appointments } = await buildDoctorFinanceAppointments(profileId, rates);

  return { appointments };
}
