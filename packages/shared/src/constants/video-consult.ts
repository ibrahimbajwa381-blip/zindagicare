export const VIDEO_CONSULT_CONFIG = {
  /**
   * Patients and doctors may join this many minutes before scheduled start.
   * The scheduled time is a recommendation, not a hard gate — either side can
   * start the call whenever they've agreed, so this window is kept wide.
   */
  joinEarlyMinutes: 720,
  /** Grace period after scheduled end to join, for the same reason as above */
  joinLateMinutes: 4320,
  defaultTimezone: "Asia/Karachi",
} as const;
