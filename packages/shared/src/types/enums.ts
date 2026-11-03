export const Roles = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
  /** Operations manager: admin panel without finances or admin management. */
  MANAGER: "manager",
  RIDER: "rider",
  NURSE: "nurse",
  PHYSIOTHERAPIST: "physiotherapist",
  HERBALIST: "herbalist",
  NUTRITIONIST: "nutritionist",
  LAB: "lab",
  OTHER: "other",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const AppointmentTypes = {
  CLINIC: "clinic",
  ONLINE: "online",
  SUNDAY_FREE: "sunday_free",
  HOME_VISIT: "home_visit",
  URGENT_ONLINE: "urgent_online",
} as const;

export type AppointmentType =
  (typeof AppointmentTypes)[keyof typeof AppointmentTypes];

export const AppointmentStatuses = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
} as const;

export type AppointmentStatus =
  (typeof AppointmentStatuses)[keyof typeof AppointmentStatuses];

export const VerificationStatuses = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  /** Approved previously but admin-suspended from new bookings and listings */
  RESTRICTED: "restricted",
} as const;

export type VerificationStatus =
  (typeof VerificationStatuses)[keyof typeof VerificationStatuses];

export const PaymentProviders = {
  STRIPE: "stripe",
  JAZZCASH: "jazzcash",
  EASYPAISA: "easypaisa",
  /** Patient sends JazzCash P2P transfer and uploads receipt (no gateway). */
  MANUAL_JAZZCASH: "manual_jazzcash",
  /** @deprecated Use MANUAL_JAZZCASH — kept for legacy pending payments */
  DUMMY: "dummy",
} as const;

export type PaymentProvider =
  (typeof PaymentProviders)[keyof typeof PaymentProviders];

export const PaymentStatuses = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded",
  CANCELLED: "cancelled",
} as const;

export type PaymentStatus =
  (typeof PaymentStatuses)[keyof typeof PaymentStatuses];

/** Patient-initiated request to cancel a booked appointment and be refunded. */
export const CancellationRequestStatuses = {
  NONE: "none",
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
} as const;

export type CancellationRequestStatus =
  (typeof CancellationRequestStatuses)[keyof typeof CancellationRequestStatuses];

/** How a patient wants their manual refund transfer sent. */
export const RefundMethods = {
  BANK: "bank",
  JAZZCASH: "jazzcash",
  EASYPAISA: "easypaisa",
} as const;

export type RefundMethod = (typeof RefundMethods)[keyof typeof RefundMethods];

export const SlotStatuses = {
  AVAILABLE: "available",
  HELD: "held",
  BOOKED: "booked",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
  CANCELLED: "cancelled",
} as const;

export type SlotStatus = (typeof SlotStatuses)[keyof typeof SlotStatuses];

export const HomeVisitServiceTypes = {
  DOCTOR_VISIT: "doctor_visit",
  NURSE: "nurse",
  IV_DRIP: "iv_drip",
  INJECTION: "injection",
  WOUND_CARE: "wound_care",
  PHYSIOTHERAPY: "physiotherapy",
  SAMPLE_COLLECTION: "sample_collection",
  EMERGENCY: "emergency",
} as const;

export type HomeVisitServiceType =
  (typeof HomeVisitServiceTypes)[keyof typeof HomeVisitServiceTypes];

export const HomeVisitStatuses = {
  REQUESTED: "requested",
  ASSIGNED: "assigned",
  EN_ROUTE: "en_route",
  ARRIVED: "arrived",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type HomeVisitStatus =
  (typeof HomeVisitStatuses)[keyof typeof HomeVisitStatuses];

export const UrgentCareRequestStatuses = {
  REQUESTED: "requested",
  ASSIGNED: "assigned",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type UrgentCareRequestStatus =
  (typeof UrgentCareRequestStatuses)[keyof typeof UrgentCareRequestStatuses];

export const SundayFreeRequestStatuses = {
  REQUESTED: "requested",
  ASSIGNED: "assigned",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type SundayFreeRequestStatus =
  (typeof SundayFreeRequestStatuses)[keyof typeof SundayFreeRequestStatuses];

/** Admin's own verdict on how a Sunday consult went (independent of the appointment status). */
export const SundayAdminOutcomes = {
  WELL_COMPLETED: "well_completed",
  NOT_COMPLETED: "not_completed",
} as const;

export type SundayAdminOutcome = (typeof SundayAdminOutcomes)[keyof typeof SundayAdminOutcomes];

export const OrderStatuses = {
  DRAFT: "draft",
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  PROCESSING: "processing",
  DISPATCHED: "dispatched",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof OrderStatuses)[keyof typeof OrderStatuses];

export const NotificationChannels = {
  PUSH: "push",
  SMS: "sms",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
  IN_APP: "in_app",
} as const;

export type NotificationChannel =
  (typeof NotificationChannels)[keyof typeof NotificationChannels];

export const VideoSessionStatuses = {
  WAITING: "waiting",
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
} as const;

export type VideoSessionStatus =
  (typeof VideoSessionStatuses)[keyof typeof VideoSessionStatuses];

export const ChatThreadTypes = {
  APPOINTMENT: "appointment",
  DIRECT: "direct",
  SUPPORT: "support",
} as const;

export type ChatThreadType =
  (typeof ChatThreadTypes)[keyof typeof ChatThreadTypes];

export const ChatMessageKinds = {
  USER: "user",
  SYSTEM: "system",
} as const;

export type ChatMessageKind =
  (typeof ChatMessageKinds)[keyof typeof ChatMessageKinds];

export const IntakeStatuses = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

export type IntakeStatus = (typeof IntakeStatuses)[keyof typeof IntakeStatuses];

export const IntakeSources = {
  CHAT: "chat",
  FORM: "form",
} as const;

export type IntakeSource = (typeof IntakeSources)[keyof typeof IntakeSources];
