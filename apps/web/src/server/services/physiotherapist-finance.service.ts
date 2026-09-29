import { Types } from "mongoose";
import {
  connectDatabase,
  DoctorPayoutModel,
  HomeVisitModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  HomeVisitStatuses,
  PHYSIOTHERAPY_HOME_VISIT_SPLIT,
  Roles,
  calculatePhysiotherapistVisitEarnings,
} from "@zindagi/shared";
import type { PhysiotherapistBankAccountInput } from "@zindagi/validators";
import { mongoFilter } from "@/lib/mongo/query";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { recordAdminActivity } from "./admin-activity.service";
import { savePayoutReceipt } from "./payout-receipt.storage";

/** Physiotherapist payouts share the provider payout ledger under this role. */
export const PHYSIOTHERAPIST_PROVIDER_ROLE = "physiotherapist";

export const PHYSIOTHERAPIST_PAYOUT_METHODS = [
  "bank_transfer",
  "jazzcash",
  "easypaisa",
  "cash",
  "other",
] as const;

export type PhysiotherapistBankAccount = {
  accountTitle?: string;
  accountNumber?: string;
  bankName?: string;
  iban?: string;
};

export type PhysiotherapistPayoutRow = {
  id: string;
  amount: number;
  method: string;
  note?: string;
  paidByName: string;
  paidAt: string;
  receiptUrl?: string;
};

export type PhysiotherapistEarningRow = {
  visitId: string;
  completedAt: string;
  patientName: string;
  /** What the patient paid for the visit. */
  grossAmount: number;
  /** The physiotherapist's share. */
  amount: number;
  /** ZindagiCare's share. */
  platformFee: number;
};

export type PhysiotherapistEarningsDetail = {
  /** % of each visit fee the physiotherapist keeps. */
  physiotherapistPercent: number;
  platformPercent: number;
  totalEarnings: number;
  earningsThisMonth: number;
  completedVisits: number;
  completedVisitsThisMonth: number;
  totalPaidOut: number;
  availableBalance: number;
  payouts: PhysiotherapistPayoutRow[];
  transactions: PhysiotherapistEarningRow[];
};

export type AdminPhysiotherapistFinance = PhysiotherapistEarningsDetail & {
  staffProfileId: string;
  name: string;
  bankAccount: PhysiotherapistBankAccount | null;
};

type StaffFinanceDoc = {
  _id: Types.ObjectId;
  userId: Types.ObjectId | string;
  commissionPercent?: number | null;
  bankAccount?: PhysiotherapistBankAccount | null;
};

/** Newest visits listed on the earnings pages; totals always cover every visit. */
const MAX_TRANSACTION_ROWS = 100;

function mapBankAccount(
  raw: PhysiotherapistBankAccount | null | undefined,
): PhysiotherapistBankAccount | null {
  if (!raw) return null;
  const account = {
    accountTitle: raw.accountTitle || undefined,
    accountNumber: raw.accountNumber || undefined,
    bankName: raw.bankName || undefined,
    iban: raw.iban || undefined,
  };
  return Object.values(account).some(Boolean) ? account : null;
}

function receiptUrl(staffProfileId: string, payoutId: string) {
  return `/api/v1/admin/physiotherapists/${staffProfileId}/finance/payouts/${payoutId}/receipt`;
}

function physiotherapistPercent(commissionOverride?: number | null) {
  return commissionOverride != null && !Number.isNaN(commissionOverride)
    ? commissionOverride
    : PHYSIOTHERAPY_HOME_VISIT_SPLIT.physiotherapistPercent;
}

async function findStaffByUserId(userId: string): Promise<StaffFinanceDoc> {
  const staff = await StaffProfileModel.findOne(
    mongoFilter({ userId, staffType: Roles.PHYSIOTHERAPIST }),
  )
    .select("_id userId commissionPercent bankAccount")
    .lean<StaffFinanceDoc | null>();
  if (!staff) {
    throw new AppError("Physiotherapist profile not found", "NOT_FOUND", 404);
  }
  return staff;
}

async function findStaffById(staffProfileId: string): Promise<StaffFinanceDoc> {
  if (!Types.ObjectId.isValid(staffProfileId)) {
    throw new AppError("Physiotherapist not found", "NOT_FOUND", 404);
  }
  const staff = await StaffProfileModel.findOne(
    mongoFilter({ _id: staffProfileId, staffType: Roles.PHYSIOTHERAPIST }),
  )
    .select("_id userId commissionPercent bankAccount")
    .lean<StaffFinanceDoc | null>();
  if (!staff) {
    throw new AppError("Physiotherapist not found", "NOT_FOUND", 404);
  }
  return staff;
}

