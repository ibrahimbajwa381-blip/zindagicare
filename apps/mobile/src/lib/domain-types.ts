/**
 * Mirrors the literal unions in packages/shared/src/types/enums.ts and
 * auth/workspace.ts. Duplicated (not imported) because @zindagi/shared's
 * barrel export also pulls in Node-only modules (e.g. crypto/field-encryption)
 * that don't type-check or bundle under React Native.
 */
export type Role =
  | "patient"
  | "doctor"
  | "admin"
  | "super_admin"
  | "rider"
  | "nurse"
  | "physiotherapist"
  | "herbalist"
  | "nutritionist";

export type Workspace =
  | "patient"
  | "doctor"
  | "admin"
  | "nurse"
  | "physiotherapist"
  | "herbalist"
  | "nutritionist"
  | "rider";
