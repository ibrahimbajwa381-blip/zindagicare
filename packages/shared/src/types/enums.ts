export const Roles = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
  RIDER: "rider",
  NURSE: "nurse",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const AppointmentTypes = {
  CLINIC: "clinic",
  ONLINE: "online",
  SUNDAY_FREE: "sunday_free",
  HOME_VISIT: "home_visit",
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
} as const;

export type VerificationStatus =
  (typeof VerificationStatuses)[keyof typeof VerificationStatuses];

export const PaymentProviders = {
  STRIPE: "stripe",
  JAZZCASH: "jazzcash",
  EASYPAISA: "easypaisa",
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
  SUPPORT: "support",
} as const;

export type ChatThreadType =
  (typeof ChatThreadTypes)[keyof typeof ChatThreadTypes];
