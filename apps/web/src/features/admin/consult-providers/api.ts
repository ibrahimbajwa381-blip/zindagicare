import type { ConsultProviderAdminConfig } from "./config";
import type {
  AdminConsultProviderDetail,
  AdminConsultProviderRow,
  ConsultProviderBankAccount,
  ConsultProviderFinance,
} from "./types";

/** Thrown for any non-success API envelope; `message` is safe to show admins. */
export class ConsultProviderApiError extends Error {}

async function request<T>(url: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ConsultProviderApiError(`${fallback} — check your connection and try again.`);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new ConsultProviderApiError(
      (json?.error?.message as string | undefined) ?? fallback,
    );
  }
  return json.data as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export type ConsultProviderUpdate = Record<string, unknown>;

export type CreateConsultProviderInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  licenseNumber: string;
  city: string;
  specialties: string[];
};

export type ConsultProviderPayoutInput = {
  amount: number;
  method: string;
  note?: string;
  receipt: File;
};

/** Typed client for one provider kind's admin endpoints. */
export function createConsultProviderApi(config: ConsultProviderAdminConfig) {
  const base = config.apiBase;
  const label = config.labels.singularLower;

  return {
    async list(params: { status?: string; search?: string } = {}) {
      const qs = new URLSearchParams();
      if (params.status) qs.set("status", params.status);
      if (params.search) qs.set("search", params.search);
      const query = qs.toString();
      const data = await request<Record<string, AdminConsultProviderRow[]>>(
        query ? `${base}?${query}` : base,
        undefined,
        `Failed to load ${config.labels.pluralLower}`,
      );
      return data[config.listResponseKey] ?? [];
    },

    detail(id: string) {
      return request<AdminConsultProviderDetail>(
        `${base}/${id}`,
        undefined,
        `Failed to load ${label}`,
      );
    },

    update(id: string, patch: ConsultProviderUpdate) {
      return request<AdminConsultProviderDetail>(
        `${base}/${id}/manage`,
        jsonInit("PATCH", patch),
        "Update failed",
      );
    },

    decide(
      id: string,
      action: "approve" | "reject",
      options: { rejectionReason?: string; verifiedSpecialties?: string[] } = {},
    ) {
      return request<{ id: string; status: string }>(
        `${base}/decide`,
        jsonInit("POST", { [config.decideIdField]: id, action, ...options }),
        action === "approve" ? "Approval failed" : "Rejection failed",
      );
    },

    create(input: CreateConsultProviderInput) {
      return request<AdminConsultProviderDetail>(
        `${base}/manage`,
        jsonInit("POST", input),
        `Failed to create ${label}`,
      );
    },

    remove(id: string) {
      return request<{ deleted: boolean }>(
        `${base}/${id}`,
        { method: "DELETE" },
        `Failed to delete ${label}`,
      );
    },

    async finance(id: string): Promise<ConsultProviderFinance> {
      const data = await request<Record<string, unknown>>(
        `${base}/${id}/finance`,
        undefined,
        "Could not load finance details",
      );
      const { [config.financeSubjectKey]: provider, ...rest } = data;
      return { provider, ...rest } as ConsultProviderFinance;
    },

    updateBankAccount(id: string, bankAccount: ConsultProviderBankAccount) {
      return request<{ bankAccount: ConsultProviderBankAccount }>(
        `${base}/${id}/finance/bank-account`,
        jsonInit("PATCH", bankAccount),
        "Failed to save bank account",
      );
    },

    recordPayout(id: string, input: ConsultProviderPayoutInput) {
      const formData = new FormData();
      formData.append("amount", String(input.amount));
      formData.append("method", input.method);
      if (input.note) formData.append("note", input.note);
      formData.append("receipt", input.receipt);
      return request<{ payout: unknown }>(
        `${base}/${id}/finance/payouts`,
        { method: "POST", body: formData },
        "Failed to record payout",
      );
    },
  };
}

export type ConsultProviderApi = ReturnType<typeof createConsultProviderApi>;

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
