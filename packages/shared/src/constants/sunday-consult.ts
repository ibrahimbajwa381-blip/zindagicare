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
} as const;
