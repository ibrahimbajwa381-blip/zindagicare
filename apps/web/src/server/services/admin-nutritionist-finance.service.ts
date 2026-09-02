import {
  connectDatabase,
  AppointmentModel,
  DoctorPayoutModel,
  NutritionistProfileModel,
  PaymentModel,
  UserModel,
  VideoSessionModel,
  type DoctorPayoutDocument,
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
import { NUTRITIONIST_PROVIDER_ROLE } from "./nutritionist-dashboard.service";
import {
  getNutritionistCommissionRatesByProfileId,
  getNutritionistReferredPatientIdSet,
  resolveEffectiveCommissionPercent,
} from "./commission.service";
import { recordAdminActivity } from "./admin-activity.service";

export type NutritionistBankAccount = {
  accountTitle?: string;
  accountNumber?: string;
  bankName?: string;
  iban?: string;
};

export type NutritionistPayoutReceipt = {
  url: string;
  originalName?: string;
  mimeType?: string;
};

export type NutritionistPayoutRow = {
  id: string;
  amount: number;
  method: string;
  note?: string;
  paidByName: string;
  paidAt: string;
  receipt: NutritionistPayoutReceipt | null;
};

export type NutritionistFinanceAppointmentRow = {
  id: string;
  scheduledStart: string;
  type: string;
  status: string;
  patientName: string;
  amountPkr?: number;
  paymentStatus?: string;
  patientJoinedAt?: string;
  providerJoinedAt?: string;
  videoSessionStatus?: string;
  earningCounted: boolean;
  earningAmount: number;
  reason: string;
  /** True when the referral bonus commission rate was applied. */
  isReferred: boolean;
};

export type AdminNutritionistFinanceDetail = {
  nutritionist: {
    id: string;
    name: string;
    avatarUrl?: string;
    specialties: string[];
    email?: string;
    phone?: string;
    verificationStatus: string;
    /** Patients who signed up via this nutritionist's referral link. */
    referredPatientCount: number;
  };
  earnings: {
    totalEarnings: number;
    earningsThisMonth: number;
    onlineCommissionPercent: number | null;
    effectiveOnlineCommissionPercent: number;
  };
  bankAccount: NutritionistBankAccount | null;
  payouts: NutritionistPayoutRow[];
  totalPaidOut: number;
  balanceDue: number;
  appointments: NutritionistFinanceAppointmentRow[];
};

function reasonForAppointment(row: {
  status: string;
  paymentStatus?: string;
  patientJoinedAt?: string;
  providerJoinedAt?: string;
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
    if (!row.patientJoinedAt && !row.providerJoinedAt) {
      return "Not counted — consult not yet completed; no video session activity recorded";
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

async function buildNutritionistFinanceAppointments(
  profileId: string,
  rates: { online: number },
): Promise<{
  appointments: NutritionistFinanceAppointmentRow[];
  totalEarnings: number;
  earningsThisMonth: number;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const appointments = await AppointmentModel.find(
    mongoFilter({
      providerRole: NUTRITIONIST_PROVIDER_ROLE,
      providerProfileId: profileId,
      $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
    }),
  )
    .populate("patientId", "name")
    .populate("paymentId", "amount status")
    .sort({ scheduledStart: -1 })
    .limit(100)
    .lean();

  const appointmentIds = appointments.map((a) => a._id.toString());
  const videoSessions = appointmentIds.length
    ? await VideoSessionModel.find(
        mongoFilter({ appointmentId: { $in: mongoObjectIds(appointmentIds) } }),
      )
        .select("appointmentId patientJoinedAt doctorJoinedAt status")
        .lean()
    : [];
  const videoSessionByAppointment = new Map(
    videoSessions.map((v) => [v.appointmentId?.toString() ?? "", v]),
  );

  const patientIds = appointments
    .map(
      (a) =>
        (a.patientId as { _id?: { toString(): string } } | null)?._id?.toString(),
    )
    .filter((id): id is string => Boolean(id));
  const referredPatientIdSet = await getNutritionistReferredPatientIdSet(
    profileId,
    patientIds,
  );

  let totalEarnings = 0;
  let earningsThisMonth = 0;

  const rows: NutritionistFinanceAppointmentRow[] = appointments.map((a) => {
    const patient = a.patientId as {
      _id?: { toString(): string };
      name?: string;
    } | null;
    const payment = a.paymentId as { amount?: number; status?: string } | null;
    const videoSession = videoSessionByAppointment.get(a._id.toString());

    const isCompleted = a.status === AppointmentStatuses.COMPLETED;
    const isPaid = payment?.status === PaymentStatuses.PAID;
    const earningCounted = isCompleted && isPaid && Boolean(payment?.amount);
    const isReferred = referredPatientIdSet.has(
      patient?._id?.toString() ?? "",
    );
    const commissionPercent = resolveEffectiveCommissionPercent(
      rates.online,
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
      providerJoinedAt: videoSession?.doctorJoinedAt
        ? new Date(videoSession.doctorJoinedAt).toISOString()
        : undefined,
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
      isReferred,
      ...base,
    };
  });

  return { appointments: rows, totalEarnings, earningsThisMonth };
}

export async function getAdminNutritionistFinanceDetail(
  nutritionistProfileId: string,
): Promise<AdminNutritionistFinanceDetail> {
  await connectDatabase();

  const profile = await NutritionistProfileModel.findById(nutritionistProfileId).lean();
  if (!profile) throw new AppError("Nutritionist not found", "NOT_FOUND", 404);

  const user = await UserModel.findById(profile.userId).lean();
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  const rates = await getNutritionistCommissionRatesByProfileId(nutritionistProfileId);
  const { appointments, totalEarnings, earningsThisMonth } =
    await buildNutritionistFinanceAppointments(nutritionistProfileId, rates);

  const [payouts, referredPatientCount] = await Promise.all([
    DoctorPayoutModel.find(
      mongoFilter({
        providerRole: NUTRITIONIST_PROVIDER_ROLE,
        providerProfileId: nutritionistProfileId,
      }),
    )
      .populate("paidBy", "name")
      .sort({ paidAt: -1 })
      .lean(),
    countReferredPatients(nutritionistProfileId),
  ]);

  const totalPaidOut = payouts.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const pii = mapUserPii(user);

  return {
    nutritionist: {
      id: nutritionistProfileId,
      name: pii.name ?? "Nutritionist",
      avatarUrl: user.avatarUrl ?? undefined,
      specialties: profile.specialties ?? [],
      email: pii.email,
      phone: pii.phone,
      verificationStatus:
        profile.verificationStatus ?? VerificationStatuses.PENDING,
      referredPatientCount,
    },
    earnings: {
      totalEarnings,
      earningsThisMonth,
      onlineCommissionPercent: profile.onlineCommissionPercent ?? null,
      effectiveOnlineCommissionPercent: rates.online,
    },
    bankAccount: profile.bankAccount
      ? {
          accountTitle: profile.bankAccount.accountTitle ?? undefined,
          accountNumber: profile.bankAccount.accountNumber ?? undefined,
          bankName: profile.bankAccount.bankName ?? undefined,
          iban: profile.bankAccount.iban ?? undefined,
        }
      : null,
    payouts: payouts.map((payout) => {
      const paidBy = payout.paidBy as { name?: string } | null;
      return {
        id: payout._id.toString(),
        amount: payout.amount ?? 0,
        method: payout.method ?? "bank_transfer",
        note: payout.note ?? undefined,
        paidByName: safeDisplayText(paidBy?.name) ?? "Admin",
        paidAt: (payout.paidAt ?? payout.createdAt ?? new Date()).toISOString(),
        receipt: payout.receipt?.url
          ? {
              url: payout.receipt.url,
              originalName: payout.receipt.originalName ?? undefined,
              mimeType: payout.receipt.mimeType ?? undefined,
            }
          : null,
      };
    }),
    totalPaidOut,
    balanceDue: Math.max(0, totalEarnings - totalPaidOut),
    appointments,
  };
}

async function countReferredPatients(profileId: string): Promise<number> {
  const { PatientProfileModel } = await import("@zindagi/database");
  return PatientProfileModel.countDocuments(
    mongoFilter({ referredByNutritionistId: profileId }),
  );
}

export async function updateNutritionistBankAccount(
  nutritionistProfileId: string,
  account: NutritionistBankAccount,
): Promise<NutritionistBankAccount> {
  await connectDatabase();
  const profile = await NutritionistProfileModel.findById(nutritionistProfileId);
  if (!profile) throw new AppError("Nutritionist not found", "NOT_FOUND", 404);

  profile.bankAccount = {
    accountTitle: account.accountTitle,
    accountNumber: account.accountNumber,
    bankName: account.bankName,
    iban: account.iban,
  };
  await profile.save();

  return account;
}

export async function updateOwnNutritionistBankAccount(
  userId: string,
  account: NutritionistBankAccount,
): Promise<NutritionistBankAccount> {
  await connectDatabase();
  const profile = await NutritionistProfileModel.findOne(mongoFilter({ userId }))
    .select("_id")
    .lean();
  if (!profile) {
    throw new AppError("Nutritionist profile not found", "NOT_FOUND", 404);
  }
  return updateNutritionistBankAccount(profile._id.toString(), account);
}

export async function getOwnNutritionistBankAccount(
  userId: string,
): Promise<NutritionistBankAccount | null> {
  await connectDatabase();
  const profile = await NutritionistProfileModel.findOne(mongoFilter({ userId }))
    .select("bankAccount")
    .lean();
  if (!profile) {
    throw new AppError("Nutritionist profile not found", "NOT_FOUND", 404);
  }
  if (!profile.bankAccount) return null;
  return {
    accountTitle: profile.bankAccount.accountTitle ?? undefined,
    accountNumber: profile.bankAccount.accountNumber ?? undefined,
    bankName: profile.bankAccount.bankName ?? undefined,
    iban: profile.bankAccount.iban ?? undefined,
  };
}

export async function recordNutritionistPayout(
  adminUserId: string,
  nutritionistProfileId: string,
  input: {
    amount: number;
    method?: string;
    note?: string;
    receipt?: {
      storageKey: string;
      url: string;
      originalName?: string;
      mimeType?: string;
    };
  },
): Promise<NutritionistPayoutRow> {
  await connectDatabase();
  const profile = await NutritionistProfileModel.findById(nutritionistProfileId)
    .select("_id userId")
    .lean();
  if (!profile) throw new AppError("Nutritionist not found", "NOT_FOUND", 404);
  if (!(input.amount > 0)) {
    throw new AppError("Payout amount must be positive", "VALIDATION_ERROR", 400);
  }

  const payout = (await DoctorPayoutModel.create({
    providerRole: NUTRITIONIST_PROVIDER_ROLE,
    providerProfileId: nutritionistProfileId,
    // doctorProfileId is required on the shared payout ledger; mirror the provider id.
    doctorProfileId: nutritionistProfileId,
    amount: input.amount,
    method: input.method ?? "bank_transfer",
    note: input.note,
    receipt: input.receipt,
    paidBy: adminUserId,
    paidAt: new Date(),
  } as Record<string, unknown>)) as DoctorPayoutDocument;

  const [admin, nutritionistUser] = await Promise.all([
    UserModel.findById(adminUserId).select("name").lean(),
    profile.userId ? UserModel.findById(profile.userId).select("name").lean() : null,
  ]);

  await recordAdminActivity({
    actor: adminUserId,
    action: "nutritionist_payout.recorded",
    entityType: "DoctorPayout",
    entityId: payout._id.toString(),
    targetLabel: safeDisplayText(nutritionistUser?.name) ?? undefined,
    changes: {
      nutritionistProfileId,
      amount: input.amount,
      method: input.method,
      note: input.note,
    },
  });

  return {
    id: payout._id.toString(),
    amount: payout.amount ?? 0,
    method: payout.method ?? "bank_transfer",
    note: payout.note ?? undefined,
    paidByName: safeDisplayText(admin?.name) ?? "Admin",
    paidAt: (payout.paidAt ?? new Date()).toISOString(),
    receipt: payout.receipt?.url
      ? {
          url: payout.receipt.url,
          originalName: payout.receipt.originalName ?? undefined,
          mimeType: payout.receipt.mimeType ?? undefined,
        }
      : null,
  };
}

/** Storage key for a payout receipt, scoped to the owning nutritionist for access checks. */
export async function getNutritionistPayoutReceiptStorageKey(
  nutritionistProfileId: string,
  payoutId: string,
): Promise<{ storageKey: string; mimeType?: string; originalName?: string }> {
  await connectDatabase();
  const payout = await DoctorPayoutModel.findOne(
    mongoFilter({
      _id: payoutId,
      providerRole: NUTRITIONIST_PROVIDER_ROLE,
      providerProfileId: nutritionistProfileId,
    }),
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
 * Nutritionist-facing view of their own appointment-by-appointment earning eligibility —
 * the same logic admins see, so providers understand why a consult did or didn't pay.
 */
export async function getOwnNutritionistEarningEligibility(
  userId: string,
): Promise<{ appointments: NutritionistFinanceAppointmentRow[] }> {
  await connectDatabase();
  const profile = await NutritionistProfileModel.findOne(mongoFilter({ userId }))
    .select("_id")
    .lean();
  if (!profile) {
    throw new AppError("Nutritionist profile not found", "NOT_FOUND", 404);
  }

  const profileId = profile._id.toString();
  const rates = await getNutritionistCommissionRatesByProfileId(profileId);
  const { appointments } = await buildNutritionistFinanceAppointments(
    profileId,
    rates,
  );

  return { appointments };
}

export { PaymentModel };
