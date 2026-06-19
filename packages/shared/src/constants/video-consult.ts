export const VIDEO_CONSULT_CONFIG = {
  /** Patients and doctors may join this many minutes before scheduled start */
  joinEarlyMinutes: 5,
  /** Grace period after scheduled end to join */
  joinLateMinutes: 5,
  defaultTimezone: "Asia/Karachi",
} as const;
