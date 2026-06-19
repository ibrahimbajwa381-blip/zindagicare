export const ONLINE_CONSULT_CONFIG = {
  timezone: "Asia/Karachi",
  defaultSlotDurationMins: 20,
  lookaheadDays: 14,
  /** Unpaid checkout holds block the slot for this long */
  paymentHoldDurationMs: 15 * 60 * 1000,
  /** Online consult is paid-only; Sunday is the sole free channel */
  minConsultationFee: 1,
} as const;
