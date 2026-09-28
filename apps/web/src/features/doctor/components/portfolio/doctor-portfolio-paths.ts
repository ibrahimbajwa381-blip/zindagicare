import type { DoctorPortfolioSectionId } from "@/lib/doctors/portfolio";

export const DOCTOR_PORTFOLIO_PATH = "/doctor/portfolio";
export const DOCTOR_PROFILE_EDIT_PATH = "/doctor/profile/edit";

/** Where each checklist item is edited — photo and clinics live on the profile edit page. */
export function doctorPortfolioItemHref(id: DoctorPortfolioSectionId): string {
  return id === "photo" || id === "clinics"
    ? DOCTOR_PROFILE_EDIT_PATH
    : `${DOCTOR_PORTFOLIO_PATH}#portfolio-${id}`;
}
