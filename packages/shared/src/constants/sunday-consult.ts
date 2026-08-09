export const SundayAffordabilityChoices = {
  /** Patient cannot afford a paid consult — keep Sunday request free. */
  CANNOT_AFFORD: "cannot_afford",
  /** Patient chooses to contribute the Sunday fee via JazzCash. */
  PAY_FEE: "pay_fee",
} as const;

export type SundayAffordabilityChoice =
  (typeof SundayAffordabilityChoices)[keyof typeof SundayAffordabilityChoices];

export const SUNDAY_CONSULT_CONFIG = {
  timezone: "Asia/Karachi",
  dayOfWeek: 0,
  defaultSlotDurationMins: 10,
  defaultMaxSlots: 20,
  holdDurationMs: 5 * 60 * 1000,
  earlyAccessHours: 24,
  noShowBanThreshold: 3,
  noShowBanWeeks: 4,
  bookingOpensDaysBefore: 7,
  /** Target window: connect an available doctor after the patient requests */
  matchWithinMinutes: 60,
  /**
   * Optional contribution when the patient can afford a small fee
   * (same JazzCash transfer flow as paid doctor booking).
   */
  contributionFeePkr: 800,
  /** Unpaid Sunday contribution checkout expires after this */
  paymentHoldDurationMs: 15 * 60 * 1000,
} as const;