/** Earnings (70% of each completed visit by default) minus payouts already sent. */
async function buildEarningsDetail(
  staff: StaffFinanceDoc,
): Promise<PhysiotherapistEarningsDetail> {
  const staffProfileId = staff._id.toString();
  const userId = staff.userId.toString();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [visits, payouts] = await Promise.all([
    HomeVisitModel.find(
      mongoFilter({
        assignedStaffId: userId,
        status: HomeVisitStatuses.COMPLETED,
        deletedAt: { $exists: false },
      }),
    )
      .select("pricing completedAt updatedAt patientId")
      .populate("patientId", "name")
      .sort({ completedAt: -1 })
      .lean(),
    DoctorPayoutModel.find(
      mongoFilter({
        providerRole: PHYSIOTHERAPIST_PROVIDER_ROLE,
        providerProfileId: staffProfileId,
      }),
    )
      .populate("paidBy", "name")
      .sort({ paidAt: -1 })
      .lean(),
  ]);

  let totalEarnings = 0;
  let earningsThisMonth = 0;
  let completedVisitsThisMonth = 0;
  const transactions: PhysiotherapistEarningRow[] = [];

  for (const visit of visits) {
    const gross = visit.pricing?.total ?? 0;
    const net = calculatePhysiotherapistVisitEarnings(gross, staff.commissionPercent);
    const completedAt = visit.completedAt ?? visit.updatedAt ?? now;
    totalEarnings += net;
    if (completedAt >= startOfMonth) {
      earningsThisMonth += net;
      completedVisitsThisMonth += 1;
    }
    if (transactions.length < MAX_TRANSACTION_ROWS) {
      const patient = visit.patientId as { name?: string } | null;
      transactions.push({
        visitId: visit._id.toString(),
        completedAt: completedAt.toISOString(),
        patientName: safeDisplayText(patient?.name) ?? "Patient",
        grossAmount: gross,
        amount: net,
        platformFee: gross - net,
      });
    }
  }

  const totalPaidOut = payouts.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const percent = physiotherapistPercent(staff.commissionPercent);

  return {
    physiotherapistPercent: percent,
    platformPercent: 100 - percent,
    totalEarnings,
    earningsThisMonth,
    completedVisits: visits.length,
    completedVisitsThisMonth,
    totalPaidOut,
    availableBalance: Math.max(0, totalEarnings - totalPaidOut),
    payouts: payouts.map((payout) => {
      const paidBy = payout.paidBy as { name?: string } | null;
      const payoutId = payout._id.toString();
      return {
        id: payoutId,
        amount: payout.amount ?? 0,
        method: payout.method ?? "bank_transfer",
        note: payout.note ?? undefined,
        paidByName: safeDisplayText(paidBy?.name) ?? "Admin",
        paidAt: (payout.paidAt ?? payout.createdAt ?? now).toISOString(),
        receiptUrl: payout.receipt?.storageKey
          ? receiptUrl(staffProfileId, payoutId)
          : undefined,
      };
    }),
    transactions,
  };
}

/** Physiotherapist's own earnings page. */
export async function getPhysiotherapistEarnings(
  userId: string,
): Promise<PhysiotherapistEarningsDetail> {
  await connectDatabase();
  return buildEarningsDetail(await findStaffByUserId(userId));
}

export async function getOwnPhysiotherapistBankAccount(
  userId: string,
): Promise<PhysiotherapistBankAccount | null> {
  await connectDatabase();
  const staff = await findStaffByUserId(userId);
  return mapBankAccount(staff.bankAccount);
}

export async function updateOwnPhysiotherapistBankAccount(
  userId: string,
  input: PhysiotherapistBankAccountInput,
): Promise<PhysiotherapistBankAccount> {
  await connectDatabase();
  const staff = await StaffProfileModel.findOne(
    mongoFilter({ userId, staffType: Roles.PHYSIOTHERAPIST }),
  );
  if (!staff) {
    throw new AppError("Physiotherapist profile not found", "NOT_FOUND", 404);
  }

  const account = {
    accountTitle: input.accountTitle,
    bankName: input.bankName,
    accountNumber: input.accountNumber,
    iban: input.iban,
  };
  staff.bankAccount = account;
  await staff.save();
  return account;
}

/** Admin: balance, bank details and payout history for one physiotherapist. */
export async function getAdminPhysiotherapistFinance(
  staffProfileId: string,
): Promise<AdminPhysiotherapistFinance> {
  await connectDatabase();
  const staff = await findStaffById(staffProfileId);
  const [detail, user] = await Promise.all([
    buildEarningsDetail(staff),
    UserModel.findById(staff.userId).select("name").lean(),
  ]);

  return {
    ...detail,
    staffProfileId,
    name: safeDisplayText(user?.name) ?? "Physiotherapist",
    bankAccount: mapBankAccount(staff.bankAccount),
  };
}

