/**
 * Doctor accountability rules — ensures doctors actually show up for online/Sunday
 * consultations they have accepted.
 *
 * Within a single calendar month (Asia/Karachi):
 *  - `warningThreshold` missed consults  → formal warning to the doctor.
 *  - `removalThreshold` missed consults   → automatic removal (restriction) from the platform.
 *
 * A "miss" = an online or Sunday consult whose scheduled window has fully passed
 * (plus `graceMinutesAfterEnd`) while it is still confirmed/in-progress AND the doctor
 * never joined the video session.
 */
export const DOCTOR_ACCOUNTABILITY_CONFIG = {
  timezone: "Asia/Karachi",
  /** Minutes after `scheduledEnd` before an un-attended consult counts as a doctor miss. */
  graceMinutesAfterEnd: 15,
  /** Misses in one calendar month that trigger a formal warning. */
  warningThreshold: 3,
  /** Misses in one calendar month that trigger automatic removal from the platform. */
  removalThreshold: 5,
} as const;

export type DoctorMissReason = "doctor_no_join";
