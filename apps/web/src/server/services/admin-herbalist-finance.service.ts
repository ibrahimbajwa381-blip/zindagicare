import {
  connectDatabase,
  AppointmentModel,
  DoctorPayoutModel,
  HerbalistProfileModel,
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
import { HERBALIST_PROVIDER_ROLE } from "./herbalist-dashboard.service";
import {
  getHerbalistCommissionRatesByProfileId,
  getHerbalistReferredPatientIdSet,
  resolveEffectiveCommissionPercent,
} from "./commission.service";
import { recordAdminActivity } from "./admin-activity.service";

export type HerbalistBankAccount = {
  accountTitle?: string;
  accountNumber?: string;
  bankName?: string;
  iban?: string;
};

export type HerbalistPayoutReceipt = {
  url: string;
  originalName?: string;
  mimeType?: string;
};

export type HerbalistPayoutRow = {
  id: string;
  amount: number;
  method: string;
  note?: string;
  paidByName: string;
  paidAt: string;
  receipt: HerbalistPayoutReceipt | null;
};

export type HerbalistFinanceAppointmentRow = {
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

export type AdminHerbalistFinanceDetail = {
  herbalist: {
    id: string;
    name: string;
    avatarUrl?: string;
    specialties: string[];
    email?: string;
    phone?: string;
    verificationStatus: string;
    /** Patients who signed up via this herbalist's referral link. */
    referredPatientCount: number;
  };
  earnings: {
    totalEarnings: number;
    earningsThisMonth: number;
    onlineCommissionPercent: number | null;
    effectiveOnlineCommissionPercent: number;
  };
  bankAccount: HerbalistBankAccount | null;
  payouts: HerbalistPayoutRow[];
  totalPaidOut: number;
  balanceDue: number;
  appointments: HerbalistFinanceAppointmentRow[];
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

async function buildHerbalistFinanceAppointments(
  profileId: string,
  rates: { online: number },
): Promise<{
  appointments: HerbalistFinanceAppointmentRow[];
  totalEarnings: number;
  earningsThisMonth: number;
}> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const appointments = await AppointmentModel.find(
    mongoFilter({
      providerRole: HERBALIST_PROVIDER_ROLE,
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
  const referredPatientIdSet = await getHerbalistReferredPatientIdSet(
    profileId,
    patientIds,
  );

  let totalEarnings = 0;
  let earningsThisMonth = 0;

  const rows: HerbalistFinanceAppointmentRow[] = appointments.map((a) => {
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

export async function getAdminHerbalistFinanceDetail(
  herbalistProfileId: string,
): Promise<AdminHerbalistFinanceDetail> {
  await connectDatabase();

  const profile = await HerbalistProfileModel.findById(herbalistProfileId).lean();
  if (!profile) throw new AppError("Herbalist not found", "NOT_FOUND", 404);

  const user = await UserModel.findById(profile.userId).lean();
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  const rates = await getHerbalistCommissionRatesByProfileId(herbalistProfileId);
  const { appointments, totalEarnings, earningsThisMonth } =
    await buildHerbalistFinanceAppointments(herbalistProfileId, rates);

  const [payouts, referredPatientCount] = await Promise.all([
    DoctorPayoutModel.find(
      mongoFilter({
        providerRole: HERBALIST_PROVIDER_ROLE,
        providerProfileId: herbalistProfileId,
      }),
    )
      .populate("paidBy", "name")
      .sort({ paidAt: -1 })
      .lean(),
    countReferredPatients(herbalistProfileId),
  ]);

  const totalPaidOut = payouts.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const pii = mapUserPii(user);

  return {
    herbalist: {
      id: herbalistProfileId,
      name: pii.name ?? "Herbalist",
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
    mongoFilter({ referredByHerbalistId: profileId }),
  );
}

export async function updateHerbalistBankAccount(
  herbalistProfileId: string,
  account: HerbalistBankAccount,
): Promise<HerbalistBankAccount> {
  await connectDatabase();
  const profile = await HerbalistProfileModel.findById(herbalistProfileId);
  if (!profile) throw new AppError("Herbalist not found", "NOT_FOUND", 404);

  profile.bankAccount = {
    accountTitle: account.accountTitle,
    accountNumber: account.accountNumber,
    bankName: account.bankName,
    iban: account.iban,
  };
  await profile.save();

  return account;
}

export async function updateOwnHerbalistBankAccount(
  userId: string,
  account: HerbalistBankAccount,
): Promise<HerbalistBankAccount> {
  await connectDatabase();
  const profile = await HerbalistProfileModel.findOne(mongoFilter({ userId }))
    .select("_id")
    .lean();
  if (!profile) {
    throw new AppError("Herbalist profile not found", "NOT_FOUND", 404);
  }
  return updateHerbalistBankAccount(profile._id.toString(), account);
}

export async function getOwnHerbalistBankAccount(
  userId: string,
): Promise<HerbalistBankAccount | null> {
  await connectDatabase();
  const profile = await HerbalistProfileModel.findOne(mongoFilter({ userId }))
    .select("bankAccount")
    .lean();
  if (!profile) {
    throw new AppError("Herbalist profile not found", "NOT_FOUND", 404);
  }
  if (!profile.bankAccount) return null;
  return {
    accountTitle: profile.bankAccount.accountTitle ?? undefined,
    accountNumber: profile.bankAccount.accountNumber ?? undefined,
    bankName: profile.bankAccount.bankName ?? undefined,
    iban: profile.bankAccount.iban ?? undefined,
  };
}

export async function recordHerbalistPayout(
  adminUserId: string,
  herbalistProfileId: string,
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
): Promise<HerbalistPayoutRow> {
  await connectDatabase();
  const profile = await HerbalistProfileModel.findById(herbalistProfileId)
    .select("_id userId")
    .lean();
  if (!profile) throw new AppError("Herbalist not found", "NOT_FOUND", 404);
  if (!(input.amount > 0)) {
    throw new AppError("Payout amount must be positive", "VALIDATION_ERROR", 400);
  }

  const payout = (await DoctorPayoutModel.create({
    providerRole: HERBALIST_PROVIDER_ROLE,
    providerProfileId: herbalistProfileId,
    // doctorProfileId is required on the shared payout ledger; mirror the provider id.
    doctorProfileId: herbalistProfileId,
    amount: input.amount,
    method: input.method ?? "bank_transfer",
    note: input.note,
    receipt: input.receipt,
    paidBy: adminUserId,
    paidAt: new Date(),
  } as Record<string, unknown>)) as DoctorPayoutDocument;

  const [admin, herbalistUser] = await Promise.all([
    UserModel.findById(adminUserId).select("name").lean(),
    profile.userId ? UserModel.findById(profile.userId).select("name").lean() : null,
  ]);

  await recordAdminActivity({
    actor: adminUserId,
    action: "herbalist_payout.recorded",
    entityType: "DoctorPayout",
    entityId: payout._id.toString(),
    targetLabel: safeDisplayText(herbalistUser?.name) ?? undefined,
    changes: {
      herbalistProfileId,
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

/** Storage key for a payout receipt, scoped to the owning herbalist for access checks. */
export async function getHerbalistPayoutReceiptStorageKey(
  herbalistProfileId: string,
  payoutId: string,
): Promise<{ storageKey: string; mimeType?: string; originalName?: string }> {
  await connectDatabase();
  const payout = await DoctorPayoutModel.findOne(
    mongoFilter({
      _id: payoutId,
      providerRole: HERBALIST_PROVIDER_ROLE,
      providerProfileId: herbalistProfileId,
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
 * Herbalist-facing view of their own appointment-by-appointment earning eligibility —
 * the same logic admins see, so providers understand why a consult did or didn't pay.
 */
export async function getOwnHerbalistEarningEligibility(
  userId: string,
): Promise<{ appointments: HerbalistFinanceAppointmentRow[] }> {
  await connectDatabase();
  const profile = await HerbalistProfileModel.findOne(mongoFilter({ userId }))
    .select("_id")
    .lean();
  if (!profile) {
    throw new AppError("Herbalist profile not found", "NOT_FOUND", 404);
  }

  const profileId = profile._id.toString();
  const rates = await getHerbalistCommissionRatesByProfileId(profileId);
  const { appointments } = await buildHerbalistFinanceAppointments(
    profileId,
    rates,
  );

  return { appointments };
}

export { PaymentModel };