/**
 * Admin: record a (Sunday) payout for the full outstanding balance, with the transfer receipt.
 * Everything is validated before the receipt is stored, so a rejected payout leaves no file.
 */
export async function recordPhysiotherapistPayout(
  adminUserId: string,
  staffProfileId: string,
  input: { amount: number; method: string; note?: string; receiptFile: File },
): Promise<PhysiotherapistPayoutRow> {
  await connectDatabase();
  const staff = await findStaffById(staffProfileId);

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new AppError("Payout amount must be greater than zero", "VALIDATION_ERROR", 400);
  }
  if (!(PHYSIOTHERAPIST_PAYOUT_METHODS as readonly string[]).includes(input.method)) {
    throw new AppError("Invalid payout method", "VALIDATION_ERROR", 400);
  }

  const bankAccount = mapBankAccount(staff.bankAccount);
  if (!bankAccount?.accountNumber && !bankAccount?.iban) {
    throw new AppError(
      "This physiotherapist has no bank account on file yet",
      "VALIDATION_ERROR",
      400,
    );
  }

  const detail = await buildEarningsDetail(staff);
  if (Math.round(input.amount) !== Math.round(detail.availableBalance)) {
    throw new AppError(
      `Payout must equal the full outstanding balance (PKR ${detail.availableBalance.toLocaleString()})`,
      "VALIDATION_ERROR",
      400,
    );
  }

  const payoutId = new Types.ObjectId();
  const stored = await savePayoutReceipt(staffProfileId, payoutId.toString(), input.receiptFile);
  const receipt = { ...stored, url: receiptUrl(staffProfileId, payoutId.toString()) };

  const payoutDoc: Record<string, unknown> = {
    _id: payoutId,
    providerRole: PHYSIOTHERAPIST_PROVIDER_ROLE,
    providerProfileId: staff._id,
    // doctorProfileId is required on the shared payout ledger; mirror the provider id.
    doctorProfileId: staff._id,
    amount: input.amount,
    method: input.method,
    note: input.note?.trim() || undefined,
    receipt,
    paidBy: adminUserId,
    paidAt: new Date(),
  };
  const [payout] = await DoctorPayoutModel.create([payoutDoc]);

  const [admin, physioUser] = await Promise.all([
    UserModel.findById(adminUserId).select("name").lean(),
    UserModel.findById(staff.userId).select("name").lean(),
  ]);

  await recordAdminActivity({
    actor: adminUserId,
    action: "physiotherapist_payout.recorded",
    entityType: "DoctorPayout",
    entityId: payout._id.toString(),
    targetLabel: safeDisplayText(physioUser?.name) ?? undefined,
    changes: {
      staffProfileId,
      amount: input.amount,
      method: input.method,
      note: input.note,
    },
  });

  return {
    id: payout._id.toString(),
    amount: payout.amount ?? 0,
    method: payout.method ?? input.method,
    note: payout.note ?? undefined,
    paidByName: safeDisplayText(admin?.name) ?? "Admin",
    paidAt: (payout.paidAt ?? new Date()).toISOString(),
    receiptUrl: receiptUrl(staffProfileId, payout._id.toString()),
  };
}

/** Receipt location for a payout, scoped to the owning physiotherapist for access checks. */
export async function getPhysiotherapistPayoutReceipt(
  staffProfileId: string,
  payoutId: string,
): Promise<{ storageKey: string; mimeType?: string; originalName?: string }> {
  if (!Types.ObjectId.isValid(staffProfileId) || !Types.ObjectId.isValid(payoutId)) {
    throw new AppError("Receipt not found", "NOT_FOUND", 404);
  }
  await connectDatabase();
  const payout = await DoctorPayoutModel.findOne(
    mongoFilter({
      _id: payoutId,
      providerRole: PHYSIOTHERAPIST_PROVIDER_ROLE,
      providerProfileId: staffProfileId,
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

/** True when the signed-in user owns this physiotherapist profile. */
export async function isOwnPhysiotherapistProfile(
  staffProfileId: string,
  userId: string,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(staffProfileId)) return false;
  await connectDatabase();
  const staff = await StaffProfileModel.findOne(
    mongoFilter({ _id: staffProfileId, staffType: Roles.PHYSIOTHERAPIST }),
  )
    .select("userId")
    .lean();
  return staff?.userId?.toString() === userId;
}
