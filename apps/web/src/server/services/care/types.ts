import type { ProviderProfile } from "./provider-registry";

/** A user plus the provider profiles they own (none for patients). */
export type CareParty = {
  userId: string;
  profiles: ProviderProfile[];
};

/** One consult or visit between a patient and a provider, whatever its source. */
export type CareEngagement = {
  patientUserId: string;
  provider: ProviderProfile;
  access: "read" | "write";
  /** Appointment a chat thread can anchor to; absent for home visits. */
  appointmentId?: string;
  startsAt: Date;
};

/** What one user may do with one counterpart, merged across all their consults. */
export type CareLink = {
  counterpartUserId: string;
  /** Provider of the anchor consult: the counterpart, or the viewer themself. */
  provider: ProviderProfile;
  counterpartIsProvider: boolean;
  /** True when any consult or visit between them is still open. */
  writable: boolean;
  /** Latest appointment between them, preferring an open one; absent when they only share home visits. */
  appointmentId?: string;
};
