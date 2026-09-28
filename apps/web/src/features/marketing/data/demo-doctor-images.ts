/** Temporary demo portraits — replace with real uploads later. */
export const DEMO_DOCTOR_IMAGES = {
  "Dr. Ayesha Khan": "/doctors/ayesha-khan.jpg",
  "Dr. Hassan Raza": "/doctors/hassan-raza.webp",
  "Dr. Sara Ahmed": "/doctors/sara-ahmed.jpg",
  "Dr. Omar Siddiqui": "/doctors/omar-siddiqui.jpg",
  "Dr. Fatima Malik": "/doctors/fatima-malik.jpg",
  "Dr. Usman Ali": "/doctors/usman-ali.jpg",
} as const;

export type DemoDoctorImageName = keyof typeof DEMO_DOCTOR_IMAGES;

export function getDemoDoctorImage(name: string): string | undefined {
  return DEMO_DOCTOR_IMAGES[name as DemoDoctorImageName];
}

/** Prefer stored avatar; fall back to demo portrait for marketing / Sunday listings. */
export function resolveDoctorPortrait(
  name: string,
  avatarUrl?: string | null,
): string | undefined {
  return avatarUrl ?? getDemoDoctorImage(name);
}
