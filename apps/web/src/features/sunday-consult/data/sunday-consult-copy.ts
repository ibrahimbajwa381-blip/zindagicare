import { SUNDAY_CONSULT_CONFIG } from "@zindagi/shared";

export const sundayConsultCopy = {
  shortName: "Sunday Free Consult",
  tagline: "Free 10-minute video consult with PMDC-verified doctors — every Sunday.",
  priceLabel: "Rs. 0",
  durationLabel: `${SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins} minutes`,
  modality: "Secure video call on ZindagiCare",
  rules: [
    "Completely free — no consultation fee on Sundays.",
    `One free slot per doctor per patient each Sunday (${SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins} min).`,
    "Booking opens 7 days before the upcoming Sunday (Pakistan time).",
    "Returning patients may get 24-hour early access to book first.",
    "Join from your phone or laptop at the booked time — no clinic visit needed.",
  ],
  steps: [
    {
      title: "Pick a doctor",
      description: "Choose a PMDC-verified specialist offering Sunday slots in Lahore.",
    },
    {
      title: "Select a time",
      description: "Pick an open 10-minute slot on the upcoming Sunday.",
    },
    {
      title: "Join your video call",
      description: "Log in at your slot time and speak with the doctor online.",
    },
  ],
} as const;
