export const VIDEO_CONSULT_CONFIG = {
  /** Patients and doctors may join this many minutes before scheduled start */
  joinEarlyMinutes: 10,
  /** Grace period after scheduled end to join */
  joinLateMinutes: 15,
  defaultTimezone: "Asia/Karachi",
} as const;
