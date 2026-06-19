export const URGENT_CONSULT_CONFIG = {
  timezone: "Asia/Karachi",
  /** Consult duration once doctor joins */
  consultDurationMins: 10,
  /** Target window: doctor arranged within this many minutes */
  minWaitMinutes: 5,
  maxWaitMinutes: 10,
  /** Flat urgent-care fee (PKR) */
  defaultFeePkr: 2000,
  /** Unpaid checkout expires after this */
  paymentHoldDurationMs: 10 * 60 * 1000,
  /** How long before call start patients can join video */
  targetCallWithinMinutes: 10,
} as const;
