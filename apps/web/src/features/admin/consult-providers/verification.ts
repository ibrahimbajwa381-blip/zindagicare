import { VerificationStatuses } from "@zindagi/shared";
import type { ConsultProviderApi } from "./api";

export const RESTRICTED_STATUS = "restricted";

/** Statuses an admin can move a provider into from the directory / manage screens. */
export const VERIFICATION_STATUS_OPTIONS = [
  { value: VerificationStatuses.APPROVED, label: "Approved" },
  { value: VerificationStatuses.REJECTED, label: "Rejected" },
  { value: RESTRICTED_STATUS, label: "Restricted" },
] as const;

export function statusRequiresReason(status: string): boolean {
  return status === VerificationStatuses.REJECTED || status === RESTRICTED_STATUS;
}

/**
 * Single entry point for status changes so every screen behaves the same:
 * approve / reject go through the verification decision (which lists, verifies
 * specialties and audits), restrict is an account-control update.
 */
export async function changeVerificationStatus(
  api: ConsultProviderApi,
  provider: { id: string; specialties: string[] },
  next: string,
  reason?: string,
): Promise<void> {
  if (next === VerificationStatuses.APPROVED) {
    await api.decide(provider.id, "approve", {
      // Keep previously verified specialties when re-approving.
      verifiedSpecialties: provider.specialties.length ? provider.specialties : undefined,
    });
    return;
  }
  if (next === VerificationStatuses.REJECTED) {
    await api.decide(provider.id, "reject", { rejectionReason: reason });
    return;
  }
  await api.update(provider.id, { verificationStatus: next, rejectionReason: reason });
}
